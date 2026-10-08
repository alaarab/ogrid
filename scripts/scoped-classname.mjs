import { readdirSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Compact, deterministic CSS-module names. The public --ogrid-* tokens and
// data attributes stay readable; module classes are private to each kit.
export function scopedClassName(kit, rootUrl) {
  const root = fileURLToPath(rootUrl);
  const files = readdirSync(root, { recursive: true }).filter(file => file.endsWith('.module.scss')).sort();
  const modules = new Map();
  return (local, file) => {
    const name = relative(root, file);
    if (!modules.has(name)) modules.set(name, new Map());
    const classes = modules.get(name);
    if (!classes.has(local)) classes.set(local, classes.size);
    const scope = files.indexOf(name);
    if (scope < 0) throw new Error(`Unknown CSS module: ${name}`);
    if (scope >= 36) throw new Error(`CSS module exceeds its module namespace: ${name}`);
    return `${kit}${scope.toString(36)}${classes.get(local).toString(36)}`;
  };
}

// The module's class names already have a dense suffix. Store each local name
// once instead of repeating that suffix in hundreds of JS string literals.
// This changes only the generated representation; the exported map is identical.
export function compactModules(transform) {
  return async (...args) => {
    const result = await transform(...args);
    const entries = Object.entries(JSON.parse(result.pluginData.exports));
    const prefix = entries[0]?.[1].slice(0, 2);
    if (entries.length && entries.every(([, value], index) => value === prefix + index.toString(36))) {
      const names = JSON.stringify(entries.map(([name]) => name).join(' '));
      result.pluginData.exports = `Object.fromEntries(${names}.split(' ').map((name,index)=>[name,${JSON.stringify(prefix)}+index.toString(36)]))`;
    }
    return result;
  };
}
