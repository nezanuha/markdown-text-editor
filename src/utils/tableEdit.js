import { serialise, cellRange } from './MarkdownTable.js';

/**
 * Swaps a table for a changed version of itself, keeping the cursor put.
 *
 * Every column changes width whenever anything changes, so the cursor's offset
 * into the document means nothing afterwards. What still means something is
 * the cell it was in and how far into that cell it sat, so that is what this
 * carries across. If the change took that cell away, the cursor lands in
 * whatever is at the same place now.
 *
 * Both the handles over a table and the controls beside it edit through here,
 * so the two cannot drift apart on what happens to the cursor.
 */
export function applyTableChange(editor, table, change) {
    const textarea = editor.usertextarea;
    const caret = textarea.selectionStart;

    const before = cellRange(textarea.value.slice(table.start, table.end), table.row, table.col);
    const within = before ? Math.max(0, (caret - table.start) - before.from) : 0;

    const text = serialise(change(table));
    const scrollTop = textarea.scrollTop;

    textarea.value = textarea.value.slice(0, table.start)
        + text
        + textarea.value.slice(table.end);
    textarea.focus();

    const row = Math.min(table.row, table.rows.length - 1);
    const col = Math.min(table.col, table.align.length - 1);
    const after = cellRange(text, row, col);
    const at = after
        ? table.start + after.from + Math.min(within, after.to - after.from)
        : table.start;
    textarea.setSelectionRange(at, at);

    editor.render();
    editor.notifyChange();
    editor.restoreScroll(scrollTop);
}
