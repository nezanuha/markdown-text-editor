import MakeTool from '../MakeTool.js';

class ULTool extends MakeTool {
    constructor(editor) {
        super(editor, '-', 'Unordered list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/></svg>
        `);
    }
    
    // You can change how the syntax is applied for this specific tool:
    applySyntax() {
        super.applySyntax('start');  // Only apply strikethrough at the start
    }
}


export default ULTool;