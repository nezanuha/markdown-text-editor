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
            btnWrapper.className = 'fj:bg-stone-100 fj:dark:bg-stone-800 fj:sticky fj:-right-2 fj:border-l fj:border-stone-200 fj:dark:border-stone-700 fj:px-1.5';
            btnWrapper.appendChild(btn);
            return btnWrapper;
        }
        
        return btn;
    }
}

export default MakeTool;
