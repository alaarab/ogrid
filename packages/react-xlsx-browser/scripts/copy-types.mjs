// The bundle re-exports @alaarab/ogrid-react-xlsx, which is only a
// devDependency here, so its declarations can't be referenced from a
// published .d.ts. Copy them next to the bundle instead.
import { cpSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..');
cpSync(join(pkgDir, '../react-xlsx/dist/types'), join(pkgDir, 'dist/types'), { recursive: true });
writeFileSync(join(pkgDir, 'dist/ogrid-xlsx.d.ts'), "export * from './types/index.js';\n");
