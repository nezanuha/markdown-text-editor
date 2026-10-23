/**
 * Types for every file in this folder: `template.js` and each translation.
 * One declaration covers them all, since they share a shape — the editor's
 * English strings as keys, the translated strings as values.
 *
 * Wired up through the `types` condition on `./locale/*` in package.json, so
 * a new translation needs no declaration of its own.
 */
declare const strings: Record<string, string>;
export default strings;
