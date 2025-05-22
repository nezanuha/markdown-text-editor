import UndoTool from '../components/toolbar/tools/UndoTool.js';
import RedoTool from '../components/toolbar/tools/RedoTool.js';

class UndoRedoManager {
    constructor(editor) {
        this.editor = editor;
        this.undoStack = [];
        this.redoStack = [];
        this.lastValue = editor.usertextarea.value;

        this.initUndoRedoTools();
        this.bindInputTracking();
        this.bindKeyboardShortcuts();
    }

    initUndoRedoTools() {
        const { toolbar } = this.editor.options;

        if (toolbar.includes('undo')) {
            new UndoTool(this.editor);
        }

        if (toolbar.includes('redo')) {
            new RedoTool(this.editor);
        }
    }

    bindInputTracking() {
        const textarea = this.editor.usertextarea;

        textarea.addEventListener('input', () => {
            const currentValue = textarea.value;

            // Only save if the value actually changed
            if (currentValue !== this.lastValue) {
                this.undoStack.push(this.lastValue);
                this.lastValue = currentValue;
                this.redoStack = []; // Clear redo stack on new input
            }
        });
    }

    bindKeyboardShortcuts() {
        const textarea = this.editor.usertextarea;

        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            } else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
                       ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                this.redo();
            }
        });
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const textarea = this.editor.usertextarea;
        const currentValue = textarea.value;

        this.redoStack.push(currentValue);

        const previousValue = this.undoStack.pop();
        this.lastValue = previousValue;
        textarea.value = previousValue;
        this.editor.render();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const textarea = this.editor.usertextarea;
        const currentValue = textarea.value;

        this.undoStack.push(currentValue);

        const nextValue = this.redoStack.pop();
        this.lastValue = nextValue;
        textarea.value = nextValue;
        this.editor.render();
    }
}

export default UndoRedoManager;