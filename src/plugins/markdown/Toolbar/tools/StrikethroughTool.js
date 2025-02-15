import MakeTool from '../MakeTool.js';

class StrikethroughTool extends MakeTool {
    constructor(editor) {
        // Call the parent constructor with the markdown syntax for strikethrough (~~)
        super(editor, '~~', 'strikethrough text');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4H9a3 3 0 0 0-2.83 4"/>
                <path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>
            </svg>
        `);
    }
}

export default StrikethroughTool;