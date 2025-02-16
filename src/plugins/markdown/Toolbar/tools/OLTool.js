import MakeTool from '../MakeTool.js';

class OLTool extends MakeTool {
    constructor(editor) {
        super(editor, '1.', 'Ordered list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 4H21V6H8V4ZM5 3V6H6V7H3V6H4V4H3V3H5ZM3 14V11.5H5V11H3V10H6V12.5H4V13H6V14H3ZM5 19.5H3V18.5H5V18H3V17H6V21H3V20H5V19.5ZM8 11H21V13H8V11ZM8 18H21V20H8V18Z"></path></svg>
        `);
    }
    
    // You can change how the syntax is applied for this specific tool:
    applySyntax() {
        super.applySyntax('start');  // Only apply strikethrough at the start
    }
}


export default OLTool;