import MakeTool from '../MakeTool.js';

class OutdentTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Outdent');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H11"/><path d="M21 12H11"/><path d="M21 19H11"/><path d="m7 8-4 4 4 4"/></svg>
        `);
    }
    
    applySyntax(e) {
        const indentManager = this.editor.indentManager;
        if (indentManager) {
            indentManager.outdent();
        }    
    }
}


export default OutdentTool;