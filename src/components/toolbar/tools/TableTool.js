import Tool from '../Tool.js';

const MAX_COLS = 8;
const MAX_ROWS = 8;

class TableTool extends Tool {
    constructor(editor) {
        super(editor, 'Table');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" /><path d="M3 10h18" /><path d="M10 3v18" /></svg>
        `);
    }

    /**
     * A grid to drag across, rather than a fixed three by three.
     *
     * Choosing the shape before the table exists saves adding the fourth
     * column afterwards, and it is the one piece of table UI everybody already
     * knows: the same block of squares sits behind the table button in every
     * word processor.
     */
    createButton(iconHtml) {
        const popoverId = `table-popover-${Math.random().toString(36).slice(2, 7)}`;

        const btn = document.createElement('button');
        btn.innerHTML = iconHtml;
        btn.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        btn.type = 'button';
        btn.title = this.editor.label('Table');
        btn.setAttribute('aria-label', this.editor.label('Table'));
        btn.setAttribute('aria-haspopup', 'menu');
        btn.className = 'markdown-btn table-btn fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost fj:me-popover-toggle';
        btn.setAttribute('popovertarget', popoverId);

        const pop = document.createElement('div');
        pop.id = popoverId;
        pop.setAttribute('popover', '');
        pop.setAttribute('role', 'menu');
        pop.setAttribute('aria-label', this.editor.label('Table size'));
        pop.className = 'fj:me-popover-content fj:p-2';

        const grid = document.createElement('div');
        grid.className = 'table-size-grid fj:grid fj:gap-0.5';
        grid.style.gridTemplateColumns = `repeat(${MAX_COLS}, 1rem)`;
        grid.setAttribute('role', 'none');

        const readout = document.createElement('div');
        readout.className = 'fj:text-xs fj:opacity-60 fj:text-center fj:pt-1.5 fj:select-none fj:tabular-nums';
        readout.setAttribute('aria-hidden', 'true');
        readout.textContent = this.editor.label('Table size');

        const cells = [];
        const highlight = (cols, rows) => {
            for (const c of cells) {
                const on = c.dataset.col <= cols && c.dataset.row <= rows;
                c.classList.toggle('fj:bg-primary/55', on);
            }
            readout.textContent = `${cols} × ${rows}`;
        };

        for (let row = 1; row <= MAX_ROWS; row++) {
            for (let col = 1; col <= MAX_COLS; col++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.setAttribute('role', 'menuitem');
                cell.className = 'fj:size-4 fj:rounded-xs fj:me-surface-outline';
                cell.dataset.col = col;
                cell.dataset.row = row;
                // Spelled out, because a screen reader gets nothing from a
                // grid of unlabelled squares.
                cell.setAttribute('aria-label', `${col} × ${row}`);
                cell.addEventListener('mouseenter', () => highlight(col, row));
                cell.addEventListener('focus', () => highlight(col, row));
                cell.addEventListener('click', () => {
                    this.insert(col, row);
                    pop.hidePopover();
                });
                cells.push(cell);
                grid.appendChild(cell);
            }
        }

        grid.addEventListener('mouseleave', () => highlight(0, 0));
        pop.addEventListener('toggle', (e) => {
            if (e.newState === 'open') highlight(0, 0);
        });

        pop.append(grid, readout);

        const wrapper = document.createElement('div');
        wrapper.className = 'fj:me-popover';
        wrapper.append(btn, pop);
        return wrapper;
    }

    /** Inserts an empty table of the chosen shape, pipes already aligned. */
    insert(cols, rows) {
        const width = 8;
        const head = [];
        const rule = [];
        for (let c = 1; c <= cols; c++) {
            head.push(`${this.editor.label('Column')} ${c}`.padEnd(width));
            rule.push('-'.repeat(Math.max(3, head[c - 1].length)));
        }
        const body = Array.from({ length: Math.max(1, rows - 1) },
            () => '| ' + head.map(h => ' '.repeat(h.length)).join(' | ') + ' |');

        const template = [
            '| ' + head.join(' | ') + ' |',
            '| ' + rule.join(' | ') + ' |',
            ...body,
        ].join('\n');

        const textarea = this.editor.usertextarea;
        const { selectionStart } = textarea;
        const value = textarea.value;
        const atLineStart = selectionStart === 0 || value[selectionStart - 1] === '\n';
        const text = atLineStart ? template : `\n${template}`;
        this.editor.insertText(text, text.length, 0);
    }

    applySyntax() {
        // The button opens the grid; nothing happens on the button itself.
    }
}

export default TableTool;
