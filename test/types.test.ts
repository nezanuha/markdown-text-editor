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
const noFooter: MarkdownEditorOptions = { footer: false };
const customTheme: MarkdownEditorOptions = { theme: 'my-brand' };
const altDisabled: MarkdownEditorOptions = { toolbar: [{ image: { altInput: false } }] };
const altRequired: MarkdownEditorOptions = { toolbar: [{ image: { altInput: { required: true } } }] };

const flat: Variable = { label: 'Today', value: '{{today}}' };
const grouped: VariableGroup = { label: 'Customer', items: [flat] };
const entries: ToolbarEntry[] = ['bold', { variables: [flat, grouped] }];

const bySelector = new MarkdownEditor('#editor', full);
const byElement = new MarkdownEditor(document.createElement('textarea'));

const textarea: HTMLTextAreaElement = bySelector.usertextarea;
const container: HTMLDivElement = bySelector.editorContainer;
const markdown: string = textarea.value;

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

export {
    full, minimal, noFooter, customTheme, altDisabled, altRequired,
    flat, grouped, entries, bySelector, byElement, textarea, container, markdown,
    badMode, badHeight, badTool, badVariable, badGroup, badRenderer, badSanitizer, badTarget,
};
