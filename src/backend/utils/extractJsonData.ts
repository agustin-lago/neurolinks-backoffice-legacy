/**
 * Extrae datos de un resumen en formato texto plano, devolviendo un objeto genérico
 * con todas las claves y valores detectados (clave: valor) en cada línea.
 */
export type GenericResumenData = Record<string, string>;

const extraerDatosResumen = (resumen: string): GenericResumenData => {
    const data: GenericResumenData = {};
    const lines = resumen.split(/\r?\n/);

    const cleanValue = (val: string): string => {
        let cleaned = val.trim();
        let changing = true;
        while (changing) {
            const len = cleaned.length;
            if (len < 2) {
                changing = false;
                break;
            }
            const first = cleaned[0];
            const last = cleaned[len - 1];
            if ((first === "'" && last === "'") ||
                (first === '"' && last === '"') ||
                (first === '`' && last === '`') ||
                (first === '´' && last === '´') ||
                (first === '’' && last === '’') ||
                (first === '‘' && last === '‘') ||
                (first === '[' && last === ']') ||
                (first === '{' && last === '}') ||
                (first === '(' && last === ')')) {
                cleaned = cleaned.slice(1, -1).trim();
                continue;
            }
            if (["'", '"', '`', '´', '’', '‘', '[', ']', '{', '}', '(', ')'].includes(first)) {
                cleaned = cleaned.slice(1).trim();
                continue;
            }
            if (["'", '"', '`', '´', '’', '‘', '[', ']', '{', '}', '(', ')'].includes(last)) {
                cleaned = cleaned.slice(0, -1).trim();
                continue;
            }
            changing = false;
        }
        return cleaned;
    };

    let currentKey: string | null = null;

    for (const line of lines) {
        // Regex mejorado para capturar "Clave: Valor" ignorando prefijos de markdown como -, *, # o números
        const match = line.match(/^\s*(?:[-*#\s\d.]*)\s*([\wÁÉÍÓÚáéíóúñÑ ._-]+)\s*[:=]\s*(.+)$/);
        if (match) {
            const key = match[1].trim().replace(/^[-–—\s]+/, '');
            const value = cleanValue(match[2]);
            currentKey = key;
            data[key] = value;
            const lowerKey = key.toLowerCase().replace(/[\s_-]+/g, '');
            // Si la clave es 'Tipo', 'Type' o similar, normalizar a 'tipo'
            if (lowerKey === 'tipo' || lowerKey === 'type') {
                data['tipo'] = value;
            }
            // Si la clave es 'Tag', 'Tags', 'Etiqueta', 'Etiquetas' o similar, normalizar a 'tag'
            if (lowerKey === 'tag' || lowerKey === 'tags' || lowerKey === 'etiqueta' || lowerKey === 'etiquetas') {
                data['tag'] = value;
            }
            // Normalizar seguimientos (Seguimiento1, Seguimiento 1, Seguimiento_1, etc.)
            if (lowerKey === 'seguimiento1' || lowerKey === 'seguimiento' || lowerKey === 'followup1') {
                data['seguimiento1'] = value;
            }
            if (lowerKey === 'seguimiento2' || lowerKey === 'followup2') {
                data['seguimiento2'] = value;
            }
            if (lowerKey === 'seguimiento3' || lowerKey === 'followup3') {
                data['seguimiento3'] = value;
            }
        } else if (currentKey && line.trim() && !line.trim().startsWith('---') && !line.trim().startsWith('📝')) {
            // Continuación multilínea del valor anterior si no es un encabezado o separador
            const appendVal = line.trim();
            data[currentKey] = (data[currentKey] ? data[currentKey] + '\n' : '') + appendVal;
            const lowerKey = currentKey.toLowerCase().replace(/[\s_-]+/g, '');
            if (lowerKey === 'seguimiento1' || lowerKey === 'seguimiento' || lowerKey === 'followup1') {
                data['seguimiento1'] = data[currentKey];
            }
            if (lowerKey === 'seguimiento2' || lowerKey === 'followup2') {
                data['seguimiento2'] = data[currentKey];
            }
            if (lowerKey === 'seguimiento3' || lowerKey === 'followup3') {
                data['seguimiento3'] = data[currentKey];
            }
        }
    }
    console.log('[extractJsonData] data extraído:', data);
    return data;
};

export { extraerDatosResumen };