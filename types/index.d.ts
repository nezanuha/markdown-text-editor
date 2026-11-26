/**
 * Type definitions for markdown-text-editor.
 *
 * Options are read once, when the editor is constructed. Changing them afterwards
 * has no effect; call destroy() and construct a new editor instead.
 */

/** Tools that take no configuration, referenced by name in `toolbar`. */
export type ToolName =
    | 'heading'
    | 'bold'
    | 'italic'
    | 'strikethrough'
    | 'blockquote'
    | 'ul'
    | 'ol'
    | 'checklist'
    | 'indent'
    | 'outdent'
    | 'code'
    | 'math'
    | 'variables'
    | 'codeblock'
    | 'hr'
    | 'table'
    | 'link'
    | 'image'
    | 'undo'
    | 'redo'
    | 'preview';

/** A single entry in the variables dropdown. */
export interface Variable {
    /** Text shown in the dropdown. Rendered as plain text, never as markup. */
    label: string;
    /** Inserted at the cursor when the entry is clicked. */
    value: string;
    /**
     * Shown in place of `value` in the preview. The textarea keeps the real
     * placeholder. Entries without a sample appear as written.
     */
    sample?: string;
}

/**
 * The variable list with the one thing there is to configure about it. Pass the
 * array on its own where there is nothing to configure, which is most of the
 * time.
 */
export interface VariablesOptions {
    items: Array<Variable | VariableGroup>;

    /**
     * Typing the opening of a placeholder opens the list under the caret.
     * Default `true`. `false` leaves the toolbar dropdown as the only way in.
     *
     * What opens it is read from your own `value`s, so `{{today}}`, `{{ today }}`
     * and `<< today >>` each complete from the punctuation they start with.
     */
    complete?: boolean;
}

/** A headed section of variables. Groups and flat entries can be mixed. */
export interface VariableGroup {
    /** Heading shown above the group. Not clickable. */
    label: string;
    items: Variable[];
}

/**
 * @deprecated Moved to the top-level `variables` in 2.0.0, which the dropdown,
 * the preview and the typed completion all read. Still works. Put `'variables'`
 * in `toolbar` for the button and the list at the top level.
 */
export interface VariablesTool {
    variables: Array<Variable | VariableGroup>;
}

export interface HeadingTool {
    heading: {
        /**
         * Which heading levels the dropdown offers, in the order 1-6 regardless
         * of how you list them. Defaults to all six. Useful where H1 belongs to
         * the page rather than the content, e.g. `[2, 3, 4]`.
         *
         * `Ctrl+1`, `Ctrl+2` and `Ctrl+3` follow this list, so a level you leave
         * out cannot be inserted from the keyboard either.
         *
         * This restricts the toolbar, not the document: someone can still type
         * `# Title` by hand and it renders as a heading. Enforce the rule on the
         * server if it has to hold.
         */
        levels?: Array<1 | 2 | 3 | 4 | 5 | 6>;
    };
}

export interface ImageTool {
    image: {
        /**
         * @deprecated Moved to the top-level `upload` in 2.0.0, which the
         * modal, paste and drop all read. Still works, and still only reachable
         * when this tool is on the toolbar, which is what `upload` fixes.
         */
        fileInput?: {
            /** Allowed types, as `'png'` or `'image/png'`. */
            accept?: string[];
            /** Endpoint the `File` is POSTed to. */
            uploadUrl?: string;
            /** Extra fields sent alongside the file. */
            params?: Record<string, string | Blob>;
        };
        /** `false` disables alt text validation. */
        altInput?: boolean | { required?: boolean };
    };
}

/**
 * Where uploaded files go. One endpoint, used by the toolbar's image dialog,
 * by pasting and by dropping alike. Absent, none of the three uploads anything.
 */
export type Upload = string | UploadOptions | UploadHandler;

/**
 * Uploads the file yourself and returns where it ended up, as a URL or as
 * `{ path, alt }`. The escape hatch for presigned URLs, an upload library, or
 * anything else the options below cannot describe.
 */
