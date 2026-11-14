/**
 * Checks the package as a consumer meets it, which the smoke tests cannot.
 *
 * They import the ESM build directly, so they never exercise the entry points
 * in package.json. `require()` was returning an empty object for every
 * CommonJS user: this package is "type": "module", so Node read the UMD
 * bundle as ESM, its `typeof module !== "undefined"` branch was never taken,
 * and nothing was assigned. The file is .cjs now, which is what tells Node to
 * read it as CommonJS. Nothing in the suite could have caught that.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
const pkg = require('./package.json');

const failures = [];
let passed = 0;
const check = (name, ok, detail = '') => {
    if (ok) { passed++; return; }
    failures.push(name + (detail ? '\n      ' + detail : ''));
};

const local = (p) => join(ROOT, p.replace(/^\.\//, ''));

// --- every advertised file exists ----------------------------------------
for (const field of ['main', 'module', 'browser', 'types', 'unpkg', 'jsdelivr']) {
    if (!pkg[field]) continue;
    check(`package.json "${field}" points at a file that exists`,
        existsSync(local(pkg[field])), pkg[field]);
}

for (const [sub, target] of Object.entries(pkg.exports ?? {})) {
    const paths = typeof target === 'string' ? [target] : Object.values(target);
    for (const p of paths) {
        if (typeof p !== 'string' || p.includes('*')) continue;
        check(`exports "${sub}" resolves`, existsSync(local(p)), p);
    }
}

// --- the entry points actually load --------------------------------------
const esm = await import(pathToFileURL(local(pkg.module)).href);
check('the ESM build exports a constructor', typeof esm.default === 'function',
    'got ' + typeof esm.default);
check('ESM: MarkdownEditor.Tool', typeof esm.default?.Tool === 'function');
check('ESM: MarkdownEditor.modal', typeof esm.default?.modal === 'function');

// The one that was broken. `require` must give the constructor itself, not a
// namespace object and not undefined.
let cjs;
try { cjs = require(pkg.main); } catch (err) { cjs = { __error: err.message }; }
check('require() gives a constructor, not an empty object',
    typeof cjs === 'function',
    'got ' + typeof cjs + (cjs?.__error ? ': ' + cjs.__error
        : ', keys: ' + JSON.stringify(Object.keys(cjs ?? {}))));
check('require(): MarkdownEditor.Tool', typeof cjs?.Tool === 'function');
check('require(): MarkdownEditor.modal', typeof cjs?.modal === 'function');

// --- importing must not need a DOM, so server rendering can load it ------
check('importing does not touch the DOM', typeof document === 'undefined',
    'this process has no document, and the import above did not throw');

// --- the stylesheet the editor warns about ------------------------------
const css = readFileSync(local(pkg.exports['./style.css']), 'utf8');
check('the stylesheet sets --mte-css, which the missing-CSS warning reads',
    css.includes('--mte-css'));

// --- what ships ----------------------------------------------------------
check('src/ is not published', !(pkg.files ?? []).some(f => f.startsWith('src')),
    JSON.stringify(pkg.files));

console.log('\n  package: ' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
    failures.forEach(f => console.log('  FAIL  ' + f + '\n'));
    process.exit(1);
}
