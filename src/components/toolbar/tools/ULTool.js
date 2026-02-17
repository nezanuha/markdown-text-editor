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
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        const syntax = '- ';
        let newText = '';
        if (selectedText.startsWith(syntax)) {
            // Remove the Unordered syntax if it's already wrapped
            newText = selectedText.slice(syntax.length);
        } else {
            // Apply Unordered list syntax
            newText = `${syntax}${selectedText || 'Unordered list'}`;
        }

        this.editor.insertText(newText);
    }
}


export default ULTool;