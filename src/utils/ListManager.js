class ListManager {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;

        // Attach the listener directly here
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleEnter(e);
            }
        });
    }

    handleEnter(event) {
        const { selectionStart, value } = this.textarea;

        const lastNewline = value.lastIndexOf('\n', selectionStart - 1);
        const lineStart = lastNewline + 1;
        const currentLine = value.substring(lineStart, selectionStart);

        // Patterns
        const olMatch = currentLine.match(/^(\s*)(\d+)\.\s/);
        const ulMatch = currentLine.match(/^(\s*)([\-\*] )\s*/);
        const taskMatch = currentLine.match(/^(\s*)(\[[\s xX]\] )\s*/);
        const isEmptyList = currentLine.match(/^(\s*)(\d+\.\s|[\-\*]\s|\[[\s xX]\]\s)$/);

        // Exit list if line is empty
        if (isEmptyList) {
            event.preventDefault();
            const before = value.substring(0, lineStart);
            const after = value.substring(selectionStart);
            this.textarea.value = before + "\n" + after;
            this.textarea.setSelectionRange(lineStart + 1, lineStart + 1);
            this.editor.render(); // Trigger editor refresh
            return;
        }

        let continuation = null;
        if (olMatch) {
            continuation = `${olMatch[1]}${parseInt(olMatch[2]) + 1}. `;
        } else if (taskMatch) {
            continuation = `${taskMatch[1]}[ ] `;
        } else if (ulMatch) {
            continuation = `${ulMatch[1]}${ulMatch[2]}`;
        }

        if (continuation) {
            event.preventDefault();
            // Use the editor's existing helper
            this.editor.insertText(`\n${continuation}`); 
            // editor.insertText usually calls render(), 
            // but we call it again to be safe if it doesn't
            this.editor.render(); 
        }
    }
}

export default ListManager;