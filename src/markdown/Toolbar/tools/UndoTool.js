import MakeTool from '../MakeTool.js';

class UndoTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Undo');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
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