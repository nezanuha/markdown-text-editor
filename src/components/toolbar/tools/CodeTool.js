import Tool from '../Tool.js';

class CodeTool extends Tool {
    constructor(editor) {
        super(editor, 'Code');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg>
        `);
    }

    applySyntax() {
        this.trimSelection();
        // Shared with maths rather than kept here: the length guard that comes
        // with it also stops a lone backtick being selected and sliced away to
        // nothing, which this did before.
        this.toggleFence({ open: '`', placeholder: 'code' });
    }
}

export default CodeTool;
