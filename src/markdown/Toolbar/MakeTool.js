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
        button.className = `markdown-btn ${buttonClass}${buttonClass == 'preview-btn' ? ' sticky right-0 btn-active ' : ' ' }btn-primary btn-ghost btn-xs`;
        button.addEventListener('click', (event) => this.applySyntax(event));  // Default to 'both', can change in child
        return button;
    }
}

export default MakeTool;
