import MakeTool from '../MakeTool.js';

class CheckListTool extends MakeTool {
    constructor(editor) {
        super(editor, '- [x]', 'Check list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>
        `);
    }
    
    // You can change how the syntax is applied for this specific tool:
    applySyntax() {
        super.applySyntax('start');  // Only apply strikethrough at the start
    }
}


export default CheckListTool;