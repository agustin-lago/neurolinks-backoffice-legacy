import { Builder, By, until, WebDriver, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { LoginAdminSelenium } from './loginAdmin-Selenium.js';
import * as fs from 'fs';
import * as path from 'path';
import { ProxyManager } from '../../../utils/proxyManager.js';

/**
 * Servicio para procesar retiros de saldo/fichas de un usuario en Cas-EPC utilizando Selenium.
 * 
 * @param username Nombre de usuario del cual retirar.
 * @param amount Monto a retirar.
 * @param driver Instancia existente de WebDriver (opcional). Si no se provee, se creará una nueva y se iniciará sesión.
 */
export async function withdrawalUser(
    username: string,
    amount: number,
    driver?: WebDriver
): Promise<boolean> {
    console.log(`[Cas-EPC] Iniciando retiro de saldo de ${amount} para: ${username}...`);

    let localDriver: WebDriver | undefined = driver;
    const shouldQuit = true; 
    let hasClickedSubmit = false;

    // Si se pasa un driver activo, ejecutamos directamente sin reintentos (sesión continua)
    if (localDriver) {
        try {
            return await executeWithdrawal(localDriver, username, amount, shouldQuit, () => { hasClickedSubmit = true; });
        } catch (err: any) {
            console.error("❌ [Cas-EPC] Error en retiro con driver existente:", err.message);
            return false;
        }
    }

    // Si no se pasa un driver, hacemos la lógica con reintentos y soporte de proxy
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[Cas-EPC] Intento ${attempt}/${maxAttempts} para retiro (usuario: ${username})...`);
        hasClickedSubmit = false;

        const options = new chrome.Options();
        if (process.env.SELENIUM_HEADLESS !== 'false') {
            options.addArguments('--headless=new');
        }
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');
        options.addArguments('--window-size=1920,1080');

        // Apply proxy if configured
        const proxySession = await ProxyManager.getProxySession('cas-epc');
        if (proxySession) {
            console.log(`🔌 [Cas-EPC] Aplicando proxy a Chrome para retiro (Intento ${attempt}): ${proxySession.proxyUrl}`);
            options.addArguments(`--proxy-server=${proxySession.proxyUrl}`);
        }

        localDriver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        if (proxySession) {
            (localDriver as any)._proxyCleanup = proxySession.cleanup;
        }

        try {
            const authenticator = new LoginAdminSelenium(localDriver);
            const adminUser = process.env.CASEPC_USER || 'testercrm2';
            const adminPass = process.env.CASEPC_PASS || 'asghs56VGS$AS';

            const logged = await authenticator.login(adminUser, adminPass);
            if (!logged) {
                throw new Error("Fallo en la autenticación del administrador.");
            }

            const success = await executeWithdrawal(localDriver, username, amount, shouldQuit, () => { hasClickedSubmit = true; });
            if (success) {
                return true;
            } else {
                throw new Error("La ejecución de retiro retornó falso.");
            }
        } catch (error: any) {
            console.error(`❌ [Cas-EPC] Error en intento ${attempt} de retiro:`, error.message || error);
            if (proxySession && proxySession.rawProxy) {
                ProxyManager.markProxyFailed(proxySession.rawProxy);
            }
            
            if (localDriver) {
                try {
                    const screenshot = await localDriver.takeScreenshot();
                    const screenshotPath = path.join(process.cwd(), 'withdrawal_failure_casepc.png');
                    fs.writeFileSync(screenshotPath, screenshot, 'base64');
                } catch (e) {
                    // Ignorar error de captura de pantalla
                }
                try {
                    await localDriver.quit();
                    if ((localDriver as any)._proxyCleanup) await (localDriver as any)._proxyCleanup();
                } catch (e) {
                    // Ignorar error al limpiar driver
                }
            }

            // Si ya se presionó el botón de submit, no reintentamos para evitar duplicación del retiro
            if (hasClickedSubmit) {
                console.warn("⚠️ [Cas-EPC] Se aborta el reintento para evitar duplicación de retiro porque el formulario ya fue enviado.");
                return false;
            }

            if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
        }
    }

    return false;
}

/**
 * Función interna que contiene la secuencia de navegación y ejecución del retiro
 */
async function executeWithdrawal(
    localDriver: WebDriver,
    username: string,
    amount: number,
    shouldQuit: boolean,
    onSubmitSent: () => void
): Promise<boolean> {
    // 1. Asegurarse de estar en la URL: https://admin.epcbet.cc/index.php
    const usersListUrl = "https://admin.epcbet.cc/index.php";
    const currentUrl = await localDriver.getCurrentUrl();
    if (!currentUrl.includes('/index.php')) {
        console.log(`[Cas-EPC] Navegando a ${usersListUrl}...`);
        await localDriver.get(usersListUrl);
        await localDriver.wait(until.urlContains('/index.php'), 10000);
    }

    // Detectar y cambiar contexto al iframe si está presente en la página
    const iframes = await localDriver.findElements(By.tagName("iframe"));
    console.log(`[Cas-EPC] Cantidad de iframes en la página: ${iframes.length}`);
    if (iframes.length > 0) {
        console.log("[Cas-EPC] Cambiando contexto al primer iframe (index 0)...");
        await localDriver.switchTo().frame(0);
    }

    // Esperar a que la página cargue y estabilice su grid inicial antes de buscar
    console.log("[Cas-EPC] Esperando a que el grid de usuarios se estabilice...");
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Hacer click en el botón "Mostrar" para forzar la recarga/actualización de la base de datos de usuarios
    try {
        console.log("[Cas-EPC] Ampliando el rango de fechas en 'from-date'...");
        const fromDateInput = await localDriver.findElement(By.id("from-date"));
        await localDriver.executeScript("arguments[0].value = '01.07.2026';", fromDateInput);
    } catch (e: any) {
        // Ignorar si no se pudo cambiar el input
    }

    try {
        console.log("[Cas-EPC] Haciendo click en Mostrar para actualizar la lista...");
        const mostrarBtn = await localDriver.findElement(By.xpath("//button[contains(text(), 'Mostrar')]"));
        await mostrarBtn.click();
        await new Promise(resolve => setTimeout(resolve, 4500)); // Esperar a que la recarga de datos termine
    } catch (e) {
        // Ignorar si el botón Mostrar no se puede clickear
    }

    // 2. Ingresar usuario en el campo de búsqueda
    const searchInputXPath = "//*[@id=\"bets_find_user\"]";
    console.log(`[Cas-EPC] Escribiendo usuario a buscar: ${username}...`);
    const searchInput = await localDriver.wait(
        until.elementLocated(By.xpath(searchInputXPath)),
        10000
    );
    await localDriver.wait(until.elementIsVisible(searchInput), 5000);
    await searchInput.clear();
    await searchInput.sendKeys(username);

    // 3. Clic en el botón Buscar
    console.log("[Cas-EPC] Haciendo click en el botón Buscar...");
    try {
        const searchBtn = await localDriver.findElement(By.xpath("//button[contains(text(), 'Buscar')] | //input[@value='Buscar'] | //button[@type='submit']"));
        await localDriver.executeScript("arguments[0].click();", searchBtn);
    } catch (e) {
        await searchInput.sendKeys(Key.ENTER);
    }

    // Esperar a que carguen los resultados
    await new Promise(resolve => setTimeout(resolve, 2500));

    // 4. Ingresar el monto en el input de depósito/retiro de la fila correspondiente
    const amountInputXPath = "/html/body/div[7]/div[2]/div/div[2]/div[2]/div[3]/div[2]/div[2]/table/tbody/tr[1]/td[5]/div/form/input";
    const amountInput = await localDriver.wait(
        until.elementLocated(By.xpath(amountInputXPath)),
        10000
    );
    await amountInput.clear();
    await amountInput.sendKeys(amount.toString());

    // 5. Clic en el botón de retiro (button[2])
    const submitWithdrawalBtnXPath = "/html/body/div[7]/div[2]/div/div[2]/div[2]/div[3]/div[2]/div[2]/table/tbody/tr[1]/td[5]/div/form/button[2]";
    const submitWithdrawalBtn = await localDriver.findElement(By.xpath(submitWithdrawalBtnXPath));
    
    // Ejecutar callback para marcar el inicio del submit
    onSubmitSent();
    await submitWithdrawalBtn.click();

    // Esperar a que se procese la operación y confirmar que no haya errores
    console.log("[Cas-EPC] Enviando retiro y esperando confirmación...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Buscar cartel de error en pantalla si lo hubiera
    const errorElements = await localDriver.findElements(By.xpath(
        "//*[contains(@class, 'swal') or contains(@class, 'modal') or contains(@class, 'alert') or contains(@class, 'toast') or contains(@class, 'popup') or contains(@class, 'notification') or contains(@class, 'dialog')]" +
        "//*[contains(text(), 'Error') or contains(text(), 'error') or contains(text(), 'insuficiente') or contains(text(), 'inválido') or contains(text(), 'no tiene')]"
    ));
    if (errorElements.length > 0) {
        for (const el of errorElements) {
            try {
                if (await el.isDisplayed()) {
                    const text = await el.getText();
                    if (text && text.trim() !== '') {
                        console.error(`❌ [Cas-EPC] Error al realizar retiro: "${text}"`);
                        
                        if (shouldQuit) {
                            await localDriver.quit();
                        }
                        return false;
                    }
                }
            } catch (e) {
                // Elemento obsoleto o inexistente
            }
        }
    }

    console.log(`🎉 [Cas-EPC] Retiro completado con éxito para ${username}.`);
    
    if (shouldQuit) {
        await localDriver.quit();
        console.log("[Cas-EPC] Navegador cerrado correctamente.");
    }
    return true;
}
