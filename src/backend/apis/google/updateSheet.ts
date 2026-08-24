import fs from "fs";
import { google } from "googleapis";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import * as glob from "glob";
import { createClient } from "@supabase/supabase-js";

import { vault } from "../../db/vault";
import { autoUpdateBotAbilities } from "../openai/toolGenerator";
import { HistoryHandler } from "../../db/historyHandler.js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || vault.supabaseUrl;
const supabaseKey = process.env.SUPABASE_KEY || vault.supabaseKey;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

let currentFileId: string | null = null;

export interface SyncResult {
    success: boolean;
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
    errors: string[];
}

interface SheetProcessResult {
    success: boolean;
    skipped?: boolean;
    tableName?: string;
    error?: string;
}

const createSheetSyncResult = (): SyncResult & { tables: string[] } => ({
    success: true,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    tables: []
});


import { createGoogleAuth } from "./googleAuth";
import { getOpenAIBaseUrl } from "../openai/openaiHelper";

// Se eliminaron las inicializaciones estáticas para evitar errores de autenticación antes de cargar settings


const getSheetsClient = () => {
    const auth = createGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    return google.sheets({ version: "v4", auth });
};

const getOpenAIClient = async (projectId?: string, serviceId?: string) => {
    let key = projectId ? await HistoryHandler.getConfig('OPENAI_API_KEY', projectId, serviceId) : null;
    if (!key) key = process.env.OPENAI_API_KEY || null;
    const baseURL = getOpenAIBaseUrl();
    return key ? new OpenAI({ 
        apiKey: key,
        ...(baseURL ? { baseURL } : {})
    }) : null;
};


// Funcion principal para procesar todos los sheets
export async function updateAllSheets(options: { forceRecreate?: boolean; projectId?: string; serviceId?: string; skipDb?: boolean } = {}): Promise<SyncResult & { tables: string[] }> {
    const result = createSheetSyncResult();
    if (!supabase) {
        const error = "[GoogleSheets] Supabase no disponible para actualizar sheets.";
        console.log(error);
        return { ...result, success: false, failed: 1, errors: [error] };
    }

    try {
        const currentProjectId = options.projectId || process.env.PROJECT_ID || process.env.RAILWAY_PROJECT_ID || HistoryHandler.PROJECT_IDENTIFIER;
        const currentServiceId = options.serviceId || process.env.SERVICE_ID || process.env.RAILWAY_SERVICE_ID || HistoryHandler.SERVICE_IDENTIFIER;

        let query = supabase.from("settings").select("project_id, service_id, value").eq("key", "SHEET_ID_UPDATE");

        if (currentProjectId && !['default_project', 'default', 'test-hugo-local', 'local-dev'].includes(currentProjectId)) {
            console.log(`[GoogleSheets] Sincronizando sheets para el proyecto activo: ${currentProjectId}`);
            query = query.eq("project_id", currentProjectId);

            if (currentServiceId && !['default_service', 'generic', 'null'].includes(currentServiceId)) {
                query = query.eq("service_id", currentServiceId);
            }
        }

        const { data: sheetSettings, error } = await query;
        if (error) {
            return { ...result, success: false, failed: 1, errors: [`[GoogleSheets] Error consultando settings: ${error.message}`] };
        }

        const sheetTasks: Array<{ projectId: string; serviceId: string | null; sheetId: string }> = [];

        if (sheetSettings && sheetSettings.length > 0) {
            for (const s of sheetSettings) {
                const ids = (s.value || "").split(",").map((id: string) => id.trim()).filter(Boolean);
                for (const sheetId of ids) {
                    if (sheetId && sheetId !== "default" && sheetId !== "PENDING" && !sheetId.startsWith("default_")) {
                        sheetTasks.push({ projectId: s.project_id, serviceId: s.service_id, sheetId });
                    }
                }
            }
        }

        const envSheet = process.env.SHEET_ID_UPDATE || "";
        if (envSheet && envSheet !== "default" && envSheet !== "PENDING") {
            const ids = envSheet.split(",").map((id: string) => id.trim()).filter(Boolean);
            for (const sheetId of ids) {
                if (sheetId && !sheetTasks.some(t => t.sheetId === sheetId)) {
                    sheetTasks.push({ projectId: currentProjectId, serviceId: currentServiceId || null, sheetId });
                }
            }
        }

        const processedSheets: Array<{ task: { projectId: string; serviceId: string | null; sheetId: string }; tableName: string }> = [];

        for (const task of sheetTasks) {
            result.processed++;
            const sheetResult = await processSheetById(task.sheetId, task.projectId, task.serviceId || undefined, options);
            if (sheetResult.success && sheetResult.skipped) {
                result.skipped++;
                continue;
            }
            if (sheetResult.success && sheetResult.tableName) {
                result.succeeded++;
                result.tables.push(sheetResult.tableName);
                processedSheets.push({ task, tableName: sheetResult.tableName });
                continue;
            }

            result.failed++;
            result.errors.push(sheetResult.error || `[GoogleSheets] No se pudo procesar sheet ${task.sheetId}`);
        }

        if (processedSheets.length > 0) {
            const tasksByProject = new Map<string, { serviceId?: string, tables: string[] }>();
            for (const processed of processedSheets) {
                const key = `${processed.task.projectId}:${processed.task.serviceId || 'default'}`;
                if (!tasksByProject.has(key)) {
                    tasksByProject.set(key, { serviceId: processed.task.serviceId || undefined, tables: [] });
                }
                tasksByProject.get(key)!.tables.push(processed.tableName);
            }

            for (const [projKey, val] of tasksByProject.entries()) {
                const [projId] = projKey.split(':');
                try {
                    await autoUpdateBotAbilities(val.tables, projId, val.serviceId);
                } catch (err: any) {
                    result.failed++;
                    result.errors.push(`[GoogleSheets] Error actualizando herramientas para ${projId}: ${err?.message || err}`);
                }
            }
        }

        result.success = result.failed === 0;
        return result;
    } catch (err: any) {
        const message = err?.message || String(err);
        console.error("[GoogleSheets] Error en updateAllSheets:", message);
        return { ...result, success: false, failed: result.failed + 1, errors: [...result.errors, message] };
    }
}
// Helper function to sanitize valid table name with project prefix
const sanitizeTableName = (name: string, _projectId?: string) => {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
};

