import { diffChars } from 'diff';

export default class UndoRedoManager {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;
        this.undoStack = [];
        this.redoStack = [];
        this.lastValue = this.textarea.value;
        this.lastSelection = {
            selectionStart: this.textarea.selectionStart,
            selectionEnd: this.textarea.selectionEnd
        };
        this.debounceDelay = 1000;

        this._bindEvents();
        // No need to push initial state, just track lastValue
    }

    _bindEvents() {
        this.textarea.addEventListener('keydown', (e) => this._onKeyDown(e));
        this.textarea.addEventListener('input', (e) => this._onInput(e));
        this.textarea.addEventListener('paste', () => this._saveState());
        this.textarea.addEventListener('blur', () => this._saveState());
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
                this._saveState();
            }
        });
    }

    _onKeyDown(e) {
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

        if (ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
            return;
        }
        if (ctrlKey && ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
            e.preventDefault();
            this.redo();
            return;
        }
    }

    _onInput(e) {
        clearTimeout(this._debounceTimer);

        // Save point if the last character is a word boundary
        const value = this.textarea.value;
        const lastChar = value[this.textarea.selectionStart - 1];
        if (lastChar && /[\s.,;:!?()\[\]{}'"`~]/.test(lastChar)) {
            this._saveState();
        } else {
            // Otherwise, debounce save point
            this._debounceTimer = setTimeout(() => {
                this._saveState();
            }, this.debounceDelay);
        }
    }

    _saveState() {
        const newValue = this.textarea.value || '';
        if (newValue !== this.lastValue) {
            // Store the diff array, not a patch
            const diff = diffChars(this.lastValue, newValue);
            this.undoStack.push({
                diff,
                selection: { ...this.lastSelection }
            });
            this.lastValue = newValue;
            this.lastSelection = {
                selectionStart: this.textarea.selectionStart,
                selectionEnd: this.textarea.selectionEnd
            };
            this.redoStack = [];
        }
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const lastStep = this.undoStack.pop();

        // Revert the diff
        const prevValue = this._revertDiff(this.lastValue, lastStep.diff);
        this.redoStack.push({
            diff: lastStep.diff,
            selection: { ...this.lastSelection }
        });

        this._restoreState(prevValue, lastStep.selection);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const redoStep = this.redoStack.pop();

        // Re-apply the diff
        const newValue = this._applyDiff(this.lastValue, redoStep.diff);
        this.undoStack.push({
            diff: redoStep.diff,
            selection: { ...redoStep.selection }
        });

        this._restoreState(newValue, redoStep.selection);
    }

    _applyDiff(oldValue, diff) {
        // Reconstruct newValue from diff
        let newValue = '';
        diff.forEach(part => {
            if (!part.removed) {
                newValue += part.value;
            }
        });
        return newValue;
    }

    _revertDiff(newValue, diff) {
        // Reconstruct oldValue from diff
        let oldValue = '';
        diff.forEach(part => {
            if (!part.added) {
                oldValue += part.value;
            }
        });
        return oldValue;
    }

    _restoreState(value, selection) {
        this.textarea.value = value;
        this.textarea.setSelectionRange(
            selection.selectionStart,
            selection.selectionEnd
        );
        this.lastValue = value;
        this.lastSelection = { ...selection };
        this.editor.render();
    }
}
