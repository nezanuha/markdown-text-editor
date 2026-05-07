import MakeTool from '../MakeTool.js';

class BoldTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Bold');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6l0 -7" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg>
        `)
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        let newText = '';
        let offset = 0;

        if (selectedText.startsWith('***') && selectedText.endsWith('***')) {
            // bold+italic selected → remove bold, keep italic
            newText = '*' + selectedText.slice(3, -3) + '*';
        } else if (selectedText.startsWith('**') && selectedText.endsWith('**')) {
            // full **text** selected → remove bold
            newText = selectedText.slice(2, -2);
        } else if (
            value.substring(selectionStart - 3, selectionStart) === '***' &&
            value.substring(selectionEnd, selectionEnd + 3) === '***'
        ) {
            // cursor inside ***text*** → remove bold, keep italic
            textarea.setSelectionRange(selectionStart - 3, selectionEnd + 3);
            this.editor.insertText(`*${selectedText}*`, 1, 1);
            return;
        } else if (
            value.substring(selectionStart - 2, selectionStart) === '**' &&
            value.substring(selectionEnd, selectionEnd + 2) === '**' &&
            value[selectionStart - 3] !== '*' &&
            value[selectionEnd + 2] !== '*'
        ) {
            // cursor inside **text** → remove bold
            textarea.setSelectionRange(selectionStart - 2, selectionEnd + 2);
            this.editor.insertText(selectedText, 0, 0);
            return;
        } else {
            newText = `**${selectedText || 'Bold text'}**`;
            if (!selectedText) offset = 2;
        }

        this.editor.insertText(newText, offset, offset);
    }
}

export default BoldTool;
