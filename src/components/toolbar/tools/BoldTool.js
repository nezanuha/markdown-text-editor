import MakeTool from '../MakeTool.js';

class BoldTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Bold');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6l0 -7" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg>
        `)
    }

    // Apply bold syntax (**bold**)
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        const syntax = '**';
        let newText = '';
        if (selectedText.startsWith(syntax) && selectedText.endsWith(syntax)) {
            // Remove the bold syntax if it's already wrapped
            newText = selectedText.slice(syntax.length, -syntax.length);
        } else {
            // Apply bold syntax
            newText = `${syntax}${selectedText || 'Bold text'}${syntax}`;
        }

        this.editor.insertText(newText);
    }
}

export default BoldTool;
