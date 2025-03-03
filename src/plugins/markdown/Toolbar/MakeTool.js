class MakeTool {
    constructor(editor, title) {
        this.editor = editor;
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
        button.className = `markdown-btn ${buttonClass}${buttonClass == 'preview-btn' ? ' sticky right-0 bg-stone-100 dark:bg-stone-900 ' : ' ' }p-2 hover:bg-stone-200 dark:hover:bg-stone-600 rounded-sm duration-300 text-stone-900 dark:text-stone-100`;
        button.addEventListener('click', () => this.applySyntax());  // Default to 'both', can change in child
        return button;
    }
}

export default MakeTool;
