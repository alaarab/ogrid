#!/usr/bin/env node
/**
 * Copy CSS files to dist directory after TypeScript build
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const distDir = path.join(__dirname, '../dist/esm');

function copyCSS(dir, targetDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(dir, entry.name);
    const relativePath = path.relative(srcDir, srcPath);
    const destPath = path.join(targetDir, relativePath);

    if (entry.isDirectory()) {
      // Skip test directories
      if (entry.name === '__tests__' || entry.name === 'node_modules') {
        continue;
      }
      // Recursively copy CSS from subdirectories
      copyCSS(srcPath, targetDir);
    } else if (entry.name.endsWith('.css')) {
      // Copy CSS file
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${relativePath}`);
    }
  }
}

console.log('Copying CSS files to dist...');
copyCSS(srcDir, distDir);
console.log('CSS files copied successfully.');
