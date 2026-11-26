/**
 * Reading and rewriting the markdown table under the cursor.
 *
 * Editing a table by hand is the worst part of writing markdown: adding a
 * column means touching every row, and the pipes stop lining up the moment any
 * cell changes width. This turns the table under the cursor into rows and
 * columns, lets a tool change it, and writes it back with the pipes aligned.
 *
 * A table here is a run of consecutive lines that each start with a pipe, where
 * the second line is a delimiter row. That is stricter than every markdown
 * parser, which generally allow the outer pipes to be left off, but the editor
 * only ever writes the strict form and guessing at the loose one risks
 * rewriting something that was never a table.
 */

// One cell is a table too. The repeated group was `+`, which needs a cell
// before the last one, so `| --- |` never matched and a one-column table was
// invisible to all of this: no controls, no Tab between cells, no alignment.
// The size grid offers one column, so the editor could write a table it then
// refused to recognise.
const DELIMITER = /^\s*\|?(\s*:?-{1,}:?\s*\|)*\s*:?-{1,}:?\s*\|?\s*$/;

// A delimiter row is made of these characters and nothing else, and finding
// a stray one costs a single pass.
//
// DELIMITER alone backtracks over the dashes against the spaces when a line
// turns out not to match at the very end -- quadratic, and 109ms on a line of
// 16k. The run above made that reachable: the repeated group used to be `+`,
// so a line with no second cell failed before the engine ever reached the
// part that backtracks. This check fails those lines just as early, and it is
// worth having because tableAt runs on every click and every keystroke.
const DELIMITER_CHARS = /^[\s|:-]*$/;

/** Whether a line is a table's delimiter row, `| --- | :--: |`. */
function isDelimiter(line) {
    return DELIMITER_CHARS.test(line) && DELIMITER.test(line);
}

/** Splits a row on unescaped pipes, dropping the outer empties. */
function splitRow(line) {
    const cells = [];
    let cell = '';
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\' && line[i + 1] === '|') { cell += '\\|'; i++; continue; }
        if (line[i] === '|') { cells.push(cell); cell = ''; continue; }
        cell += line[i];
    }
    cells.push(cell);
    // A row written `| a | b |` splits to ['', ' a ', ' b ', ''], so the empty
    // ends are the outer pipes rather than real cells.
    if (cells.length && cells[0].trim() === '') cells.shift();
    if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
    return cells.map(c => c.trim());
}

/** 'left' | 'center' | 'right' | null, from one delimiter cell. */
function readAlign(cell) {
    const t = cell.trim();
    const left = t.startsWith(':');
    const right = t.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
}

function writeAlign(align, width) {
    const w = Math.max(width, align === 'center' ? 5 : 3);
    if (align === 'center') return ':' + '-'.repeat(w - 2) + ':';
    if (align === 'right') return '-'.repeat(w - 1) + ':';
    if (align === 'left') return ':' + '-'.repeat(w - 1);
    return '-'.repeat(w);
}

/**
 * The table containing `offset`, or null.
 *
 * `row` and `col` say where the cursor sits inside it, so a tool can act on
 * "this column" without the caller working it out again. `row` counts the
 * delimiter out, so row 0 is the header and row 1 is the first body row.
 *
 * This walks outward from the cursor rather than splitting the document, since
 * it runs on every cursor move to decide whether the table controls apply. A
 * whole-document split would make that cost grow with the file; this way it
 * costs the size of the table, whatever the document around it.
 */
