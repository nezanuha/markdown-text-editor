// #components/Toolbar/tools/VariableTool.js
import MakeTool from '../MakeTool.js';
import { flattenVariables } from '../../../utils/variables.js';

const ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 4a2 2 0 0 0 -2 2v3a2 2 0 0 1 -2 2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2" /><path d="M17 4a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2v3a2 2 0 0 1 -2 2" /></svg>
`;

class VariableTool extends MakeTool {
    constructor(editor) {
        // MakeTool's constructor calls createButton(), so read config from
        // this.editor there rather than from a field assigned after super()
        super(editor, 'Variables');
    }

    createButton() {
        const variables = Array.isArray(this.editor.options.variables)
            ? this.editor.options.variables
            : [];

        // Nothing usable configured means no button at all, not an empty dropdown
        if (!flattenVariables(variables).length) return null;

        const popoverId = `variable-popover-${Math.random().toString(36).slice(2, 7)}`;

        const btn = document.createElement('button');
        btn.innerHTML = ICON;
        btn.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        btn.type = 'button';
        btn.title = 'Insert variable';
        btn.setAttribute('aria-label', 'Insert variable');
        btn.setAttribute('aria-haspopup', 'menu');
        btn.className = 'markdown-btn variable-btn fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost fj:me-popover-toggle';
        btn.setAttribute('popovertarget', popoverId);

        const popoverContent = document.createElement('div');
        popoverContent.id = popoverId;
        popoverContent.setAttribute('role', 'menu');
        popoverContent.setAttribute('aria-label', 'Variables');
        popoverContent.className = 'fj:me-popover-content';
        popoverContent.setAttribute('popover', '');

        const menu = document.createElement('ul');
        menu.className = 'fj:me-menu';
        menu.setAttribute('role', 'presentation');

        const usable = entry => entry && entry.label && typeof entry.value === 'string';

        for (const entry of variables) {
            if (!entry) continue;

            if (Array.isArray(entry.items)) {
                const items = entry.items.filter(usable);
                if (!items.length) continue;

                const title = document.createElement('li');
                title.className = 'fj:me-menu-title';
                title.setAttribute('role', 'presentation');
                title.textContent = entry.label ?? '';

                const sublist = document.createElement('ul');
                sublist.setAttribute('role', 'group');
                if (entry.label) sublist.setAttribute('aria-label', entry.label);
                items.forEach(item => sublist.appendChild(this.createItem(item, popoverContent)));

                const holder = document.createElement('li');
                holder.setAttribute('role', 'none');
                holder.appendChild(sublist);

                menu.appendChild(title);
                menu.appendChild(holder);
            } else if (usable(entry)) {
                menu.appendChild(this.createItem(entry, popoverContent));
            }
        }

        popoverContent.appendChild(menu);

        const wrapper = document.createElement('div');
        wrapper.className = 'fj:me-popover';
        wrapper.appendChild(btn);
        wrapper.appendChild(popoverContent);

        return wrapper;
    }

    createItem(variable, popoverContent) {
        const li = document.createElement('li');
        li.setAttribute('role', 'none');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.className = 'fj:me-menu-item';
        // textContent, never innerHTML — labels come from user config
        btn.textContent = variable.label;
        btn.title = variable.value;
        btn.addEventListener('click', () => {
            // insertText handles focus, caret, scroll, re-render and onChange
            this.editor.insertText(variable.value, variable.value.length, 0);
            popoverContent.hidePopover();
        });

        li.appendChild(btn);
        return li;
    }

    applySyntax() {}
}

export default VariableTool;
