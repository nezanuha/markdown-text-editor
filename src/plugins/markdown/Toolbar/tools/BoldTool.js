import MakeTool from '../MakeTool.js';

class BoldTool extends MakeTool {
    constructor(editor) {
        // Call the parent constructor with the markdown syntax for bold (**)
        super(editor, '**', 'Bold');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>
            </svg>
        `);
    }
}

export default BoldTool;