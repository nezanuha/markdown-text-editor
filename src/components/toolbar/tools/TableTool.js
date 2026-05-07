import MakeTool from '../MakeTool.js';

class TableTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Table');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" /><path d="M3 10h18" /><path d="M10 3v18" /></svg>
        `);
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart } = textarea;
        const value = textarea.value;

        const template = `| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |`;
        const atLineStart = selectionStart === 0 || value[selectionStart - 1] === '\n';
        const text = atLineStart ? template : `\n${template}`;
        this.editor.insertText(text, text.length, 0);
    }
}

export default TableTool;
