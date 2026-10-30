class Tool {
    constructor(editor, title) {
        this.editor = editor;
        this.defaultText = `${title} text`; // Default text if nothing is selected
        this.button = this.createButton();
        this.title = title
    }

    /**
     * Shrinks the selection so it holds no leading or trailing whitespace.
     *
     * Double-clicking a word takes the space after it in Chrome and usually in
     * Edge, and triple-clicking a line takes the newline. Wrapping that raw
     * selection puts the closing marker on the wrong side of the space, giving
     * `**Lorem **ipsum`, which no parser reads as bold (#47).
     *
     * Call it first in applySyntax for any tool that wraps a selection inline.
     * Line based tools do not want it: a trailing newline is what tells them
     * which lines the selection covers.
     *
     * A selection that is nothing but whitespace is left alone, since trimming
     * it would leave an empty range and change what the tool does.
     */
    trimSelection() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd, value } = textarea;
        if (selectionStart === selectionEnd) return;

        let start = selectionStart;
        let end = selectionEnd;
        while (start < end && /\s/.test(value[start])) start++;
        while (end > start && /\s/.test(value[end - 1])) end--;

        if (start === end) return;
        if (start !== selectionStart || end !== selectionEnd) {
            textarea.setSelectionRange(start, end);
        }
    }

    // Create a button element (can be overridden in child classes)
    createButton(iconHtml) {
        const btn = document.createElement('button');
        const btnClass = this.title ? `${this.title.replace(/ /g, '-')}-btn`.toLowerCase() : '';
        btn.innerHTML = iconHtml;
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('aria-hidden', 'true');
        btn.type = 'button';
        // The class stays keyed on the English title so styling and tests are
        // unaffected by translation; only what the user sees is translated.
        btn.title = this.title ? this.editor.label(this.title) : this.title;
        btn.className = `markdown-btn ${btnClass} fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost`;
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

export default Tool;
