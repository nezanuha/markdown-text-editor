/**
 * Headless smoke tests.
 *
 * These catch the class of bug a build cannot: runtime errors and wrong DOM
 * structure when an editor is constructed. They run against the built bundle,
 * so run `npm run build` first.
 *
 * Layout is not simulated, so offsetHeight and friends are always 0. Anything
 * depending on real measurement still has to be checked in a browser.
 *
 * DOMPurify also drops block elements (p, pre, blockquote) under happy-dom's
 * parser, though inline ones survive. Assert on <em> or <strong>, not <pre>.
 */
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';

const window = new Window({ url: 'http://localhost' });

// happy-dom 20 has no Popover API, and the dropdown tools call hidePopover()
// after a selection. Stub it: these tests care that the menu is built and the
// click handled, not that it is visually shown.
const proto = window.HTMLElement.prototype;
proto.showPopover ??= function () { this.setAttribute('data-open', ''); };
proto.hidePopover ??= function () { this.removeAttribute('data-open'); };

for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node',
                   'getComputedStyle', 'matchMedia', 'CustomEvent', 'Event',
                   'MutationObserver', 'requestAnimationFrame', 'KeyboardEvent']) {
    if (window[key] === undefined) continue;
    // Node defines some of these as getter-only, so assignment alone is not enough
    Object.defineProperty(globalThis, key, {
        value: window[key], writable: true, configurable: true
    });
}

const { default: MarkdownEditor } = await import('../dist/markdown-text-editor.es.js');

// Nothing loads the stylesheet here, so the editor's missing-CSS error fires on
// the first one built. Collect it rather than letting it litter the output, and
// pass anything else through so a real error is still visible.
const cssErrors = [];
const realError = console.error;
console.error = (...args) => {
    if (String(args[0]).includes('Stylesheet not loaded')) cssErrors.push(args[0]);
    else realError(...args);
};

let passed = 0;
const failures = [];
// A check may return a promise, for the handful of paths that only settle after
// a timer or a frame. Those are collected and awaited before the report.
const pending = [];
const record = (name, result) => {
    if (result === true) { passed++; return; }
    failures.push(name + '\n      expected true, got ' + JSON.stringify(result));
};
const check = (name, fn) => {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            pending.push(result.then(
                r => record(name, r),
                err => failures.push(name + '\n      threw ' + err.name + ': ' + err.message),
            ));
            return;
        }
        record(name, result);
    } catch (err) {
        failures.push(name + '\n      threw ' + err.name + ': ' + err.message);
    }
};

const ITEM = '.fj\\:me-menu-item';
const TITLE = '.fj\\:me-menu-title';

let seq = 0;
const makeEditor = (options = {}, value = '') => {
    const ta = document.createElement('textarea');
    ta.id = 'ed' + (++seq);
    ta.value = value;
    document.body.appendChild(ta);
    return new MarkdownEditor(ta, options);
};
// HeadingTool's dropdown uses the same menu classes, so scope to the popover
// that belongs to the variables button before querying items.
const varMenu = editor => editor.editorContainer.querySelector('.variable-btn')
    ?.closest('.fj\\:me-popover') ?? null;
const varItems = editor => [...(varMenu(editor)?.querySelectorAll(ITEM) ?? [])];
const labels = editor => varItems(editor).map(b => b.textContent);

const BASE_BAR = ['heading', 'bold', 'italic', 'ul', 'ol', 'checklist', 'blockquote',
                  'code', 'codeblock', 'hr', 'table', 'link', 'image',
                  'undo', 'redo', 'indent', 'outdent'];
const FULL_BAR = [...BASE_BAR, 'preview'];
// variables are configured inline in the toolbar
const barWith = variables => [...BASE_BAR, { variables }, 'preview'];

const VARS = [
    { label: 'Today', value: '{{today}}', sample: '10 September 2026' },
    { label: 'Customer', items: [
        { label: 'Name',  value: '{{user}}',       sample: 'Hannes' },
        { label: 'Email', value: '{{user.email}}', sample: 'h@example.com' }
    ]},
    { label: 'Invoice No', value: '{{invoice.number}}' }
];

// --- construction -----------------------------------------------------------

check('every tool constructs without throwing', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    return e.editorContainer.querySelectorAll('.markdown-btn').length > 0;
});

check('no variables configured renders no variable button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.variable-btn') === null;
});

check('malformed variables do not throw and keep the good entry', () => {
    const e = makeEditor({
        toolbar: barWith([null, 'garbage', { label: 'No value' }, { label: 'Empty', items: [] },
                          { label: 'Works', value: '{{ok}}' }])
    });
    return labels(e).length === 1 && labels(e)[0] === 'Works';
});

check('default toolbar shows no variable button', () => {
    const e = makeEditor({});
    return e.editorContainer.querySelector('.variable-btn') === null;
});

check('an empty inline list renders no button', () => {
    const e = makeEditor({ toolbar: barWith([]) });
    return e.editorContainer.querySelector('.variable-btn') === null;
});

check('hybrid mode constructs', () => !!makeEditor({ mode: 'hybrid', toolbar: FULL_BAR }).displayLayer);

// --- data-editor ------------------------------------------------------------

check('wrapper mirrors the textarea id', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.dataset.editor === e.usertextarea.id;
});

check('id still resolves to the textarea, not the wrapper', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return document.getElementById(e.usertextarea.id).tagName === 'TEXTAREA';
});

// --- variables dropdown -----------------------------------------------------

check('groups render a menu title and a nested group', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    const menu = varMenu(e);
    const titles = [...menu.querySelectorAll(TITLE)].map(t => t.textContent);
    return titles.includes('Customer')
        && menu.querySelectorAll('ul[role="group"]').length === 1;
});

check('flat and grouped entries both appear', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    const seen = labels(e);
    return ['Today', 'Name', 'Email', 'Invoice No'].every(l => seen.includes(l));
});

check('clicking an entry inserts its value', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Hi ');
    e.usertextarea.setSelectionRange(3, 3);
    varItems(e).find(b => b.textContent === 'Invoice No').click();
    return e.usertextarea.value.includes('{{invoice.number}}');
});

check('labels are not treated as markup', () => {
    const e = makeEditor({ toolbar: barWith([{ label: '<img src=x onerror=alert(1)>', value: '{{x}}' }]) });
    const item = varItems(e)[0];
    return item.querySelector('img') === null && item.textContent.includes('<img');
});

// --- preview ----------------------------------------------------------------

check('sample replaces the variable in the preview', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Hi {{user}}');
    return e.previewContent.innerHTML.includes('Hannes');
});

check('a variable without a sample stays raw', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Inv {{invoice.number}}');
    return e.previewContent.innerHTML.includes('{{invoice.number}}');
});

check('a longer variable is not clobbered by a shorter prefix', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, '{{user.email}}');
    return e.previewContent.innerHTML.includes('h@example.com');
});

check('the textarea keeps the real placeholders', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Hi {{user}}');
    return e.usertextarea.value === 'Hi {{user}}';
});

// --- custom tools -----------------------------------------------------------

class ShoutTool extends MarkdownEditor.Tool {
    constructor(editor, config) {
        super(editor, 'Shout');
        this.text = config?.text ?? '**LOUD**';
        this.button = this.createButton('<svg></svg>');
    }
    applySyntax() { this.editor.insertText(this.text); }
}

const accordion = (overrides = {}) => ({
    custom: {
        title: 'Insert accordion',
        icon: '<svg viewBox="0 0 24 24"></svg>',
        action: (editor) => editor.insertText('<div class="accordion"></div>'),
        ...overrides,
    },
});

check('a declarative custom tool renders and inserts', () => {
    const e = makeEditor({ toolbar: ['bold', accordion(), 'preview'] }, '');
    const btn = e.editorContainer.querySelector('.insert-accordion-btn');
    if (!btn || btn.title !== 'Insert accordion') return false;
    btn.click();
    return e.usertextarea.value === '<div class="accordion"></div>';
});

check('the action receives the click event, for dialogs', () => {
    let seen = null;
    const e = makeEditor({ toolbar: [accordion({ action: (ed, ev) => { seen = ev; } }), 'preview'] });
    e.editorContainer.querySelector('.insert-accordion-btn').click();
    return seen !== null && typeof seen.type === 'string';
});

check('a declarative tool title is translatable', () => {
    const e = makeEditor({ toolbar: [accordion(), 'preview'], labels: { 'Insert accordion': 'Insertar acordeon' } });
    return e.editorContainer.querySelector('.insert-accordion-btn').title === 'Insertar acordeon';
});

check('a custom tool with no action is skipped, not fatal', () => {
    const quiet = console.warn; console.warn = () => {};
    const e = makeEditor({ toolbar: ['bold', { custom: { title: 'Broken' } }, 'preview'] });
    console.warn = quiet;
    return e.editorContainer.querySelector('.broken-btn') === null
        && e.editorContainer.querySelector('.bold-btn') !== null;
});

// Note: DOMPurify drops block elements (p, pre, blockquote) under happy-dom's
// parser, so assert on inline tags only. They survive in a real browser.
const press = (editor, { key, ctrl = false, shift = false, alt = false }) => {
    const ev = new window.KeyboardEvent('keydown',
        { key, ctrlKey: ctrl, shiftKey: shift, altKey: alt, bubbles: true, cancelable: true });
    editor.usertextarea.dispatchEvent(ev);
    return ev;
};

check('a custom tool can declare a keyboard shortcut', () => {
    let fired = 0;
    const e = makeEditor({ toolbar: ['bold', { custom: {
        title: 'Shout', icon: '<svg></svg>', shortcut: 'Ctrl+Shift+K',
        action: (ed) => { fired++; ed.insertText('!!'); },
    }}, 'preview'] }, '');
    const ev = press(e, { key: 'K', ctrl: true, shift: true });
    return fired === 1 && ev.defaultPrevented && e.usertextarea.value === '!!';
});

