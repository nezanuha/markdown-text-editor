// #components\Toolbar\tools\MarkdownTool.js
class MarkdownTool {
    constructor(editor, syntax, defaultText) {
        this.editor = editor;
        this.syntax = syntax; // Markdown syntax (e.g., ** for bold, * for italic)
        this.defaultText = defaultText; // Default text if nothing is selected
        this.button = this.createButton();
    }

    // Create a button element (can be overridden in child classes)
    createButton(iconHtml) {
        const button = document.createElement('button');
        button.innerHTML = iconHtml;  // Pass icon HTML from child classes
        button.className = 'markdown-btn p-2 hover:bg-stone-200 dark:hover:bg-stone-600 rounded duration-300';
        button.addEventListener('click', () => this.applySyntax());
        return button;
    }

    // Toggle markdown syntax at the current cursor position
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        const syntaxLength = this.syntax.length;

        if (selectedText.startsWith(this.syntax) && selectedText.endsWith(this.syntax)) {
            // If text is already wrapped with the markdown syntax, remove it
            const unformattedText = selectedText.slice(syntaxLength, -syntaxLength);
            this.editor.insertText(unformattedText);
        } else {
            // If no text is selected or it's not wrapped, add the markdown syntax
            const newText = `${this.syntax}${selectedText || this.defaultText}${this.syntax}`;
            this.editor.insertText(newText);
        }
    }
}

export default MarkdownTool;