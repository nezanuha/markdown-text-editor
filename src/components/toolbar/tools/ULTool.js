import MakeTool from '../MakeTool.js';

class ULTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Unordered list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
        `);
    }
    
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        const syntax = '- ';
        let newText = '';
        let offset = 0;

        if (selectedText.startsWith(syntax)) {
            newText = selectedText.slice(syntax.length);
        } else if (value.substring(selectionStart - syntax.length, selectionStart) === syntax) {
            textarea.setSelectionRange(selectionStart - syntax.length, selectionEnd);
            this.editor.insertText(selectedText, 0, 0);
            return;
        } else {
            newText = `${syntax}${selectedText || 'Unordered list'}`;
            offset = syntax.length;
        }

        this.editor.insertText(newText, offset);
    }
}


export default ULTool;