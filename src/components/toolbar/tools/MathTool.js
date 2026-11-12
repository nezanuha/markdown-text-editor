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
 *     import DOMPurify from 'dompurify';
 *
 *     new MarkdownEditor('#editor', {
 *         renderer: md => markdownIt().use(katex).render(md),
 *         // The default sanitizer keeps KaTeX's MathML but drops <semantics>
 *         // and <annotation>, and the annotation is where the original TeX
 *         // lives: it is what a screen reader and a copy out of the preview
 *         // read. Allowing the two tags back gives KaTeX's output through
 *         // untouched. Checked in Edge, not assumed.
 *         sanitizer: html => DOMPurify.sanitize(html, {
 *             ADD_TAGS: ['semantics', 'annotation'],
 *             ADD_ATTR: ['encoding'],
 *         }),
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
        const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);

        // The block markers carry the newlines that put them on their own
        // lines. Taking only the dollars back off left those newlines behind,
        // so a block gained a blank line above and below on every toggle and
        // never came back to what you started with.
        const BLOCK = { open: '$$\n', close: '\n$$' };
        const INLINE = { open: '$', close: '$' };

        // Whichever pair is already there wins, so selecting one line inside a
        // block unwraps the block rather than nesting an inline span in it.
        const existing = [BLOCK, INLINE].find(fence => this.fencedBy(fence));
        if (existing) {
            this.toggleFence(existing);
            return;
        }

        // A block of maths sits on its own lines, inline maths does not
        this.toggleFence(selected.includes('\n') ? BLOCK : INLINE);
    }
}

export default MathTool;
