/**
 * Escapes a value for interpolation into HTML built as a string.
 *
 * The link and image dialogs prefill their fields from the document, and those
 * dialogs are assembled by concatenation and inserted with
 * `insertAdjacentHTML`. Without this, selecting
 * `"><img src=x onerror=...>` and pressing the link button closed the `value`
 * attribute and ran the handler: markdown written by one person, executing in
 * the session of whoever edited it next. The alt field fell back to whatever
 * was selected, so no image syntax was needed to reach it.
 *
 * Quotes are escaped as well as the angle brackets, because every use here is
 * inside a double-quoted attribute, where `<` alone is harmless but `"` ends
 * the value. The ampersand has to go first, or it would re-escape the
 * ampersands the later replacements introduce.
 *
 * Escaping does not change what the field holds: the browser decodes the
 * entities when it parses the attribute, so reading `input.value` gives the
 * original text back, quotes and all.
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
