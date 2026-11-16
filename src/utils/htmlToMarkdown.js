/**
 * Turns pasted HTML into markdown.
 *
 * Copying a paragraph from a web page or a word processor puts two things on
 * the clipboard: `text/plain`, which is what a textarea takes, and
 * `text/html`, which is the formatting. Taking the plain text throws away
 * every link, heading and list, and the person pastes a wall of prose and
 * then puts the formatting back by hand.
 *
 * There is no HTML parser here and no library. The HTML has to go through the
 * sanitiser before anything else touches it -- it came from outside, and the
 * editor already owns a sanitiser -- and sanitising gives us a DOM. Walking
 * that DOM is the whole conversion.
 *
 * It covers what people actually paste: headings, paragraphs, bold, italic,
 * strikethrough, inline code, code blocks, links, images, lists nested to any
 * depth, blockquotes, rules and tables. Anything it does not recognise falls
 * back to the text inside it, which is the same thing a plain-text paste
 * would have given.
 */

// Characters that start a markdown construct at the beginning of a line, and
// would turn pasted prose into a heading or a list by accident.
const LINE_START = /^(\s*)([-*+>#]|\d+[.)])(\s)/;

// Characters that mean something mid-line. Backslash-escaped so the pasted
// text reads as what was copied rather than as markup.
const INLINE = /([\\`*_[\]])/g;

const BLOCK = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'FIGURE',
    'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV',
    'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'UL']);

const escapeText = (text) => text
    .replace(INLINE, '\\$1')
    .replace(LINE_START, '$1\\$2$3');

/** Collapses the whitespace HTML ignores, the way a browser renders it. */
const collapse = (text) => text.replace(/[\t\n\r ]+/g, ' ');

const isBlock = (node) => node.nodeType === 1 && BLOCK.has(node.tagName);

/**
 * `**bold**` cannot start or end on a space: `** bold **` renders literally.
 * Copying a bold word usually brings its trailing space along, so the spaces
 * are moved outside the markers rather than dropped, which would join two
 * words together.
 */
const wrap = (inner, marker) => {
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    const [, before, text, after] = match;
    if (!text) return inner;
    return before + marker + text + marker + after;
};

export function htmlToMarkdown(html, sanitize) {
    const clean = sanitize(html);
    const host = document.createElement('div');
    host.innerHTML = clean;

    const out = walk(host, { listStack: [] }).replace(/\n{3,}/g, '\n\n').trim();
    return out;
}

function walk(node, ctx) {
    let out = '';
    for (const child of Array.from(node.childNodes)) out += render(child, ctx);
    return out;
}

function render(node, ctx) {
    // Text
    if (node.nodeType === 3) {
        const text = collapse(node.textContent);
        // Whitespace between two blocks is layout, not content.
        if (!text.trim() && isBlock(node.previousSibling ?? {}) ) return '';
        return ctx.raw ? node.textContent : escapeText(text);
    }
    if (node.nodeType !== 1) return '';

    const tag = node.tagName;
    const inner = () => walk(node, ctx);

    switch (tag) {
        case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
            return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + inner().trim() + '\n\n';

        case 'P': case 'DIV': case 'SECTION': case 'ARTICLE': case 'MAIN':
            return '\n\n' + inner().trim() + '\n\n';

        case 'BR':
            return '  \n';

        case 'HR':
            return '\n\n---\n\n';

        case 'STRONG': case 'B':
            return wrap(inner(), '**');

        case 'EM': case 'I':
            return wrap(inner(), '*');

        case 'DEL': case 'S': case 'STRIKE':
            return wrap(inner(), '~~');

        case 'CODE': {
            // Inside <pre> the parent emits the fence, so this is the inline
            // case only. Backticks in the content need a longer fence.
            if (node.parentNode?.tagName === 'PRE') return node.textContent;
            const text = node.textContent;
            const longest = (text.match(/`+/g) ?? []).reduce((a, s) => Math.max(a, s.length), 0);
            const fence = '`'.repeat(longest + 1);
            const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
            return fence + pad + text + pad + fence;
        }

        case 'PRE': {
            // The language, where the source bothered to say so. Highlighters
            // write it as a class, and the two spellings below are what the
            // ones people paste from actually emit.
            const classes = (node.className || '')
                + ' ' + (node.querySelector('code')?.className || '');
            const lang = /(?:language|lang)-([\w+#-]+)/.exec(classes)?.[1] ?? '';
            const text = node.textContent.replace(/\n+$/, '');
            const longest = (text.match(/^`{3,}/gm) ?? []).reduce((a, s) => Math.max(a, s.length), 2);
            const fence = '`'.repeat(longest + 1);
            return '\n\n' + fence + lang + '\n' + text + '\n' + fence + '\n\n';
        }

        case 'A': {
            const href = node.getAttribute('href');
            const text = inner().trim();
            if (!href || !text) return text;
            // A link whose text is its own address reads better bare.
            if (href === text) return '<' + href + '>';
            const title = node.getAttribute('title');
            return '[' + text + '](' + href + (title ? ' "' + title.replace(/"/g, '\\"') + '"' : '') + ')';
        }

        case 'IMG': {
            const src = node.getAttribute('src');
            if (!src) return '';
            const alt = (node.getAttribute('alt') || '').replace(/[[\]]/g, '');
            const title = node.getAttribute('title');
            return '![' + alt + '](' + src + (title ? ' "' + title.replace(/"/g, '\\"') + '"' : '') + ')';
        }

        case 'BLOCKQUOTE': {
            // Collapse first, prefix second. Each paragraph inside brings its
            // own blank lines, and prefixing those would give a quote with
            // three empty "> " lines between its paragraphs instead of one.
            const body = inner().replace(/\n{3,}/g, '\n\n').trim();
            if (!body) return '';
            return '\n\n' + body.split('\n').map((l) => ('> ' + l).trimEnd()).join('\n') + '\n\n';
        }

        case 'UL': case 'OL': {
            ctx.listStack.push({ ordered: tag === 'OL', index: Number(node.getAttribute('start') ?? 1) });
            const body = walk(node, ctx);
            ctx.listStack.pop();
            // A nested list is already indented by its parent item; a top-level
            // one needs the blank lines around it that make it a block.
            return ctx.listStack.length ? '\n' + body.replace(/\n+$/, '') : '\n\n' + body.trim() + '\n\n';
        }

        case 'LI': {
            const list = ctx.listStack[ctx.listStack.length - 1];
            if (!list) return inner();
            const marker = list.ordered ? (list.index++) + '. ' : '- ';
            const body = inner().trim();
            if (!body) return '';
            // Continuation lines, including nested lists, line up under the
            // first character of the text rather than under the marker.
            const pad = ' '.repeat(marker.length);
            return marker + body.split('\n').map((l, i) => (i ? pad + l : l)).join('\n') + '\n';
        }

        case 'TABLE': return table(node, ctx);

        // Rendered by their table
        case 'THEAD': case 'TBODY': case 'TFOOT': case 'TR': case 'TH': case 'TD':
            return inner();

        case 'SCRIPT': case 'STYLE': case 'NOSCRIPT': case 'TEMPLATE':
            return '';

        default:
            return inner();
    }
}

/**
 * A markdown table needs every row to have the same number of cells and a
 * delimiter row under the head. HTML guarantees neither, so short rows are
 * padded out.
 *
 * A table with no `th` gets an empty head rather than losing its first row to
 * one. An empty head bar looks odd, but promoting data to a heading changes
 * what the table says, and only one of those is recoverable by the reader.
 */
function table(node, ctx) {
    const rows = Array.from(node.querySelectorAll('tr'));
    if (!rows.length) return walk(node, ctx);

    const cells = rows.map((tr) => Array.from(tr.children).map((cell) => {
        // A pipe inside a cell ends the cell, and a newline ends the row.
        return walk(cell, ctx).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
    }));

    const width = cells.reduce((a, row) => Math.max(a, row.length), 0);
    if (!width) return '';
    const pad = (row) => row.concat(Array(width - row.length).fill(''));

    const hasHead = rows[0].querySelector('th') !== null;
    const head = hasHead ? pad(cells[0]) : Array(width).fill('');
    const body = (hasHead ? cells.slice(1) : cells).map(pad);

    const line = (row) => '| ' + row.join(' | ') + ' |';
    const out = [line(head), line(Array(width).fill('---')), ...body.map(line)];
    return '\n\n' + out.join('\n') + '\n\n';
}

export default htmlToMarkdown;
