import MakeTool from '../MakeTool.js';

class RedoTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Redo');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
            </svg>
        `);
    }

    applySyntax() {
        // Check if Redo is available and perform the redo action
        const undoRedoManager = this.editor.undoRedoManager;
        if (undoRedoManager) {
            undoRedoManager.redo();
        }
    }
}

export default RedoTool;