export type UploadHandler =
    (file: File, alt: string) => string | { path?: string; url?: string; alt?: string }
        | Promise<string | { path?: string; url?: string; alt?: string }>;

export interface UploadOptions {
    /** Endpoint the file is POSTed to, as multipart form data. */
    url: string;

    /**
     * Name of the form field carrying the file. Defaults to `'image_file'`,
     * which is what the editor has sent since 1.8, so an endpoint written
     * against an older version keeps working untouched.
     */
    field?: string;

    /**
     * Sent with the request. This is where a CSRF token goes when the framework
     * wants one in a header: `X-CSRFToken` for Django, `X-CSRF-TOKEN` for
     * Laravel. `Content-Type` is ignored, since the browser writes it itself
     * with the multipart boundary.
     */
    headers?: Record<string, string>;

    /** Extra form fields sent alongside the file. */
    params?: Record<string, string | Blob>;

    /**
     * Reads your endpoint's answer, for a shape the editor does not already
     * understand. Without it, any of these are read as they are:
     *
     * - `{ url }` or `{ path }`, with an optional `alt`
     * - `{ success: true, image_path, image_alt? }`, the contract 1.8 shipped
     * - `{ success: false, error }`, a failure carrying its own message
     *
     * So an endpoint storing PDFs or video need not call its answer
     * `image_path`, and one written against 1.8 keeps working. Throw from here
     * to report a failure.
     *
     * @example response: body => ({ path: body.data.url })
     */
    response?: (body: any) => { path?: string; url?: string; alt?: string };

    /**
     * What may be uploaded, as `'png'`, `'image/png'` or `'image/*'`. Defaults
     * to `['image/*']`, so an editor that says nothing behaves as it always
     * has. Widen it and other kinds of file become uploadable too.
     *
     * This decides what the editor will even look at: a type outside the list
     * is left alone on paste and drop, the way a dropped PDF always was. The
     * image dialog offers whichever image types are in the list.
     */
    accept?: string[];

    /**
     * Largest file accepted, in bytes. Enforced on all three paths. Unlike
     * `accept`, exceeding it is a failure and is reported: the file was one
     * you said you would take.
     */
    maxSize?: number;

    /**
     * What is written into the document once the upload lands. The default
     * covers the four cases markdown can be asked about:
     *
     * - image -> `![alt](url)`
     * - video -> `<video src="url" controls></video>`
     * - audio -> `<audio src="url" controls></audio>`
     * - anything else -> `[filename](url)`
     *
     * Video and audio are raw HTML because markdown has no syntax for either.
     * Give `insert` where that is wrong for you, such as a publishing renderer
     * that escapes HTML, or an attachment that should render as a card.
     *
     * @example insert: (file, url) => `<a href="${url}" download>${file.name}</a>`
     */
    insert?: (file: File, url: string, alt: string) => string;

    /**
     * Called as the bytes go out, for your own progress bar. Only fires for the
     * built-in `url` upload; a function passed as `upload` reports its own.
     *
     * Bytes rather than a percentage, which divides out of them but cannot be
     * multiplied back into "2.1 MB of 5 MB". The names are the ones
     * `ProgressEvent` uses, since that is where they come from.
     *
     * @example onProgress: (file, loaded, total) => setProgress(loaded / total)
     */
    onProgress?: (file: File, loaded: number, total: number) => void;

    /** `false` leaves pasted images alone. Default `true`. */
    paste?: boolean;

    /**
     * `false` leaves dropped images alone. Default `true`.
     *
     * The drop is still swallowed: letting it through hands the file to the
     * browser, which navigates to it and takes the unsaved document with it.
     */
    drop?: boolean;
}

/**
 * A tool of your own. Extend `MarkdownEditor.Tool`, set `this.button` in the
 * constructor, and implement `applySyntax()`.
 *
 * @example
 * class ShoutTool extends MarkdownEditor.Tool {
 *     constructor(editor) {
 *         super(editor, 'Shout');
 *         this.button = this.createButton('<svg>…</svg>');
 *     }
 *     applySyntax() { this.editor.insertText('**LOUD**'); }
 * }
 */
