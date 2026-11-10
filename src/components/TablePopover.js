import {
    tableAt, addColumn, removeColumn, addRow, removeRow, setAlign,
} from '../utils/MarkdownTable.js';
import { applyTableChange } from '../utils/tableEdit.js';
import { overlayHost, measureOffsets } from '../utils/overlay.js';

// Past this the second layout costs more than the controls are worth, and the
// popover opens against the top of the editor instead. Measured on the demo in
// Edge: 1.3ms at 10k, 8.5ms at 120k, 39ms at 500k. 250k is around 16ms, one
// frame, which is the most a click should ever cost.
const MEASURE_LIMIT = 250_000;

/**
 * Table controls: one small bar at the table's top corner.
 *
 * This replaced a visual rig of column grips, insert circles, shading and a
 * selection bar, built to look like a word processor. A word processor can
 * hang that furniture off a drawn grid. Over a textarea there is no grid, only
 * pipes in a line of text, so the same controls read as clutter sitting on the
 * writing. One bar, out of the way, is both less to look at and less to learn.
 *
 * It acts on the cell the cursor is in, which is the cell you just clicked, so
 * nothing has to be selected first.
 *
 * A textarea will not say where its text is, so the position comes from
 * measuring a mirror of the document. That is why this opens on a click rather
 * than following the caret: once per click is nothing, once per keystroke is
 * the 114ms-per-megabyte that ruled anchoring out the first time.
 */
class TablePopover {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;

        // Positioned here rather than by the popover component.
        //
        // That component anchors with CSS anchor positioning, which needs an
        // element to anchor to. A table is text inside a textarea, so the only
        // candidate is an empty trigger parked at the measured corner. Wired
        // exactly as the documentation says, with a popovertarget button and
        // the placement modifier on the wrapper, Edge still laid the panel out
        // at the bottom of the pane instead of against the trigger, while an
        // identical structure built by hand on the same page anchored
        // correctly. Until that is understood, the panel keeps the component's
        // appearance and places itself. The button-anchored case uses the
        // component properly: see the size grid in TableTool.
        this.el = document.createElement('div');
        this.el.className = `
            table-popover not-prose
            fj:absolute fj:z-20
            fj:max-w-[calc(100%_-_0.5rem)]
            fj:me-surface fj:me-surface-outline fj:me-surface-rounded fj:shadow-md
            fj:flex fj:items-center fj:gap-0.5 fj:px-1 fj:py-0.5
        `;
        this.el.setAttribute('role', 'toolbar');
        this.el.setAttribute('aria-label', editor.label('Table'));
        this.el.hidden = true;

        this._build();
        overlayHost(editor).appendChild(this.el);

        // Clicking a control must not take the caret out of the table, since
        // the caret is what says which row and column to act on.
        this.el.addEventListener('mousedown', e => e.preventDefault());

        this._onClick = () => this.open();
        this._onKey = (e) => {
            if (e.key === 'Escape') { this.close(); return; }
            // Typing keeps it open while the caret is still in the table, so
            // it does not flash away mid-edit, but leaving closes it.
            if (this.isOpen && !tableAt(this.textarea.value, this.textarea.selectionStart)) {
                this.close();
            }
        };
        this._onScroll = () => this._place();
        // The anchor is measured text, so a resize invalidates it the same way
        // it invalidates the find panel's scrollbar offset: measure again.
        this._onResize = () => { if (!this.el.hidden) this.open(); };
        this._onBlur = () => this.close();

