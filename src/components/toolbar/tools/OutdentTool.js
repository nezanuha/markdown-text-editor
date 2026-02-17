import MakeTool from '../MakeTool.js';

class OutdentTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Outdent');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 6l-7 0" /><path d="M20 12l-9 0" /><path d="M20 18l-7 0" /><path d="M8 8l-4 4l4 4" /></svg>
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