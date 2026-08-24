import fs from 'fs';
import path from 'path';
import url from 'url';

const rootDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(rootDir, 'src', 'frontend', 'style', 'tailwind.input.css');
const outputPath = path.join(rootDir, '.codex', 'tailwind.composed.css');
const seen = new Set();

function compose(filePath) {
    const normalizedPath = path.resolve(filePath);
    if (seen.has(normalizedPath)) return '';
    seen.add(normalizedPath);

    const dir = path.dirname(normalizedPath);
    const content = fs.readFileSync(normalizedPath, 'utf8');

    return content.replace(/^@import\s+['"]([^'"]+)['"];\s*$/gm, (full, importTarget) => {
        if (/^(https?:)?\/\//.test(importTarget) || !importTarget.startsWith('.')) {
            return full;
        }

        const importedPath = path.resolve(dir, importTarget);
        if (!fs.existsSync(importedPath)) {
            throw new Error(`CSS import not found: ${importTarget} from ${normalizedPath}`);
        }

        const relative = path.relative(rootDir, importedPath).replace(/\\/g, '/');
        return `/* begin ${relative} */\n${compose(importedPath)}\n/* end ${relative} */`;
    });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, compose(inputPath), 'utf8');
