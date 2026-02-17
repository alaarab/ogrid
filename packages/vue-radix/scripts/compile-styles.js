/**
 * Compiles all .module.scss files to .module.css and rewrites dist JS imports.
 */
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DIST_ESM = path.join(__dirname, '..', 'dist', 'esm');

function* walkDir(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (e.isDirectory()) {
      yield* walkDir(full, base);
    } else if (e.isFile() && e.name.endsWith('.module.scss')) {
      yield { full, rel };
    }
  }
}

for (const { full, rel } of walkDir(SRC_DIR)) {
  const outRel = rel.replace(/\.scss$/, '.css');
  const outPath = path.join(DIST_ESM, outRel);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const result = sass.compile(full);
  fs.writeFileSync(outPath, result.css, 'utf8');
  console.log('Compiled:', rel, '→', outRel);
}

function* walkJs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkJs(full);
    else if (e.isFile() && e.name.endsWith('.js')) yield full;
  }
}

for (const jsPath of walkJs(DIST_ESM)) {
  let content = fs.readFileSync(jsPath, 'utf8');
  if (content.includes('.module.scss')) {
    content = content.replace(/\.module\.scss/g, '.module.css');
    fs.writeFileSync(jsPath, content, 'utf8');
    console.log('Rewrote imports:', path.relative(DIST_ESM, jsPath));
  }
}

// ---------------------------------------------------------------------------
// Restore CSS imports that Vite strips (replaces with `/* empty css */`)
// For each .vue.js file, if a sibling .css file exists, inject the import.
// ---------------------------------------------------------------------------

let restored = 0;
for (const jsPath of walkJs(DIST_ESM)) {
  let content = fs.readFileSync(jsPath, 'utf8');
  if (!content.includes('/* empty css')) continue;

  const dir = path.dirname(jsPath);
  const baseName = path.basename(jsPath, '.js'); // e.g. "DataGridTable.vue"

  // Derive the CSS filename: DataGridTable.vue.js → DataGridTable.css
  const cssName = baseName.replace(/\.vue$/, '') + '.css';
  const cssPath = path.join(dir, cssName);

  if (fs.existsSync(cssPath)) {
    content = content.replace(
      /\/\* empty css\s*\*\//g,
      `import './${cssName}';`
    );
    fs.writeFileSync(jsPath, content, 'utf8');
    restored++;
    console.log('Restored CSS import:', path.relative(DIST_ESM, jsPath), '→', cssName);
  }
}

if (restored > 0) {
  console.log(`Restored ${restored} CSS import(s).`);
}

console.log('Styles compiled and dist JS imports updated.');
