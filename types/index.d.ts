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

export type ToolbarEntry = ToolName | VariablesTool | ImageTool;

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

export default class MarkdownEditor {
    /**
     * @param selector A CSS selector for a `<textarea>`, or the element itself.
     */
    constructor(selector: string | HTMLTextAreaElement, options?: MarkdownEditorOptions);

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