check('a skipped custom tool does not keep its shortcut', () => {
    const quiet = console.warn; console.warn = () => {};
    const e = makeEditor({ toolbar: ['bold', { custom: {
        title: 'Broken', shortcut: 'Ctrl+Shift+J',   // no action
    }}, 'preview'] }, 'untouched');
    console.warn = quiet;
    const ev = press(e, { key: 'J', ctrl: true, shift: true });
    // Without the guard the manager still registers it, so preventDefault()
    // eats the keystroke and applySyntax throws on every press.
    return !ev.defaultPrevented && e.usertextarea.value === 'untouched';
});

check('the shortcut is shown in the tooltip, like the built-ins', () => {
    const e = makeEditor({ toolbar: [{ custom: {
        title: 'Shout', icon: '<svg></svg>', shortcut: 'Ctrl+Shift+K', action: () => {},
    }}, 'preview'] });
    return e.editorContainer.querySelector('.shout-btn').title === 'Shout (Ctrl+Shift+K)';
});

check('a tool shortcut can take over a built-in combination', () => {
    let mine = 0;
    const e = makeEditor({ toolbar: ['bold', { custom: {
        title: 'Mine', icon: '<svg></svg>', shortcut: 'Ctrl+B', action: () => { mine++; },
    }}, 'preview'] }, '');
    press(e, { key: 'b', ctrl: true });
    return mine === 1 && e.usertextarea.value === '';   // built-in bold did not also run
});

check('built-in shortcuts still work alongside', () => {
    const e = makeEditor({ toolbar: ['bold', 'preview'] }, 'hi');
    e.usertextarea.setSelectionRange(0, 2);
    press(e, { key: 'b', ctrl: true });
    return e.usertextarea.value === '**hi**';
});

check('renderMarkdown is public and honours the configured renderer', () => {
    const plain = makeEditor({ toolbar: FULL_BAR });
    const custom = makeEditor({ toolbar: FULL_BAR, renderer: md => '<em>' + md.toUpperCase() + '</em>' });
    // The uppercasing proves the custom renderer ran; which tags survive is
    // happy-dom's business, not the editor's.
    return plain.renderMarkdown('**hi**').includes('<strong>hi</strong>')
        && custom.renderMarkdown('x').includes('X');
});

check('renderMarkdown sanitizes, like the preview', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return !/onerror/.test(e.renderMarkdown('<img src=x onerror=alert(1)>'));
});

check('createToolbar builds a toolbar bound to another textarea', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'main');
    const sub = document.createElement('textarea');
    sub.value = 'hello';
    document.body.appendChild(sub);

    const bar = e.createToolbar(sub, ['bold', 'italic']);
    sub.setSelectionRange(0, 5);
    bar.querySelector('.bold-btn').click();

    // the sub-area changed and the real editor did not
    return sub.value === '**hello**' && e.usertextarea.value === 'main';
});

check('a standalone toolbar has no preview button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const sub = document.createElement('textarea');
    document.body.appendChild(sub);
    return e.createToolbar(sub, ['bold', 'preview']).querySelector('.preview-btn') === null;
});

check('a standalone toolbar inherits labels', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Bold: 'Negrita' } });
    const sub = document.createElement('textarea');
    document.body.appendChild(sub);
    return e.createToolbar(sub, ['bold']).querySelector('.bold-btn').title === 'Negrita';
});

check('destroy reaches toolbar tools', () => {
    let torn = false;
    class Listening extends MarkdownEditor.Tool {
        constructor(editor) { super(editor, 'Listening'); this.button = this.createButton('<svg></svg>'); }
        destroy() { torn = true; }
    }
    makeEditor({ toolbar: ['bold', Listening, 'preview'] }).destroy();
    return torn;
});

check('Tool and modal are reachable without a named export', () =>
    typeof MarkdownEditor.Tool === 'function' && typeof MarkdownEditor.modal === 'function');

check('a tool class in the toolbar renders a button', () => {
    const e = makeEditor({ toolbar: ['bold', ShoutTool, 'preview'] });
    const btn = e.editorContainer.querySelector('.shout-btn');
    return btn !== null && btn.title === 'Shout';
});

check('a custom tool can insert text', () => {
    const e = makeEditor({ toolbar: [ShoutTool, 'preview'] }, 'hi ');
    e.usertextarea.setSelectionRange(3, 3);
    e.editorContainer.querySelector('.shout-btn').click();
    return e.usertextarea.value === 'hi **LOUD**';
});

check('a custom tool can take configuration', () => {
    const e = makeEditor({ toolbar: [{ tool: ShoutTool, config: { text: '~~quiet~~' } }, 'preview'] }, '');
    e.editorContainer.querySelector('.shout-btn').click();
    return e.usertextarea.value === '~~quiet~~';
});

check('custom tool labels are translatable like any other', () => {
    const e = makeEditor({ toolbar: [ShoutTool, 'preview'], labels: { Shout: 'Gritar' } });
    return e.editorContainer.querySelector('.shout-btn').title === 'Gritar';
});

check('a custom tool returning no button is skipped', () => {
    class Silent extends MarkdownEditor.Tool {
        constructor(editor) { super(editor, 'Silent'); this.button = null; }
    }
    const e = makeEditor({ toolbar: ['bold', Silent, 'preview'] });
    return e.editorContainer.querySelector('.silent-btn') === null
        && e.editorContainer.querySelector('.bold-btn') !== null;
});

// --- labels -----------------------------------------------------------------

// ShortcutManager appends the shortcut, so titles read "Negrita (Ctrl+B)"
const tooltip = (editor, cls) => editor.editorContainer.querySelector(cls).title;

check('tool tooltips are translatable', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Bold: 'Negrita', Table: 'Tabla' } });
    return tooltip(e, '.bold-btn').startsWith('Negrita')
        && tooltip(e, '.table-btn') === 'Tabla';
});

check('untranslated labels fall back to English', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Bold: 'Negrita' } });
    return tooltip(e, '.italic-btn').startsWith('Italic');
});

check('class names stay in English so styling is unaffected', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Bold: 'Negrita' } });
    return e.editorContainer.querySelector('.bold-btn') !== null;
});

check('locale translates, the same as labels did', () => {
    const e = makeEditor({ toolbar: FULL_BAR, locale: { Bold: 'Negrita', Table: 'Tabla' } });
    return tooltip(e, '.bold-btn').startsWith('Negrita') && tooltip(e, '.table-btn') === 'Tabla';
});

check('the maths tool wraps a selection, and unwraps it again', () => {
    const e = makeEditor({ toolbar: ['bold', 'math'] }, 'see x^2 here');
    const btn = e.editorContainer.querySelector('.math-btn');

    e.usertextarea.setSelectionRange(4, 7);
    btn.click();
    const wrapped = e.usertextarea.value;

    // pressing it again on the same span takes the delimiters off
    e.usertextarea.setSelectionRange(4, 9);
    btn.click();

    return wrapped === 'see $x^2$ here' && e.usertextarea.value === 'see x^2 here';
});

check('maths over several lines uses the block form', () => {
    const e = makeEditor({ toolbar: ['bold', 'math'] }, 'a\nb');
    e.usertextarea.setSelectionRange(0, 3);
    e.editorContainer.querySelector('.math-btn').click();
    return e.usertextarea.value === '$$\na\nb\n$$';
});

check('the maths tool with nothing selected leaves the caret between the markers', () => {
    const e = makeEditor({ toolbar: ['bold', 'math'] }, '');
    e.usertextarea.setSelectionRange(0, 0);
    e.editorContainer.querySelector('.math-btn').click();
    return e.usertextarea.value === '$$' && e.usertextarea.selectionStart === 1;
});

check('maths that nothing renders says so, once, and not for prices', () => {
    const said = [];
    const real = console.warn;
    console.warn = (...a) => said.push(a.join(' '));

    const e = makeEditor({ toolbar: ['bold', 'math'] });
    // marked does not know TeX, so this comes through as text
    e.renderMarkdown('$x^2$');
    e.renderMarkdown('$$\n\\frac{a}{b}\n$$');
    const warnedOnce = said.filter(m => m.includes('Maths syntax')).length === 1;

    // a price is not maths, and must not provoke it
    const f = makeEditor({ toolbar: ['bold'] });
    f.renderMarkdown('it costs $5, up from $4');
    const quietForPrices = !said.some(m => m.includes('Maths syntax') && said.indexOf(m) > 0);

    // and a renderer that handles maths should hear nothing either
    const g = makeEditor({
        toolbar: ['bold'],
        renderer: md => md.replace(/\$([^$]+)\$/g, '<span class="katex">$1</span>'),
    });
    const before = said.length;
    g.renderMarkdown('$x^2$');
    const quietWhenRendered = said.length === before;

    console.warn = real;
    return warnedOnce && quietForPrices && quietWhenRendered;
});

check('every region a screen reader lands on is translated', () => {
    const e = makeEditor({
        toolbar: FULL_BAR,
        preview: true,
        locale: { 'Preview': 'Vista previa', 'Find and replace': 'Buscar y reemplazar', 'Editor toolbar': 'Barra' },
    });
    e.findReplace.open(false);
    const named = sel => e.editorContainer.querySelector(sel)?.getAttribute('aria-label');

    // the preview pane was the last place still announcing itself in English
    return named('.preview-wrapper') === 'Vista previa'
        && named('.find-replace-panel') === 'Buscar y reemplazar';
});

check('locale wins when both are given', () => {
    const e = makeEditor({ toolbar: FULL_BAR,
        locale: { Bold: 'Negrita' }, labels: { Bold: 'Grassetto' } });
    return tooltip(e, '.bold-btn').startsWith('Negrita');
});

check('a language code is reported, not silently ignored', () => {
    const errors = [];
    const real = console.error; console.error = m => errors.push(String(m));
    const e = makeEditor({ toolbar: ['bold'], locale: 'es' });
    console.error = real;
    return errors.some(m => m.includes("locale: 'es' has no effect"))
        && errors.some(m => m.includes("locale/es.js"))
        && tooltip(e, '.bold-btn').startsWith('Bold');   // still English, as before
});

