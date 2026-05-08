import MakeTool from '../MakeTool.js';

class HeadingTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Heading');
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
        btn.title = 'Heading';
        btn.className = 'markdown-btn heading-btn fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost fj:me-popover-toggle';
        btn.setAttribute('popovertarget', popoverId);

        const popoverContent = document.createElement('div');
        popoverContent.id = popoverId;
        popoverContent.tabIndex = 0;
        popoverContent.className = 'fj:me-popover-content';
        popoverContent.setAttribute('popover', '');

        const menu = document.createElement('ul');
        menu.className = 'fj:me-menu';

        const headingClasses = ['fj:me-heading-xl', 'fj:me-heading-lg', 'fj:me-heading-md', 'fj:me-heading-sm', 'fj:me-heading-xs', 'fj:me-heading-xs'];

        for (let level = 1; level <= 6; level++) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.className = `fj:me-menu-item ${headingClasses[level - 1]}`;
            a.textContent = `Heading ${level}`;
            a.addEventListener('click', () => {
                this.applyHeading(level);
                popoverContent.hidePopover();
            });
            li.appendChild(a);
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

        textarea.value = `${value.substring(0, lineStart)}${newText}${value.substring(lineEnd)}`;
        textarea.focus();

        const textStart = lineStart + (newText === cleanText || newText === 'Heading' ? 0 : prefix.length);
        const textEnd = lineStart + newText.length;
        textarea.setSelectionRange(textStart, textEnd);

        this.editor.scrollToView();
        this.editor.render();
    }

    applySyntax() {}
}

export default HeadingTool;