// Helper function to sanitize column names
const sanitizeColumnName = (name: string) => {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    let finalName = sanitized;
    if (finalName === 'id') finalName = 'id_';
    else if (finalName === 'created_at') finalName = 'created_at_';
    return finalName.substring(0, 63).replace(/_+$/, '');
};

async function ensureTableExists(tableName: string, headers: string[]) {
    if (!supabase) return;
    
    // Check if table exists by selecting 1 row
    const check = await supabase.from(tableName).select('*').limit(1);
    
    if (check.error && (check.error.code === '42P01' || check.error.code === 'PGRST205')) { // undefined_table or cache miss (table likely missing)
        console.log(`⚠️ La tabla '${tableName}' no existe. Intentando crearla via RPC...`);
        
        // Construct Create Table SQL
        const columnsSql = headers.map(h => `${sanitizeColumnName(h)} TEXT`).join(', ');
        const createSql = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
                ${columnsSql}, 
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            GRANT ALL ON TABLE ${tableName} TO service_role;
            GRANT ALL ON TABLE ${tableName} TO authenticated;
            GRANT SELECT ON TABLE ${tableName} TO anon;
            NOTIFY pgrst, 'reload schema';
        `;
        
        const res = await supabase.rpc('exec_sql', { query: createSql });
        
        if (res.error) {
            console.error(`❌ Error creando tabla '${tableName}':`, res.error);
            return false;
        }
        console.log(`✅ Tabla '${tableName}' creada con éxito.`);
        
        // Wait 1 second and check again to avoid immediate cache sync issues
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        for (let i = 0; i < 3; i++) {
            const recheck = await supabase.from(tableName).select('*').limit(1);
            if (!recheck.error) {
                console.log(`✅ [Supabase] Confirmada existencia de la tabla '${tableName}' tras ${i+1} intentos.`);
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.warn(`⚠️ La tabla '${tableName}' fue creada pero la API aún no la reconoce. La inserción podría fallar.`);
        return true;
    } else if (check.error) {
        console.error("Error verificando tabla:", check.error);
        return false;
    }
    return true; // Table exists
}

// Procesa un sheet por ID, obtiene el nombre real y ejecuta la lógica
async function processSheetById(SHEET_ID: string, projectId: string, serviceId: string | undefined, options: { forceRecreate?: boolean; skipDb?: boolean } = {}): Promise<SheetProcessResult> {
    const sheets = getSheetsClient();
    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
        const sheetTitle = meta.data.sheets?.[0]?.properties?.title || "Sheet1";
        const SHEET_NAME = sheetTitle;
        const tableName = sanitizeTableName(SHEET_NAME, projectId);
        const TXT_PATH = path.join("temp", `${SHEET_NAME}.json`);

        console.log(`Obteniendo datos de Google Sheets: ${SHEET_ID} (${SHEET_NAME})`);

        const initialRange = `${SHEET_NAME}!A1:ZZ10000`;
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: initialRange });
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.warn("No se encontraron datos en la hoja de calculo.");
            return { success: true, skipped: true };
        }

        let lastRow = rows.length;
        let lastCol = 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.every(cell => (cell === undefined || cell === null || String(cell).trim() === ""))) {
                lastRow = i;
                break;
            }
            if (row.length > lastCol) lastCol = row.length;
        }
        if (lastCol === 0) lastCol = 1;

        const colToLetter = (col: number) => {
            let temp = "";
            let n = col;
            while (n > 0) {
                const rem = (n - 1) % 26;
                temp = String.fromCharCode(65 + rem) + temp;
                n = Math.floor((n - 1) / 26);
            }
            return temp;
        };

        const dynamicRange = `${SHEET_NAME}!A1:${colToLetter(lastCol)}${lastRow}`;
        const fullResponse = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: dynamicRange });
        const fullRows = fullResponse.data.values;
        if (!fullRows || fullRows.length === 0) {
            console.warn("No se encontraron datos en el rango calculado.");
            return { success: true, skipped: true };
        }

        const rawHeaders = fullRows[0].map((h: string) => (h || "").trim());
        const activeColumns = rawHeaders
            .map((h, idx) => ({ original: h, sanitized: sanitizeColumnName(h), idx }))
            .filter(col => col.sanitized.length > 0);

        if (activeColumns.length === 0) {
            console.warn("La primera fila no contiene encabezados validos.");
            return { success: true, skipped: true };
        }

        const formattedData = fullRows.slice(1)
            .filter(row => row && row.length > 0 && row.some(cell => (cell || "").trim() !== ""))
            .map((row) => {
                const obj: Record<string, any> = {};
                activeColumns.forEach(col => {
                    const cellValue = row[col.idx];
                    obj[col.original] = typeof cellValue === "string" ? cellValue.trim() : (cellValue ?? "");
                });
                return obj;
            });

        if (formattedData.length === 0) {
            console.warn("La hoja solo contiene encabezados o filas vacias.");
            return { success: true, skipped: true };
        }

        const dirPath = path.join("temp");
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(TXT_PATH, JSON.stringify(formattedData, null, 2), "utf8");
        console.log(`Datos guardados en archivo de texto: ${TXT_PATH}`);

        if (supabase && !options.skipDb) {
            const headersSanitized = activeColumns.map(col => col.sanitized);

            if (options.forceRecreate) {
                console.log(`Forzando recreacion de tabla '${tableName}' (DROP TABLE)...`);
                const dropRes = await supabase.rpc('exec_sql', { query: `DROP TABLE IF EXISTS ${tableName}` });
                if (dropRes.error) {
                    console.error(`Error al eliminar tabla '${tableName}':`, dropRes.error);
                    return { success: false, tableName, error: dropRes.error.message };
                }
            }

            const tableReady = await ensureTableExists(tableName, headersSanitized);
            if (!tableReady) {
                return { success: false, tableName, error: `No se pudo crear o verificar la tabla ${tableName}` };
            }

            const supabaseData = formattedData.map(row => {
                const newRow: any = {};
                activeColumns.forEach(col => {
                    newRow[col.sanitized] = row[col.original];
                });
                return newRow;
            });

            const truncateRes = await supabase.rpc('exec_sql', { query: `TRUNCATE TABLE ${tableName}` });
            if (truncateRes.error) {
                const { error: delErr } = await supabase.from(tableName).delete().not('id', 'is', null);
                if (delErr) {
                    console.error(`[Supabase] Error limpiando tabla:`, delErr.message);
                    return { success: false, tableName, error: delErr.message };
                }
            } else {
                console.log(`[Supabase] Tabla '${tableName}' truncada correctamente.`);
            }

            const insertRes = await supabase.from(tableName).insert(supabaseData);
            if (insertRes.error) {
                console.error(`Error uploading to Supabase table '${tableName}':`, insertRes.error.message);

                if (insertRes.error.code === '42703' || (insertRes.error.message && insertRes.error.message.toLowerCase().includes('column'))) {
                    console.log(`Detectado conflicto de esquema en '${tableName}'. Recreando tabla...`);
                    const dropRes = await supabase.rpc('exec_sql', { query: `DROP TABLE IF EXISTS ${tableName}` });
                    if (dropRes.error) {
                        console.error(`Error al eliminar tabla '${tableName}' durante la recuperacion:`, dropRes.error);
                        return { success: false, tableName, error: dropRes.error.message };
                    }

                    const tableRecreated = await ensureTableExists(tableName, headersSanitized);
                    if (!tableRecreated) {
                        return { success: false, tableName, error: `No se pudo recrear la tabla ${tableName}` };
                    }

                    const retryRes = await supabase.from(tableName).insert(supabaseData);
                    if (retryRes.error) {
                        console.error(`Error en el reintento de carga para '${tableName}':`, retryRes.error.message);
                        return { success: false, tableName, error: retryRes.error.message };
                    }

                    console.log(`Datos cargados exitosamente tras recrear la tabla '${tableName}'.`);
                } else {
                    return { success: false, tableName, error: insertRes.error.message };
                }
            } else {
                console.log(`Datos cargados exitosamente en Supabase tabla '${tableName}'.`);
            }
        } else if (!options.skipDb) {
            return { success: false, tableName, error: "No se encontraron credenciales de Supabase." };
        }

        const success = await uploadDataToAssistant(TXT_PATH, SHEET_ID, projectId, serviceId);
        if (!success) {
            return { success: false, tableName, error: `Error al enviar los datos del sheet ${SHEET_ID} al vector store.` };
        }

        return { success: true, tableName };
    } catch (error: any) {
        console.error("Error al obtener datos:", error.message);
        return { success: false, error: error?.message || String(error) };
    }
}
// Función para subir datos al vector store de OpenAI
export async function uploadDataToAssistant(filePath: string, stateId: string, projectId?: string, serviceId?: string) {
    const openai = await getOpenAIClient(projectId, serviceId);
    if (!openai) {
        console.warn("⚠️ IA Desactivada: Saltando subida al vector store.");
        return true; // Continuar aunque no haya IA configurada
    }
    try {
        if (currentFileId && stateId === currentFileId) {
            console.log("📂 Utilizando archivo existente con ID:", currentFileId);
            return true;
        }
        await deleteOldFiles(filePath, projectId, serviceId);
        console.log("🚀 Subiendo archivo al vector store...");
        const fileStream = fs.createReadStream(filePath);
        const response = await openai.files.create({
            file: fileStream,
            purpose: "assistants"
        });
        currentFileId = response.id;
        console.log(`📂 Archivo subido con ID: ${currentFileId}`);
        const success = await attachFileToVectorStore(currentFileId, projectId, serviceId);
        if (!success) {
            return false;
        }
        deleteTemporaryFiles(filePath);
        console.log("✅ Datos actualizados en el vector store.");
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
    } catch (error: any) {
        console.error("❌ Error al subir el archivo al vector store:", error.message);
        return false;
    }
}

async function attachFileToVectorStore(fileId: string, projectId?: string, serviceId?: string) {
    let VECTOR_STORE_ID = projectId ? await HistoryHandler.getSetting('VECTOR_STORE_ID', projectId, serviceId) : null;
    if (!VECTOR_STORE_ID) VECTOR_STORE_ID = process.env.VECTOR_STORE_ID || "";
    const openai = await getOpenAIClient(projectId, serviceId);

    if (!openai) return true;
    try {
        if (!VECTOR_STORE_ID || VECTOR_STORE_ID === "vs_" || VECTOR_STORE_ID.trim() === "") {
            console.warn("⚠️ Salteando adjuntar archivo: VECTOR_STORE_ID no definido o inválido.");
            return true;
        }

        console.log(`📡 Adjuntando archivo al vector store: ${fileId}`);
        const response = await openai.vectorStores.fileBatches.createAndPoll(VECTOR_STORE_ID, {
            file_ids: [fileId]
        });
        if (response && response.status === "completed") {
            console.log("✅ Confirmación recibida: Archivo adjuntado correctamente al vector store.");
            return true;
        } else {
            console.warn("⚠️ No se recibió una confirmación clara de OpenAI.");
            return false;
        }
    } catch (error: any) {
        console.error("❌ Error al adjuntar el archivo al vector store:", error.message);
        return false;
    }
}

async function deleteOldFiles(filePath: string, projectId?: string, serviceId?: string) {
    const openai = await getOpenAIClient(projectId, serviceId);
    if (!openai) return;
    try {
        const fileName = path.basename(filePath);
        console.log(`🗑️ Eliminando archivo anterior del vector store relacionado con ${fileName}...`);
        const files = await openai.files.list();
        for (const file of files.data) {
            if (file.filename === fileName) {
                await openai.files.del(file.id);
                console.log(`🗑️ Archivo eliminado: ${file.id}`);
            }
        }
    } catch (error: any) {
        console.error("❌ Error al eliminar archivo anterior del vector store:", error.message);
    }
}

function deleteTemporaryFiles(filePath: string) {
    try {
        const fileName = path.basename(filePath);
        console.log("🗑️ Eliminando archivos temporales...");
        const files = glob.sync(path.join("temp", fileName));
        for (const file of files) {
            fs.unlinkSync(file);
            console.log(`🗑️ Archivo temporal eliminado: ${file}`);
        }
    } catch (error: any) {
        console.error("❌ Error al eliminar archivos temporales:", error.message);
    }
}