check('the find panel is translatable, screen reader names included', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: {
        'Find': 'Buscar', 'Replace': 'Reemplazar', 'Match case': 'Coincidir mayusculas',
        'Next match': 'Siguiente', 'Find and replace': 'Buscar y reemplazar',
    }});
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const aria = sel => panel.querySelector(sel)?.getAttribute('aria-label');
    return panel.getAttribute('aria-label') === 'Buscar y reemplazar'
        && panel.querySelector('input').placeholder === 'Buscar'
        && aria('[aria-pressed]') === 'Coincidir mayusculas'
        && [...panel.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Siguiente');
});

// The panel is hidden with the `hidden` attribute, but every element in it also
// carries a utility class that sets `display`, and an author rule outranks the
// user agent's `[hidden] { display: none }`. Without a rule of our own the close
// button did nothing and the replace row never hid (#45). Only a real cascade
// catches this, so load the stylesheet for the three below.
const withStylesheet = fn => {
    const style = document.createElement('style');
    style.textContent = readFileSync(new URL('../dist/markdown-text-editor.css', import.meta.url), 'utf8');
    document.head.appendChild(style);
    try { return fn(); } finally { style.remove(); }
};

check('the find panel actually hides when closed', () => withStylesheet(() => {
    const e = makeEditor({ toolbar: FULL_BAR });
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const shown = getComputedStyle(panel).display;
    panel.closest('.markdown-editor-wrapper')
        .querySelector('[aria-label="Close"]').click();
    return shown !== 'none' && getComputedStyle(panel).display === 'none';
}));

check('the panel is built from the design system, not from its own CSS', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const inputs = [...panel.querySelectorAll('input')];
    const buttons = [...panel.querySelectorAll('button')];

    // The boxes are frutjam's input with its border made transparent, so the
    // panel is the only frame, and every button is frutjam's button. Anything
    // hand-rolled here would drift from the rest of the editor on the next
    // theme change.
    const fields = [...panel.querySelectorAll('.find-replace-field')];
    return inputs.length === 2
        && fields.length === 2
        && fields.every(f => f.className.includes('fj:me-input'))
        && inputs.every(i => i.className.includes('fj:border-0')
                          && i.className.includes('fj:bg-transparent'))
        && buttons.every(b => b.className.includes('fj:me-btn'))
        && !panel.querySelector('[style]');
});

check('Tab moves to the next cell inside a table, and indents outside one', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, ['Intro paragraph.', '', '| Name | Role |', '| --- | --- |', '| Alice | Engineer |'].join('\n'));
    const ta = e.usertextarea;
    const tab = (shift = false) => ta.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }));

    // Not at offset 0: the caret maths is relative to where the table starts,
    // and a table at the top of a document hides getting that wrong.
    const name = ta.value.indexOf('Name');
    ta.setSelectionRange(name + 1, name + 1);
    tab();
    const inCell = ta.value.slice(ta.selectionStart, ta.selectionEnd);

    // outside a table Tab still belongs to the indent manager
    ta.value = 'plain line';
    ta.setSelectionRange(0, 0);
    tab();
    const indented = ta.value !== 'plain line';

    return inCell === 'Role' && indented;
});

check('Tab in the last cell starts a row, and Enter on an empty row leaves', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, ['Intro paragraph.', '', '| Name | Role |', '| --- | --- |', '| Alice | Engineer |'].join('\n'));
    const ta = e.usertextarea;
    const key = k => ta.dispatchEvent(new KeyboardEvent('keydown',
        { key: k, bubbles: true, cancelable: true }));

    ta.setSelectionRange(ta.value.lastIndexOf('Engineer'), ta.value.lastIndexOf('Engineer'));
    key('Tab');                                       // last cell -> new row
    const rowsAfterTab = ta.value.trim().split('\n').length;

    key('Enter');                                     // the new row is empty
    const rowsAfterEnter = ta.value.trim().split('\n').length;

    // A table you cannot leave with Enter is a trap, so an empty row exits it.
    // two lines of prose, then header, delimiter and one row; one more once
    // Tab has added a row, and back again once Enter has dropped the empty one
    return rowsAfterTab === 6 && rowsAfterEnter === 5;
});

check('the table controls open on a click inside a table, and not outside one', () => {
    const rows = ['Intro.', '', '| a | b |', '|---|---|', '| longer cell | x |'].join('\n');
    const e = makeEditor({ toolbar: FULL_BAR }, rows);
    const ta = e.usertextarea;
    const click = () => ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    // It is a popover now, so open means open, not "not hidden".
    const atStart = !e.tablePopover.isOpen;
    const at = ta.value.indexOf('| a') + 3;
    ta.setSelectionRange(at, at);
    click();
    const inTable = e.tablePopover.isOpen;

    ta.setSelectionRange(0, 0);                       // up in the prose
    click();
    // One bar and nothing else: no grips, no insert circles, no shading.
    return atStart && inTable && !e.tablePopover.isOpen
        && !e.editorContainer.querySelector('.table-overlay');
});

check('the table controls act on the column and row the cursor is in', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, ['Intro paragraph.', '', '| a | b |', '|---|---|', '| longer cell | x |'].join('\n'));
    const ta = e.usertextarea;
    const pop = e.editorContainer.querySelector('.table-popover');
    const press = label => [...pop.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === label).click();

    const second = ta.value.indexOf('| b') + 2;
    ta.setSelectionRange(second, second);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    press('Insert column after');
    const widened = ta.value.split('\n')[2].split('|').length;

    press('Tidy the table');
    const lines = ta.value.split('\n').slice(2);
    const even = lines.every(l => l.length === lines[0].length);

    // two columns become three, which is five pieces either side of the pipes
    return widened === 5 && even;
});

check('the table bar wraps rather than running off a narrow editor', () => {
    const e = makeEditor({ toolbar: FULL_BAR },
        ['| a | b | c |', '| --- | --- | --- |', '| 1 | 2 | 3 |'].join('\n'));
    const ta = e.usertextarea;
    const at = ta.value.indexOf('| 1') + 2;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    const pop = e.editorContainer.querySelector('.table-popover');

    // Eight controls in a row are wider than a phone, and the bar was capped
    // at the pane width with nowhere for the rest to go, so the last controls
    // were simply cut off. Each group is one flex child, so a wrap breaks
    // between groups rather than through the middle of one.
    const wraps = pop.className.includes('fj:flex-wrap');

    // Placement needs real geometry, which happy-dom does not have, so the
    // clamp is checked in a browser. What is checked here is that it stays
    // out of trouble when every measurement reads zero.
    e.tablePopover._place();
    const top = parseInt(pop.style.top, 10);
    const survivesPageScroll = (() => {
        window.dispatchEvent(new Event('scroll'));
        return !pop.hidden;
    })();

    return wraps && Number.isFinite(top) && top >= 4 && survivesPageScroll;
});

check('the table controls can be reached and driven from the keyboard', () => {
    const e = makeEditor({ toolbar: FULL_BAR },
        ['| Name | Role |', '| --- | --- |', '| Alice | Engineer |'].join('\n'));
    const ta = e.usertextarea;
    const pop = e.editorContainer.querySelector('.table-popover');
    const at = ta.value.indexOf('Alice') + 2;
    ta.focus();
    ta.setSelectionRange(at, at);

    // Until now the only way in was a click, so none of this existed for
    // anyone working from the keyboard. Matched on `code`, because Alt
    // composes a character on macOS and gives a different `key`.
    ta.dispatchEvent(new KeyboardEvent('keydown',
        { key: 't', code: 'KeyT', altKey: true, bubbles: true, cancelable: true }));
    if (pop.hidden || !pop.contains(document.activeElement)) return false;

    const buttons = [...pop.querySelectorAll('button')];
    // one tab stop, arrows inside it: the toolbar pattern
    if (buttons.filter(b => b.tabIndex === 0).length !== 1) return false;

    const first = document.activeElement;
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    const second = document.activeElement;
    if (second === first || !pop.contains(second)) return false;
    if (second.tabIndex !== 0 || first.tabIndex !== -1) return false;

    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    return pop.hidden && document.activeElement === ta;
});

check('the table bar reads as named groups, not loose words', () => {
    const e = makeEditor({ toolbar: FULL_BAR },
        ['| Name | Role |', '| --- | --- |', '| Alice | Engineer |'].join('\n'));
    const ta = e.usertextarea;
    const at = ta.value.indexOf('Alice') + 2;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    const pop = e.editorContainer.querySelector('.table-popover');

    // The words Column and Row used to sit beside the buttons as text, which
    // a screen reader read out before a button that already says "column".
    // They are group names now, and the pictures are hidden.
    const named = [...pop.querySelectorAll('[role="group"]')]
        .map(g => g.getAttribute('aria-label')).join(',');
    const loose = [...pop.querySelectorAll('span')]
        .filter(x => x.textContent.trim() && x.getAttribute('aria-hidden') !== 'true');

    return named === 'Column,Row'
        && loose.length === 0
        && [...pop.querySelectorAll('button')].every(b => b.getAttribute('aria-label') && b.title);
});

check('a table with one column is a table like any other', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, ['| A |', '| --- |', '| a |'].join('\n'));
    const ta = e.usertextarea;
    const at = ta.value.indexOf('| A') + 2;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    // The delimiter pattern wanted a cell before the last one, so `| --- |`
    // never matched: no controls, no Tab between cells, no alignment. The size
    // grid offers one column, so the editor could write a table it then
    // refused to recognise.
    const barOpened = e.tablePopover.isOpen;

    [...e.editorContainer.querySelectorAll('.table-popover button')]
        .find(b => b.getAttribute('aria-label') === 'Align center').click();

    return barOpened && /:-+:/.test(ta.value.split('\n')[1]);
});

