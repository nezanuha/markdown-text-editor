import MakeTool from '../MakeTool.js';

class HrTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Horizontal Rule');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 12l16 0" stroke-width="3"/><path d="M4 7l6 0" /><path d="M4 17l6 0" /><path d="M14 7l6 0" /><path d="M14 17l6 0" /></svg>
        `);
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart } = textarea;
        const value = textarea.value;

        const atLineStart = selectionStart === 0 || value[selectionStart - 1] === '\n';
        const text = atLineStart ? '---\n' : '\n\n---\n';
        this.editor.insertText(text, text.length, 0);
    }
}

export default HrTool;
