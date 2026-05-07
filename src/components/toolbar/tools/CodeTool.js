import MakeTool from '../MakeTool.js';

class CodeTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Code');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg>
        `);
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        // Toggle off: full `code` selected
        if (selectedText.startsWith('`') && selectedText.endsWith('`')) {
            this.editor.insertText(selectedText.slice(1, -1), 0, 0);
            return;
        }

        // Toggle off: cursor is inside `code`
        if (value[selectionStart - 1] === '`' && value[selectionEnd] === '`') {
            textarea.setSelectionRange(selectionStart - 1, selectionEnd + 1);
            this.editor.insertText(selectedText, 0, 0);
            return;
        }

        const newText = `\`${selectedText || 'code'}\``;
        this.editor.insertText(newText, 1, 1);
    }
}

export default CodeTool;
