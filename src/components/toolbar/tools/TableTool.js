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
        // `touch-none`, or the browser decides the first finger movement is a
        // page scroll, takes the gesture over and fires pointercancel: the drag
        // died after one cell and released without inserting anything.
        grid.className = 'table-size-grid fj:grid fj:gap-0.5 fj:touch-none';
        // `auto`, not a fixed rem, so the track follows whatever size the cells
        // take: they grow for a finger and a hardcoded track would crop them.
        grid.style.gridTemplateColumns = `repeat(${MAX_COLS}, auto)`;
        grid.setAttribute('role', 'none');

        const readout = document.createElement('div');
        readout.className = 'fj:text-xs fj:opacity-60 fj:text-center fj:pt-1.5 fj:select-none fj:tabular-nums';
        readout.setAttribute('aria-hidden', 'true');
        readout.textContent = this.editor.label('Table size');

        const cells = [];
        const highlight = (cols, rows) => {
            for (const c of cells) {
                // The whole block shows the size; the one under the pointer is
                // darker, so you can see where you actually are. Without it a
                // fingertip covers its own cell and you are picking blind.
                const inside = +c.dataset.col <= cols && +c.dataset.row <= rows;
                const here = +c.dataset.col === cols && +c.dataset.row === rows;
                c.classList.toggle('fj:bg-primary-700', inside && !here);
                c.classList.toggle('fj:bg-primary-active', here);
            }
            readout.textContent = `${cols} × ${rows}`;
        };

        for (let row = 1; row <= MAX_ROWS; row++) {
            for (let col = 1; col <= MAX_COLS; col++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.setAttribute('role', 'menuitem');
                // 16px is a mouse target. A finger gets 28, which still leaves
                // the whole grid narrow enough for a phone; eight columns at the
                // 44px the guidance asks for would be 368px and fit nothing.
                // Dragging is what really makes it usable, since the gesture is
                // the target rather than any one square.
                cell.className = 'fj:size-4 fj:pointer-coarse:size-7 fj:rounded-xs fj:me-surface-outline';
                cell.dataset.col = col;
                cell.dataset.row = row;
                // Spelled out, because a screen reader gets nothing from a
                // grid of unlabelled squares.
                cell.setAttribute('aria-label', `${col} × ${row}`);
                cell.addEventListener('mouseenter', () => highlight(col, row));
                cell.addEventListener('focus', () => highlight(col, row));
                // Reached by the keyboard, and by a pointer only when capture
                // did not take; a release handles the pointer otherwise.
                cell.addEventListener('click', () => {
                    if (pointerDidIt) { pointerDidIt = false; return; }
                    this.insert(col, row);
                    pop.hidePopover();
                });
                cells.push(cell);
                grid.appendChild(cell);
            }
        }

        // Drag to size, which is how a finger uses this.
        //
        // Hovering has no touch equivalent, so a tap had to be aimed at one
        // 16px square with no preview of what it would produce. Dragging shows
        // the size as you go and lets you correct before letting go, and one
        // pointer path covers mouse, pen and finger alike.
        //
        // `mouseenter` stays for plain hovering, which pointer events would
        // only duplicate.
        // Worked out from where the pointer is in the grid, not from what is
        // under it.
        //
        // The squares have gaps between them, and `elementFromPoint` in a gap
        // finds the grid rather than a cell: a tap landing on one of those 2px
        // seams did nothing at all, which reads as a broken control. Every
        // point inside the grid now belongs to the cell whose track it falls
        // in, seams included.
        //
        // `edge` keeps a drag alive past the border, where the pointer spends
        // much of its time once the gesture is moving.
        const cellAt = (e, edge = false) => {
            const box = grid.getBoundingClientRect();
            if (!box.width || !box.height) return null;
            const first = cells[0].getBoundingClientRect();
            const pitchX = cells[1] ? cells[1].getBoundingClientRect().left - first.left : first.width;
            const pitchY = cells[MAX_COLS] ? cells[MAX_COLS].getBoundingClientRect().top - first.top : first.height;
            if (!pitchX || !pitchY) return null;

            const inside = e.clientX >= box.left && e.clientX <= box.right
                && e.clientY >= box.top && e.clientY <= box.bottom;
            if (!inside && !edge) return null;

            const span = (at, from, pitch, most) =>
                Math.min(most, Math.max(1, Math.floor((at - from) / pitch) + 1));
            return {
                col: span(e.clientX, box.left, pitchX, MAX_COLS),
                row: span(e.clientY, box.top, pitchY, MAX_ROWS),
            };
        };

        let dragFrom = null;
        // Set when a release has already inserted, so the click that may follow
        // cannot insert a second table if the capture did not take.
        let pointerDidIt = false;
        grid.addEventListener('pointerdown', (e) => {
            const cell = cellAt(e);
            if (!cell) return;
            dragFrom = cell;
            // No preventDefault here: on a mouse it would suppress the
            // compatibility events, and with them the click, so a plain click
            // stopped inserting anything. `touch-action: none` on the grid is
            // what keeps a finger from turning the drag into a page scroll.
            //
            // Capture keeps the moves coming when the pointer slides off the
            // grid, which is most of them once the gesture gets going.
            grid.setPointerCapture(e.pointerId);
            highlight(cell.col, cell.row);
        });
        grid.addEventListener('pointermove', (e) => {
            if (!dragFrom) return;
            const cell = cellAt(e, true);
            if (cell) highlight(cell.col, cell.row);
        });
        const endDrag = (e) => {
            if (!dragFrom) return;
            const cell = cellAt(e, true) ?? dragFrom;
            dragFrom = null;
            if (grid.hasPointerCapture?.(e.pointerId)) grid.releasePointerCapture(e.pointerId);

            // Every pointer release lands here, a tap as much as a drag, because
            // capturing the pointer retargets the click to the grid and the
            // cell's own handler never runs again. That handler stays for the
            // keyboard, where there is no pointer and no capture.
            pointerDidIt = true;
            this.insert(cell.col, cell.row);
            pop.hidePopover();
        };
        grid.addEventListener('pointerup', endDrag);
        grid.addEventListener('pointercancel', () => { dragFrom = null; });

        grid.addEventListener('mouseleave', () => highlight(0, 0));
        pop.addEventListener('toggle', (e) => {
            if (e.newState === 'open') { highlight(0, 0); pointerDidIt = false; dragFrom = null; }
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
        const before = value.slice(0, selectionStart);
        const after = value.slice(textarea.selectionEnd);

        // A GFM table runs on until a blank line, so the block needs one on
        // each side. Without the one above, a header glued to the line over it
        // just continues whatever is up there: insert a table below another and
        // the second is swallowed whole, its extra columns dropped without a
        // word. Without the one below, the next line becomes another row, and
        // with no newline at all it was welded onto the last one as
        // `|   |   |next paragraph`.
        //
        // Only the breaks that are missing get added, so inserting into an
        // empty document, or onto a line of its own, pads nothing out.
        const pad = (has, want) => '\n'.repeat(Math.max(0, want - has));
        const above = before === '' ? '' : pad(before.match(/\n*$/)[0].length, 2);
        const below = pad(after.match(/^\n*/)[0].length, after === '' ? 1 : 2);
        const text = above + template + below;

        // The caret stays in the table, not on the line the break below it
        // just opened.
        this.editor.insertText(text, text.length - below.length, below.length);
    }

    applySyntax() {
        // The button opens the grid; nothing happens on the button itself.
    }
}

export default TableTool;