check('a centred column still lines its pipes up, however narrow', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, ['| A | Role |', '| --- | --- |', '| a | b |'].join('\n'));
    const ta = e.usertextarea;
    const at = ta.value.indexOf('| A') + 2;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    [...e.editorContainer.querySelectorAll('.table-popover button')]
        .find(b => b.getAttribute('aria-label') === 'Align center').click();

    // `:---:` is five characters at its shortest, so a column narrower than
    // that has to widen to fit it. Letting the marker overflow left the pipes
    // out of line in a way Tidy could never put right, because this is what
    // Tidy writes.
    const rows = ta.value.split('\n').filter(l => l.startsWith('|'));
    return rows.every(l => l.length === rows[0].length);
});

check('an alignment stays with its column when another is inserted', () => {
    const e = makeEditor({ toolbar: FULL_BAR },
        ['| A | B | C |', '| --- | --- | --- |', '| a | b | c |'].join('\n'));
    const ta = e.usertextarea;
    const press = label => [...e.editorContainer.querySelectorAll('.table-popover button')]
        .find(b => b.getAttribute('aria-label') === label).click();
    const put = needle => {
        const at = ta.value.indexOf(needle) + 2;
        ta.setSelectionRange(at, at);
        ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    };
    const markedColumn = () => ta.value.split('\n')[1]
        .split('|').slice(1, -1).map(c => c.trim()).findIndex(c => /-+:$/.test(c));

    put('| B'); press('Align right');
    if (markedColumn() !== 1) return false;

    put('| A'); press('Insert column after');     // inserts at index 1
    if (markedColumn() !== 2) return false;       // pushes the marked one right

    put('| A'); press('Delete column');           // and back again
    return markedColumn() === 1;
});

check('Tidy greys out when the pipes already line up', () => {
    const ragged = ['Intro.', '', '| Name | Role |', '| --- | --- |', '| Alexandra | Engineer |'].join('\n');
    const e = makeEditor({ toolbar: FULL_BAR }, ragged);
    const ta = e.usertextarea;
    const pop = e.editorContainer.querySelector('.table-popover');
    const tidy = [...pop.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'Tidy the table');

    const at = ta.value.indexOf('Alexandra') + 2;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    const liveWhileRagged = !tidy.disabled;

    tidy.click();

    // Every other control writes the table back through serialise, which lines
    // the pipes up on the way, so Tidy is usually a button that changes nothing
    // and says nothing. Now it shows that there is nothing to act on.
    return liveWhileRagged && tidy.disabled;
});

check('the align switches show which alignment the column is set to', () => {
    const e = makeEditor({ toolbar: FULL_BAR },
        ['Intro.', '', '| a | b |', '| --- | ---: |', '| 1 | 2 |'].join('\n'));
    const ta = e.usertextarea;
    const pop = e.editorContainer.querySelector('.table-popover');
    const btn = label => [...pop.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === label);
    const lit = () => ['Align left', 'Align center', 'Align right']
        .filter(l => btn(l).getAttribute('aria-pressed') === 'true');

    // column 1 has no alignment of its own, so none of the three is lit
    const first = ta.value.indexOf('| 1') + 2;
    ta.setSelectionRange(first, first);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    const noneAtFirst = lit().length === 0;

    // arrowing into column 2, which the delimiter row aligns right, moves the
    // highlight without reopening the bar
    const second = ta.value.indexOf('| 2') + 2;
    ta.setSelectionRange(second, second);
    ta.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    const rightAtSecond = lit().join() === 'Align right';

    // and pressing another one moves it again
    btn('Align center').click();
    const centerAfterPress = lit().join() === 'Align center';

    return noneAtFirst && rightAtSecond && centerAfterPress;
});

check('a column alignment survives rendering into the preview', () => {
    const e = makeEditor({ toolbar: FULL_BAR, preview: true });
    const html = e.renderMarkdown(
        ['| L | C | R |', '| :--- | :---: | ---: |', '| a | b | c |'].join('\n'));

    // The renderer writes the alignment as a presentational attribute and the
    // sanitizer has to leave it alone, or the stylesheet has nothing to act on.
    // Whether it is then painted is a cascade question, which happy-dom does
    // not answer: that half is checked in a browser.
    return html.includes('align="left"')
        && html.includes('align="center"')
        && html.includes('align="right"');
});

check('a table edit leaves the cursor in the cell it was in', () => {
    const rows = ['Intro.', '', '| Name | Role |', '|---|---|', '| Alice | Engineer |'].join('\n');
    const e = makeEditor({ toolbar: FULL_BAR }, rows);
    const ta = e.usertextarea;
    const pop = e.editorContainer.querySelector('.table-popover');

    // three characters into "Engineer"
    const at = ta.value.indexOf('Engineer') + 3;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    [...pop.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'Insert column after').click();

    // Every column just changed width, so the old offset means nothing. What
    // should survive is the cell and how far into it the cursor was.
    const c = ta.selectionStart;
    const line = ta.value.slice(ta.value.lastIndexOf('\n', c - 1) + 1,
                                ta.value.indexOf('\n', c));
    const col = c - (ta.value.lastIndexOf('\n', c - 1) + 1);
    const cellStart = line.lastIndexOf('|', col - 1) + 1;
    const cell = line.slice(cellStart, line.indexOf('|', col));

    return cell.trim() === 'Engineer'
        && col - (cellStart + cell.length - cell.trimStart().length) === 3;
});

check('deleting the column the cursor is in moves it to the one left behind', () => {
    const rows = ['Intro.', '', '| Name | Role |', '|---|---|', '| Alice | Engineer |'].join('\n');
    const e = makeEditor({ toolbar: FULL_BAR }, rows);
    const ta = e.usertextarea;
    const pop = e.editorContainer.querySelector('.table-popover');

    const at = ta.value.indexOf('Engineer') + 3;      // the last column
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    [...pop.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'Delete column').click();

    // Its own cell is gone, so the cursor cannot stay in it. It should land in
    // the column now at that edge, not back at the top of the table.
    // three characters into the cell, as it was three into the one deleted
    return !ta.value.includes('Engineer')
        && ta.value.slice(ta.selectionStart - 3, ta.selectionStart) === 'Ali';
});

check('the table button offers a grid of sizes, and inserts the one picked', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const grid = e.editorContainer.querySelector('.table-size-grid');
    const cell = [...grid.querySelectorAll('button')]
        .find(b => b.dataset.col === '4' && b.dataset.row === '3');

    cell.click();
    const lines = e.usertextarea.value.trim().split('\n');
    // four columns across, three rows down: a header, the delimiter, and two
    return grid.querySelectorAll('button').length === 64
        && lines.length === 4
        && lines[0].split('|').length === 6;
});

check('the size grid shows where the pointer is, not just how big', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const grid = e.editorContainer.querySelector('.table-size-grid');
    const cell = (c, r) => grid.querySelector(`button[data-col="${c}"][data-row="${r}"]`);

    cell(3, 2).dispatchEvent(new window.Event('mouseenter', { bubbles: false }));

    const all = [...grid.querySelectorAll('button')];
    const block = all.filter(b => b.className.includes('bg-primary-700'));
    const under = all.filter(b => b.className.includes('bg-primary-active'));

    // A fingertip covers its own square, so a block of one flat colour leaves
    // you picking blind. The corner under the pointer is darker, and is not
    // also in the block, or the two backgrounds would fight.
    return under.length === 1
        && under[0] === cell(3, 2)
        && block.length === 5              // six cells in a 3x2, less the corner
        && !block.includes(cell(3, 2));
});

check('the size grid is set up to be dragged, and still works by keyboard', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const grid = e.editorContainer.querySelector('.table-size-grid');
    const cell = (c, r) => grid.querySelector(`button[data-col="${c}"][data-row="${r}"]`);

    // Hovering has no touch equivalent, so a tap had to be aimed at one small
    // square with no preview of what it would produce. Two things make the
    // drag possible, and both are easy to delete by accident:
    //   touch-none  — or the browser reads the first finger movement as a page
    //                 scroll, takes the gesture over and fires pointercancel
    //   coarse size — 16px is a mouse target, a finger gets 28
    // The gesture itself needs real geometry and elementFromPoint, neither of
    // which happy-dom has, so it is checked in a browser.
    const dragReady = grid.className.includes('fj:touch-none')
        && cell(1, 1).className.includes('fj:pointer-coarse:size-7')
        && grid.style.gridTemplateColumns.includes('auto');

    // Capturing the pointer retargets the click to the grid, so a release does
    // the inserting now. The click handler stays for the keyboard, where there
    // is no pointer and no capture, and this is the path that proves it.
    cell(4, 3).click();
    const lines = e.usertextarea.value.split('\n').filter(x => x.trim().startsWith('|'));

    return dragReady && lines.length === 4 && lines[0].split('|').length - 2 === 4;
});

check('a table inserted below another is a second table, not more rows', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const pick = (cols, rows) => e.editorContainer.querySelector('.table-size-grid')
        .querySelector(`button[data-col="${cols}"][data-row="${rows}"]`).click();

    pick(4, 2);
    pick(7, 4);                   // from wherever the first insert left the caret

    const lines = e.usertextarea.value.split('\n');
    // Without a blank line between them the second table was swallowed by the
    // first: one table of seven rows, with columns 5 to 7 dropped in silence
    // because the first table only declares four.
    return lines[3] === ''
        && lines[4].split('|').length === 9      // seven columns, kept
        && lines[2].split('|').length === 6;     // the first table still has four
});

check('a table inserted above text leaves it a paragraph, not a third row', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'next paragraph');
    e.usertextarea.setSelectionRange(0, 0);
    e.editorContainer.querySelector('.table-size-grid')
        .querySelector('button[data-col="2"][data-row="2"]').click();

    // A GFM table runs on until a blank line. With no newline at all the
    // paragraph was welded onto the last row as `|   |   |next paragraph`;
    // with one it became a third row. It takes a blank line to end the block.
    const lines = e.usertextarea.value.split('\n');
    return lines.length === 5
        && lines[3] === ''
        && lines[4] === 'next paragraph'
        // and the caret is left in the table, not on the line below it
        && e.usertextarea.selectionStart === e.usertextarea.value.indexOf('\n\n');
});

