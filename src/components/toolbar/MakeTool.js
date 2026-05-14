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
        btn.innerHTML = iconHtml;
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('aria-hidden', 'true');
        btn.type = 'button';
        btn.title = this.title;
        btn.className = `markdown-btn ${btnClass} fj:me-btn fj:me-btn-square fj:me-btn-ghost`;
        btn.addEventListener('click', (event) => this.applySyntax(event));  // Default to 'both', can change in child

        if(btnClass == 'preview-btn') {
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'fj:me-surface fj:me-surface-outline fj:border-base-soft fj:border-0 fj:border-l fj:sticky fj:-right-2 fj:px-1.5';
            btnWrapper.appendChild(btn);
            return btnWrapper;
        }
        
        return btn;
    }
}

export default MakeTool;