export function tableAt(value, offset) {
    if (offset < 0 || offset > value.length) return null;

    const lineStart = at => {
        const i = value.lastIndexOf('\n', Math.max(0, at - 1));
        return i === -1 ? 0 : i + 1;
    };
    const lineEnd = at => {
        const i = value.indexOf('\n', at);
        return i === -1 ? value.length : i;
    };
    const lineAt = at => value.slice(lineStart(at), lineEnd(at));

    const here = lineStart(offset);
    if (!/^\s*\|/.test(lineAt(here))) return null;

    // walk up and down while the lines still look like table rows
    let first = here;
    while (first > 0) {
        const prev = lineStart(first - 1);
        if (!/^\s*\|/.test(lineAt(prev))) break;
        first = prev;
    }
    let last = here;
    while (lineEnd(last) < value.length) {
        const next = lineEnd(last) + 1;
        if (!/^\s*\|/.test(lineAt(next))) break;
        last = next;
    }

    // collect the run, and remember where each line began
    let starts = [];
    let lines = [];
    for (let s = first; s <= last; s = lineEnd(s) + 1) {
        starts.push(s);
        lines.push(lineAt(s));
        if (lineEnd(s) >= value.length) break;
    }
    if (lines.length < 2) return null;

    // A table has exactly one delimiter row, so a second one in the run cannot
    // belong to it: it is the start of another table. Two tables written with
    // no blank line between them are two tables to anyone reading them, and
    // taking the run as one made an edit to the first rewrite the second --
    // widening it to match, and leaving its delimiter showing as a row of
    // dashes. It also put the cursor halfway down a table it thought was one,
    // so Enter could never step out of the first.
    const delimiters = [];
    for (let i = 0; i < lines.length; i++) {
        if (isDelimiter(lines[i])) delimiters.push(i);
    }

    // the delimiter governing the cursor is the last one at or above it, and
    // the header is the line before it
    const cursorLine = starts.indexOf(here);
    let governing = -1;
    for (const i of delimiters) {
        if (i - 1 <= cursorLine) governing = i;
    }
    if (governing < 1) return null;

    const nextTable = delimiters.find(i => i > governing);
    const from = governing - 1;
    const to = nextTable === undefined ? lines.length - 1 : nextTable - 2;
    if (to < from + 1) return null;             // a header and its delimiter

    lines = lines.slice(from, to + 1);
    starts = starts.slice(from, to + 1);
    first = starts[0];

    if (!isDelimiter(lines[1])) return null;

    const align = splitRow(lines[1]).map(readAlign);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
        if (i === 1) continue;                  // the delimiter is not a row
        rows.push(splitRow(lines[i]));
    }

    // normalise every row to the widest, so a short row does not lose cells
    const width = Math.max(align.length, ...rows.map(r => r.length));
    for (const r of rows) while (r.length < width) r.push('');
    while (align.length < width) align.push(null);

    const lineIndex = starts.indexOf(here);
    const cursorRow = lineIndex <= 1 ? 0 : lineIndex - 1;
    const before = value.slice(here, offset);
    const cursorCol = Math.max(0, Math.min(width - 1, splitRow(before + '|').length - 1));

    return {
        start: first,
        end: starts[starts.length - 1] + lines[lines.length - 1].length,
        rows,
        align,
        row: cursorRow,
        col: cursorCol,
    };
}

/** Writes a table back out with the pipes lined up. */
export function serialise({ rows, align }) {
    const width = Math.max(align.length, ...rows.map(r => r.length));
    const widths = [];
    for (let c = 0; c < width; c++) {
        // A centre marker is five characters at its shortest, `:---:`, so a
        // column narrower than that has to widen to fit it. Letting the marker
        // overflow instead left the pipes out of line in a way Tidy could never
        // put right, since this is the function Tidy writes with.
        const floor = align[c] === 'center' ? 5 : 3;
        widths.push(Math.max(floor, ...rows.map(r => (r[c] ?? '').length)));
    }

    const line = cells => '| ' + cells.map((c, i) => (c ?? '').padEnd(widths[i])).join(' | ') + ' |';

    const out = [line(rows[0] ?? [])];
    out.push('| ' + widths.map((w, i) => writeAlign(align[i], w)).join(' | ') + ' |');
    for (let r = 1; r < rows.length; r++) out.push(line(rows[r]));
    return out.join('\n');
}


export function addRow(table, at) {
    const width = table.align.length;
    table.rows.splice(Math.max(1, at), 0, Array(width).fill(''));
    return table;
}

export function addColumn(table, at) {
    for (const r of table.rows) r.splice(at, 0, '');
    table.align.splice(at, 0, null);
    return table;
}

export function removeColumn(table, at) {
    if (table.align.length <= 1) return table;      // never leave no columns
    for (const r of table.rows) r.splice(at, 1);
    table.align.splice(at, 1);
    return table;
}

export function removeRow(table, at) {
    if (at === 0) return table;                     // the header has to stay
    if (table.rows.length <= 1) return table;
    table.rows.splice(at, 1);
    return table;
}

export function setAlign(table, at, align) {
    table.align[at] = align;
    return table;
}

/**
 * Where one cell's text sits inside a table, as offsets into that table.
 *
 * Works on a table straight out of the document as well as on one that has
 * just been serialised, which is what lets a caller keep the cursor in the
 * same cell across a rewrite: read the offset before, apply it after.
 *
 * The padding that lines the pipes up is not part of the cell: a caller
 * placing a cursor wants the text, not the spaces holding the column open.
 */
export function cellRange(text, row, col) {
    const lines = text.split('\n');
    const index = row === 0 ? 0 : row + 1;          // the delimiter is line 1
    if (index < 0 || index >= lines.length) return null;

    let offset = 0;
    for (let i = 0; i < index; i++) offset += lines[i].length + 1;

    const line = lines[index];
    let seen = 0;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\') { i++; continue; }   // an escaped pipe is text
        if (line[i] !== '|') continue;
        if (seen === col) {
            const close = line.indexOf('|', i + 1);
            const inner = line.slice(i + 1, close === -1 ? line.length : close);
            const from = offset + i + 1 + (inner.length - inner.trimStart().length);
            return { from, to: from + inner.trim().length };
        }
        seen++;
    }
    return null;
}
