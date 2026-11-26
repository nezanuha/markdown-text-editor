class Footer {
    /**
     * @param label Translator for the footer's own strings. Counts are given as
     *              "{n} words" rather than a bare "words" so a translation can
     *              put the number where its language wants it.
     */
    constructor(container, options = {}, label = text => text) {
        this.options = options;
        this.label = label;

        this.footer = document.createElement('div');
        this.footer.className = 'editor-footer not-prose fj:me-surface fj:me-surface-outline fj:border-base-soft fj:border-0 fj:border-t fj:flex fj:justify-between fj:items-center fj:px-3 fj:py-1 fj:text-xs fj:opacity-60 fj:select-none';
        this.footer.setAttribute('aria-hidden', 'true');

        this.positionEl = document.createElement('span');
        this.charsEl = document.createElement('span');
        this.wordsEl = document.createElement('span');

        if (this.options.line || this.options.col) {
            this.footer.appendChild(this.positionEl);
        }
        if (this.options.chars) {
            this.footer.appendChild(this.charsEl);
        }
        if (this.options.words) {
            this.footer.appendChild(this.wordsEl);
        }

        container.appendChild(this.footer);
    }

    update(textarea) {
        const value = textarea.value;
        const pos = textarea.selectionStart ?? 0;

        if (this.options.line || this.options.col) {
            const lines = value.substring(0, pos).split('\n');
            const parts = [];
            if (this.options.line) parts.push(this._count('Ln {n}', lines.length));
            if (this.options.col)  parts.push(this._count('Col {n}', lines[lines.length - 1].length + 1));
            this.positionEl.textContent = parts.join(', ');
        }

        if (this.options.chars) {
            this.charsEl.textContent = this._count('{n} chars', value.length);
        }

        if (this.options.words) {
            const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
            this.wordsEl.textContent = this._count('{n} words', wordCount);
        }
    }

    _count(template, n) {
        return this.label(template).replace('{n}', n.toLocaleString());
    }
}

export default Footer;
