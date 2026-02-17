import MakeTool from '../MakeTool.js';

class IndentTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Indent');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 6l-11 0" /><path d="M20 12l-7 0" /><path d="M20 18l-11 0" /><path d="M4 8l4 4l-4 4" /></svg>
        `);
    }
    
    applySyntax() {
        const indentManager = this.editor.indentManager;
        if (indentManager) {
            indentManager.indent();
        }    
    }
}


export default IndentTool;