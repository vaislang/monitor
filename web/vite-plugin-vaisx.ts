/**
 * vite-plugin-vaisx
 *
 * Transforms .vaisx (VaisX component) files into JavaScript modules.
 *
 * .vaisx format (Svelte-like):
 *   <template> ... </template>
 *   <script> ... </script>
 *   <style> ... </style>
 *
 * Build-time transform strategy:
 *   - <script>: extract, normalize Vais-isms, rewrite .vais imports to stubs
 *   - <template>: compile to __render__() → HTML string
 *   - <style>: inject at runtime via document.head
 *   - .vais imports → virtual stub module (no-op Proxy)
 */

import type { Plugin } from "vite";
import * as path from "node:path";

// ── helpers ────────────────────────────────────────────────────────────────

function extractBlock(src: string, tag: string): string {
  // Match <tag> or <tag attr=...> … </tag>. The opening tag may carry arbitrary
  // attributes (e.g. `<style scoped>`, `<script lang="ts">`), so we look for a
  // literal `<tag` and then advance to the first `>` that closes the opening tag.
  const close = `</${tag}>`;
  const openAnchor = `<${tag}`;
  const openIdx = src.indexOf(openAnchor);
  if (openIdx === -1) return "";
  // Ensure the next character is a space, `>`, or `/` — otherwise this is a
  // different tag (e.g. `<scripttrue>`).
  const nextCh = src.charAt(openIdx + openAnchor.length);
  if (nextCh !== " " && nextCh !== ">" && nextCh !== "\t" && nextCh !== "\n") {
    return "";
  }
  const openTagEnd = src.indexOf(">", openIdx + openAnchor.length);
  if (openTagEnd === -1) return "";
  const end = src.lastIndexOf(close);
  if (end === -1 || end < openTagEnd) return "";
  return src.slice(openTagEnd + 1, end).trim();
}

/**
 * Collect all names that are imported in a script block.
 * Returns a Set of identifier strings.
 */
function collectImportedNames(script: string): Set<string> {
  const names = new Set<string>();
  // default import: import Foo from '...'
  for (const m of script.matchAll(/^\s*import\s+(\w+)\s+from\s+['"][^'"]+['"]/gm)) {
    names.add(m[1]);
  }
  // named imports: import { a, b as c } from '...'
  for (const m of script.matchAll(/^\s*import\s*\{([^}]+)\}\s*from\s+['"][^'"]+['"]/gm)) {
    for (const part of m[1].split(",")) {
      // handle "a as b" → b is the local name
      const asMatch = part.trim().match(/(\w+)\s+as\s+(\w+)/);
      if (asMatch) {
        names.add(asMatch[2]);
      } else {
        const name = part.trim().match(/(\w+)/);
        if (name) names.add(name[1]);
      }
    }
  }
  // namespace import: import * as ns from '...'
  for (const m of script.matchAll(/^\s*import\s*\*\s+as\s+(\w+)\s+from\s+['"][^'"]+['"]/gm)) {
    names.add(m[1]);
  }
  return names;
}

/**
 * Normalize a raw .vaisx <script> block into valid JavaScript:
 *
 *  1. Convert Vais-style `# comment` → `// comment`
 *  2. Remove duplicate `let`/`const`/`var` declarations for names already imported
 *  3. Convert Svelte reactive labels `$: x = expr` → `let x = expr`
 *  4. Rewrite `.vais` imports to `?vais-stub` virtual module
 */
function normalizeScript(script: string, _selfId: string): string {
  // Step 1: Rewrite .vais imports (before collecting imported names so we
  //         don't accidentally strip the import lines)
  let out = script.replace(
    /^(\s*import\s[^'"]*['"])([^'"]+\.vais)(['"]\s*(?:\/\/.*)?$)/gm,
    "$1$2?vais-stub$3"
  );

  // Step 2: Collect imported names (after rewrite so stub suffix is present)
  const imported = collectImportedNames(out);

  // Step 3: Comment-convert `# text` → `// text`
  out = out
    .split("\n")
    .map((line) => line.replace(/^(\s*)#\s(.*)$/, "$1// $2"))
    .join("\n");

  // Step 4: Remove duplicate `let/const/var name = ...` for imported names.
  //         We replace these with a comment to preserve line structure.
  if (imported.size > 0) {
    out = out.replace(
      /^(\s*)(let|const|var)\s+(\w+)(\s*=)/gm,
      (full, indent, kw, name, eq) => {
        if (imported.has(name)) {
          return `${indent}// [vaisx] skipped duplicate decl '${name}' (already imported)`;
        }
        return full;
      }
    );
  }

  // Step 5: Svelte reactive statements `$: …` are handled differently depending on
  //         whether the statement is a block (`$: { … }`) or a single expression
  //         (`$: x = expr`, `$: console.log(x)`). In JavaScript, `$:` by itself is a
  //         label and a labeled block is legal, so `$: { … }` can be left intact.
  //         For single-statement forms we insert `;` to make the label a no-op:
  //           `$: x = expr`  →  `$: ; x = expr`
  //         This keeps semantics reasonable (assignment still runs on module load)
  //         without creating orphan braces.
  out = out
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*)\$:\s*(.*)$/);
      if (!m) return line;
      const [, indent, rest] = m;
      // Block form: `$: {` — preserve as labeled block
      if (rest.trim().startsWith("{")) {
        return `${indent}$: ${rest}`;
      }
      // Empty `$:` (just the label) — keep as-is
      if (rest.trim().length === 0) {
        return line;
      }
      // Single-statement form — normalize to `$: ; statement` so the label stays
      // paired with an empty statement and the real statement runs standalone.
      return `${indent}$: ; ${rest}`;
    })
    .join("\n");

  return out;
}

