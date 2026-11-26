/**
 * Says once, in the console, that an option has moved.
 *
 * Three decisions are in here rather than obvious from the code:
 *
 * Keyed by the form, not by the page. Twelve editors on one old name is one
 * notice; two different old names on one page are two, whichever editor
 * happens to be built first.
 *
 * `info` for a rename, `warn` for the one that is going. Warning about
 * everything and then removing nothing is how a console stops being read.
 *
 * No version named. There is no next major planned, and a date given before
 * it is planned is a date that slips.
 */

const DOCS = 'https://frutjam.com/plugins/markdown-editor#upgrading-from-1x';

const said = new Set();

// Anything after the message goes on an indented line of its own: the link is
// longer than the sentence it belongs to, and a console line that has to be
// scrolled sideways does not get read.
function once(key, level, message, ...rest) {
    if (said.has(key)) return;
    said.add(key);
    console[level](['[MarkdownEditor] ' + message, ...rest].join('\n  '));
}

/** The toolbar entry for a tool, if the array holds one in object form. */
function entryFor(toolbar, name) {
    return (Array.isArray(toolbar) ? toolbar : [])
        .find(tool => tool && typeof tool === 'object' && tool[name] !== undefined);
}

/** Called from the constructor, before anything else reads the options. */
export function noteDeprecations(options = {}) {
    if (options.labels !== undefined) {
        once('labels', 'info', options.locale !== undefined
            ? 'labels and locale are both set, and locale wins.'
            : 'labels is now locale. Both work.', DOCS);
    }

    if (options.label !== undefined) {
        once('label', 'info',
            'label is an aria-label you can set on the textarea yourself. Both work.', DOCS);
    }

    if (entryFor(options.toolbar, 'variables')) {
        once('variables', 'info',
            'variables moved from the toolbar array to the top level. Both work.', DOCS);
    }

    const fileInput = entryFor(options.toolbar, 'image')?.image?.fileInput;
    if (!fileInput?.uploadUrl) return;

    if (options.upload !== undefined) {
        once('fileInput', 'warn',
            'image.fileInput is ignored, because upload is set. Remove it from the toolbar entry.');
        return;
    }

    once('fileInput', 'warn',
        'image.fileInput still works, and will be removed in a future major version.',
        'upload replaces it, and uploads on a paste or a drop as well:',
        "new MarkdownEditor(el, { upload: '/api/upload' })",
        DOCS);
}
