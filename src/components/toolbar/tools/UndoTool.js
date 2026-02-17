import MakeTool from '../MakeTool.js';

class UndoTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Undo');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg>
        `);
    }

    applySyntax() {
        // Check if Undo is available and perform the undo action
        const undoRedoManager = this.editor.undoRedoManager;
        if (undoRedoManager) {
            undoRedoManager.undo();
        }
    }
}

export default UndoTool;