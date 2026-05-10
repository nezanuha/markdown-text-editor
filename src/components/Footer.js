class Footer {
    constructor(container, options = {}) {
        this.options = options;

        this.footer = document.createElement('div');
        this.footer.className = 'editor-footer not-prose fj:me-surface fj:me-surface-outline fj:border-base-soft fj:border-0 fj:border-t fj:flex fj:justify-between fj:items-center fj:px-3 fj:py-1 fj:text-xs fj:opacity-60 fj:select-none';
        this.footer.setAttribute('aria-hidden', 'true');

        this.positionEl = document.createElement('span');
        this.charsEl = document.createElement('span');

        if (this.options.line || this.options.col) {
            this.footer.appendChild(this.positionEl);
        }
        if (this.options.chars) {
            this.footer.appendChild(this.charsEl);
        }

        container.appendChild(this.footer);
    }

    update(textarea) {
        const value = textarea.value;
        const pos = textarea.selectionStart ?? 0;

        if (this.options.line || this.options.col) {
            const lines = value.substring(0, pos).split('\n');
            const parts = [];
            if (this.options.line) parts.push(`Ln ${lines.length}`);
            if (this.options.col)  parts.push(`Col ${lines[lines.length - 1].length + 1}`);
            this.positionEl.textContent = parts.join(', ');
        }

        if (this.options.chars) {
            this.charsEl.textContent = `${value.length.toLocaleString()} chars`;
        }
    }
}

export default Footer;
