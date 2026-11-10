import Tool from '../Tool.js';

/**
 * Wraps the selection in TeX delimiters: `$...$` on one line, `$$...$$` when
 * the selection spans several.
 *
 * The editor does not render maths itself. Nothing here depends on KaTeX, and
 * the delimiters are only text, so a document written with this tool stays
 * valid markdown whether or not a renderer understands it. To see it rendered,
 * pass a renderer that handles TeX and load that renderer's stylesheet:
 *
 *     import markdownIt from 'markdown-it';
 *     import katex from '@vscode/markdown-it-katex';
 *     import 'katex/dist/katex.min.css';
 *
 *     new MarkdownEditor('#editor', {
 *         renderer: md => markdownIt().use(katex).render(md),
 *     });
 */
class MathTool extends Tool {
    constructor(editor) {
        super(editor, 'Math');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 5h-7l-4 14l-3 -6h-2" /><path d="M14 13l6 6" /><path d="M14 19l6 -6" /></svg>
        `);
    }

    applySyntax() {
        this.trimSelection();
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selected = textarea.value.substring(selectionStart, selectionEnd);

        // A block of maths sits on its own lines, inline maths does not
        const block = selected.includes('\n');
        const fence = block ? '$$' : '$';

        // already wrapped, so unwrap
        if (selected.startsWith(fence) && selected.endsWith(fence)
            && selected.length > fence.length * 2) {
            this.editor.insertText(selected.slice(fence.length, -fence.length));
            return;
        }

        if (!selected) {
            this.editor.insertText(`${fence}${fence}`, fence.length, fence.length);
            return;
        }

        const text = block
            ? `${fence}\n${selected}\n${fence}`
            : `${fence}${selected}${fence}`;
        this.editor.insertText(text, fence.length + (block ? 1 : 0), fence.length + (block ? 1 : 0));
    }
}

export default MathTool;
