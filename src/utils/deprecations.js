/**
 * The options that moved in 2.0, each said once.
 *
 * Every one of them still works, and this file exists so that nobody finds
 * that out in 3.0 instead. A deprecation period only begins when people are
 * told: removing something that never warned is not a deprecation, it is a
 * surprise with a long fuse.
 *
 * Three rules, in the order they matter.
 *
 * **Once per form, not once per editor.** A page carrying twelve editors on
 * the old name has one thing to change, not twelve things to read -- but a
 * page using two different old names needs to hear about both, whichever
 * editor happens to be built first. So the key is the form, and `said` is
 * module-level.
 *
 * **One line each, naming the replacement.** "Deprecated" on its own is a
 * complaint; what someone needs is the name to type instead.
 *
 * **Say what you mean about removal.** This is the part most libraries get
 * wrong: they warn "will be removed" about everything, nothing is removed for
 * years, and people learn to ignore the console. So there are two brackets
 * here and they read differently.
 *
 *   `info`  -- renamed. The old name is one line of code to keep reading, so
 *              it keeps working, and no version is promised. Worth saying
 *              only because your config should match the documentation.
 *
 *   `warn`  -- going in 3.0, and costing you something today. `fileInput` is
 *              the only one: it cannot upload from a paste or a drop, which
 *              is what people on it turn up asking for (#40), and it is the
 *              only one of the four carrying real weight in here.
 *
 * Neither bracket is a sign of breakage, so neither is an `error`.
 */

const said = new Set();

function once(key, level, message) {
    if (said.has(key)) return;
    said.add(key);
    console[level]('[MarkdownEditor] ' + message);
}

/** The toolbar entry for a tool, if the array holds one in object form. */
function entryFor(toolbar, name) {
    return (Array.isArray(toolbar) ? toolbar : [])
        .find(tool => tool && typeof tool === 'object' && tool[name] !== undefined);
}

const KEEPS_WORKING = ' The old form keeps working.';

/**
 * Reads the options for anything written against 1.x and says so.
 *
 * Called from the constructor before anything else reads the options, so that
 * the note about a form comes before whatever that form goes on to do.
 */
export function noteDeprecations(options = {}) {
    if (options.labels !== undefined) {
        once('labels', 'info', options.locale !== undefined
            ? 'labels and locale are both set, and locale wins. labels was the name '
                + 'before 2.0.'
            : 'labels is now locale -- the same object, a better name for strings that '
                + 'are not all labels.' + KEEPS_WORKING);
    }

    if (options.label !== undefined) {
        once('label', 'info',
            'label writes an aria-label on the textarea, which you can write yourself, '
            + 'along with a <label for>. Either is native, applies before this script '
            + 'runs, and is what the editor looks for first.' + KEEPS_WORKING);
    }

    if (entryFor(options.toolbar, 'variables')) {
        once('variables', 'info',
            'variables belongs at the top level now, not in the toolbar array: the list '
            + 'is data, read by the preview and the completion as well as the dropdown.'
            + KEEPS_WORKING);
    }

    // The toolbar form of uploading, which is the one with a date on it.
    const fileInput = entryFor(options.toolbar, 'image')?.image?.fileInput;
    if (!fileInput?.uploadUrl) return;

    once('fileInput', 'warn', options.upload !== undefined
        ? 'image.fileInput is ignored, since upload is set and wins. Drop fileInput '
            + 'from the toolbar entry to say so: it will be removed in 3.0.'
        : 'image.fileInput still works and will be removed in 3.0. Use the top-level '
            + "upload instead:\n  new MarkdownEditor(el, { upload: '/api/upload' })\n"
            + '  Pasting and dropping then upload too, with or without the image button.');
}
