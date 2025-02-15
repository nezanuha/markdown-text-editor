import MakeTool from '../MakeTool.js';

class OLTool extends MakeTool {
    constructor(editor) {
        super(editor, '1.', 'Ordered list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
            </svg>
        `);
    }
    
    // You can change how the syntax is applied for this specific tool:
    applySyntax() {
        super.applySyntax('start');  // Only apply strikethrough at the start
    }
}


export default OLTool;