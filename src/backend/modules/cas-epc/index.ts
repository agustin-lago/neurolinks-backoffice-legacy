import { createUserSelenium } from "../../apis/external/Cas-EPC/createUser-Selenium.js";
import { rechargeUserSelenium } from "../../apis/external/Cas-EPC/rechargeUser-Selenium.js";
import { withdrawalUser } from "../../apis/external/Cas-EPC/withdrawalUser-Selunium.js";

export const casEpcModule = {
  key: "cas-epc",
  label: "Cas - EPC",

  tools: {
    // ----------------------------------------------------
    // LOWERCASE WRAPPERS (Para invocación por código)
    // ----------------------------------------------------
    crearJugador: async (args: any, context: any) => casEpcModule.tools.CREAR_JUGADOR(args, context),
    depositar: async (args: any, context: any) => casEpcModule.tools.DEPOSITAR(args, context),
    retirar: async (args: any, context: any) => casEpcModule.tools.RETIRAR(args, context),

    // ----------------------------------------------------
    // CORE TOOLS (Para mapear respuestas del Asistente OpenAI)
    // ----------------------------------------------------
    CREAR_JUGADOR: async (args: any, context: any) => {
      const nombre = args.nombre || args.baseName || args.username || 'jugador';

      console.log(`[casEpcModule] 👤 Invocando CREAR_JUGADOR para: "${nombre}"`);
      
      const res = await createUserSelenium(nombre, false);
      if (res) {
          const chatId = context?.ctx?.from;
          const projectId = context?.projectId;
          if (chatId) {
              try {
                  const { HistoryHandler } = await import("../../db/historyHandler.js");
                  await HistoryHandler.updateContactDetails(chatId, { cuit_dni: res.username }, projectId);
                  console.log(`[casEpcModule] 💾 Guardado usuario ${res.username} en chats.cuit_dni para ${chatId}`);
              } catch (dbErr: any) {
                  console.error(`[casEpcModule] ❌ Error guardando usuario de jugador en BD:`, dbErr.message);
              }
          }
          return `✅ Usuario ${res.username} creado con éxito. Contraseña por defecto: "${res.password}".`;
      }
      return `❌ No se pudo completar la creación del usuario.`;
    },

    DEPOSITAR: async (args: any, context: any) => {
      const username = args.username || args.usuario || args.user;
      const amount = Number(args.monto || args.amount || args.cantidad);

      console.log(`[casEpcModule] 💰 Invocando DEPOSITAR para: "${username}" | monto: ${amount}`);

      if (!username || !amount || isNaN(amount)) {
          return `❌ Parámetros insuficientes. Se requiere 'username' y 'monto'.`;
      }

      const success = await rechargeUserSelenium(username, amount);
      if (success) {
          return `✅ Depósito de $${amount} procesado con éxito para el usuario ${username}.`;
      }
      
      // Si falló el depósito automático, liberar el comprobante en la base de datos
      const paymentId = context?.state?.get?.('pendingPaymentId');
      if (paymentId) {
          const { HistoryHandler } = await import("../../db/historyHandler.js");
          const supabase = HistoryHandler.getSupabase();
          if (supabase) {
              const { error } = await supabase
                  .from("mercadopago_payments_clients")
                  .delete()
                  .eq("id", paymentId);
              if (error) {
                  console.error(`[casEpcModule] ❌ Error al eliminar comprobante fallido ${paymentId} de la BD:`, error);
              } else {
                  console.log(`[casEpcModule] ♻️ Comprobante fallido ${paymentId} liberado en la base de datos para reintento.`);
              }
          }
      }
      
      return `❌ No se pudo procesar el depósito de $${amount} para el usuario ${username}.`;
    },

    RETIRAR: async (args: any, context: any) => {
      const username = args.username || args.usuario || args.user;
      const amount = Number(args.monto || args.amount || args.cantidad);

      console.log(`[casEpcModule] 💸 Invocando RETIRAR para: "${username}" | monto: ${amount}`);

      if (!username || !amount || isNaN(amount)) {
          return `❌ Parámetros insuficientes. Se requiere 'username' y 'monto'.`;
      }

      const success = await withdrawalUser(username, amount);
      if (success) {
          return `✅ Retiro de $${amount} procesado con éxito para el usuario ${username}.`;
      }
      return `❌ No se pudo procesar el retiro de $${amount} para el usuario ${username}.`;
    },

    BUSCAR_CVU: async (args: any, context: any) => {
      console.log(`[casEpcModule] 🏦 Invocando BUSCAR_CVU...`);
      try {
        const { HistoryHandler } = await import("../../db/historyHandler.js");
        const projectId = context?.projectId || HistoryHandler.PROJECT_IDENTIFIER;
        const serviceId = context?.serviceId || process.env.SERVICE_ID || process.env.RAILWAY_SERVICE_ID || HistoryHandler.SERVICE_IDENTIFIER;
        
        // Cargar el listado de CBU/CVU/ALIAS
        const dataStr = await HistoryHandler.getConfig('EPC_CBU_CVU_DATA', projectId, serviceId);
        if (!dataStr) {
          return `❌ No se han configurado cuentas CBU/CVU/ALIAS en el sistema.`;
        }
        
        const list = JSON.parse(dataStr);
        if (!Array.isArray(list) || list.length === 0) {
          return `❌ No se han configurado cuentas CBU/CVU/ALIAS en el sistema.`;
        }
        
        const activeItem = list.find((item: any) => item.active === true);
        if (!activeItem) {
          return `❌ No hay ninguna cuenta CBU/CVU/ALIAS activa en este momento.`;
        }
        
        const label = activeItem.type === 'alias' ? 'Alias' : activeItem.type.toUpperCase();
        return `🏦 Datos de transferencia activos:\n- Tipo: ${activeItem.type.toUpperCase()}\n- ${label}: ${activeItem.number}\n- Titular: ${activeItem.holder || 'N/A'}\n- Banco/Plataforma: ${activeItem.bank || 'N/A'}`;
      } catch (err: any) {
        console.error(`[casEpcModule] ❌ Error en BUSCAR_CVU:`, err.message);
        return `❌ Ocurrió un error al buscar los datos de transferencia.`;
      }
    },

    // ----------------------------------------------------
    // ALIASES Y SINÓNIMOS LEGACY
    // ----------------------------------------------------
    CREAR_USUARIO: async (args: any, context: any) => casEpcModule.tools.CREAR_JUGADOR(args, context),
    RECARGAR: async (args: any, context: any) => casEpcModule.tools.DEPOSITAR(args, context),
    RETIRO: async (args: any, context: any) => casEpcModule.tools.RETIRAR(args, context),
    buscar_cvu: async (args: any, context: any) => casEpcModule.tools.BUSCAR_CVU(args, context),
  },

  // ----------------------------------------------------
  // NATIVE OPENAI TOOLS SCHEMAS
  // ----------------------------------------------------
  openAiTools: [
    {
      "type": "function",
      "function": {
        "name": "BUSCAR_CVU",
        "description": "Obtiene los datos de la cuenta bancaria (CBU, CVU o Alias) activa de la plataforma para recibir transferencias.",
        "parameters": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "CREAR_JUGADOR",
        "description": "Crea una nueva cuenta de jugador en la plataforma Cas - EPC.",
        "parameters": {
          "type": "object",
          "properties": {
            "nombre": {
              "type": "string",
              "description": "Nombre de pila o base del cliente para generar su usuario (ej. lucas)."
            }
          },
          "required": ["nombre"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "DEPOSITAR",
        "description": "Carga/Deposita créditos o saldo en la cuenta de un jugador registrado en la plataforma Cas - EPC.",
        "parameters": {
          "type": "object",
          "properties": {
            "username": {
              "type": "string",
              "description": "Nombre de usuario exacto del jugador (ej. lucash8420)."
            },
            "monto": {
              "type": "number",
              "description": "Monto numérico de créditos a depositar (ej. 500)."
            }
          },
          "required": ["username", "monto"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "RETIRAR",
        "description": "Retira/Debita créditos o saldo de la cuenta de un jugador registrado en la plataforma Cas - EPC.",
        "parameters": {
          "type": "object",
          "properties": {
            "username": {
              "type": "string",
              "description": "Nombre de usuario exacto del jugador (ej. lucash8420)."
            },
            "monto": {
              "type": "number",
              "description": "Monto numérico de créditos a retirar (ej. 300)."
            }
          },
          "required": ["username", "monto"]
        }
      }
    }
  ]
};