/**
 * Minimal template compiler: Svelte-like syntax → render() returning HTML string.
 */
function compileTemplate(template: string): string {
  if (!template) {
    return `export function __render__(_props) { return ''; }`;
  }

  let t = template;

  // Strip block directives (stub: render all branches)
  t = t
    .replace(/\{#if [^}]+\}/g, "")
    .replace(/\{:else if [^}]+\}/g, "")
    .replace(/\{:else\}/g, "")
    .replace(/\{\/if\}/g, "")
    .replace(/\{#each [^}]+\}/g, "")
    .replace(/\{\/each\}/g, "")
    .replace(/\{@html ([^}]+)\}/g, "<!-- html:$1 -->");

  // Escape for template literal embedding
  const escaped = t
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  return [
    `export function __render__(_props) {`,
    `  // Auto-generated stub by vite-plugin-vaisx`,
    `  return \`${escaped}\`;`,
    `}`,
  ].join("\n");
}

/** Runtime CSS injection snippet */
function buildStyleInjection(style: string, componentId: string): string {
  if (!style) return "";
  const escaped = style
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`");
  return [
    `// vaisx: inject styles for '${componentId}'`,
    `(function __injectStyle__() {`,
    `  const sid = ${JSON.stringify("vaisx-" + componentId)};`,
    `  if (typeof document !== 'undefined' && !document.getElementById(sid)) {`,
    `    const el = document.createElement('style');`,
    `    el.id = sid;`,
    `    el.textContent = \`${escaped}\`;`,
    `    document.head.appendChild(el);`,
    `  }`,
    `})();`,
  ].join("\n");
}

// ── virtual stub ───────────────────────────────────────────────────────────

const VAIS_STUB_RESOLVED = "\0vais-stub";

const VAIS_STUB_CODE = `
// vais-stub: no-op module for .vais server-side imports in browser context
const __noop__ = () => {};
const __stub__ = new Proxy({}, {
  get(_, k) {
    if (k === Symbol.toPrimitive || k === Symbol.iterator) return undefined;
    if (k === '__esModule') return true;
    return __stub__;
  },
  apply() { return __stub__; },
});

export default __stub__;
export const t = (k) => String(k);
export const create_auth_store = () => __stub__;
export const create_app_store = () => __stub__;
export const is_dark_theme = () => false;
export const authStore = __stub__;
export const appStore = __stub__;
export const __vais_stub__ = true;
`;

// ── plugin ─────────────────────────────────────────────────────────────────

export function vaisxPlugin(): Plugin {
  return {
    name: "vite-plugin-vaisx",
    enforce: "pre",

    resolveId(id: string) {
      // Any .vais file (possibly with ?vais-stub suffix) → stub
      if (/\.vais(\?|$)/.test(id)) {
        return VAIS_STUB_RESOLVED;
      }
      return undefined;
    },

    load(id: string) {
      if (id === VAIS_STUB_RESOLVED) {
        return VAIS_STUB_CODE;
      }
      return undefined;
    },

    transform(src: string, id: string) {
      if (!id.endsWith(".vaisx")) return undefined;

      const componentId = path
        .basename(id, ".vaisx")
        .replace(/[^a-zA-Z0-9_]/g, "-");

      const template = extractBlock(src, "template");
      const script = extractBlock(src, "script");
      const style = extractBlock(src, "style");

      const templateCode = compileTemplate(template);
      const styleCode = buildStyleInjection(style, componentId);
      const scriptCode = normalizeScript(script, id);

      const lines = [
        `// [vite-plugin-vaisx] ${path.basename(id)}`,
        "",
        "// ── template ──",
        templateCode,
        "",
        styleCode ? "// ── styles ──" : "",
        styleCode,
        "",
        "// ── script ──",
        scriptCode,
        "",
        "// ── component export ──",
        `export default {`,
        `  id: ${JSON.stringify(componentId)},`,
        `  render: __render__,`,
        `};`,
      ];

      return { code: lines.join("\n"), map: null };
    },
  };
}