check('leaving a fresh table with Enter keeps every row it was given', () => {
    // a separator row is the one carrying dashes; the rest are the header and
    // the body rows, so the body count is one short of what is left
    const bodyRows = ta => ta.value.split('\n')
        .filter(l => l.trim().startsWith('|') && !l.includes('---')).length - 1;

    // Every size the grid offers, because the first fix only covered a table
    // with a single row and an 8 x 4 still lost one.
    for (let rows = 2; rows <= 8; rows++) {
        const e = makeEditor({ toolbar: FULL_BAR });
        e.editorContainer.querySelector('.table-size-grid')
            .querySelector(`button[data-col="8"][data-row="${rows}"]`).click();
        const ta = e.usertextarea;
        const asked = bodyRows(ta);

        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

        // Enter leaves a table from an empty row, but a row the size grid was
        // asked for is not Enter's to take back.
        if (bodyRows(ta) !== asked) return false;
        // and the caret clears the table and the blank line under it, so what
        // is typed next is a paragraph rather than another row
        const line = ta.value.slice(0, ta.selectionStart).split('\n').pop();
        if (line.startsWith('|') || ta.selectionStart !== ta.value.length) return false;
    }
    return true;
});

check('Enter takes back the row it made, and leaves the ones it did not', () => {
    const bodyRows = ta => ta.value.split('\n')
        .filter(l => l.trim().startsWith('|') && !l.includes('---')).length - 1;
    const e = makeEditor({ toolbar: FULL_BAR },
        ['| a | b |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |', ''].join('\n'));
    const ta = e.usertextarea;
    const enter = () => ta.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'Enter', bubbles: true, cancelable: true }));

    const at = ta.value.indexOf('| 3') + 3;
    ta.setSelectionRange(at, at);
    enter();                       // the last filled row -> a row Enter made
    const made = bodyRows(ta);
    enter();                       // empty, and Enter's own, so it goes

    return made === 3 && bodyRows(ta) === 2;
});

check('two tables with no blank line between them are two tables', () => {
    const first = ['| a1 | a2 | a3 |', '| -- | -- | -- |', '|    |    |    |'].join('\n');
    const second = ['| b1 | b2 |', '| -- | -- |', '|    |    |'].join('\n');
    const e = makeEditor({ toolbar: FULL_BAR }, first + '\n' + second);
    const ta = e.usertextarea;

    // A table has exactly one delimiter row, so the second one starts another
    // table. Reading the run as one table put the cursor halfway down it, so
    // Enter could never step out of the first, and any edit to the first
    // rewrote the second: widened to match, its delimiter left showing as a
    // row of dashes.
    ta.setSelectionRange(first.length, first.length);
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    // stepping out of the first separates them, and leaves the second as it was
    return ta.value.includes(second)
        && ta.value.includes('\n\n')
        && ta.value.indexOf('b1') > ta.value.indexOf('\n\n');
});

check('Enter steps out of a table onto a line prose can go on, whatever follows', async () => {
    const table = ['| a | b |', '| --- | --- |', '| 1 | 2 |', '|   |   |'].join('\n');
    const other = ['| c | d | e |', '| --- | --- | --- |', '|   |   |   |'].join('\n');

    // The caret needs an empty line with a blank line above it: the line right
    // under a table is still the table, and the line past the gap is already
    // taken when something else is there.
    for (const below of ['', '\n', '\n\n', '\n\n\n\n',
                         '\nnext paragraph', '\n\nnext paragraph',
                         '\n\n' + other, '\n' + other,
                         '\n\n## Heading', '\n\n- one\n- two']) {
        const e = makeEditor({ toolbar: FULL_BAR }, table + below);
        const ta = e.usertextarea;
        ta.setSelectionRange(table.length, table.length);
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

        const lines = ta.value.slice(0, ta.selectionStart).split('\n');
        const onEmptyLine = lines[lines.length - 1] === ''
            && ta.value.slice(ta.selectionStart).split('\n')[0] === '';
        const blankAbove = lines[lines.length - 2] === '';
        if (!onEmptyLine || !blankAbove) return false;

        // the table kept its two rows, and whatever was below is untouched
        const rows = ta.value.split('\n')
            .filter(l => l.trim().startsWith('|') && !l.includes('---'));
        if (rows.length < 3) return false;
        if (below.trim() && !ta.value.includes(below.trim())) return false;
    }
    return true;
});

check('stepping out of a table twice does not stack up blank lines', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, ['| a | b |', '| --- | --- |', '| 1 | 2 |', ''].join('\n'));
    const ta = e.usertextarea;
    const enter = () => ta.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'Enter', bubbles: true, cancelable: true }));

    // re-found each time, because writing the table back aligns the pipes
    // and every offset in it moves
    const intoTheRow = () => {
        const at = ta.value.indexOf('| 1') + 3;
        ta.setSelectionRange(at, at);
    };

    intoTheRow();
    enter();                      // the last filled row -> a new empty one
    enter();                      // the empty one -> out, dropping it
    const once = ta.value;

    intoTheRow();
    enter();
    enter();
    return ta.value === once;
});

check('the panel lays itself out from its own width, in CSS', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const rows = [...panel.querySelectorAll('.find-replace-row')];
    const controls = [...panel.querySelectorAll('.find-replace-controls')];
    const options = panel.querySelector('.find-replace-options');

    // The panel is the container, so the rules key off how much room the
    // panel has rather than how wide the window is: a narrow editor on a
    // desktop has the same problem as a phone. This used to be a
    // ResizeObserver measuring offsetTop and toggling a class.
    return panel.className.includes('fj:@container')
        && rows.every(r => r.className.includes('fj:flex-wrap')
                        && r.className.includes('fj:justify-end'))
        // the controls fold under the box on their own when there is no room
        && controls.length === 2
        // under 22rem the matching switches wait behind the chevron
        && options.className.includes('fj:@max-[22rem]:hidden')
        && options.className.includes('fj:@max-[22rem]:[.is-expanded_&]:flex');
});

check('every match is marked, not just the one you are on', async () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat and the hat sat on the mat');
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const input = panel.querySelector('input');
    input.value = 'the';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // typing defers the marks to the next pause, so the count can keep up
    await new Promise(r => setTimeout(r, 200));
    const layer = e.usertextarea.parentElement.querySelector('.find-replace-marks');
    // one solid for where you are, a wash for the rest
    return layer.children.length === 3
        && layer.querySelectorAll('.find-replace-mark').length === 3
        && layer.querySelectorAll('.is-current').length === 1;
});

check('the count is silent, and a live region speaks for it', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat');
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const count = panel.querySelector('.find-replace-count');
    const live = panel.querySelector('[aria-live]');

    // The count changes on every keystroke. Announcing each one means a
    // screen reader never gets to the end of a sentence.
    return count.getAttribute('aria-hidden') === 'true'
        && live !== null && live !== count
        && live.className.includes('sr-only')
        && live.textContent === '';
});

check('the count is announced once the typing stops', async () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat and the hat');
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const live = panel.querySelector('[aria-live]');
    const input = panel.querySelector('input');

    input.value = 't';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'th';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'the';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const whileTyping = live.textContent;

    await new Promise(r => setTimeout(r, 700));
    return whileTyping === '' && live.textContent === '2 matches';
});

check('replacing everything says how much it changed', async () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat and the hat and the mat');
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const live = panel.querySelector('[aria-live]');
    const [find, replace] = panel.querySelectorAll('input');

    find.value = 'the';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    replace.value = 'a';
    [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'Replace all').click();

    await new Promise(r => setTimeout(r, 700));
    // the count would say 0 matches, which is true and useless
    return live.textContent === '3 replaced'
        && e.usertextarea.value === 'a cat and a hat and a mat';
});

check('preserve case gives a replacement the case it replaced', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'cat CAT Cat cAt');
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const [find, replace] = panel.querySelectorAll('input');
    const press = label => [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === label).click();

    find.value = 'cat';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    replace.value = 'dog';
    press('Preserve case');
    press('Replace all');

    // shouted stays shouted, capitalised stays capitalised, the rest is typed
    return e.usertextarea.value === 'dog DOG Dog dog';
});

check('find in selection searches and replaces only what was selected', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'one the two the three the four');
    const ta = e.usertextarea;
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const [find, replace] = panel.querySelectorAll('input');
    const press = label => [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === label).click();

    const from = ta.value.indexOf('two');
    const to = ta.value.indexOf('three') + 'three'.length;
    ta.setSelectionRange(from, to);
    press('Find in selection');

    find.value = 'the';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    const scoped = panel.querySelector('.find-replace-count').textContent;

    replace.value = 'X';
    press('Replace all');

    // one of the three "the"s is inside the selection, and only it changes
    return scoped === '1/1' && ta.value === 'one the two X three the four';
});

check('find in selection will not engage with nothing selected', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat');
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const btn = [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'Find in selection');

    e.usertextarea.setSelectionRange(3, 3);
    btn.click();
    // there is no range to scope to, so the switch stays off rather than
    // quietly scoping to nothing and finding none of anything
    return btn.getAttribute('aria-pressed') === 'false';
});

check('every control in the panel has a name, and says its shortcut', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const buttons = [...panel.querySelectorAll('button')];

    // A name for a screen reader, the shortcut declared rather than only
    // written in the tooltip, and the tooltip spelling Control as Ctrl.
    const named = buttons.every(b => (b.getAttribute('aria-label') || '').length > 2);
    const withKeys = buttons.filter(b => b.hasAttribute('aria-keyshortcuts'));
    const titled = withKeys.every(b => b.title.includes('(') && !b.title.includes('Control+'));

    // the switches report their state, and the disclosure says what it opens
    const toggles = buttons.filter(b => b.hasAttribute('aria-pressed'));
    const chevron = panel.querySelector('[aria-expanded]');

    return named && titled
        && withKeys.length >= 8
        && toggles.length === 5
        && chevron.getAttribute('aria-controls') === panel.querySelector('.is-replace').id;
});

