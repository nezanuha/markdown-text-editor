import MakeTool from '../MakeTool.js';

class ItalicTool extends MakeTool {
    constructor(editor) {
        // Call the parent constructor with the markdown syntax for italic (*)
        super(editor, 'Italic');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg>
        `);
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        let newText = '';
        let offset = 0;

        if (selectedText.startsWith('***') && selectedText.endsWith('***')) {
            // bold+italic selected → remove italic, keep bold
            newText = '**' + selectedText.slice(3, -3) + '**';
        } else if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**')) {
            // full *text* selected → remove italic
            newText = selectedText.slice(1, -1);
        } else if (
            value.substring(selectionStart - 3, selectionStart) === '***' &&
            value.substring(selectionEnd, selectionEnd + 3) === '***'
        ) {
            // cursor inside ***text*** → remove italic, keep bold
            textarea.setSelectionRange(selectionStart - 3, selectionEnd + 3);
            this.editor.insertText(`**${selectedText}**`, 2, 2);
            return;
        } else if (
            value[selectionStart - 1] === '*' &&
            value[selectionEnd] === '*' &&
            value[selectionStart - 2] !== '*' &&
            value[selectionEnd + 1] !== '*'
        ) {
            // cursor inside *text* → remove italic
            textarea.setSelectionRange(selectionStart - 1, selectionEnd + 1);
            this.editor.insertText(selectedText, 0, 0);
            return;
        } else {
            newText = `*${selectedText || 'Italic text'}*`;
            if (!selectedText) offset = 1;
        }

        this.editor.insertText(newText, offset, offset);
    }
}

export default ItalicTool;