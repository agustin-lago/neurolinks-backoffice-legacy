import { updateAllSheets } from "./updateSheet";
import { updateAllDocs } from "./updateDoc";

export interface SyncResult {
    success: boolean;
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
    errors: string[];
}

export interface UpdateMainResult {
    success: boolean;
    sheets: SyncResult & { tables?: string[] };
    docs: SyncResult;
    errors: string[];
}

const emptySyncResult = (): SyncResult => ({
    success: true,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: []
});

/**
 * Carga los datos de todas las hojas y documentos principales usando las funciones unificadas.
 */
export const updateMain = async (projectId?: string, serviceId?: string): Promise<UpdateMainResult> => {
    try {
        const sheets = await updateAllSheets({ projectId, serviceId });
        const docs = await updateAllDocs(projectId, serviceId);
        const errors = [...(sheets.errors || []), ...(docs.errors || [])];
        const success = sheets.success && docs.success && errors.length === 0;

        if (success) {
            console.log("Todas las hojas y documentos procesados correctamente.");
        } else {
            console.warn("[GoogleSync] Sincronizacion finalizada con errores parciales.", errors);
        }

        return { success, sheets, docs, errors };
    } catch (error: any) {
        const message = error?.message || String(error);
        console.error("Error al actualizar datos:", message);
        return {
            success: false,
            sheets: { ...emptySyncResult(), success: false, failed: 1, errors: [message], tables: [] },
            docs: { ...emptySyncResult(), success: false },
            errors: [message]
        };
    }
};
