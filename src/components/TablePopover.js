import {
    tableAt, addColumn, removeColumn, addRow, removeRow, setAlign, serialise,
} from '../utils/MarkdownTable.js';
import { applyTableChange } from '../utils/tableEdit.js';
import { overlayHost, measureOffsets, setPressed } from '../utils/overlay.js';

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
            fj:flex fj:flex-wrap fj:items-center fj:gap-0.5 fj:px-1 fj:py-0.5
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
            if (!this.isOpen) return;
            const table = tableAt(this.textarea.value, this.textarea.selectionStart);
            // Typing keeps it open while the caret is still in the table, so
            // it does not flash away mid-edit, but leaving closes it.
            if (!table) { this.close(); return; }
            // Arrowing into another column has to move the lit alignment with
            // it. Only the switches are refreshed, not the position: measuring
            // is what made following the caret too expensive to do per key.
            this._showAlign(table);
            this._showTidy(table);
        };
        this._onScroll = () => this._place();
        // The anchor is measured text, so a resize invalidates it the same way
        // it invalidates the find panel's scrollbar offset: measure again.
        this._onResize = () => { if (!this.el.hidden) this.open(); };
        this._onBlur = (e) => {
            // Tabbing from the text into the bar blurs the textarea. Closing on
            // that would make the controls impossible to reach by keyboard: you
            // would shut the thing you were reaching for.
            if (e.relatedTarget && this.el.contains(e.relatedTarget)) return;
            this.close();
        };

        // Until now the only way in was a click, so the controls did not exist
        // for anyone working from the keyboard. Matched on `code`, because Alt
        // composes a character on macOS and gives a different `key`.
        this._onShortcut = (e) => {
            if (e.code !== 'KeyT' || !e.altKey || e.ctrlKey || e.metaKey) return;
            if (!tableAt(this.textarea.value, this.textarea.selectionStart)) return;
            e.preventDefault();
            this.open({ focus: true });
        };

        this._onBarKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
                this.textarea.focus();
                return;
            }
            // One tab stop, arrows inside it: the toolbar pattern. Eight
            // separate stops meant tabbing out of a table walked every button.
            const items = this._controls().filter(b => !b.disabled);
            const i = items.indexOf(document.activeElement);
            if (i === -1) return;
            const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 }[e.key];
            if (to === undefined) return;
            e.preventDefault();
            const next = items[(to + items.length) % items.length];
            this._roving(next);
            next.focus();
        };

        this.textarea.addEventListener('mouseup', this._onClick);
        this.textarea.addEventListener('keydown', this._onShortcut);
        this.textarea.addEventListener('keyup', this._onKey);
        this.el.addEventListener('keydown', this._onBarKey);
        this.textarea.addEventListener('scroll', this._onScroll);
        // The page is what scrolls once the editor has grown past the window,
        // so the textarea's own scroll event never fires. Placing is pure
        // arithmetic -- no measuring -- so it is cheap enough per scroll.
        window.addEventListener('scroll', this._onScroll, { passive: true });
        window.addEventListener('resize', this._onScroll, { passive: true });
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
        // Named, so a screen reader says "Column group, Delete column" rather
        // than reading a loose word that sits next to the buttons.
        // Named for a screen reader, parted by a rule for the eye. A box drawn
        // round each one said the same thing but cost a border inside a border,
        // and the bar is small enough that one rule is enough to separate.
        const group = (name) => {
            const g = document.createElement('div');
            g.className = 'fj:flex fj:items-center fj:gap-1';
            if (name) {
                g.setAttribute('role', 'group');
                g.setAttribute('aria-label', name);
            }
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

        // A picture of the thing the group acts on, then its controls.
        //
        // Icons were rejected for the operations themselves and still are:
        // nobody can tell an insert-column-before glyph from an insert-after
        // one at this size. Saying which *part of the table* is a different
        // job, and a grid with one column or one row shaded is how every
        // spreadsheet has drawn it for thirty years. It also buys back the
        // width two words cost, which is the width a phone has least of.
        //
        // Hidden from assistive software: the group is named, and every
        // button already says "column" or "row" in its own label.
        const marker = (icon, name) => {
            const s = document.createElement('span');
            s.className = 'fj:opacity-60 fj:select-none fj:ps-0.5 fj:inline-flex';
            s.innerHTML = icon;
            s.setAttribute('aria-hidden', 'true');
            s.title = name;
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

        // Minus on the left, plus on the right, the way a stepper or a zoom
        // control is laid out everywhere else. The other order read as
        // backwards to the first person who used it.
        const GRID = '<rect x="4" y="4" width="16" height="16" rx="2"/>';
        const COLUMN = ico(GRID + '<path d="M10 4v16"/><path d="M14 4v16"/>'
            + '<rect x="10" y="4" width="4" height="16" fill="currentColor" stroke="none" opacity="0.35"/>');
        const ROW = ico(GRID + '<path d="M4 10h16"/><path d="M4 14h16"/>'
            + '<rect x="4" y="10" width="16" height="4" fill="currentColor" stroke="none" opacity="0.35"/>');

        const columns = group(this.editor.label('Column'));
        columns.append(
            marker(COLUMN, this.editor.label('Column')),
            button(this.editor.label('Delete column'), MINUS, t => removeColumn(t, t.col)),
            button(this.editor.label('Insert column after'), PLUS, t => addColumn(t, t.col + 1)),
        );

        const rows = group(this.editor.label('Row'));
        rows.append(
            marker(ROW, this.editor.label('Row')),
            button(this.editor.label('Delete row'), MINUS, t => removeRow(t, t.row)),
            button(this.editor.label('Insert row below'), PLUS, t => addRow(t, t.row + 1)),
        );

        // These three are worth keeping as icons: align left, centre and right
        // are drawn the same way in every piece of software ever made.
        // Unnamed: 'Align' is not a translatable key and one word is not worth
        // 56 translations, while the three buttons already say what they do.
        const aligns = group();
        // Kept on the instance so _showAlign can light the one that is on. The
        // three looked identical whatever the column was set to, which is most
        // of why they read as doing nothing.
        this._alignBtns = {
            left: button(this.editor.label('Align left'),
                ico('<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h13"/>'),
                t => setAlign(t, t.col, 'left')),
            center: button(this.editor.label('Align center'),
                ico('<path d="M4 6h16"/><path d="M7 12h10"/><path d="M5 18h14"/>'),
                t => setAlign(t, t.col, 'center')),
            right: button(this.editor.label('Align right'),
                ico('<path d="M4 6h16"/><path d="M10 12h10"/><path d="M7 18h13"/>'),
                t => setAlign(t, t.col, 'right')),
        };
        aligns.append(this._alignBtns.left, this._alignBtns.center, this._alignBtns.right);

        // No change of its own: writing the table back is what lines the pipes
        // up, so handing serialise the table unaltered is the whole operation.
        this._tidyBtn = button(this.editor.label('Tidy the table'),
            ico('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="M9 4v16"/>'),
            t => t);

        this.el.append(columns, divider(), rows, divider(), aligns, divider(), this._tidyBtn);
        this._roving();
    }

    /** Shows the controls beside the table the cursor is in, if it is in one. */
    open({ focus = false } = {}) {
        const table = tableAt(this.textarea.value, this.textarea.selectionStart);
        if (!table) { this.close(); return; }

        this.el.hidden = false;
        this._showAlign(table);
        this._showTidy(table);
        this._anchor = this._measure(table);
        this._place();
        if (focus) this._controls().find(b => b.tabIndex === 0)?.focus();
    }

    /** Every control, in the order they sit in the bar. */
    _controls() {
        return [...this.el.querySelectorAll('button')];
    }

    /**
     * Keeps exactly one control in the tab order.
     *
     * The rest are reachable with the arrow keys, which is what a toolbar is
     * supposed to do. Re-run whenever a control is disabled, or the one stop
     * could land on a button nobody can focus.
     */
    _roving(target) {
        const items = this._controls();
        const enabled = items.filter(b => !b.disabled);
        const chosen = (target && !target.disabled) ? target
            : (enabled.includes(this._stop) ? this._stop : enabled[0]);
        this._stop = chosen;
        for (const b of items) b.tabIndex = b === chosen ? 0 : -1;
    }

    /**
     * Lights whichever alignment the cursor's column is set to.
     *
     * A column with no alignment of its own lights none of the three, which is
     * the honest answer: the markdown says nothing, and the renderer is left to
     * its default.
     */
    _showAlign(table) {
        const current = table.align[table.col];
        for (const [name, btn] of Object.entries(this._alignBtns)) {
            setPressed(btn, current === name);
        }
    }

    /**
     * Greys Tidy out when the pipes already line up.
     *
     * Every other control writes the table back through serialise, which lines
     * the pipes up on the way, so by the time anyone reaches for Tidy there is
     * usually nothing left for it to do. Pressing it then changed nothing and
     * said nothing, and it read as a broken button. The find panel's arrows are
     * disabled on the same grounds: better to show there is nothing to act on
     * than to answer with silence.
     */
    _showTidy(table) {
        const current = this.textarea.value.slice(table.start, table.end);
        this._tidyBtn.disabled = serialise(table) === current;
        this._roving();
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
        const wanted = Math.max(4, above >= 4 ? above : below);

        this.el.style.top = this._onScreen(wanted) + 'px';
    }

    /**
     * Pulls a position back into the part of the editor you can actually see.
     *
     * The editor grows to fit its text, so a long document scrolls the page
     * rather than the textarea. A table taller than the window then put the
     * bar hundreds of pixels below the fold -- anchored to the table, correctly,
     * and invisible. Above the fold it hid under the toolbar the same way.
     *
     * Clamped against the pane and the window both, so the controls stay where
     * they can be reached whichever of the two is doing the scrolling.
     */
    _onScreen(top) {
        const pane = this.el.parentElement;
        const rect = pane.getBoundingClientRect();
        const view = typeof window === 'undefined' ? 0 : (window.innerHeight || 0);
        if (!view || !rect.height) return Math.max(4, top);

        // the visible band, in the pane's own coordinates
        const from = Math.max(0, -rect.top) + 4;
        const to = Math.min(rect.height, view - rect.top) - this.el.offsetHeight - 4;
        if (to < from) return Math.max(4, from);        // nothing fits: do no harm
        return Math.min(Math.max(top, from), to);
    }

    _rewrite(change) {
        const table = tableAt(this.textarea.value, this.textarea.selectionStart);
        if (!table) return;
        // Writing the table back puts the caret in the textarea, which is right
        // after a click and wrong after a keypress: it would throw you out of
        // the bar after one button.
        const held = this.el.contains(document.activeElement) ? document.activeElement : null;
        applyTableChange(this.editor, table, change);
        this.open();
        if (held && !held.disabled) held.focus();
    }

    destroy() {
        this.textarea.removeEventListener('mouseup', this._onClick);
        this.textarea.removeEventListener('keydown', this._onShortcut);
        this.textarea.removeEventListener('keyup', this._onKey);
        this.el.removeEventListener('keydown', this._onBarKey);
        this.textarea.removeEventListener('scroll', this._onScroll);
        window.removeEventListener('scroll', this._onScroll);
        window.removeEventListener('resize', this._onScroll);
        this._sizeObserver?.disconnect();
        this.textarea.removeEventListener('blur', this._onBlur);
        this.el.remove();
    }
}

export default TablePopover;
