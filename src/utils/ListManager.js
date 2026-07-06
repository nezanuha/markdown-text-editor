class ListManager {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;

        this._keydownHandler = (e) => { if (e.key === 'Enter') this.handleEnter(e); };
        this.textarea.addEventListener('keydown', this._keydownHandler);
    }

    destroy() {
        this.textarea.removeEventListener('keydown', this._keydownHandler);
    }

    handleEnter(event) {
        const { selectionStart, value } = this.textarea;

        const lastNewline = value.lastIndexOf('\n', selectionStart - 1);
        const lineStart = lastNewline + 1;
        const currentLine = value.substring(lineStart, selectionStart);

        // Patterns
        const olMatch = currentLine.match(/^(\s*)(\d+)\.\s/);
        const taskMatch = currentLine.match(/^(\s*)([\-\*] )\[[\s xX]\] /);
        const ulMatch = currentLine.match(/^(\s*)([\-\*] )\s*/);
        const isEmptyList = currentLine.match(/^(\s*)(\d+\.\s|[\-\*] \[[\s xX]\] |[\-\*]\s)$/);

        // Exit list if line is empty
        if (isEmptyList) {
            event.preventDefault();
            const before = value.substring(0, lineStart);
            const after = value.substring(selectionStart);
            this.textarea.value = before + "\n" + after;
            this.textarea.setSelectionRange(lineStart + 1, lineStart + 1);
            this.editor.render();
            this.editor.notifyChange();
            return;
        }

        let continuation = null;
        if (olMatch) {
            continuation = `${olMatch[1]}${parseInt(olMatch[2]) + 1}. `;
        } else if (taskMatch) {
            continuation = `${taskMatch[1]}${taskMatch[2]}[ ] `;
        } else if (ulMatch) {
            continuation = `${ulMatch[1]}${ulMatch[2]}`;
        }

        if (continuation) {
            event.preventDefault();
            const insert = `\n${continuation}`;
            const before = value.substring(0, selectionStart);
            const after = value.substring(selectionStart);
            this.textarea.value = before + insert + after;
            const cursor = selectionStart + insert.length;
            this.textarea.setSelectionRange(cursor, cursor);
            this.editor.render();
            this.editor.notifyChange();
        }
    }
}

export default ListManager;