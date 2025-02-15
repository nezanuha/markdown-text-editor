class MakeTool {
    constructor(editor, syntax, title) {
        this.editor = editor;
        this.syntax = syntax; // Markdown syntax (e.g., ** for bold, * for italic)
        this.defaultText = `${title} text`; // Default text if nothing is selected
        this.button = this.createButton();
        this.title = title
    }

    // Create a button element (can be overridden in child classes)
    createButton(iconHtml) {
        const button = document.createElement('button');
        const buttonClass = this.title ? `${this.title.replace(/ /g, '-')}-btn`.toLowerCase() : '';
        button.innerHTML = iconHtml;  // Pass icon HTML from child classes
        button.type = 'button';
        button.title = this.title;
        button.className = `markdown-btn ${buttonClass}${buttonClass == 'preview-btn' ? ' sticky right-0 bg-stone-100 dark:bg-stone-900 ' : ' ' }p-2 hover:bg-stone-200 dark:hover:bg-stone-600 rounded duration-300 text-stone-900 dark:text-stone-100`;
        button.addEventListener('click', () => this.applySyntax('both'));  // Default to 'both', can change in child
        return button;
    }

    // Toggle markdown syntax at the current cursor position
    applySyntax(position = 'both') {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        const syntaxLength = this.syntax.length;

        // Check which type of syntax to apply based on the position
        let newText = '';
        if(position === 'start'){
            if (selectedText.startsWith(this.syntax)) {
                // If text is already wrapped with the markdown syntax, remove it
                const unformattedText = selectedText.slice(syntaxLength);
                this.editor.insertText(unformattedText);
            }else{
                newText = `${this.syntax} ${selectedText || this.defaultText}`;
                // Insert the new formatted text
                this.editor.insertText(newText);
            }
        } else if (position === 'end') {
            if (selectedText.startsWith(this.syntax)) {
                // If text is already wrapped with the markdown syntax, remove it
                const unformattedText = selectedText.slice(syntaxLength);
                this.editor.insertText(unformattedText);
            }else{
                newText = `${selectedText || this.defaultText}${this.syntax}`;
                // Insert the new formatted text
                this.editor.insertText(newText);
            }
        } else {
            if (selectedText.startsWith(this.syntax) && selectedText.endsWith(this.syntax)) {
                // If text is already wrapped with the markdown syntax, remove it
                const unformattedText = selectedText.slice(syntaxLength, -syntaxLength);
                this.editor.insertText(unformattedText);
            }else{
                newText = `${this.syntax}${selectedText || this.defaultText}${this.syntax}`;
                // Insert the new formatted text
                this.editor.insertText(newText);
            }
        }
    }
}

export default MakeTool;
