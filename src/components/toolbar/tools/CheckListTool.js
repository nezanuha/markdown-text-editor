import MakeTool from '../MakeTool.js';

class CheckListTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Check list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3.5 5.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 11.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 17.5l1.5 1.5l2.5 -2.5" /><path d="M11 6l9 0" /><path d="M11 12l9 0" /><path d="M11 18l9 0" /></svg>
        `);
    }
    
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        const syntax = '- [x] ';
        let newText = '';
        if (selectedText.startsWith(syntax)) {
            // Remove the checklist syntax if it's already wrapped
            newText = selectedText.slice(syntax.length);
        } else {
            // Apply check list syntax
            newText = `${syntax}${selectedText || 'Check list'}`;
        }

        this.editor.insertText(newText);
    }
}


export default CheckListTool;