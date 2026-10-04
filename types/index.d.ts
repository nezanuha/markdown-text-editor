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

/** A headed section of variables. Groups and flat entries can be mixed. */
export interface VariableGroup {
    /** Heading shown above the group. Not clickable. */
    label: string;
    items: Variable[];
}

/** Toolbar entries that carry their own configuration. */
export interface VariablesTool {
    variables: Array<Variable | VariableGroup>;
}

export interface ImageTool {
    image: {
        fileInput?: {
            /** Allowed extensions, e.g. `['webp', 'avif', 'png']`. */
            accept?: string[];
            /** Endpoint the `File` is POSTed to. */
            uploadUrl?: string;
        };
        /** `false` disables alt text validation. */
        altInput?: boolean | { required?: boolean };
    };
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
        /** Tooltip, and the source of the button's CSS class. Translatable via `labels`. */
        title: string;
        /** Inline SVG for the button face. */
        icon?: string;
        /** Runs on click. The event is passed so dialog tools can position against it. */
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
    footer?: false | FooterOptions;

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
     * tooltips, menu items, modal fields and buttons. Anything not listed stays
     * in English. CSS class names are unaffected.
     *
     * @example labels: { Bold: 'Negrita', 'Insert variable': 'Insertar variable' }
     */
    labels?: Record<string, string>;

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
     * Builds a small toolbar bound to another textarea, for a custom tool that
     * collects rich text in its own dialog. The tools are the real ones, and
     * `labels` are inherited. Returns the element; append it where you like.
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
