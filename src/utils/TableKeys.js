import { tableAt, serialise, addRow, cellRange } from './MarkdownTable.js';

/**
 * Tab, Shift+Tab and Enter inside a markdown table.
 *
 * This replaced a strip of buttons floating over the text. The buttons could
 * do more, but they sat at the top of the editor rather than beside the table,
 * appeared and vanished as the caret crossed a table boundary, and covered the
 * text underneath. Keys cost nothing on screen, and moving between cells is
 * what people reach for first in every other table they have ever edited.
 *
 * Tab and Enter already belong to indenting and to lists, so this listens
 * first and stops the event only when the caret really is in a table. Outside
 * one, every key behaves as it did.
 */
export default class TableKeys {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;

        // Which row, if any, Tab or Enter has just added: see _addRow.
        this._madeRow = null;

        this._handler = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key !== 'Tab' && e.key !== 'Enter') return;

            const table = tableAt(this.textarea.value, this.textarea.selectionStart);
            if (!table) return;

            e.preventDefault();
            // The indent and list managers listen on the same element, and one
            // of them would otherwise also act on this key.
            e.stopImmediatePropagation();

            if (e.key === 'Tab') this._step(table, e.shiftKey ? -1 : 1);
            else this._enter(table);
        };

        this.textarea.addEventListener('keydown', this._handler);
    }

    /** Tab moves on by one cell, Shift+Tab back by one. */
    _step(table, by) {
        const width = table.align.length;
        let index = table.row * width + table.col + by;

        if (index < 0) return;                       // already in the first cell

        // Past the last cell, Tab starts a new row rather than stopping. It is
        // how a table gets written in the first place: type, Tab, type, Tab.
        if (index >= table.rows.length * width) {
            this._addRow(table);
            index = (table.rows.length - 1) * width;
        }

        this._write(table, Math.floor(index / width), index % width);
    }

    /**
     * Enter goes down a column, and leaves the table from an empty row.
     *
     * Without that last part a table is a trap: every Enter inside it makes
     * another row and there is no way out but the arrow keys. Lists in this
     * editor end the same way, on an empty item.
     */
    _enter(table) {
        const atLastRow = table.row === table.rows.length - 1;
        const rowIsEmpty = table.rows[table.row].every(c => c === '');

        // Only a row Tab or Enter has just made is ours to take back. The
        // rows the size grid was asked for are someone's work, and dropping
        // one because it happens to be empty answers "a table with three
        // rows" by handing back two.
        const mine = this._madeRow !== null
            && this._madeRow.start === table.start
            && this._madeRow.row === table.row;
        this._madeRow = null;

        if (atLastRow && rowIsEmpty && table.rows.length > 1) {
            if (mine) table.rows.splice(table.row, 1);
            const text = serialise(table);
            const after = table.start + text.length;

            // A GFM table runs on until a blank line, so the line directly
            // below the last row still belongs to the table: type there and it
            // becomes another row. The caret needs an empty line of its own with
            // a blank line above it, and the line after the gap will not do when
            // something is already on it -- below a second table, Enter landed
            // the caret on its header and the next keystroke wrote
            // `hello| Column 1 |`, which collapsed the whole table into prose.
            //
            // So: a break to end the last row, a break to leave the blank line,
            // and a third to open a line to sit on when text follows. Whatever
            // is already there counts, or stepping out twice would stack up
            // blank lines.
            const rest = this.textarea.value.slice(table.end);
            const breaks = rest.match(/^\n*/)[0].length;
            const followed = rest.slice(breaks) !== '';
            const want = followed ? 3 : 2;
            this._replace(table, text, after + 2,
                '\n'.repeat(Math.max(0, want - breaks)));
            return;
        }

        if (atLastRow) this._addRow(table);
        this._write(table, table.row + 1, table.col);
    }

    /**
     * Adds a row at the bottom, and remembers that a key put it there.
     *
     * That is the whole difference between tidying up after Tab or Enter and
     * deleting a row someone asked for: the document cannot tell an empty row
     * apart from an empty row, so the editor has to remember which it made.
     * Anything that moves the table or the caret elsewhere makes the note
     * stop matching, and then the row stays.
     */
    _addRow(table) {
        addRow(table, table.rows.length);
        this._madeRow = { start: table.start, row: table.rows.length - 1 };
    }

    /** Writes the table back and selects one cell's text. */
    _write(table, row, col) {
        const text = serialise(table);
        const cell = cellRange(text, row, col);
        if (!cell) { this._replace(table, text, table.start + text.length); return; }

        // Selected rather than just placed, so the next keystroke replaces the
        // cell, which is what Tab does in every other table.
        this._replace(table, text, table.start + cell.from, '', table.start + cell.to);
    }

    /**
     * Swaps the table for `text`, then places the caret.
     *
     * `tail` is anything to add after the table, and `selectionEnd` extends the
     * caret into a selection.
     */
    _replace(table, text, caret, tail = '', selectionEnd = null) {
        const textarea = this.textarea;
        const scrollTop = textarea.scrollTop;

        textarea.value = textarea.value.slice(0, table.start)
            + text + tail
            + textarea.value.slice(table.end);

        textarea.focus();
        textarea.setSelectionRange(caret, selectionEnd ?? caret);

        this.editor.render();
        this.editor.notifyChange();
        this.editor.restoreScroll(scrollTop);
    }

    destroy() {
        this.textarea.removeEventListener('keydown', this._handler);
    }
}
