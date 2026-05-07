import MakeTool from '../MakeTool.js';

class StrikethroughTool extends MakeTool {
    constructor(editor) {
        // Call the parent constructor with the markdown syntax for strikethrough (~~)
        super(editor, 'Strikethrough');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M16 6.5a4 2 0 0 0 -4 -1.5h-1a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-1.5a4 2 0 0 1 -4 -1.5" /></svg>
        `);
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        const syntax = '~~';
        let newText = '';
        let offset = 0;

        if (selectedText.startsWith(syntax) && selectedText.endsWith(syntax)) {
            // full ~~text~~ selected → remove
            newText = selectedText.slice(syntax.length, -syntax.length);
        } else if (
            value.substring(selectionStart - 2, selectionStart) === syntax &&
            value.substring(selectionEnd, selectionEnd + 2) === syntax
        ) {
            // cursor inside ~~text~~ → remove
            textarea.setSelectionRange(selectionStart - 2, selectionEnd + 2);
            this.editor.insertText(selectedText, 0, 0);
            return;
        } else {
            newText = `${syntax}${selectedText || 'Strikethrough text'}${syntax}`;
            offset = syntax.length;
        }

        this.editor.insertText(newText, offset, offset);
    }
}

export default StrikethroughTool;