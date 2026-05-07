import MakeTool from '../MakeTool.js';

class BlockQuoteTool extends MakeTool {
    constructor(editor) {
        // Call the parent constructor with the markdown syntax for italic (*)
        super(editor, 'Blockquote');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /></svg>
        `);
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        const syntax = '>';
        let newText = '';
        let offset = 0;

        if (selectedText.startsWith(syntax)) {
            newText = selectedText.slice(syntax.length);
        } else if (value.substring(selectionStart - syntax.length, selectionStart) === syntax) {
            textarea.setSelectionRange(selectionStart - syntax.length, selectionEnd);
            this.editor.insertText(selectedText, 0, 0);
            return;
        } else {
            newText = `${syntax}${selectedText || 'Blockquote text'}`;
            if (!selectedText) offset = syntax.length;
        }

        this.editor.insertText(newText, offset);
    }
}

export default BlockQuoteTool;