export type CustomTool = new (editor: MarkdownEditor, config?: any) => {
    /** Appended to the toolbar. Return `null` to render nothing. */
    button: HTMLElement | null;
};

/**
 * A toolbar button described rather than written as a class. The usual way to
 * add your own tool.
 *
 * @example
 * { custom: {
 *     title: 'Insert accordion',
 *     icon: '<svg>…</svg>',
 *     action(editor) { editor.insertText('<div class="accordion">…</div>'); }
 * }}
 */
export interface DeclarativeTool {
    custom: {
        /** Tooltip, and the source of the button's CSS class. Translatable via `locale`. */
        title: string;
        /** Inline SVG for the button face. */
        icon?: string;
        /** Runs on click. The event is passed on for handing to `MarkdownEditor.modal`. */
        action: (editor: MarkdownEditor, event: Event) => void;
        /**
         * Keyboard shortcut, e.g. `'Ctrl+Shift+K'`. Appended to the tooltip, and
         * takes precedence over a built-in using the same combination.
         */
        shortcut?: string;
    };
}

export type ToolbarEntry =
    | ToolName
    | VariablesTool
    | ImageTool
    | HeadingTool
    | DeclarativeTool
    | CustomTool
    | { tool: CustomTool; config?: any };

/** Status bar fields. `false` hides the bar entirely. */
export interface FooterOptions {
    /** Default `true`. */
    line?: boolean;
    /** Default `true`. */
    col?: boolean;
    /** Default `true`. */
    chars?: boolean;
    /** Default `false`. */
    words?: boolean;
}

/**
 * One option per feature, named after the feature. `false` turns it off, and
 * an object configures it where there is anything to configure. New features
 * follow the same shape, so there is never a question of where one goes.
 */
/** Settings for `autosave`, where the plain `true` default is not enough. */
export interface AutosaveOptions {
    /**
     * Where the draft is kept. Defaults to the page's path, query and hash plus
     * the textarea's id or name, so two editors on one page stay apart and a
     * draft never surfaces on a different page.
     *
     * Give it explicitly where the default cannot tell two documents apart,
     * such as a textarea with no id or name, or a page that identifies the
     * document somewhere other than the URL.
     */
    key?: string;

    /**
     * How long a draft stays offerable, in milliseconds. Anything older is
     * dropped rather than offered. Default one week.
     */
    maxAge?: number;

    /**
     * How long typing must pause before a draft is written, in milliseconds.
     * Default `1000`.
     */
    debounce?: number;
}

export interface MarkdownEditorOptions {
    /**
     * `'hybrid'` renders formatting live as you type, `'plain'` shows raw
     * markdown. Default `'plain'`.
     */
    mode?: 'plain' | 'hybrid';

    /** Text shown when the editor is empty. */
    placeholder?: string;

    /**
     * Which tools appear and in what order. Omit for the default toolbar.
     * Note that `preview` must be present for the preview pane to exist.
     */
    toolbar?: ToolbarEntry[];

    /** Status bar configuration, or `false` to hide it. */
    footer?: boolean | FooterOptions;

    /** Find and replace, `Ctrl+F`. Set `false` to leave the shortcut to the
     * browser. Default `true`. */
    find?: boolean;

    /**
     * Table controls, which open beside a table when you click inside one, or
     * on `Alt+T`. Omit to follow the toolbar, where they come with the `table`
     * tool. `true` offers them without that tool, for content that already
     * holds tables; `false` never. Tab between cells works either way.
     */
    tableBar?: boolean;

    /**
     * Overrides the theme. Without it the editor inherits `data-theme` from the
     * nearest ancestor, or from the textarea itself.
     */
    theme?: 'light' | 'dark' | 'snowberry' | 'darkberry' | (string & {});

    /** Minimum height in pixels. Default `200`. */
    minHeight?: number;

    /** Maximum height in pixels before the editor scrolls. Default `500`. */
    maxHeight?: number;

