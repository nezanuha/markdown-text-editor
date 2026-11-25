/**
 * What changed between two versions of the document, as one span.
 *
 * This was `diffChars` from the `diff` package, a character-level Myers diff
 * of the whole document on every save point. It cost what that costs: 249ms
 * for a 2,000-character paste into a 50,000-character document, 1.4 seconds
 * for 5,000 into 100,000 -- on the main thread, while someone was typing.
 *
 * Nothing needed that resolution. The two users of a step reassemble the whole
 * old value or the whole new one, never the parts between, so trimming the
 * common prefix and the common suffix gives the same two strings back from one
 * replacement: where it starts, what was there, what is there now. Two scans
 * and no allocation beyond the changed text.
 *
 * A step that happens to cover two separate edits collapses into the span that
 * contains both. The values on either side are identical either way, which is
 * all undo and redo put back.
 */
function patchBetween(from, to) {
    const max = Math.min(from.length, to.length);

    let start = 0;
    while (start < max && from[start] === to[start]) start++;

    // The suffix may not reach back past the prefix, or a change like
    // "aa" -> "aaa" counts the same characters twice.
    let tail = 0;
    while (tail < max - start
        && from[from.length - 1 - tail] === to[to.length - 1 - tail]) tail++;

    return {
        at: start,
        removed: from.slice(start, from.length - tail),
        added: to.slice(start, to.length - tail),
    };
}

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
        this._keydownHandler    = (e) => this._onKeyDown(e);
        this._selectHandler     = () => this._updateLastSelection();
        this._mousedownHandler  = () => setTimeout(() => this._updateLastSelection(), 0);
        this._beforeinputHandler = (e) => {
            if (e.inputType === 'historyUndo') { e.preventDefault(); this.undo(); }
            else if (e.inputType === 'historyRedo') { e.preventDefault(); this.redo(); }
        };
        this._inputHandler = (e) => this._onInput(e);
        this._pasteHandler = () => this._saveState();
        this._blurHandler  = () => this._saveState();

        this.textarea.addEventListener('keydown', this._keydownHandler);
        this.textarea.addEventListener('select', this._selectHandler);
        this.textarea.addEventListener('mousedown', this._mousedownHandler);
        this.textarea.addEventListener('beforeinput', this._beforeinputHandler);
        this.textarea.addEventListener('input', this._inputHandler);
        this.textarea.addEventListener('paste', this._pasteHandler);
        this.textarea.addEventListener('blur', this._blurHandler);
    }

    destroy() {
        clearTimeout(this._debounceTimer);
        this.textarea.removeEventListener('keydown', this._keydownHandler);
        this.textarea.removeEventListener('select', this._selectHandler);
        this.textarea.removeEventListener('mousedown', this._mousedownHandler);
        this.textarea.removeEventListener('beforeinput', this._beforeinputHandler);
        this.textarea.removeEventListener('input', this._inputHandler);
        this.textarea.removeEventListener('paste', this._pasteHandler);
        this.textarea.removeEventListener('blur', this._blurHandler);
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

        this.undoStack.push({
            patch: patchBetween(this.lastValue, newValue),
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

    /**
     * Records the current value as one undo step, for a change this manager
     * did not witness.
     *
     * Everything here hangs off DOM events, and assigning `textarea.value`
     * fires none of them. Anything that writes the value directly -- a draft
     * restored from storage, a host setting it from its own code -- was
     * therefore unreachable by Ctrl+Z, which for the draft meant the text it
     * replaced could not be got back at all.
     */
    record() {
        this._saveState();
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const lastStep = this.undoStack.pop();
        const prevValue = this._revert(this.lastValue, lastStep.patch);

        this.redoStack.push({
            patch: lastStep.patch,
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
        const newValue = this._apply(this.lastValue, redoStep.patch);

        this.undoStack.push({
            patch: redoStep.patch,
            selection: { ...this.lastSelection }
        });

        this._restoreState(newValue, redoStep.selection);
    }

    /** Forward: the value as it was after the change. */
    _apply(value, patch) {
        return value.slice(0, patch.at)
            + patch.added
            + value.slice(patch.at + patch.removed.length);
    }

    /** Back: the value as it was before it. */
    _revert(value, patch) {
        return value.slice(0, patch.at)
            + patch.removed
            + value.slice(patch.at + patch.added.length);
    }

    _restoreState(value, selection) {
        this.textarea.value = value;
        this.textarea.setSelectionRange(selection.selectionStart, selection.selectionEnd);
        this.lastValue = value;
        this.lastSelection = { ...selection };

        if (this.editor.render) this.editor.render();
        this.editor.notifyChange();
        this.textarea.focus();
    }
}