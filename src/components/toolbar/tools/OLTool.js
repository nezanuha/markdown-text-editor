import MakeTool from '../MakeTool.js';

class OLTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Ordered list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M11 6h9" /><path d="M11 12h9" /><path d="M12 18h8" /><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4" /><path d="M6 10v-6l-2 2" /></svg>
        `);
    }
    
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        const syntax = '1. ';
        let newText = '';
        let offset = 0;

        if (selectedText.startsWith(syntax)) {
            newText = selectedText.slice(syntax.length);
        } else if (value.substring(selectionStart - syntax.length, selectionStart) === syntax) {
            textarea.setSelectionRange(selectionStart - syntax.length, selectionEnd);
            this.editor.insertText(selectedText, 0, 0);
            return;
        } else {
            newText = `${syntax}${selectedText || 'Ordered list'}`;
            offset = syntax.length;
        }

        this.editor.insertText(newText, offset);
    }
}


export default OLTool;