    /** Called on every content change with the current markdown. */
    onChange?: (value: string) => void;

    /**
     * Translations for the editor's own interface, keyed by the English text:
     * tooltips, menu items, modal fields, buttons and screen reader names.
     * Anything not listed stays in English. CSS class names are unaffected.
     *
     * Takes the strings themselves, not a language code. Import the one you want
     * so nobody pays for the languages they do not use.
     * `locale/template.js` lists every key.
     *
     * @example
     * import es from 'markdown-text-editor/locale/es.js';
     * new MarkdownEditor('#editor', { locale: es });
     *
     * @example locale: { Bold: 'Negrita', '{n} words': '{n} palabras' }
     */
    locale?: Record<string, string>;

    /** @deprecated Renamed to `locale` in 2.0.0. Still works. */
    labels?: Record<string, string>;

    /**
     * The accessible name for the textarea, read before anything else by a
     * screen reader. Without it the editor falls back to a translated
     * `'Markdown editor'`.
     *
     * @deprecated Put `aria-label` on the textarea, or give it a `<label>`.
     * Either is native, works before this script runs, and is what the editor
     * checks for first. This option only writes the attribute for you. It
     * still works, and is not to be confused with `labels`, the old name for
     * `locale`, or with `editor.label()`, which looks up translations.
     */
    label?: string;

    /**
     * Placeholders your users insert rather than type: merge tags, template
     * variables, anything with a fixed spelling they would otherwise get wrong.
     *
     * Put `'variables'` in `toolbar` for the dropdown. The list is read whether
     * or not the button is there, since the preview uses `sample` values and
     * the typed completion offers the same entries.
     *
     * @example variables: [{ label: 'Name', value: '{{customer.name}}', sample: 'Hannes' }]
     * @example variables: { items: [...], complete: false }
     */
    variables?: Array<Variable | VariableGroup> | VariablesOptions;

    /**
     * Keeps a copy of what is being written in `localStorage`. If the tab dies,
     * the next load offers the draft back with the time it was taken.
     *
     * It never restores on its own: the text the server put on the page may be
     * newer than the draft, so restoring is always the reader's choice. The
     * draft is cleared when the form submits. Default `false`.
     *
     * @example autosave: true
     * @example autosave: { key: 'post-42', maxAge: 86400000 }
     */
    autosave?: boolean | AutosaveOptions;

    /**
     * Converts formatted text pasted from a web page or a word processor into
     * markdown, instead of dropping it in as plain text. The HTML goes through
     * the same sanitizer as the preview.
     *
     * `false` pastes the plain text alternative the clipboard carries.
     * Default `true`.
     */
    pasteHtml?: boolean;

    /**
     * Where uploaded files go, for the toolbar's image dialog, for pasting and
     * for dropping alike. Without it none of the three uploads anything, and
     * pasting a file says why in the console.
     *
     * Images only unless `accept` says otherwise. Before 2.0.0 this was
     * `{ image: { fileInput: { uploadUrl } } }` in the toolbar, which meant
     * upload could not be had without the image button. That form still works.
     *
     * @example upload: '/api/upload'
     * @example upload: { url: '/api/upload', headers: { 'X-CSRFToken': token } }
     * @example upload: async file => (await myUploader.send(file)).url
     */
    upload?: Upload;

    /**
     * Replaces the markdown parser used for the preview. Must be synchronous and
     * return an HTML string. Affects the preview pane only; hybrid mode's live
     * formatting uses a separate internal renderer.
     *
     * Clickable task list checkboxes are found by looking for
     * `input[type="checkbox"]` in the output, so a renderer without task list
     * support will break them.
     *
     * @example renderer: markdown => markdownIt.render(markdown)
     */
    renderer?: (markdown: string) => string;

    /**
     * Replaces the HTML sanitizer. Must be synchronous and return an HTML string.
     * Defaults to DOMPurify, which still runs when only `renderer` is given.
     *
     * Replacing this replaces your XSS protection. A pass-through such as
     * `html => html` disables sanitizing entirely.
     *
     * @example sanitizer: html => DOMPurify.sanitize(html, { ADD_TAGS: ['iframe'] })
     */
    sanitizer?: (html: string) => string;
}