        this.textarea.addEventListener('mouseup', this._onClick);
        this.textarea.addEventListener('keyup', this._onKey);
        this.textarea.addEventListener('scroll', this._onScroll);
        if (typeof ResizeObserver !== 'undefined') {
            this._sizeObserver = new ResizeObserver(this._onResize);
            this._sizeObserver.observe(this.textarea);
        }
        this.textarea.addEventListener('blur', this._onBlur);
    }

    get isOpen() {
        return !this.el.hidden;
    }

    _build() {
        const group = () => {
            const g = document.createElement('div');
            g.className = 'fj:flex fj:items-center fj:gap-1';
            return g;
        };

        const ico = paths =>
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

        const button = (label, icon, run) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost fj:pointer-coarse:min-w-8 fj:pointer-coarse:min-h-8';
            b.innerHTML = icon;
            b.querySelector('svg')?.setAttribute('aria-hidden', 'true');
            b.title = label;
            b.setAttribute('aria-label', label);
            b.addEventListener('click', () => this._rewrite(run));
            return b;
        };

        // A word, then the controls it governs. Icons alone were unreadable
        // here: nobody can tell an insert-column-before glyph from an
        // insert-after one, and there is no room to draw the difference.
        const caption = text => {
            const s = document.createElement('span');
            s.className = 'fj:text-xs fj:opacity-60 fj:select-none fj:ps-0.5';
            s.textContent = text;
            return s;
        };

        // frutjam's divider rather than a bordered span, so the rule is the
        // same weight and colour as every other rule in the editor. Its own
        // margin is 1rem, which is a gap and a half in a bar this size.
        const divider = () => {
            const d = document.createElement('span');
            d.className = 'fj:me-divider fj:me-divider-vertical fj:mx-0';
            d.setAttribute('aria-hidden', 'true');
            return d;
        };

        const PLUS = ico('<path d="M12 5v14"/><path d="M5 12h14"/>');
        const MINUS = ico('<path d="M5 12h14"/>');

        const columns = group();
        columns.append(
            caption(this.editor.label('Column')),
            button(this.editor.label('Insert column after'), PLUS, t => addColumn(t, t.col + 1)),
            button(this.editor.label('Delete column'), MINUS, t => removeColumn(t, t.col)),
        );

        const rows = group();
        rows.append(
            caption(this.editor.label('Row')),
            button(this.editor.label('Insert row below'), PLUS, t => addRow(t, t.row + 1)),
            button(this.editor.label('Delete row'), MINUS, t => removeRow(t, t.row)),
        );

        // These three are worth keeping as icons: align left, centre and right
        // are drawn the same way in every piece of software ever made.
        const aligns = group();
        aligns.append(
            button(this.editor.label('Align left'),
                ico('<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h13"/>'),
                t => setAlign(t, t.col, 'left')),
            button(this.editor.label('Align center'),
                ico('<path d="M4 6h16"/><path d="M7 12h10"/><path d="M5 18h14"/>'),
                t => setAlign(t, t.col, 'center')),
            button(this.editor.label('Align right'),
                ico('<path d="M4 6h16"/><path d="M10 12h10"/><path d="M7 18h13"/>'),
                t => setAlign(t, t.col, 'right')),
        );

        const tidy = button(this.editor.label('Tidy the table'),
            ico('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="M9 4v16"/>'),
            t => t);

        this.el.append(columns, divider(), rows, divider(), aligns, divider(), tidy);
    }

    /** Shows the controls beside the table the cursor is in, if it is in one. */
    open() {
        const table = tableAt(this.textarea.value, this.textarea.selectionStart);
        if (!table) { this.close(); return; }

        this.el.hidden = false;
        this._anchor = this._measure(table);
        this._place();
    }

    close() {
        this.el.hidden = true;
    }

    /** Where the table starts, ends, and how far right its first line runs. */
    _measure(table) {
        if (this.textarea.value.length > MEASURE_LIMIT) return null;
        const headerEnd = table.start + this.textarea.value
            .slice(table.start, table.end).indexOf('\n');
        const [first, header, last] = measureOffsets(this.textarea, [
            [table.start, table.start + 1],
            [headerEnd - 1, headerEnd],
            [table.end - 1, table.end],
        ]);
        return {
            top: first.top,
            height: first.height,
            bottom: last.top + last.height,
            right: header.left + header.width,
        };
    }

    _place() {
        if (this.el.hidden) return;

        const pane = this.el.parentElement;
        const gutter = this.textarea.offsetWidth - this.textarea.clientWidth;
        const room = pane.clientWidth - gutter - 4 - this.el.offsetWidth;

        // At the table's far corner, not the pane's: beside the text it acts
        // on, and clear of the start of every line, which is where the eye and
        // the cursor are.
        const x = this._anchor
            ? Math.min(this._anchor.right - this.el.offsetWidth, room)
            : room;
        this.el.style.left = Math.max(4, x) + 'px';

        // Too long to measure: fall back to the top of the pane, which is at
        // least somewhere predictable.
        if (!this._anchor) { this.el.style.top = '4px'; return; }

        const y = this._anchor.top - this.textarea.scrollTop;
        const above = y - this.el.offsetHeight - 4;
        // Above the table by preference, under the whole table when there is
        // no room there, rather than over the middle of it.
        const below = this._anchor.bottom - this.textarea.scrollTop + 4;
        this.el.style.top = Math.max(4, above >= 4 ? above : below) + 'px';
    }

    _rewrite(change) {
        const table = tableAt(this.textarea.value, this.textarea.selectionStart);
        if (!table) return;
        applyTableChange(this.editor, table, change);
        this.open();
    }

    destroy() {
        this.textarea.removeEventListener('mouseup', this._onClick);
        this.textarea.removeEventListener('keyup', this._onKey);
        this.textarea.removeEventListener('scroll', this._onScroll);
        this._sizeObserver?.disconnect();
        this.textarea.removeEventListener('blur', this._onBlur);
        this.el.remove();
    }
}

export default TablePopover;