check('what cannot be done is disabled, not silent', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat');
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const input = panel.querySelector('input');
    const state = name => [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === name).disabled;

    input.value = 'zzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const nothingFound = state('Next match') && state('Previous match')
        && state('Replace') && state('Replace all');

    input.value = 'the';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const found = !state('Next match') && !state('Replace all');

    // tabbing onto four controls that answer with silence is the thing to avoid
    return nothingFound && found;
});

check('a scoped range keeps covering the same text as the document is edited', () => {
    // start: "KEEP cat cat | OUTSIDE cat", scoped to "KEEP cat cat "
    const scoped = (edit) => {
        const e = makeEditor({ toolbar: FULL_BAR }, 'KEEP cat cat | OUTSIDE cat');
        e.findReplace.open(true);
        const panel = e.editorContainer.querySelector('.find-replace-panel');
        const btn = name => [...panel.querySelectorAll('button')]
            .find(b => b.getAttribute('aria-label') === name);

        e.usertextarea.setSelectionRange(0, 13);
        btn('Find in selection').click();
        const find = panel.querySelector('input');
        find.value = 'cat';
        find.dispatchEvent(new Event('input', { bubbles: true }));

        e.usertextarea.value = edit(e.usertextarea.value);
        e.usertextarea.dispatchEvent(new Event('input', { bubbles: true }));

        panel.querySelector('.is-replace input').value = 'dog';
        btn('Replace all').click();
        return e.usertextarea.value;
    };

    // inserted before the range: it slides along, both cats still inside
    const before = scoped(v => 'INSERTED ' + v);
    // inserted after the range: nothing moves
    const after = scoped(v => v + ' TRAILING');
    // deleted before the range: it slides back
    const deleted = scoped(v => v.replace('KEEP ', ''));

    return before === 'INSERTED KEEP dog dog | OUTSIDE cat'
        && after === 'KEEP dog dog | OUTSIDE cat TRAILING'
        && deleted === 'dog dog | OUTSIDE cat';
});

check('the arrows and replace work on a pending edit without waiting for it', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'cat and cat');
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const find = panel.querySelector('input');
    const btn = name => [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === name);

    find.value = 'cat';
    find.dispatchEvent(new Event('input', { bubbles: true }));

    // the re-search waits for a pause, so right after this the offsets are
    // known to be stale and no timer has fired
    e.usertextarea.value = 'ZZZZZ cat and cat and cat';
    e.usertextarea.dispatchEvent(new Event('input', { bubbles: true }));
    const staleBeforeFlush = e.findReplace._stale === true;

    // an arrow has to bring them up to date rather than step through old ones
    btn('Next match').click();
    const countAfterArrow = panel.querySelector('.find-replace-count').textContent;

    panel.querySelector('.is-replace input').value = 'dog';
    btn('Replace all').click();

    return staleBeforeFlush
        && countAfterArrow.endsWith('/3')
        && e.usertextarea.value === 'ZZZZZ dog and dog and dog';
});

check('an edit in the document does not make Replace rewrite the wrong text', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'cat cat cat');
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const find = panel.querySelector('input');
    const replace = panel.querySelector('.is-replace input');

    find.value = 'cat';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    replace.value = 'dog';

    // the reader goes back to the text and types, pushing every match along
    e.usertextarea.value = 'XXXXXXXXXX cat cat cat';
    e.usertextarea.dispatchEvent(new Event('input', { bubbles: true }));

    [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'Replace').click();

    // Replacing at the offsets found before the edit ate the X's and left
    // every match standing: 'dogXXXXXXX cat cat cat'
    return e.usertextarea.value === 'XXXXXXXXXX dog cat cat'
        && panel.querySelector('.find-replace-count').textContent === '1/2';
});

check('a switch reports itself the same way wherever it is set from', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat');
    e.findReplace.open(false);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const btn = name => [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === name);
    const reads = b => b.getAttribute('aria-pressed') + ':'
        + b.className.includes('fj:me-btn-active') + ':' + b.className.includes('fj:me-btn-ghost');

    const off = reads(btn('Match case'));
    btn('Match case').click();
    const on = reads(btn('Match case'));

    // the same three facts for a switch set by hand and one reset by close()
    e.usertextarea.setSelectionRange(0, 3);
    btn('Find in selection').click();
    const scopeOn = reads(btn('Find in selection'));
    e.findReplace.close();
    const scopeOff = reads(btn('Find in selection'));

    return off === 'false:false:true' && on === 'true:true:false'
        && scopeOn === on && scopeOff === off;
});

check('the shortcuts work from anywhere in the panel', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat and The hat');
    e.findReplace.open(true);
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const key = (code, mods) => panel.dispatchEvent(new KeyboardEvent('keydown',
        { key: code.replace('Key', '').toLowerCase(), code, bubbles: true, cancelable: true, ...mods }));
    const pressed = name => [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === name).getAttribute('aria-pressed');

    key('KeyC', { altKey: true });
    const caseOn = pressed('Match case') === 'true';
    key('KeyR', { altKey: true });
    const regexOn = pressed('Regular expression') === 'true';

    // Escape has to work with focus on a button, not only in the box
    [...panel.querySelectorAll('button')][0].focus();
    panel.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

    return caseOn && regexOn && panel.hidden;
});

check('the shortcuts work with the caret back in the text', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the cat and The hat');
    const ta = e.usertextarea;
    const press = (code, mods) => ta.dispatchEvent(new KeyboardEvent('keydown',
        { key: code.replace('Key', '').toLowerCase(), code, bubbles: true, cancelable: true, ...mods }));
    const pressed = name => [...e.editorContainer.querySelectorAll('.find-replace-panel button')]
        .find(b => b.getAttribute('aria-label') === name)?.getAttribute('aria-pressed');

    // nothing open: Alt+W is not ours to take
    press('KeyW', { altKey: true });
    const quietWhenClosed = pressed('Whole word') === undefined;

    e.findReplace.open(false);
    press('KeyW', { altKey: true });
    const onFromText = pressed('Whole word') === 'true';
    press('KeyW', { altKey: true });

    // the letter is unreliable with Alt held, so the code alone has to carry it
    ta.dispatchEvent(new KeyboardEvent('keydown',
        { key: '∑', code: 'KeyW', altKey: true, bubbles: true, cancelable: true }));
    const onFromComposedKey = pressed('Whole word') === 'true';

    return quietWhenClosed && onFromText && onFromComposedKey;
});

check('the match count reads as a fraction and is there before you type', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the better letter');
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const count = panel.querySelector('.find-replace-count');
    const empty = count.textContent;
    const input = panel.querySelector('input');
    input.value = 'e';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Always on screen, so typing does not shift the line, and a slash needs no
    // translating where "1 of 9" would.
    return empty === '0/0' && /^\d+\/[1-9]\d*$/.test(count.textContent);
});

check('the replace row stays hidden until the replace button is pressed', () => withStylesheet(() => {
    const e = makeEditor({ toolbar: FULL_BAR });
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');
    const row = panel.querySelector('.find-replace-row.is-replace');
    const before = getComputedStyle(row).display;
    [...panel.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'Toggle replace row').click();
    // Hidden has to resolve to none against the utility classes on the row,
    // which is the whole of #45.
    return before === 'none' && getComputedStyle(row).display !== 'none';
}));

// Every utility assumes border-box, and so does the sizing done from
// JavaScript: the wrapper is handed a pixel height while carrying a 1px border.
// Under content-box `minHeight: 200` yields 202 and the Find box, which sets a
// width alongside padding, comes out 17px over. Tailwind's preflight used to be
// the only thing making this true, so a plain page differed from the demo.
check('the editor is border-box without the host page providing it', () => withStylesheet(() => {
    const e = makeEditor({ toolbar: FULL_BAR, minHeight: 200 });
    e.findReplace.open();
    const input = e.editorContainer.querySelector('.find-replace-panel input');
    return getComputedStyle(e.editorContainer).boxSizing === 'border-box'
        && getComputedStyle(input).boxSizing === 'border-box';
}));

check('the footer is translatable, with the number placed by the translation', () => {
    const e = makeEditor({ footer: { words: true, chars: true }, labels: {
        '{n} words': 'palabras: {n}', '{n} chars': 'caracteres: {n}',
    }}, 'one two three');
    const text = e.editorContainer.querySelector('.editor-footer').textContent;
    return text.includes('palabras: 3') && text.includes('caracteres: 13');
});

check('footer counts fall back to English', () => {
    const e = makeEditor({ footer: { words: true } }, 'one two three');
    return e.editorContainer.querySelector('.editor-footer').textContent.includes('3 words');
});

check('heading menu items are translated', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Heading: 'Titulo' } });
    const wrapper = e.editorContainer.querySelector('.heading-btn').closest('.fj\\:me-popover');
    return [...wrapper.querySelectorAll(ITEM)].some(b => b.textContent === 'Titulo 1');
});

// --- heading levels ---------------------------------------------------------

const headingItems = editor => [...editor.editorContainer
    .querySelector('.heading-btn').closest('.fj\\:me-popover')
    .querySelectorAll(ITEM)].map(b => b.textContent);

check('all six levels are offered by default', () =>
    headingItems(makeEditor({ toolbar: ['heading', 'bold'] })).length === 6);

check('levels narrows the dropdown', () => {
    const items = headingItems(makeEditor({ toolbar: [{ heading: { levels: [2, 3, 4] } }, 'bold'] }));
    return items.length === 3 && items[0] === 'Heading 2' && items[2] === 'Heading 4';
});

check('levels are sorted, whatever order you give them', () => {
    const items = headingItems(makeEditor({ toolbar: [{ heading: { levels: [4, 2] } }, 'bold'] }));
    return items[0] === 'Heading 2' && items[1] === 'Heading 4';
});

check('a narrowed dropdown still inserts the right prefix', () => {
    const e = makeEditor({ toolbar: [{ heading: { levels: [2, 3] } }, 'bold'] }, 'Title');
    e.editorContainer.querySelector('.heading-btn').closest('.fj\\:me-popover')
        .querySelectorAll(ITEM)[1].click();      // Heading 3
    return e.usertextarea.value === '### Title';
});

