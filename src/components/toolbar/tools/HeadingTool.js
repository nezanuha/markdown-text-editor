import Tool from '../Tool.js';

const ALL_LEVELS = [1, 2, 3, 4, 5, 6];

/**
 * Accepts `{ levels: [2, 3, 4] }`. Anything outside 1-6, duplicated or not a
 * whole number is dropped, and a list with nothing usable in it falls back to
 * all six rather than rendering an empty menu.
 */
function parseLevels(levels) {
    if (levels === undefined) return ALL_LEVELS;

    if (!Array.isArray(levels)) {
        console.warn('[MarkdownEditor] heading levels must be an array of numbers 1-6. Using all six.', levels);
        return ALL_LEVELS;
    }

    const valid = [...new Set(levels)]
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 6)
        .sort((a, b) => a - b);

    if (valid.length !== levels.length) {
        console.warn('[MarkdownEditor] Ignored heading levels outside 1-6, or repeated.', levels);
    }
    if (!valid.length) {
        console.warn('[MarkdownEditor] No usable heading levels. Using all six.', levels);
        return ALL_LEVELS;
    }
    return valid;
}

class HeadingTool extends Tool {
    constructor(editor, config = {}) {
        super(editor, 'Heading');
        // Tool's constructor already called createButton() before this line, so
        // that first button is built with the default levels and thrown away.
        // Assigning before the second call is what makes the config take effect.
        this.levels = parseLevels(config?.levels);
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 12h10" /><path d="M7 5v14" /><path d="M17 5v14" /><path d="M15 19h4" /><path d="M15 5h4" /><path d="M5 19h4" /><path d="M5 5h4" /></svg>
        `);
    }

    createButton(iconHtml) {
        const popoverId = `heading-popover-${Math.random().toString(36).slice(2, 7)}`;

        const btn = document.createElement('button');
        btn.innerHTML = iconHtml;
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('aria-hidden', 'true');
        btn.type = 'button';
        btn.title = this.editor.label('Heading');
        btn.setAttribute('aria-label', this.editor.label('Heading'));
        btn.setAttribute('aria-haspopup', 'menu');
        btn.className = 'markdown-btn heading-btn fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost fj:me-popover-toggle';
        btn.setAttribute('popovertarget', popoverId);

        const popoverContent = document.createElement('div');
        popoverContent.id = popoverId;
        popoverContent.setAttribute('role', 'menu');
        popoverContent.setAttribute('aria-label', this.editor.label('Heading level'));
        popoverContent.className = 'fj:me-popover-content';
        popoverContent.setAttribute('popover', '');

        const menu = document.createElement('ul');
        menu.className = 'fj:me-menu';
        menu.setAttribute('role', 'presentation');

        const headingClasses = ['fj:me-heading-xl', 'fj:me-heading-lg', 'fj:me-heading-md', 'fj:me-heading-sm', 'fj:me-heading-xs', 'fj:me-heading-xs'];

        for (const level of (this.levels ?? ALL_LEVELS)) {
            const li = document.createElement('li');
            li.setAttribute('role', 'none');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('role', 'menuitem');
            btn.className = `fj:me-menu-item ${headingClasses[level - 1]}`;
            btn.textContent = `${this.editor.label('Heading')} ${level}`;
            btn.addEventListener('click', () => {
                this.applyHeading(level);
                popoverContent.hidePopover();
            });
            li.appendChild(btn);
            menu.appendChild(li);
        }

        popoverContent.appendChild(menu);

        const wrapper = document.createElement('div');
        wrapper.className = 'fj:me-popover';
        wrapper.appendChild(btn);
        wrapper.appendChild(popoverContent);

        return wrapper;
    }

    applyHeading(level) {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;

        // Always work on the full current line so existing heading prefixes are included
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEndRaw = value.indexOf('\n', selectionEnd);
        const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;

        const lineText = value.substring(lineStart, lineEnd);
        const existingLevel = (lineText.match(/^(#+)\s/) || [])[1];
        const cleanText = lineText.replace(/^#+\s*/, '');
        const prefix = `${'#'.repeat(level)} `;

        // Same level clicked again → remove heading
        const newText = (existingLevel && existingLevel.length === level)
            ? (cleanText || 'Heading')
            : (cleanText ? `${prefix}${cleanText}` : `${prefix}Heading`);

        // Assigning value sends the textarea back to the top, so hold the
        // reader's place across the edit the same way insertText does (#46)
        const scrollTop = textarea.scrollTop;

        textarea.value = `${value.substring(0, lineStart)}${newText}${value.substring(lineEnd)}`;
        textarea.focus();

        const textStart = lineStart + (newText === cleanText || newText === 'Heading' ? 0 : prefix.length);
        const textEnd = lineStart + newText.length;
        textarea.setSelectionRange(textStart, textEnd);

        this.editor.render();
        this.editor.notifyChange();
        this.editor.restoreScroll(scrollTop);
    }

    applySyntax() {}
}

export default HeadingTool;
