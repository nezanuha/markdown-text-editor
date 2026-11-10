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
            addRow(table, table.rows.length);
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

        if (atLastRow && rowIsEmpty && table.rows.length > 1) {
            table.rows.splice(table.row, 1);
            const text = serialise(table);
            const after = table.start + text.length;
            this._replace(table, text, after + 1, '\n');
            return;
        }

        if (atLastRow) addRow(table, table.rows.length);
        this._write(table, table.row + 1, table.col);
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