check('a level left out cannot be typed either', () => {
    const e = makeEditor({ toolbar: [{ heading: { levels: [2, 3] } }, 'bold'] }, 'Title');
    const ev = press(e, { key: '1', ctrl: true });
    return !ev.defaultPrevented && e.usertextarea.value === 'Title';
});

check('a level that is offered still works from the keyboard', () => {
    const e = makeEditor({ toolbar: [{ heading: { levels: [2, 3] } }, 'bold'] }, 'Title');
    press(e, { key: '2', ctrl: true });
    return e.usertextarea.value === '## Title';
});

check('the tooltip lists only the shortcuts that exist', () => {
    const e = makeEditor({ toolbar: [{ heading: { levels: [2, 3] } }, 'bold'] });
    return tooltip(e, '.heading-btn') === 'Heading (Ctrl+2/3)';
});

check('no shortcut hint when none of 1-3 is offered', () => {
    const e = makeEditor({ toolbar: [{ heading: { levels: [4, 5, 6] } }, 'bold'] });
    return tooltip(e, '.heading-btn') === 'Heading';
});

check('levels restrict the toolbar, not what can be typed', () => {
    const e = makeEditor({ toolbar: [{ heading: { levels: [2, 3] } }, 'bold'] });
    // A hand-typed H1 is still a heading; the renderer decides what is valid,
    // not the toolbar. Asserting on the transformation rather than the tag,
    // since DOMPurify drops block elements under happy-dom.
    return e.renderMarkdown('# Title').trim() === 'Title';
});

check('shortcuts still cover 1-3 when heading is not in the toolbar', () => {
    const e = makeEditor({ toolbar: ['bold'] }, 'Title');
    press(e, { key: '1', ctrl: true });
    return e.usertextarea.value === '# Title';
});

check('a junk levels value warns and falls back to all six', () => {
    const quiet = console.warn; console.warn = () => {};
    const items = headingItems(makeEditor({ toolbar: [{ heading: { levels: [0, 9, 'two'] } }, 'bold'] }));
    console.warn = quiet;
    return items.length === 6;
});

// --- scroll arithmetic that could go NaN ------------------------------------

// Layout is not simulated, so these check the guards rather than the geometry.
// The real positions were measured in a browser; what can regress here is a
// division by a zero range, or a scroll driven by a measurement that is absent.

// These drive the editor the way a user does rather than calling the new
// helpers, so they fail on the old code because of what it does, not because a
// method is missing. Without layout every height is 0, which is exactly the
// degenerate case both bugs turned into NaN.

check('searching does not fling the textarea to the top', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'line\n'.repeat(60) + 'needle');
    e.findReplace.open();
    e.usertextarea.scrollTop = 200;

    const input = e.editorContainer.querySelector('.find-replace-panel input');
    input.value = 'needle';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    // The old code read line-height, got NaN, and wrote NaN to scrollTop, which
    // a browser stores as 0. Nothing here can measure a real position, so the
    // right answer is to leave the reader where they were.
    return e.usertextarea.scrollTop === 200;
});

check('typing does not reset a preview the reader scrolled', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '# one\n\n# two\n\n# three');
    e.editorContainer.querySelector('.preview-btn')?.click();
    if (!e.previewContent) return 'no preview pane';

    e.previewContent.scrollTop = 120;
    // The textarea cannot scroll here, so the range is zero. The old code
    // divided by it, and 0/0 stored as 0 took the reader back to the top.
    e.usertextarea.value += ' more';
    e.usertextarea.dispatchEvent(new window.Event('input', { bubbles: true }));

    return new Promise(resolve => setTimeout(
        () => resolve(e.previewContent.scrollTop === 120), 250));
});

// --- selection trimming (#47) -----------------------------------------------

// Double-clicking a word takes the space after it, and triple-clicking a line
// takes the newline. Wrapping that raw selection put the closing marker on the
// wrong side: `**Lorem **ipsum`, which no parser reads as bold.
const selectThen = (value, selected, btn, options = {}) => {
    const e = makeEditor({ toolbar: FULL_BAR, ...options }, value);
    const start = value.indexOf(selected);
    e.usertextarea.setSelectionRange(start, start + selected.length);
    e.editorContainer.querySelector(btn).click();
    return e.usertextarea.value;
};

check('a trailing space is left outside the markers', () =>
    selectThen('Lorem ipsum dolor', 'Lorem ', '.bold-btn') === '**Lorem** ipsum dolor');

check('italic, strikethrough and code trim the same way', () =>
    selectThen('Lorem ipsum', 'Lorem ', '.italic-btn') === '*Lorem* ipsum'
    && selectThen('Lorem ipsum', 'Lorem ', '.code-btn') === '`Lorem` ipsum'
    // strikethrough is not in FULL_BAR, so ask for it explicitly
    && selectThen('Lorem ipsum', 'Lorem ', '.strikethrough-btn',
                  { toolbar: ['bold', 'strikethrough'] }) === '~~Lorem~~ ipsum');

check('a trailing newline from a triple click stays outside', () =>
    selectThen('First line\nSecond', 'First line\n', '.bold-btn') === '**First line**\nSecond');

check('a selection with no stray whitespace is untouched', () =>
    selectThen('Lorem ipsum', 'Lorem', '.bold-btn') === '**Lorem** ipsum');

check('unwrapping still works after trimming', () =>
    selectThen('**Lorem** ipsum', '**Lorem** ', '.bold-btn') === 'Lorem ipsum');

check('a selection of only spaces is left alone', () => {
    const out = selectThen('a   b', '   ', '.bold-btn');
    return out.includes('a') && out.includes('b');
});

// --- scroll and height preservation (#46) -----------------------------------

// Layout is not simulated, so scrollTop is just a property here. That is enough:
// the old code derived a position from `line-height`, which computes to `normal`
// unless a page sets it, so parseInt gave NaN and every edit wrote NaN to
// scrollTop, which a browser turns into 0. Recording the writes catches that
// without needing real layout.
const recordScrollWrites = textarea => {
    const writes = [];
    let value = 0;
    Object.defineProperty(textarea, 'scrollTop', {
        get: () => value,
        set: v => { writes.push(v); value = v; },
        configurable: true,
    });
    return { writes, at: v => { value = v; writes.length = 0; }, now: () => value };
};

check('formatting holds the scroll position instead of jumping to the top', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'line\n'.repeat(60) + 'word');
    const scroll = recordScrollWrites(e.usertextarea);
    scroll.at(600);

    e.usertextarea.setSelectionRange(e.usertextarea.value.length - 4, e.usertextarea.value.length);
    e.insertText('**word**');

    return scroll.now() === 600 && !scroll.writes.some(v => Number.isNaN(v));
});

check('the heading tool holds the scroll position too', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'line\n'.repeat(60) + 'title');
    const scroll = recordScrollWrites(e.usertextarea);
    scroll.at(600);

    e.usertextarea.setSelectionRange(e.usertextarea.value.length - 2, e.usertextarea.value.length - 2);
    e.editorContainer.querySelector('.heading-btn').click();
    const item = [...e.editorContainer.querySelectorAll(ITEM)].find(b => /2/.test(b.textContent));
    item?.click();

    return scroll.now() === 600 && !scroll.writes.some(v => Number.isNaN(v));
});

// The wrapper is what resizes. The textarea had its own grip in plain mode,
// because resize-none was only set on the hybrid path, so you saw two handles
// and the inner one sized the textarea out of its container.
check('only the wrapper is resizable, in either mode', () => {
    const plain = makeEditor({ mode: 'plain' }, 'x');
    const hybrid = makeEditor({ mode: 'hybrid' }, 'x');
    return plain.usertextarea.classList.contains('fj:resize-none')
        && hybrid.usertextarea.classList.contains('fj:resize-none');
});

check('a height the reader set by hand survives the next edit', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'hello');
    e.editorContainer.style.height = '420px';   // as dragging the resize handle does
    e.insertText(' there');
    return e.editorContainer.style.height === '420px';
});

// --- paste ------------------------------------------------------------------

const paste = (editor, { text = '', files = [] } = {}) => {
    const event = new window.Event('paste', { bubbles: true, cancelable: true });
    event.clipboardData = { getData: () => text, files, types: files.length ? ['Files'] : ['text/plain'] };
    editor.usertextarea.dispatchEvent(event);
    return event;
};

check('a bare URL pasted over a selection becomes a link', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'see the docs here');
    e.usertextarea.setSelectionRange(4, 12);      // "the docs"
    paste(e, { text: 'https://example.com' });
    return e.usertextarea.value === 'see [the docs](https://example.com) here';
});

check('a URL pasted with no selection is left to the browser', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'abc');
    e.usertextarea.setSelectionRange(3, 3);
    const event = paste(e, { text: 'https://example.com' });
    return !event.defaultPrevented && e.usertextarea.value === 'abc';
});

check('non-URL text pasted over a selection is left to the browser', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'hello world');
    e.usertextarea.setSelectionRange(0, 5);
    const event = paste(e, { text: 'not a url' });
    return !event.defaultPrevented;
});

check('a URL with spaces is not treated as a link', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'hello world');
    e.usertextarea.setSelectionRange(0, 5);
    const event = paste(e, { text: 'see https://example.com for more' });
    return !event.defaultPrevented;
});

check('pasting an image without an upload endpoint warns and does nothing', () => {
    let warned = '';
    const quiet = console.warn;
    console.warn = (...a) => { warned = a.join(' '); };
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const file = new window.File(['x'], 'a.png', { type: 'image/png' });
    const event = paste(e, { files: [file] });
    console.warn = quiet;
    return !event.defaultPrevented
        && e.usertextarea.value === ''
        && /no upload endpoint is configured/.test(warned);
});

// --- renderer / sanitizer ---------------------------------------------------

check('custom renderer is used', () => {
    const e = makeEditor({ toolbar: FULL_BAR, renderer: md => '<pre>' + md.toUpperCase() + '</pre>' }, 'hello');
    return e.previewContent.innerHTML.includes('HELLO');
});

