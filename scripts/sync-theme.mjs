#!/usr/bin/env node
/**
 * Sync OGrid theme variables from the canonical SCSS to the Vue and JS
 * plain-CSS counterparts. Run when `_ogrid-theme.scss` changes.
 *
 *   node scripts/sync-theme.mjs            # write Vue + JS files
 *   node scripts/sync-theme.mjs --check    # exit 1 if out of sync (CI gate)
 *
 * Strategy: read the SCSS, drop the SCSS-only header comment block, drop
 * `:global()` wrappers (they're SCSS-modules-only), and emit plain CSS with
 * the same variable declarations and dark-mode rules. The JS variant rewrites
 * `[data-theme="dark"]` to `[data-theme='dark']` to match historical convention.
 *
 * Vue and JS files have additional structural CSS below the variable block.
 * We only replace the variable block (everything from start of file through
 * the closing `}` of the explicit-dark rule); structural rules below are
 * preserved.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const SOURCE = join(repoRoot, "packages/core/src/styles/_ogrid-theme.scss");
const VUE_TARGET = join(repoRoot, "packages/vue/src/styles/ogrid-theme.css");
const JS_TARGET = join(repoRoot, "packages/js/styles/ogrid.css");

const checkMode = process.argv.includes("--check");

const HEADER_VUE = `/* OGrid Vue theme — generated from packages/core/src/styles/_ogrid-theme.scss
 * Run \`node scripts/sync-theme.mjs\` to regenerate. Do not edit by hand.
 *
 * Dark mode activates via:
 *   1. System preference (prefers-color-scheme: dark) unless [data-theme="light"]
 *      or .light is set on root.
 *   2. Explicit attribute: [data-theme="dark"] on any ancestor.
 *   3. Tailwind/shadcn convention: .dark class on any ancestor.
 *
 * To opt OUT of auto-dark: set .light or [data-theme="light"] on :root.
 */

`;

const HEADER_JS = `/* OGrid JS theme — generated from packages/core/src/styles/_ogrid-theme.scss
 * Run \`node scripts/sync-theme.mjs\` to regenerate. Do not edit by hand.
 *
 * Dark mode: prefers-color-scheme + [data-theme='dark'] + .dark class.
 * Opt out of auto-dark with .light or [data-theme='light'] on :root.
 */

`;

/**
 * Strip `:global(X)` wrappers, including ones with nested parens.
 * SCSS modules use `:global()` to opt out of name scoping; plain CSS doesn't
 * need it. Walk the string char-by-char to handle balanced parens.
 */
function stripGlobalWrappers(input) {
  const needle = ":global(";
  let result = "";
  let i = 0;
  while (i < input.length) {
    if (input.startsWith(needle, i)) {
      // Find matching close paren
      let depth = 1;
      let j = i + needle.length;
      while (j < input.length && depth > 0) {
        if (input[j] === "(") depth += 1;
        else if (input[j] === ")") depth -= 1;
        if (depth === 0) break;
        j += 1;
      }
      // input[i+needle.length .. j] is the body inside :global(...)
      result += input.slice(i + needle.length, j);
      i = j + 1; // skip the closing paren
    } else {
      result += input[i];
      i += 1;
    }
  }
  return result;
}

/** Drop the leading SCSS line-comment block (consecutive `//` lines at file start). */
function stripLeadingScssCommentBlock(input) {
  const lines = input.split("\n");
  let i = 0;
  while (i < lines.length && /^\s*\/\/(\s|$)/.test(lines[i])) i += 1;
  // also drop a single blank line right after the block
  if (i < lines.length && lines[i].trim() === "") i += 1;
  return lines.slice(i).join("\n");
}

function transformToCss(scss, { quoteStyle }) {
  let css = stripLeadingScssCommentBlock(scss);
  css = stripGlobalWrappers(css);
  if (quoteStyle === "single") {
    css = css.replace(/\[data-theme="(dark|light)"\]/g, "[data-theme='$1']");
  }
  return css;
}

/**
 * Replace the variable-declaration block in `existing` with `generated`.
 * Variable block ends at the closing `}` of the explicit-dark rule, marked
 * canonically by the `--ogrid-formula-error-color: #ef5350;` line followed by
 * `}` (end of explicit-dark, which is the last synced rule).
 */
const SENTINEL = "/* @sync-end — do not move; sync-theme.mjs anchors here when splicing. */";

/**
 * Replace the synced block in `existing` with `header + generated`.
 *
 * The synced block ends at SENTINEL, which the script ALWAYS emits and which
 * the source SCSS also carries. After the first successful sync, the target
 * file has the sentinel line; before, it doesn't — in that case we look for
 * the historic marker (closing `}` of the explicit-dark rule, just before any
 * `.ogrid-*` structural rule) and treat everything from start of file up to
 * that point as the synced block to replace.
 */
function spliceVariablesIntoExisting(target, generated, header) {
  let existing;
  try {
    existing = readFileSync(target, "utf8");
  } catch {
    return header + generated.trimStart();
  }
  let tail = "";
  const sentinelIdx = existing.indexOf(SENTINEL);
  if (sentinelIdx !== -1) {
    // Tail = everything after the sentinel line (skip the line itself).
    const afterSentinel = existing.slice(sentinelIdx + SENTINEL.length);
    tail = afterSentinel.replace(/^\n/, "");
  } else {
    // Bootstrap path: look for the historic block boundary — first occurrence
    // of a `.ogrid-*` selector at column 0 (a structural rule). Everything from
    // there onward is preserved as tail.
    const m = existing.match(/^\.ogrid-/m);
    if (m) {
      tail = existing.slice(m.index);
    }
    // If neither sentinel nor historic boundary, target file is variables-only:
    // tail stays empty and we overwrite the whole file with generated content.
  }
  const body = header + generated.trimStart();
  if (!tail) return body;
  return body + "\n" + tail.replace(/^\n+/, "");
}

function compareOrWrite(target, contents, label) {
  if (checkMode) {
    let existing = "";
    try {
      existing = readFileSync(target, "utf8");
    } catch {
      console.error(`✗ ${label}: missing file`);
      process.exit(1);
    }
    if (existing !== contents) {
      console.error(
        `✗ ${label}: out of sync. Run \`node scripts/sync-theme.mjs\` to fix.`
      );
      process.exit(1);
    }
    console.log(`✓ ${label}: in sync`);
  } else {
    writeFileSync(target, contents, "utf8");
    console.log(`→ wrote ${label}`);
  }
}

const scss = readFileSync(SOURCE, "utf8");

const vueCss = transformToCss(scss, { quoteStyle: "double" });
const jsCss = transformToCss(scss, { quoteStyle: "single" });

const finalVue = spliceVariablesIntoExisting(VUE_TARGET, vueCss, HEADER_VUE);
const finalJs = spliceVariablesIntoExisting(JS_TARGET, jsCss, HEADER_JS);

compareOrWrite(VUE_TARGET, finalVue, "vue/styles/ogrid-theme.css");
compareOrWrite(JS_TARGET, finalJs, "js/styles/ogrid.css");

if (!checkMode) console.log("\nDone. Rebuild affected packages.");
