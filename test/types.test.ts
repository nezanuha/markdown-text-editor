/**
 * Type definition tests. Run with `npm run typecheck`.
 *
 * Nothing here executes. It exists so the definitions in types/index.d.ts cannot
 * drift from the implementation without something failing: valid configuration
 * must compile, and each @ts-expect-error must actually produce an error, since
 * an unused one is itself a compile error.
 */
import MarkdownEditor, {
    MarkdownEditorOptions,
    ToolbarEntry,
    Variable,
    VariableGroup,
} from '../types/index';

// --- valid usage ------------------------------------------------------------

const full: MarkdownEditorOptions = {
    mode: 'hybrid',
    placeholder: 'Write something',
    minHeight: 200,
    maxHeight: 500,
    theme: 'darkberry',
    footer: { line: true, col: true, chars: true, words: true },
    onChange: (value) => { const length: number = value.length; },
    renderer: (markdown) => markdown.toUpperCase(),
    sanitizer: (html) => html,
    toolbar: [
        'heading', 'bold', 'italic', 'link',
        { variables: [
            { label: 'Customer Name', value: '{{customer.name}}', sample: 'Hannes' },
            { label: 'Invoice No', value: '{{invoice.number}}' },
            { label: 'Customer', items: [
                { label: 'Email', value: '{{customer.email}}' },
            ]},
        ]},
        { image: { fileInput: { accept: ['webp', 'png'], uploadUrl: '/api/upload' } } },
        'preview',
    ],
};

const minimal: MarkdownEditorOptions = {};
const localised: MarkdownEditorOptions = { locale: { Bold: 'Negrita', '{n} words': '{n} palabras' } };

const translated: MarkdownEditorOptions = {
    labels: { Bold: 'Negrita', 'Insert variable': 'Insertar variable', 'Uploading...': 'Subiendo...' },
};
const noFooter: MarkdownEditorOptions = { footer: false };

const switches: MarkdownEditorOptions = { find: false, tableBar: true, footer: { words: true } };
const barOff: MarkdownEditorOptions = { tableBar: false };
// @ts-expect-error  tablePopover was renamed to tableBar in 2.0.0
const renamedOption: MarkdownEditorOptions = { tablePopover: true };
// @ts-expect-error  the bar is on or off, not configured
const badBar: MarkdownEditorOptions = { tableBar: { align: true } };
// @ts-expect-error  find is on or off
const badFind: MarkdownEditorOptions = { find: 'always' };
const customTheme: MarkdownEditorOptions = { theme: 'my-brand' };
const altDisabled: MarkdownEditorOptions = { toolbar: [{ image: { altInput: false } }] };
const altRequired: MarkdownEditorOptions = { toolbar: [{ image: { altInput: { required: true } } }] };

const someHeadings: MarkdownEditorOptions = { toolbar: [{ heading: { levels: [2, 3, 4] } }] };
const allHeadings: MarkdownEditorOptions = { toolbar: [{ heading: {} }, 'heading'] };
// @ts-expect-error  7 is not a heading level
const badHeading: MarkdownEditorOptions = { toolbar: [{ heading: { levels: [7] } }] };

class ShoutTool extends MarkdownEditor.Tool {
    constructor(editor: MarkdownEditor) {
        super(editor, 'Shout');
        this.button = this.createButton('<svg></svg>');
    }
    applySyntax() { this.editor.insertText('**LOUD**'); }
}

const withCustomTool: MarkdownEditorOptions = {
    toolbar: ['bold', ShoutTool, { tool: ShoutTool, config: { text: 'x' } }, 'preview'],
};

const withDeclarativeTool: MarkdownEditorOptions = {
    toolbar: ['bold', {
        custom: {
            title: 'Insert accordion',
            icon: '<svg></svg>',
            shortcut: 'Ctrl+Shift+K',
            action(editor, event) { editor.insertText('<div class="accordion"></div>'); },
        },
    }, 'preview'],
};


// @ts-expect-error a declarative tool needs an action
const noAction: MarkdownEditorOptions = { toolbar: [{ custom: { title: 'x' } }] };
const translatedCustom: MarkdownEditorOptions = { labels: { Shout: 'Gritar' } };

const flat: Variable = { label: 'Today', value: '{{today}}' };
const grouped: VariableGroup = { label: 'Customer', items: [flat] };
const entries: ToolbarEntry[] = ['bold', { variables: [flat, grouped] }];

const bySelector = new MarkdownEditor('#editor', full);
const byElement = new MarkdownEditor(document.createElement('textarea'));

const textarea: HTMLTextAreaElement = bySelector.usertextarea;
const container: HTMLDivElement = bySelector.editorContainer;
const markdown: string = textarea.value;

const rendered: string = bySelector.renderMarkdown('**hi**');
const subToolbar: HTMLDivElement = bySelector.createToolbar(
    document.createElement('textarea'), ['bold', 'italic'],
);
const defaultTools: HTMLDivElement = bySelector.createToolbar(document.createElement('textarea'));