check('DOMPurify still runs when only renderer is given', () => {
    const e = makeEditor({ toolbar: FULL_BAR, renderer: () => '<img src=x onerror=alert(1)>' }, 'x');
    return !e.previewContent.innerHTML.includes('onerror');
});

check('custom sanitizer is used', () => {
    const e = makeEditor({
        toolbar: FULL_BAR,
        renderer:  () => '<b>keep</b><i>strip</i>',
        sanitizer: html => html.replace('<i>strip</i>', '')
    }, 'x');
    const html = e.previewContent.innerHTML;
    return html.includes('keep') && !html.includes('strip');
});

check('script tags are stripped by default', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '<script>alert(1)</scr' + 'ipt>');
    return !/<script/i.test(e.previewContent.innerHTML);
});

// --- image upload via paste and drop ----------------------------------------

const checkAsync = async (name, fn) => {
    try {
        const result = await fn();
        if (result === true) { passed++; return; }
        failures.push(name + '\n      expected true, got ' + JSON.stringify(result));
    } catch (err) {
        failures.push(name + '\n      threw ' + err.name + ': ' + err.message);
    }
};

const UPLOAD_BAR = [...BASE_BAR, { image: { fileInput: { uploadUrl: '/api/upload' } } }, 'preview'];
const pngFile = () => new window.File(['x'], 'shot.png', { type: 'image/png' });

// Replaces fetch for one upload, and records what the editor sent
const stubUpload = (body) => {
    const sent = {};
    globalThis.fetch = async (url, init) => {
        sent.url = url;
        sent.method = init?.method;
        sent.form = init?.body;
        return { ok: true, json: async () => body };
    };
    return sent;
};

// The editor awaits fetch, so yield until the placeholder has been swapped out
const settle = async (editor) => {
    for (let i = 0; i < 20 && editor.usertextarea.value.includes('Uploading'); i++) {
        await new Promise(r => setTimeout(r, 0));
    }
};

await checkAsync('pasting an image uploads it and inserts the markdown', async () => {
    const sent = stubUpload({ success: true, image_path: '/media/shot.png', image_alt: 'A screenshot' });
    const e = makeEditor({ toolbar: UPLOAD_BAR }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![A screenshot](/media/shot.png)'
        && sent.url === '/api/upload' && sent.method === 'POST';
});

await checkAsync('a placeholder is shown while the upload is in flight', async () => {
    let release;
    globalThis.fetch = () => new Promise(r => { release = r; });
    const e = makeEditor({ toolbar: UPLOAD_BAR }, '');
    paste(e, { files: [pngFile()] });
    const during = e.usertextarea.value;
    release({ ok: true, json: async () => ({ success: true, image_path: '/m/a.png' }) });
    await settle(e);
    return during.includes('Uploading...') && e.usertextarea.value === '![](/m/a.png)';
});

await checkAsync('a failed upload leaves a visible marker, not silence', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const quiet = console.error; console.error = () => {};
    const e = makeEditor({ toolbar: UPLOAD_BAR }, 'before');
    paste(e, { files: [pngFile()] });
    await settle(e);
    console.error = quiet;
    return e.usertextarea.value === 'before![Upload failed]()';
});

await checkAsync('the failure marker is translatable', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const quiet = console.error; console.error = () => {};
    const e = makeEditor({ toolbar: UPLOAD_BAR, labels: { 'Upload failed': 'Fallo la subida' } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    console.error = quiet;
    return e.usertextarea.value === '![Fallo la subida]()';
});

const drop = (editor, files) => {
    const event = new window.Event('drop', { bubbles: true, cancelable: true });
    event.dataTransfer = { files, types: files.length ? ['Files'] : [] };
    editor.usertextarea.dispatchEvent(event);
    return event;
};

await checkAsync('a file drop is swallowed even with no upload configured', async () => {
    const quiet = console.warn; console.warn = () => {};
    const e = makeEditor({ toolbar: FULL_BAR }, 'my draft');
    const event = drop(e, [pngFile()]);
    console.warn = quiet;
    // Without preventDefault the browser would navigate to the file and lose the draft
    return event.defaultPrevented && e.usertextarea.value === 'my draft';
});

await checkAsync('a non-image file drop is swallowed too', async () => {
    const e = makeEditor({ toolbar: UPLOAD_BAR }, 'my draft');
    const pdf = new window.File(['x'], 'a.pdf', { type: 'application/pdf' });
    const event = drop(e, [pdf]);
    return event.defaultPrevented && e.usertextarea.value === 'my draft';
});

await checkAsync('dropping an image uploads it too', async () => {
    stubUpload({ success: true, image_path: '/media/dropped.png' });
    const e = makeEditor({ toolbar: UPLOAD_BAR }, '');
    drop(e, [pngFile()]);
    await settle(e);
    return e.usertextarea.value === '![](/media/dropped.png)';
});

await checkAsync('the upload placeholder is translatable', async () => {
    let release;
    globalThis.fetch = () => new Promise(r => { release = r; });
    const e = makeEditor({ toolbar: UPLOAD_BAR, labels: { 'Uploading...': 'Subiendo...' } }, '');
    paste(e, { files: [pngFile()] });
    const during = e.usertextarea.value;
    release({ ok: true, json: async () => ({ success: true, image_path: '/m/a.png' }) });
    await settle(e);
    return during.includes('Subiendo...');
});

// --- the separate stylesheet ------------------------------------------------
// From 2.0.0 the CSS is a file the host has to load, so forgetting it leaves a
// working but unstyled editor. These guard the only signal the user gets.

check('a missing stylesheet is reported', () =>
    cssErrors.length === 1 && cssErrors[0].includes("import 'markdown-text-editor/style.css'"));

check('it is reported once per page, not once per editor', () => {
    const before = cssErrors.length;
    makeEditor(); makeEditor();
    return cssErrors.length === before;
});

// --- turning features off ----------------------------------------------------
//
// One option per feature, `false` to turn it off. None of this gating was
// covered before, in either direction, so these pin both: that each feature is
// built by default, and that turning it off actually stops it being built.

const BAR_NO_TABLE = BASE_BAR.filter(t => t !== 'table');
const clickIn = (e, needle) => {
    const ta = e.usertextarea;
    const at = ta.value.indexOf(needle) + 2;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
};
const TABLE_DOC = ['| a | b |', '|---|---|', '| x | y |'].join('\n');

check('find and the footer are both built by default', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return !!e.findReplace
        && !!e.editorContainer.querySelector('.editor-footer');
});

check('find: false leaves Ctrl+F to the browser', () => {
    const e = makeEditor({ toolbar: FULL_BAR, find: false });
    e.usertextarea.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'f', code: 'KeyF', ctrlKey: true, bubbles: true, cancelable: true,
    }));
    // Not built, and nothing left behind that a stray handler could open.
    return e.findReplace === undefined
        && e.editorContainer.querySelector('.find-replace-panel') === null;
});

check('the table bar follows the toolbar when nothing says otherwise', () => {
    const withTable = makeEditor({ toolbar: FULL_BAR }, TABLE_DOC);
    const without = makeEditor({ toolbar: BAR_NO_TABLE }, TABLE_DOC);
    clickIn(withTable, '| a');
    clickIn(without, '| a');
    return withTable.tablePopover.isOpen && without.tablePopover === undefined;
});

check('tableBar: true offers the bar without the table button', () => {
    const e = makeEditor({ toolbar: BAR_NO_TABLE, tableBar: true }, TABLE_DOC);
    const built = !!e.tablePopover;
    clickIn(e, '| a');
    // The gap this closes: content can hold tables on a toolbar that offers
    // no way to insert one, and alignment was unreachable there.
    return built && e.tablePopover.isOpen
        && e.editorContainer.querySelector('.table-btn') === null;
});

check('tableBar: false wins over the table button', () => {
    const e = makeEditor({ toolbar: FULL_BAR, tableBar: false }, TABLE_DOC);
    clickIn(e, '| a');
    const alt = new window.KeyboardEvent('keydown', {
        key: 't', code: 'KeyT', altKey: true, bubbles: true, cancelable: true,
    });
    e.usertextarea.dispatchEvent(alt);
    return e.tablePopover === undefined
        && e.editorContainer.querySelector('.table-popover') === null
        && !!e.editorContainer.querySelector('.table-btn');
});

check('Tab between cells still works with the bar turned off', () => {
    const e = makeEditor({ toolbar: FULL_BAR, tableBar: false }, TABLE_DOC);
    const ta = e.usertextarea;
    const at = ta.value.indexOf('| a') + 2;
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'Tab', bubbles: true, cancelable: true,
    }));
    // Documented promise: the keys are markdown editing, not the tool.
    return ta.selectionStart > at;
});

check('the old tablePopover name says where it went', () => {
    const said = [];
    const quiet = console.error;
    console.error = (...a) => { if (!String(a[0]).includes('Stylesheet')) said.push(a[0]); };
    const e = makeEditor({ toolbar: FULL_BAR, tableBar: true, tablePopover: false });
    console.error = quiet;
    // Renamed, not aliased: beta.3 is not a contract. But silence would read
    // as the bar being broken, so the old name has to point somewhere.
    return said.length === 1
        && said[0].includes('tableBar: false')
        && !!e.tablePopover;
});

check('footer keeps the name and the shape it has had since 1.x', () => {
    // It already followed the convention the other two now match: `false` off,
    // an object to configure. Nothing about it changed, so this is the guard
    // that nothing about it moved either.
    const on = makeEditor({ toolbar: FULL_BAR, footer: { words: true } }, 'one two');
    const hidden = makeEditor({ toolbar: FULL_BAR, footer: false });
    return on.footerOptions.words === true
        && !!on.editorContainer.querySelector('.editor-footer')
        && hidden.footerOptions === null
        && hidden.editorContainer.querySelector('.editor-footer') === null;
});

// --- report -----------------------------------------------------------------

await Promise.all(pending);

console.log('\n  ' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
    failures.forEach(f => console.log('  FAIL  ' + f + '\n'));
    process.exit(1);
}
