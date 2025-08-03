class MakeTool {
    constructor(editor, title) {
        this.editor = editor;
        this.defaultText = `${title} text`; // Default text if nothing is selected
        this.button = this.createButton();
        this.title = title
    }

    // Create a button element (can be overridden in child classes)
    createButton(iconHtml) {
        const btn = document.createElement('button');
        const btnClass = this.title ? `${this.title.replace(/ /g, '-')}-btn`.toLowerCase() : '';
        btn.innerHTML = iconHtml;  // Pass icon HTML from child classes
        btn.type = 'button';
        btn.title = this.title;
        btn.className = `markdown-btn ${btnClass} btn btn-sm btn-square btn-ghost`;
        btn.addEventListener('click', (event) => this.applySyntax(event));  // Default to 'both', can change in child

        if(btnClass == 'preview-btn') {
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'surface surface-1 surface-outline border-0 border-l sticky -right-2 px-1.5';
            btnWrapper.appendChild(btn);
            return btnWrapper;
        }
        
        return btn;
    }
}

export default MakeTool;