bySelector.insertText('{{customer.name}}');
bySelector.insertText('**bold**', 2, 2);
bySelector.render();
bySelector.destroy();

// --- rejected usage ---------------------------------------------------------

// @ts-expect-error mode is plain or hybrid
const badMode: MarkdownEditorOptions = { mode: 'wysiwyg' };
// @ts-expect-error minHeight is a number of pixels
const badHeight: MarkdownEditorOptions = { minHeight: '200px' };
// @ts-expect-error not a known tool
const badTool: MarkdownEditorOptions = { toolbar: ['bold', 'nope'] };
// @ts-expect-error a variable needs a value
const badVariable: MarkdownEditorOptions = { toolbar: [{ variables: [{ label: 'x' }] }] };
// @ts-expect-error a group needs items, not a value
const badGroup: VariableGroup = { label: 'x', value: 'y' };
// @ts-expect-error renderer returns an HTML string
const badRenderer: MarkdownEditorOptions = { renderer: (md: string) => 42 };
// @ts-expect-error sanitizer takes the rendered HTML
const badSanitizer: MarkdownEditorOptions = { sanitizer: () => undefined };
// @ts-expect-error the first argument is a selector or a textarea
const badTarget = new MarkdownEditor(42);
// @ts-expect-error label values are strings
const badLabels: MarkdownEditorOptions = { labels: { Bold: 42 } };

// The options 2.0 added. Each was missing from the declarations while the
// feature shipped, so a TypeScript host could not pass it without an error.
const topVariables: MarkdownEditorOptions = {
    toolbar: ['bold', 'variables', 'preview'],
    variables: [{ label: 'Today', value: '{{today}}', sample: '10 September 2026' }],
};
const roomyFooter: MarkdownEditorOptions = { footer: true };
const named: MarkdownEditorOptions = { label: 'Article body' };
const drafts: MarkdownEditorOptions = { autosave: true };
const draftsTuned: MarkdownEditorOptions = {
    autosave: { key: 'post-42', maxAge: 86400000, debounce: 500 },
};
const noComplete: MarkdownEditorOptions = {
    variables: { items: [{ label: 'Today', value: '{{today}}' }], complete: false },
};
const plainPaste: MarkdownEditorOptions = { pasteHtml: false };

// @ts-expect-error a variable needs a value, wherever the list is written
const badTopVariable: MarkdownEditorOptions = { variables: [{ label: 'x' }] };
// @ts-expect-error autosave takes true or its settings
const badAutosave: MarkdownEditorOptions = { autosave: 'yes' };
// @ts-expect-error maxAge is milliseconds
const badMaxAge: MarkdownEditorOptions = { autosave: { maxAge: '1 week' } };

// upload, in each of its three forms
const uploadUrl: MarkdownEditorOptions = { upload: '/api/upload' };
const uploadFull: MarkdownEditorOptions = {
    upload: {
        url: '/api/upload',
        field: 'file',
        headers: { 'X-CSRFToken': 'abc' },
        params: { album: 'holiday' },
        response: body => ({ path: body.data.url }),
        accept: ['image/png', 'webp'],
        maxSize: 5 * 1024 * 1024,
        paste: true,
        drop: false,
    },
};
const uploadFn: MarkdownEditorOptions = { upload: async (file: File) => file.name };
const uploadFiles: MarkdownEditorOptions = {
    upload: {
        url: '/api/upload',
        accept: ['image/*', 'application/pdf'],
        insert: (file: File, url: string) => `[${file.name}](${url})`,
    },
};
const uploadFnObject: MarkdownEditorOptions = { upload: () => ({ path: '/a.png', alt: 'A' }) };
// the pre-2.0 toolbar form still typechecks
const uploadLegacy: MarkdownEditorOptions = {
    toolbar: [{ image: { fileInput: { uploadUrl: '/api/upload' } } }],
};

// @ts-expect-error the object form needs somewhere to post to
const badUpload: MarkdownEditorOptions = { upload: { headers: {} } };
// @ts-expect-error maxSize is a number of bytes
const badMaxSize: MarkdownEditorOptions = { upload: { url: '/u', maxSize: '5MB' } };

export {
    rendered, subToolbar, defaultTools,
    withCustomTool, withDeclarativeTool, noAction, translatedCustom, ShoutTool,
    translated, badLabels,
    full, minimal, noFooter, customTheme, altDisabled, altRequired,
    flat, grouped, entries, bySelector, byElement, textarea, container, markdown,
    badMode, badHeight, badTool, badVariable, badGroup, badRenderer, badSanitizer, badTarget,
    drafts, draftsTuned, noComplete, plainPaste,
    topVariables, roomyFooter, named, badTopVariable,
    badAutosave, badMaxAge,
    uploadUrl, uploadFull, uploadFn, uploadFnObject, uploadFiles, uploadLegacy,
    badUpload, badMaxSize,
};
