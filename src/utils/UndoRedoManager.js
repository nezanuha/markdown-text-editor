import { diffChars } from 'diff';

export default class UndoRedoManager {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;
        this.undoStack = [];
        this.redoStack = [];
        
        // Internal tracking
        this.lastValue = this.textarea.value;
        this.lastSelection = {
            selectionStart: this.textarea.selectionStart,
            selectionEnd: this.textarea.selectionEnd
        };

        // Settings
        this.debounceDelay = 1000;
        this.maxStackSize = 100;
        this._debounceTimer = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.textarea.addEventListener('keydown', (e) => this._onKeyDown(e));
        
        // Listen for selection changes to "pre-save" state before an overwrite happens
        this.textarea.addEventListener('select', () => this._updateLastSelection());
        this.textarea.addEventListener('mousedown', () => {
            // Check selection after a short delay to let the click finish
            setTimeout(() => this._updateLastSelection(), 0);
        });

        this.textarea.addEventListener('beforeinput', (e) => {
            if (e.inputType === 'historyUndo') {
                e.preventDefault();
                this.undo();
            } else if (e.inputType === 'historyRedo') {
                e.preventDefault();
                this.redo();
            }
        });

        this.textarea.addEventListener('input', (e) => this._onInput(e));
        this.textarea.addEventListener('paste', () => this._saveState());
        this.textarea.addEventListener('blur', () => this._saveState());
    }

    _updateLastSelection() {
        // We only care about updating this if the value hasn't changed yet.
        // This marks the "starting point" for the next undo step.
        this.lastSelection = {
            selectionStart: this.textarea.selectionStart,
            selectionEnd: this.textarea.selectionEnd
        };
    }

    _onKeyDown(e) {
        const modifier = e.metaKey || e.ctrlKey;
        const isZ = e.key.toLowerCase() === 'z';
        const isY = e.key.toLowerCase() === 'y';
        const isShift = e.shiftKey;

        // 1. CRITICAL: Save state before selection is overwritten or deleted
        const hasSelection = this.textarea.selectionStart !== this.textarea.selectionEnd;
        const isDeletiveKey = e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter';

        if (hasSelection && (e.key.length === 1 || isDeletiveKey)) {
            this._saveState();
        }

        // 2. Save state on structural keys (Enter, Delete, etc.) or generic Modifiers
        if (modifier || isDeletiveKey) {
            this._saveState();
        }

        // 3. UNDO: (Cmd+Z or Ctrl+Z)
        if (modifier && isZ && !isShift) {
            e.preventDefault();
            this.undo();
        } 
        
        // 4. REDO: (Cmd+Shift+Z, Ctrl+Shift+Z, or Ctrl+Y)
        else if (modifier && ( (isShift && isZ) || (!e.metaKey && isY) )) {
            e.preventDefault();
            this.redo();
        }
    }

    _onInput(e) {
        clearTimeout(this._debounceTimer);
        const value = this.textarea.value;
        const lastChar = value[this.textarea.selectionStart - 1];
        
        if (lastChar && /[\s.,;:!?()\[\]{}'"`~]/.test(lastChar)) {
            this._saveState();
        } else {
            this._debounceTimer = setTimeout(() => this._saveState(), this.debounceDelay);
        }
    }

    _saveState() {
        const newValue = this.textarea.value || '';
    
        // 1. If nothing changed, exit immediately to save CPU
        if (newValue === this.lastValue) return;

        // 2. Clear any pending debounced timers so we don't save twice
        clearTimeout(this._debounceTimer);

        const diff = diffChars(this.lastValue, newValue);
        
        this.undoStack.push({
            diff,
            selection: { ...this.lastSelection }
        });

        // --- Performance Optimization: Max Depth ---
        // If the stack exceeds the limit, remove the oldest entry (bottom of stack)
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift(); 
        }

        this.lastValue = newValue;
        this._updateLastSelection();
        this.redoStack = []; // Standard: typing new text clears redo history
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const lastStep = this.undoStack.pop();
        const prevValue = this._revertDiff(this.lastValue, lastStep.diff);

        this.redoStack.push({
            diff: lastStep.diff,
            selection: { 
                selectionStart: this.textarea.selectionStart, 
                selectionEnd: this.textarea.selectionEnd 
            }
        });

        this._restoreState(prevValue, lastStep.selection);
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const redoStep = this.redoStack.pop();
        const newValue = this._applyDiff(this.lastValue, redoStep.diff);

        this.undoStack.push({
            diff: redoStep.diff,
            selection: { ...this.lastSelection }
        });

        this._restoreState(newValue, redoStep.selection);
    }

    _applyDiff(oldValue, diff) {
        let newValue = '';
        diff.forEach(part => { if (!part.removed) newValue += part.value; });
        return newValue;
    }

    _revertDiff(currentValue, diff) {
        let oldValue = '';
        diff.forEach(part => { if (!part.added) oldValue += part.value; });
        return oldValue;
    }

    _restoreState(value, selection) {
        this.textarea.value = value;
        this.textarea.setSelectionRange(selection.selectionStart, selection.selectionEnd);
        this.lastValue = value;
        this.lastSelection = { ...selection };
        
        if (this.editor.render) this.editor.render();
        this.textarea.focus();
    }
}