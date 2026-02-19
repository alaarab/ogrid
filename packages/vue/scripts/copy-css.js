#!/usr/bin/env node
/**
 * Copy CSS files from src/styles to dist directory after TypeScript build.
 * These shared styles are consumed by vue-vuetify and vue-primevue via @import.
 */
const fs = require('fs');
const path = require('path');

const srcStylesDir = path.join(__dirname, '../src/styles');
const distStylesDir = path.join(__dirname, '../dist/esm/styles');

if (!fs.existsSync(srcStylesDir)) {
  console.log('No styles directory found, skipping CSS copy.');
  process.exit(0);
}

if (!fs.existsSync(distStylesDir)) {
  fs.mkdirSync(distStylesDir, { recursive: true });
}

const entries = fs.readdirSync(srcStylesDir, { withFileTypes: true });
for (const entry of entries) {
  if (entry.isFile() && entry.name.endsWith('.css')) {
    const src = path.join(srcStylesDir, entry.name);
    const dest = path.join(distStylesDir, entry.name);
    fs.copyFileSync(src, dest);
    console.log(`Copied: styles/${entry.name}`);
  }
}

console.log('CSS files copied successfully.');
