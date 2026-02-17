import MakeTool from '../MakeTool.js';

class RedoTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Redo');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 14l4 -4l-4 -4" /><path d="M19 10h-11a4 4 0 1 0 0 8h1" /></svg>
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
