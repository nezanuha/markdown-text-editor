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
        btn.className = `markdown-btn ${btnClass} fj:btn fj:btn-sm fj:btn-square fj:btn-ghost`;
        btn.addEventListener('click', (event) => this.applySyntax(event));  // Default to 'both', can change in child

        if(btnClass == 'preview-btn') {
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'fj:surface fj:surface-1 fj:surface-outline fj:border-0 fj:border-l fj:sticky fj:-right-2 fj:px-1.5';
            btnWrapper.appendChild(btn);
            return btnWrapper;
        }
        
        return btn;
    }
}

export default MakeTool;