/** Base class for toolbar tools. Reach it as `MarkdownEditor.Tool`. */
export declare class Tool {
    constructor(editor: MarkdownEditor, title: string);
    readonly editor: MarkdownEditor;
    /** The element appended to the toolbar. Set it to `null` to render nothing. */
    button: HTMLElement | null;
    /** Builds the default square icon button. Override for a dropdown or similar. */
    createButton(iconHtml?: string): HTMLElement | null;
    /** Called when the button is clicked, or its shortcut is pressed. */
    applySyntax(event?: Event): void;
    /**
     * Shrinks the selection so it holds no leading or trailing whitespace.
     * Call it first in `applySyntax` if your tool wraps the selection inline,
     * since double-clicking a word selects the space after it and the closing
     * marker would otherwise land on the wrong side of it.
     *
     * Line based tools should not call it: a trailing newline is what tells
     * them which lines the selection covers.
     */
    trimSelection(): void;
    /** Set to e.g. `'Ctrl+Shift+K'` to bind a shortcut. */
    shortcut?: string;
    /** Implement to release anything the tool registered. Called by `destroy()`. */
    destroy?: () => void;
}

export default class MarkdownEditor {
    /**
     * @param selector A CSS selector for a `<textarea>`, or the element itself.
     */
    constructor(selector: string | HTMLTextAreaElement, options?: MarkdownEditorOptions);

    /** Base class for writing your own toolbar tool. */
    static Tool: typeof Tool;

    /** The dialog helper the built-in link and image tools use. */
    static modal: (event: Event, size: string, bodyHTML: string, label?: string) => HTMLDialogElement;

    /** Returns the translation for a UI string, or the string itself. */
    label(text: string): string;

    /**
     * Renders markdown to sanitized HTML exactly as the preview does, honouring
     * the configured `renderer` and `sanitizer`. For custom tools that need to
     * embed rendered content, such as a tooltip body.
     */
    renderMarkdown(markdown: string): string;

    /**
     * Puts HTML through the configured `sanitizer`, or DOMPurify when none is
     * set. For a tool handling HTML that did not come from markdown: an embed,
     * a server's response, a clipboard payload.
     *
     * `renderMarkdown` is the one to use for markdown; it ends with this. Doing
     * it yourself with your own copy of DOMPurify would ignore whatever the
     * host configured, which is the whole point of the option.
     */
    sanitizeHtml(html: string): string;

    /**
     * Builds a small toolbar bound to another textarea, for a custom tool that
     * collects rich text in its own dialog. The tools are the real ones, and
     * `locale` is inherited. Returns the element; append it where you like.
     *
     * No preview button is added, whatever you pass.
     */
    createToolbar(textarea: HTMLTextAreaElement, tools?: ToolbarEntry[]): HTMLDivElement;

    /** The original textarea. Its `.value` is always the current markdown. */
    readonly usertextarea: HTMLTextAreaElement;

    /** The wrapper the editor builds around the textarea. */
    readonly editorContainer: HTMLDivElement;

    /** Options exactly as passed in. */
    readonly options: MarkdownEditorOptions;

    /** Variables parsed out of the toolbar configuration. */
    readonly variables: Array<Variable | VariableGroup>;

    /**
     * Inserts text at the cursor, replacing any selection, then restores focus,
     * scrolls the insertion into view, re-renders and fires `onChange`.
     *
     * @param selectionOffset Where the caret lands, measured from the insertion point.
     * @param trailingLength Characters at the end to leave outside the selection.
     */
    insertText(text: string, selectionOffset?: number, trailingLength?: number): void;

    /** Re-renders the preview and the hybrid display layer from the textarea. */
    render(): void;

    /**
     * Removes the editor UI, restores the original textarea and detaches every
     * listener. Call this on unmount in single page applications.
     */
    destroy(): void;
}
