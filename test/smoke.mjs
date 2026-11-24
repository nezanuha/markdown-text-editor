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

// The old fileInput form is exercised by a dozen tests below, and it notes
// once per page what replaced it. Collect that the same way.
const notes = [];
const realInfo = console.info;
console.info = (...args) => {
    if (String(args[0]).includes('[MarkdownEditor]')) notes.push(args[0]);
    else realInfo(...args);
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

check('two editors on a page do not put the same id on their dialogs', () => {
    // The dialog carried a fixed id that nothing referenced, so two editors
    // with a dialog open each produced a duplicate id in the document.
    const a = makeEditor({ toolbar: ['bold', 'link'] }, 'a');
    const b = makeEditor({ toolbar: ['bold', 'link'] }, 'b');
    a.editorContainer.querySelector('.link-btn').click();
    b.editorContainer.querySelector('.link-btn').click();

    const dialogs = [...document.querySelectorAll('.markdown-modal')];
    const ids = dialogs.map(d => d.id).filter(Boolean);
    return dialogs.length === 2 && new Set(ids).size === ids.length;
});

// --- what the dialogs put in their own markup -------------------------------
//
// 1.9.5 fixed an XSS here: the prefills are interpolated into attributes of
// HTML built as a string. The escaping helper had a unit test, but nothing
// checked that the dialogs called it, so deleting the call would have passed.

check('the link dialog escapes what it prefills from the document', () => {
    const payload = '"><img src=x onerror=alert(1)>';
    const e = makeEditor({ toolbar: ['bold', 'link'] }, payload);
    e.usertextarea.setSelectionRange(0, payload.length);
    e.editorContainer.querySelector('.link-btn').click();

    const dialog = e.editorContainer.querySelector('.markdown-modal');
    // the browser decodes the entities, so the field still holds the original
    return dialog.querySelector('.link-text-input').value === payload
        && dialog.querySelector('img') === null;
});

check('the image dialog escapes what it prefills too', () => {
    const payload = '"><img src=x onerror=alert(1)>';
    const e = makeEditor({ toolbar: ['bold', 'image'] }, payload);
    e.usertextarea.setSelectionRange(0, payload.length);
    e.editorContainer.querySelector('.image-link-btn').click();

    const dialog = e.editorContainer.querySelector('.markdown-modal');
    return dialog.querySelector('.img-link-alt-input').value === payload
        && dialog.querySelector('img') === null;
});

check('a translation cannot break out of the attribute it lands in', () => {
    // `locale` is the host's, but a host may load it from a database or from
    // crowdsourced translations, and every other interpolation here is escaped
    const e = makeEditor({ toolbar: ['bold', 'link'],
                           locale: { URL: '" onfocus="steal()' } }, '');
    e.editorContainer.querySelector('.link-btn').click();

    const input = e.editorContainer.querySelector('.link-input');
    return input.getAttribute('placeholder') === '" onfocus="steal()'
        && input.getAttribute('onfocus') === null;
});

check('a dialog announces itself in the reader language', () => {
    // The heading was translated and the accessible name was not, so a Spanish
    // reader saw "Enlace" and heard "Link"
    const e = makeEditor({ toolbar: ['bold', 'link'], locale: { Link: 'Enlace' } }, '');
    e.editorContainer.querySelector('.link-btn').click();

    return e.editorContainer.querySelector('.markdown-modal')
        .getAttribute('aria-label') === 'Enlace';
});

check('the divider between upload and URL is translated', () => {
    const e = makeEditor({ toolbar: ['bold', 'image'], upload: '/u',
                           locale: { OR: 'O BIEN' } }, '');
    e.editorContainer.querySelector('.image-link-btn').click();

    return e.editorContainer.querySelector('.markdown-modal')
        .textContent.includes('O BIEN');
});

check('an upload failure is reported in the dialog, not in an alert()', () => {
    const e = makeEditor({ toolbar: ['bold', 'image'], upload: '/u' }, '');
    e.editorContainer.querySelector('.image-link-btn').click();

    const note = e.editorContainer.querySelector('.markdown-modal .img-upload-error');
    // alert() is unstyled, blocks the page, and puts the message where the
    // file input is not
    return note !== null && note.hidden && note.getAttribute('role') === 'alert';
});

check('modal() says what to pass when the event is not from an editor', () => {
    let message = '';
    try {
        MarkdownEditor.modal({ target: document.body }, 'fj:max-w-sm', '<p>x</p>');
    } catch (error) {
        message = error.message;
    }
    return message.includes('click event');
});

check('a textarea id with a quote in it does not take the editor down', () => {
    // An id may hold almost any character, and `label[for="a\"b"]` is a
    // SyntaxError thrown from the constructor
    const ta = document.createElement('textarea');
    ta.id = 'quote"id';
    document.body.appendChild(ta);

    const e = new MarkdownEditor(ta, { toolbar: ['bold'] });
    return e.usertextarea.getAttribute('aria-label') === 'Markdown editor';
});

check('destroy leaves nothing listening on the textarea it was given', () => {
    // The wrapper's own elements go when the wrapper does, so only the user's
    // textarea matters: it outlives the editor. IndentManager used to attach
    // Tab handling with an anonymous function and had no destroy at all, so an
    // app that rebuilt editors as it navigated left one behind each time, each
    // still answering Tab and each holding its dead editor alive through the
    // closure.
    const ta = document.createElement('textarea');
    ta.id = 'teardown' + (++seq);
    document.body.appendChild(ta);

    const net = new Map();
    let adds = 0;          // counted separately: the net is 0 when balanced,
                           // which is exactly the case this must not mistake
                           // for "nothing was instrumented"
    const add = ta.addEventListener.bind(ta);
    const remove = ta.removeEventListener.bind(ta);
    ta.addEventListener = (type, fn, o) => {
        adds++; net.set(type, (net.get(type) ?? 0) + 1); return add(type, fn, o);
    };
    ta.removeEventListener = (type, fn, o) => {
        net.set(type, (net.get(type) ?? 0) - 1); return remove(type, fn, o);
    };

    new MarkdownEditor(ta, { toolbar: FULL_BAR, footer: { words: true } }).destroy();

    const leaked = [...net.entries()].filter(([, n]) => n > 0);
    return adds > 10 && leaked.length === 0;
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

check('maths unwraps when the markers are outside the selection', () => {
    // Selecting the contents and pressing the button is the likely action, and
    // it used to wrap again: `$x^2$` became `$$x^2$$`, which is display maths,
    // so a toggle quietly changed what kind of maths it was. Bold, italic and
    // code all handled this; maths did not.
    const e = makeEditor({ toolbar: ['bold', 'math'] }, '$x^2$');
    const at = e.usertextarea.value.indexOf('x^2');
    e.usertextarea.setSelectionRange(at, at + 3);
    e.editorContainer.querySelector('.math-btn').click();
    return e.usertextarea.value === 'x^2';
});

check('code unwraps the same way, through the shared helper', () => {
    const e = makeEditor({ toolbar: ['bold', 'code'] }, '`thing`');
    const at = e.usertextarea.value.indexOf('thing');
    e.usertextarea.setSelectionRange(at, at + 5);
    e.editorContainer.querySelector('.code-btn').click();
    return e.usertextarea.value === 'thing';
});

check('a lone backtick is not sliced away to nothing', () => {
    // No length guard before, so startsWith and endsWith both matched the one
    // character and slice(1, -1) emptied it.
    const e = makeEditor({ toolbar: ['bold', 'code'] }, '`');
    e.usertextarea.setSelectionRange(0, 1);
    e.editorContainer.querySelector('.code-btn').click();
    return e.usertextarea.value.includes('`') && e.usertextarea.value !== '';
});

check('a block of maths comes back to what it started as', () => {
    const e = makeEditor({ toolbar: ['bold', 'math'] }, 'a\nb');
    const ta = e.usertextarea;
    const btn = e.editorContainer.querySelector('.math-btn');

    ta.setSelectionRange(0, 3);
    btn.click();
    const wrapped = ta.value;

    ta.setSelectionRange(0, ta.value.length);
    btn.click();
    // The wrap writes the markers on their own lines, so the unwrap has to take
    // those newlines with them. It did not, so every toggle added a blank line
    // above and below and the block grew each time.
    return wrapped === '$$\na\nb\n$$' && ta.value === 'a\nb';
});

check('a block unwraps from inside too', () => {
    const e = makeEditor({ toolbar: ['bold', 'math'] }, '$$\na\nb\n$$');
    const ta = e.usertextarea;
    const at = ta.value.indexOf('a');
    ta.setSelectionRange(at, at + 3);
    e.editorContainer.querySelector('.math-btn').click();
    return ta.value === 'a\nb';
});

check('the maths probe reads overlapping dollar pairs', () => {
    const said = [];
    const real = console.warn;
    console.warn = (...a) => said.push(a.join(' '));
    // The maths is the second pair, not the first. The pattern this replaced
    // found it by trying every start position; the loop has to step one dollar
    // at a time to match that.
    makeEditor({ toolbar: ['bold'] }).renderMarkdown('$a$b_c$');
    console.warn = real;
    return said.some(m => m.includes('Maths syntax'));
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

check('the panel is pinned logically, so it follows the text direction', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    e.findReplace.open();
    const panel = e.editorContainer.querySelector('.find-replace-panel');

    // Pinned with `right`, the panel stayed top-right under dir="rtl" while
    // the scrollbar moved to the left: the gutter was reserved on the side
    // that no longer had a scrollbar, and the panel sat over the start of
    // every line instead of the ragged ends it covers in LTR.
    //
    // happy-dom has no layout and no cascade, so this guards the property
    // rather than the geometry. The mirroring itself was measured in Edge:
    // LTR keeps a 19px gap on the right, RTL moves it to the left.
    return panel.style.insetInlineEnd !== ''
        && panel.style.right === ''
        && panel.className.includes('fj:start-auto')
        && !panel.className.includes('fj:left-auto');
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

check('the preview tooltip follows the state and the name does not', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '# one');
    const btn = e.editorContainer.querySelector('.preview-btn');
    if (!btn) return 'no preview button';

    const closed = btn.title;
    const name = btn.getAttribute('aria-label');

    btn.click();
    const openTitle = btn.title;
    const openName = btn.getAttribute('aria-label');
    const openPressed = btn.getAttribute('aria-pressed');

    btn.click();

    // The tooltip says what the click will do; the name a screen reader hears
    // stays still, because aria-pressed is already carrying the state and a
    // name that moved with it would contradict that.
    return closed === 'Preview (F11)'
        && openTitle === 'Close preview (Esc)'
        && openPressed === 'true'
        && openName === name
        && btn.getAttribute('aria-label') === name
        // and it goes back whole, shortcut hint and all
        && btn.title === closed
        && btn.getAttribute('aria-pressed') === 'false';
});

check('the preview tooltip is translated, the key is not', () => {
    const e = makeEditor({
        toolbar: FULL_BAR,
        locale: { 'Preview': 'Vista previa', 'Close preview': 'Cerrar vista previa' },
    }, '# one');
    const btn = e.editorContainer.querySelector('.preview-btn');

    const closed = btn.title;
    btn.click();
    const open = btn.title;
    btn.click();

    // Esc and F11 are the same keys in every language, so they are not looked
    // up; only the words around them are.
    return closed === 'Vista previa (F11)'
        && open === 'Cerrar vista previa (Esc)'
        && btn.title === closed;
});

// --- what marked turns markdown into ----------------------------------------

// The preview is marked's output, so a marked release can change what every
// user sees without a line of this project changing. The range is a caret,
// which lets a minor reach them before it reaches a release here. These pin
// the output exactly, so the version that moves it fails here, naming the
// case, instead of arriving in someone's preview.
//
// Sanitising is switched off on purpose. What is under watch is marked, and
// DOMPurify under happy-dom drops the tags of the first element it is handed
// -- "<h1>One</h1>" comes back as "One" -- which a browser does not do. The
// XSS tests cover the sanitiser; these cover the parser.
//
// Regenerate deliberately, never to make a failure go away: read the diff
// first and decide whether the new output is the one you want to ship.
const RENDER_CASES = [
    ["headings", "# One\n## Two\n###### Six",
     "<h1>One</h1>\n<h2>Two</h2>\n<h6>Six</h6>\n"],
    ["setext headings", "One\n===\n\nTwo\n---",
     "<h1>One</h1>\n<h2>Two</h2>\n"],
    ["emphasis", "*a* _b_ **c** __d__ ***e*** ~~f~~",
     "<p><em>a</em> <em>b</em> <strong>c</strong> <strong>d</strong> <em><strong>e</strong></em> <del>f</del></p>\n"],
    ["emphasis edges", "a*b*c  a_b_c  **a**b  snake_case_word",
     "<p>a<em>b</em>c  a_b_c  <strong>a</strong>b  snake_case_word</p>\n"],
    ["inline code", "`x` ``a ` b`` `` ` ``",
     "<p><code>x</code> <code>a ` b</code> <code>`</code></p>\n"],
    ["fence with info", "```js\nconst a = 1;\n```",
     "<pre><code class=\"language-js\">const a = 1;\n</code></pre>\n"],
    ["fence tilde", "~~~\nplain\n~~~",
     "<pre><code>plain\n</code></pre>\n"],
    ["fence nested", "````\n```\ninner\n```\n````",
     "<pre><code>```\ninner\n```\n</code></pre>\n"],
    ["indented code", "    four spaces",
     "<pre><code>four spaces\n</code></pre>\n"],
    ["list tight", "- a\n- b",
     "<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n"],
    ["list loose", "- a\n\n- b",
     "<ul>\n<li><p>a</p>\n</li>\n<li><p>b</p>\n</li>\n</ul>\n"],
    ["list numbered", "3. a\n4. b",
     "<ol start=\"3\">\n<li>a</li>\n<li>b</li>\n</ol>\n"],
    ["list nested", "- a\n  - b\n    - c",
     "<ul>\n<li>a<ul>\n<li>b<ul>\n<li>c</li>\n</ul>\n</li>\n</ul>\n</li>\n</ul>\n"],
    ["task list", "- [ ] todo\n- [x] done",
     "<ul>\n<li><input disabled=\"\" type=\"checkbox\"> todo</li>\n<li><input checked=\"\" disabled=\"\" type=\"checkbox\"> done</li>\n</ul>\n"],
    ["blockquote", "> a\n> b\n\n> > nested",
     "<blockquote>\n<p>a<br>b</p>\n</blockquote>\n<blockquote>\n<blockquote>\n<p>nested</p>\n</blockquote>\n</blockquote>\n"],
    ["table", "| a | b |\n| --- | --- |\n| 1 | 2 |",
     "<table>\n<thead>\n<tr>\n<th>a</th>\n<th>b</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>1</td>\n<td>2</td>\n</tr>\n</tbody></table>\n"],
    ["table aligned", "| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |",
     "<table>\n<thead>\n<tr>\n<th align=\"left\">a</th>\n<th align=\"center\">b</th>\n<th align=\"right\">c</th>\n</tr>\n</thead>\n<tbody><tr>\n<td align=\"left\">1</td>\n<td align=\"center\">2</td>\n<td align=\"right\">3</td>\n</tr>\n</tbody></table>\n"],
    ["table escapes", "| a \\| b | c |\n| --- | --- |\n| `x|y` | 2 |",
     "<table>\n<thead>\n<tr>\n<th>a | b</th>\n<th>c</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>`x</td>\n<td>y`</td>\n</tr>\n</tbody></table>\n"],
    ["link", "[t](https://a.b \"ti\")",
     "<p><a href=\"https://a.b\" title=\"ti\">t</a></p>\n"],
    ["link reference", "[t][r]\n\n[r]: https://a.b",
     "<p><a href=\"https://a.b\">t</a></p>\n"],
    ["autolink", "<https://a.b> https://c.d",
     "<p><a href=\"https://a.b\">https://a.b</a> <a href=\"https://c.d\">https://c.d</a></p>\n"],
    ["image", "![alt](https://a.b/i.png \"ti\")",
     "<p><img src=\"https://a.b/i.png\" alt=\"alt\" title=\"ti\"></p>\n"],
    ["thematic breaks", "---\n\n***\n\n___",
     "<hr>\n<hr>\n<hr>\n"],
    ["html block", "<div><p>raw</p></div>",
     "<div><p>raw</p></div>"],
    ["html inline", "a <span>b</span> c",
     "<p>a <span>b</span> c</p>\n"],
    ["entities", "&amp; &copy; &#35; &lt;tag&gt;",
     "<p>&amp; &copy; # &lt;tag&gt;</p>\n"],
    ["escapes", "\\* \\_ \\# \\[ \\\\",
     "<p>* _ # [ \\</p>\n"],
    ["hard break", "a  \nb",
     "<p>a<br>b</p>\n"],
    ["backslash break", "a\\\nb",
     "<p>a<br>b</p>\n"],
    ["soft break", "a\nb",
     "<p>a<br>b</p>\n"],
    ["footnote syntax", "text[^1]\n\n[^1]: note",
     "<p>text<a href=\"note\">^1</a></p>\n"],
    ["everything", "# T\n\n> q *i*\n\n- [x] **d** `c`\n\n| a |\n| - |\n| 1 |",
     "<h1>T</h1>\n<blockquote>\n<p>q <em>i</em></p>\n</blockquote>\n<ul>\n<li><input checked=\"\" disabled=\"\" type=\"checkbox\"> <strong>d</strong> <code>c</code></li>\n</ul>\n<table>\n<thead>\n<tr>\n<th>a</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>1</td>\n</tr>\n</tbody></table>\n"],
    ["unicode", "déjà – em—dash … “smart” ‘q’",
     "<p>déjà – em—dash … “smart” ‘q’</p>\n"],
    ["empty", "",
     ""],
    ["whitespace only", "   \n   ",
     ""],
];

for (const [name, input, expected] of RENDER_CASES) {
    check('renders: ' + name, () => {
        const e = makeEditor({ toolbar: ['bold'], sanitizer: (html) => html });
        const got = e._renderMarkdown(input);
        return got === expected || ('got ' + JSON.stringify(got));
    });
}

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

const paste = (editor, { text = '', html = '', files = [] } = {}) => {
    const event = new window.Event('paste', { bubbles: true, cancelable: true });
    const types = files.length ? ['Files'] : ['text/plain', ...(html ? ['text/html'] : [])];
    event.clipboardData = {
        getData: (type) => (type === 'text/html' ? html : text),
        files,
        types,
    };
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

check('every shortcut is declared to assistive technology, not just drawn in a tooltip', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const buttons = [...e.editorContainer.querySelectorAll('.markdown-btn')];
    const withKeys = buttons.filter(b => b.hasAttribute('aria-keyshortcuts'));

    // A tooltip says Ctrl, which is what the keycap says. The attribute takes
    // key names, so it says Control -- and a slash is not a separator in it.
    const spelled = withKeys.every(b => {
        const v = b.getAttribute('aria-keyshortcuts');
        return !/\bCtrl\b/.test(v) && !v.includes('/');
    });

    // Anything advertising a key in its tooltip has to declare it as well.
    const tooltipClaims = buttons.filter(b => /\([^)]*(Ctrl|Alt|Shift|Tab|F11)/.test(b.title));
    const allDeclared = tooltipClaims.every(b => b.hasAttribute('aria-keyshortcuts'));

    // The count is only a guard against the two checks above passing because
    // the toolbar was empty. FULL_BAR has no strikethrough and no math, so
    // eleven of its buttons carry a key.
    return withKeys.length >= 10 && spelled && allDeclared;
});

check('the heading button declares all three of its shortcuts', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const btn = e.editorContainer.querySelector('.heading-btn');

    // One button, three keys. The attribute takes a space-separated list,
    // where the tooltip can use the shorter Ctrl+1/2/3.
    return btn.getAttribute('aria-keyshortcuts') === 'Control+1 Control+2 Control+3'
        && btn.title.includes('Ctrl+1/2/3');
});

check('the unordered list button advertises Ctrl+L', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    // Its class is built from its title, so it is unordered-list-btn and not
    // ul-btn. The shortcut table said ul-btn, found nothing, and the key
    // worked while the button said nothing about it.
    const btn = e.editorContainer.querySelector('.unordered-list-btn');
    return btn.title.includes('Ctrl+L') && btn.getAttribute('aria-keyshortcuts') === 'Control+L';
});

check("the editor announces itself in the reader's language", () => {
    const spanish = { 'Markdown editor': 'Editor de Markdown' };

    // Every button translated while the field they all act on said
    // "Markdown editor" in English. It is the first thing a screen reader
    // reads and the one that says what the thing is.
    const plain = makeEditor({ toolbar: FULL_BAR });
    const translated = makeEditor({ toolbar: FULL_BAR, locale: spanish });
    // `label` has been public since before 2.0. Deprecated in favour of the
    // attribute, which is native, but still honoured: dropping it would have
    // taken the accessible name off a 1.x host without saying so.
    const named = makeEditor({ toolbar: FULL_BAR, locale: spanish, label: 'Cuerpo' });

    return plain.usertextarea.getAttribute('aria-label') === 'Markdown editor'
        && translated.usertextarea.getAttribute('aria-label') === 'Editor de Markdown'
        && named.usertextarea.getAttribute('aria-label') === 'Cuerpo';
});

check('a textarea that is already labelled is left alone', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    e.destroy();
    const ta = document.createElement('textarea');
    ta.setAttribute('aria-label', 'Set by the page');
    document.body.appendChild(ta);
    new MarkdownEditor(ta, { toolbar: FULL_BAR, label: 'ignored' });
    // The page knows its own form better than this does, option or no option.
    return ta.getAttribute('aria-label') === 'Set by the page';
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

// What these can and cannot show, so nobody spends an afternoon on a bug that
// is not there.
//
// DOMPurify does not work under happy-dom. It strips the tags of the first
// element it is handed and lets everything after it through untouched:
//
//     "<p>hello</p><script>alert(1)</script>"
//         -> "hello<script>alert(1)</script>"
//
// Chrome does the right thing with the same editor and the same input: the
// script is removed, onerror is stripped off the image, and nothing runs.
// Checked over CDP against the running editor, not reasoned about.
//
// So the two checks above pass because of that mangling rather than because
// anything was sanitised, and a payload placed anywhere but first would fail
// here against code that is correct. Do not add one.
//
// Whether DOMPurify strips scripts is DOMPurify's business and their suite's.
// What belongs here is the seam on either side of it: everything the renderer
// produces has to reach the sanitiser, and only what the sanitiser hands back
// may reach the DOM. Neither needs a working sanitiser to test.

check('everything the renderer produces reaches the sanitiser', () => {
    const produced = '<p>one</p><script>two</scr' + 'ipt><img src=x onerror=three>';
    const seen = [];
    const e = makeEditor({
        toolbar: FULL_BAR,
        renderer: () => produced,
        sanitizer: (html) => { seen.push(html); return 'clean'; },
    }, 'anything');

    // Nothing may be trimmed, split or pre-filtered on the way in: the
    // sanitiser has to see the whole string, dangerous parts and all.
    return seen.length > 0 && seen.every((html) => html === produced);
});

check('only what the sanitiser returns reaches the preview', () => {
    const e = makeEditor({
        toolbar: FULL_BAR,
        renderer: () => '<p>dangerous</p>',
        sanitizer: () => '<em>safe</em>',
    }, 'x');

    const html = e.previewContent.innerHTML;
    return html.includes('safe') && !html.includes('dangerous');
});

check('the sanitiser runs again on every edit, not just the first render', () => {
    let calls = 0;
    const e = makeEditor({
        toolbar: FULL_BAR,
        renderer: (md) => '<p>' + md + '</p>',
        sanitizer: (html) => { calls += 1; return html; },
    }, 'first');

    const afterFirst = calls;
    e.usertextarea.value = 'second';
    e.render();

    // A sanitiser that only ran once would leave every later keystroke
    // unsanitised, which is the shape this bug takes when it happens.
    return afterFirst > 0 && calls > afterFirst;
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

// A file that claims a size without allocating it. happy-dom reads size off the
// blob, so a 6 MB test file would otherwise mean 6 MB of 'x'.
const bigFile = (bytes) => {
    const file = new window.File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: bytes, configurable: true });
    return file;
};

// Replaces XMLHttpRequest for one upload, and records what the editor sent.
// XHR and not fetch because fetch raises no events for a FormData body, so it
// cannot report progress, which is the whole reason the editor moved off it.
//
//   hold    the request stays in flight until sent.finish() is called
//   forbid  send() throws, for the tests that assert nothing is uploaded
const stubXhr = ({ body = {}, status = 200, hold = false, forbid = false } = {}) => {
    const sent = { headers: {} };
    globalThis.XMLHttpRequest = class {
        constructor() {
            this._on = {};
            this.status = status;
            this.responseText = JSON.stringify(body);
            this.upload = { addEventListener: (name, fn) => { this._tick = fn; } };
        }
        open(method, url) { sent.method = method; sent.url = url; }
        setRequestHeader(key, value) { sent.headers[key] = value; }
        addEventListener(name, fn) { this._on[name] = fn; }
        send(form) {
            if (forbid) throw new Error('should not be called');
            sent.form = form;
            sent.finish = () => {
                this._tick?.({ lengthComputable: true, loaded: 1024, total: 1024 });
                this._on.load?.();
            };
            if (!hold) setTimeout(sent.finish, 0);
        }
    };
    return sent;
};

const stubUpload = (body) => stubXhr({ body });

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
    const sent = stubXhr({ body: { success: true, image_path: '/m/a.png' }, hold: true });
    const e = makeEditor({ toolbar: UPLOAD_BAR }, '');
    paste(e, { files: [pngFile()] });
    const during = e.usertextarea.value;
    sent.finish();
    await settle(e);
    return during.includes('Uploading...') && e.usertextarea.value === '![](/m/a.png)';
});

await checkAsync('a failed upload leaves a visible marker, not silence', async () => {
    stubXhr({ status: 500 });
    const quiet = console.error; console.error = () => {};
    const e = makeEditor({ toolbar: UPLOAD_BAR }, 'before');
    paste(e, { files: [pngFile()] });
    await settle(e);
    console.error = quiet;
    return e.usertextarea.value === 'before![Upload failed]()';
});

await checkAsync('the failure marker is translatable', async () => {
    stubXhr({ status: 500 });
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
    const sent = stubXhr({ body: { success: true, image_path: '/m/a.png' }, hold: true });
    const e = makeEditor({ toolbar: UPLOAD_BAR, labels: { 'Uploading...': 'Subiendo...' } }, '');
    paste(e, { files: [pngFile()] });
    const during = e.usertextarea.value;
    sent.finish();
    await settle(e);
    return during.includes('Subiendo...');
});

// --- upload, the top level option -------------------------------------
// 2.0 moves the endpoint out of the toolbar. It was read out of the toolbar
// array before the toolbar existed, which is the tell: an endpoint is not a
// button. The toolbar form above still works and is tested there.

await checkAsync('upload takes a bare URL', async () => {
    const sent = stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: '/api/upload' }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![](/m/a.png)' && sent.url === '/api/upload';
});

await checkAsync('paste uploads with no image tool on the toolbar at all', async () => {
    stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: ['bold', 'preview'], upload: '/api/upload' }, '');
    const hasImageButton = !!e.toolbar?.querySelector('.image-link-btn');
    paste(e, { files: [pngFile()] });
    await settle(e);
    // The whole point of the move: upload without the button
    return !hasImageButton && e.usertextarea.value === '![](/m/a.png)';
});

await checkAsync('headers reach the request, which CSRF needs', async () => {
    const sent = stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/api/upload', headers: { 'X-CSRFToken': 'abc123' },
    } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return sent.headers?.['X-CSRFToken'] === 'abc123';
});

await checkAsync('response adapts a server that answers in its own shape', async () => {
    stubUpload({ data: { url: '/cdn/x.png' } });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/api/upload', response: body => ({ path: body.data.url }),
    } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![](/cdn/x.png)';
});

await checkAsync('field renames the form field', async () => {
    const sent = stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', field: 'file' } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return sent.form.has('file') && !sent.form.has('image_file');
});

await checkAsync('the default field is unchanged, so an old endpoint keeps working', async () => {
    const sent = stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: '/u' }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return sent.form.has('image_file');
});

await checkAsync('a function form hands the file to the host', async () => {
    let got = null;
    const e = makeEditor({ toolbar: BASE_BAR, upload: async (file) => {
        got = file.name;
        return '/s3/signed.png';
    } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return got === 'shot.png' && e.usertextarea.value === '![](/s3/signed.png)';
});

await checkAsync('maxSize is enforced on paste, not just in the file dialog', async () => {
    const quiet = console.error; console.error = () => {};
    stubXhr({ forbid: true });
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', maxSize: 10 } }, '');
    const big = new window.File(['x'.repeat(5000)], 'big.png', { type: 'image/png' });
    paste(e, { files: [big] });
    await settle(e);
    console.error = quiet;
    return e.usertextarea.value === '![Upload failed]()';
});

await checkAsync('a type outside accept is ignored on paste, not reported', async () => {
    stubXhr({ forbid: true });
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', accept: ['jpeg'] } }, 'draft');
    paste(e, { files: [pngFile()] });
    await settle(e);
    // accept decides what the editor looks at, so a type it was never offered
    // passes through untouched, the way a dropped PDF always has. Size is the
    // other way round: an accepted file that is too big did fail, and says so.
    return e.usertextarea.value === 'draft';
});

await checkAsync('accept reads a full media type as well as a bare subtype', async () => {
    stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', accept: ['image/png'] } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![](/m/a.png)';
});

await checkAsync('paste: false leaves pasting alone while drop still uploads', async () => {
    stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', paste: false } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    const afterPaste = e.usertextarea.value;
    drop(e, [pngFile()]);
    await settle(e);
    return afterPaste === '' && e.usertextarea.value === '![](/m/a.png)';
});

await checkAsync('drop: false still swallows the event, or the browser eats the draft', async () => {
    stubXhr({ forbid: true });
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', drop: false } }, 'my draft');
    const event = drop(e, [pngFile()]);
    await settle(e);
    return event.defaultPrevented && e.usertextarea.value === 'my draft';
});

await checkAsync('a non-image file is still refused by default', async () => {
    stubXhr({ forbid: true });
    const e = makeEditor({ toolbar: BASE_BAR, upload: '/u' }, 'my draft');
    const pdf = new window.File(['x'], 'spec.pdf', { type: 'application/pdf' });
    const event = drop(e, [pdf]);
    await settle(e);
    // accept defaults to image/*, so nothing changes for a host that says nothing
    return event.defaultPrevented && e.usertextarea.value === 'my draft';
});

await checkAsync('accept opens it to other file types, inserted as a link', async () => {
    stubUpload({ success: true, image_path: '/files/spec.pdf' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['image/*', 'application/pdf'],
    } }, '');
    const pdf = new window.File(['x'], 'spec.pdf', { type: 'application/pdf' });
    drop(e, [pdf]);
    await settle(e);
    return e.usertextarea.value === '[spec.pdf](/files/spec.pdf)';
});

await checkAsync('an image still inserts as an image when other types are allowed', async () => {
    stubUpload({ success: true, image_path: '/m/a.png', image_alt: 'A shot' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['image/*', 'application/pdf'],
    } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![A shot](/m/a.png)';
});

await checkAsync('insert overrides what is written into the document', async () => {
    stubUpload({ success: true, image_path: '/files/notes.txt' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['text/plain'],
        insert: (file, url) => `<a href="${url}" download>${file.name}</a>`,
    } }, '');
    const txt = new window.File(['x'], 'notes.txt', { type: 'text/plain' });
    drop(e, [txt]);
    await settle(e);
    return e.usertextarea.value === '<a href="/files/notes.txt" download>notes.txt</a>';
});

await checkAsync('the in-flight placeholder follows the file type', async () => {
    const sent = stubXhr({ body: { success: true, image_path: '/f/spec.pdf' }, hold: true });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['application/pdf'],
    } }, '');
    const pdf = new window.File(['x'], 'spec.pdf', { type: 'application/pdf' });
    drop(e, [pdf]);
    const during = e.usertextarea.value;
    sent.finish();
    await settle(e);
    // a link placeholder, not ![...](), or the preview shows a broken image
    return during === '[Uploading...]()';
});

await checkAsync('the image dialog offers images even when more is accepted', async () => {
    const e = makeEditor({ toolbar: [...BASE_BAR, 'image', 'preview'], upload: {
        url: '/u', accept: ['image/png', 'application/pdf'],
    } }, '');
    return e.upload.accept.join(',') === 'image/png,application/pdf';
});

// image_path was named when images were all this took. An endpoint that stores
// a PDF should not have to call its answer that, so url and path are read too.
await checkAsync('a plain { url } answer is understood, with no success flag', async () => {
    stubUpload({ url: '/cdn/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: '/u' }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![](/cdn/a.png)';
});

await checkAsync('a { path, alt } answer is understood too', async () => {
    stubUpload({ path: '/cdn/a.png', alt: 'A screenshot' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: '/u' }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![A screenshot](/cdn/a.png)';
});

await checkAsync('the 1.8 answer is still read', async () => {
    stubUpload({ success: true, image_path: '/m/a.png', image_alt: 'A shot' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: '/u' }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![A shot](/m/a.png)';
});

await checkAsync('success: false reports the reason the endpoint gave', async () => {
    stubUpload({ success: false, error: 'The disk is full' });
    let logged = '';
    const quiet = console.error;
    console.error = (...args) => { logged = args.map(String).join(' '); };
    const e = makeEditor({ toolbar: BASE_BAR, upload: '/u' }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    console.error = quiet;
    return e.usertextarea.value === '![Upload failed]()' && logged.includes('The disk is full');
});

// Nobody widens accept to video hoping for a link, so the default writes the
// player. markdown has no syntax for one, which is why it is raw HTML.
await checkAsync('a video arrives as a player, not a link', async () => {
    stubUpload({ url: '/u/clip.mp4' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['video/mp4'],
    } }, '');
    const clip = new window.File(['x'], 'clip.mp4', { type: 'video/mp4' });
    drop(e, [clip]);
    await settle(e);
    return e.usertextarea.value === '<video src="/u/clip.mp4" controls></video>';
});

await checkAsync('audio does the same', async () => {
    stubUpload({ url: '/u/a.mp3' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['audio/mpeg'],
    } }, '');
    const song = new window.File(['x'], 'a.mp3', { type: 'audio/mpeg' });
    drop(e, [song]);
    await settle(e);
    return e.usertextarea.value === '<audio src="/u/a.mp3" controls></audio>';
});

await checkAsync('a quote in the URL cannot break out of the attribute', async () => {
    stubUpload({ url: '/u/a.mp4?x="><script>alert(1)</script>' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['video/mp4'],
    } }, '');
    const clip = new window.File(['x'], 'clip.mp4', { type: 'video/mp4' });
    drop(e, [clip]);
    await settle(e);
    const written = e.usertextarea.value;
    return !written.includes('<script>') && written.includes('&quot;&gt;&lt;script&gt;');
});

await checkAsync('a PDF is still a link, since markdown cannot embed one', async () => {
    stubUpload({ url: '/u/spec.pdf' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', accept: ['application/pdf'],
    } }, '');
    const pdf = new window.File(['x'], 'spec.pdf', { type: 'application/pdf' });
    drop(e, [pdf]);
    await settle(e);
    return e.usertextarea.value === '[spec.pdf](/u/spec.pdf)';
});

check('variables read from the top level, with the button in the toolbar', () => {
    const e = makeEditor({
        toolbar: ['bold', 'variables', 'preview'],
        variables: [{ label: 'Today', value: '{{today}}', sample: '10 September 2026' }],
    }, 'Sent {{today}}');

    return e.variables.length === 1
        && !!e.editorContainer.querySelector('.variable-btn')
        // the preview swaps the sample in, which is why the list cannot live
        // in the toolbar array: it is needed before the toolbar is built
        && e.renderMarkdown('Sent {{today}}').includes('10 September 2026');
});

check('the toolbar form still works, and the top level wins over it', () => {
    const old = makeEditor({ toolbar: ['bold', { variables: [
        { label: 'Today', value: '{{today}}' },
    ] }, 'preview'] }, '');

    const both = makeEditor({
        toolbar: ['bold', { variables: [{ label: 'Old', value: '{{old}}' }] }, 'preview'],
        variables: [{ label: 'New', value: '{{new}}' }],
    }, '');

    return old.variables.length === 1 && old.variables[0].value === '{{today}}'
        && both.variables.length === 1 && both.variables[0].value === '{{new}}';
});

await checkAsync('the alt field keeps its name even when the file field is renamed', async () => {
    const sent = stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', field: 'file' } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return sent.form.has('file') && sent.form.has('image_alt');
});

await checkAsync('onProgress reports the bytes as they go out', async () => {
    const ticks = [];
    stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: BASE_BAR, upload: {
        url: '/u', onProgress: (file, done, total) => ticks.push([file.name, done, total]),
    } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return ticks.length === 1 && ticks[0].join() === 'shot.png,1024,1024';
});

// The dialog shows err.message to the reader, so these two are interface text
// and belong in the locale files with everything else the editor says aloud.
await checkAsync('the size refusal is translated and reads in MB', async () => {
    const e = makeEditor({ toolbar: BASE_BAR, locale: {
        'Maximum file size is {n}': 'Tamano maximo: {n}',
    }, upload: { url: '/u', maxSize: 5 * 1024 * 1024 } }, '');
    const message = await e.upload.upload(bigFile(6 * 1024 * 1024))
        .then(() => 'it resolved', err => err.message);
    return message === 'Tamano maximo: 5 MB';
});

await checkAsync('a sub-megabyte limit reads in kB, not bytes', async () => {
    const e = makeEditor({ toolbar: BASE_BAR, upload: { url: '/u', maxSize: 500 * 1024 } }, '');
    const message = await e.upload.upload(bigFile(600 * 1024))
        .then(() => 'it resolved', err => err.message);
    return message === 'Maximum file size is 500 kB';
});

await checkAsync('the type refusal is translated and keeps the MIME out of it', async () => {
    const e = makeEditor({ toolbar: BASE_BAR, locale: {
        'This file type is not allowed': 'Tipo no permitido',
    }, upload: { url: '/u', accept: ['image/jpeg'] } }, '');
    const error = await e.upload.upload(pngFile()).then(() => null, err => err);
    // the type and the list go to the console, not to whoever picked the file
    return error.message === 'Tipo no permitido'
        && error.detail.includes('image/png')
        && !error.message.includes('image/png');
});

await checkAsync('upload wins over the old toolbar form', async () => {
    const sent = stubUpload({ success: true, image_path: '/m/a.png' });
    const e = makeEditor({ toolbar: UPLOAD_BAR, upload: '/new/endpoint' }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return sent.url === '/new/endpoint';
});

// --- the separate stylesheet ------------------------------------------------
// From 2.0.0 the CSS is a file the host has to load, so forgetting it leaves a
// working but unstyled editor. These guard the only signal the user gets.

check('the old fileInput form says what replaced it', () => {
    const about = notes.filter(note => note.includes('image.fileInput'));
    return about.length === 1 && about[0].includes('upload');
});

check('it says so once per page, not once per editor', () => {
    const before = notes.length;
    makeEditor({ toolbar: UPLOAD_BAR }, '');
    makeEditor({ toolbar: UPLOAD_BAR }, '');
    return notes.length === before;
});

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

// --- accessibility of the two table controls --------------------------------

check('the size grid is one tab stop, not sixty-four', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const cells = [...e.editorContainer.querySelectorAll('.table-size-grid button')];
    const stops = cells.filter(c => c.tabIndex >= 0);
    return cells.length === 64 && stops.length === 1 && stops[0] === cells[0];
});

check('the arrow keys walk the size grid in both axes', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const cells = [...e.editorContainer.querySelectorAll('.table-size-grid button')];
    const grid = e.editorContainer.querySelector('.table-size-grid');
    const press = key => grid.dispatchEvent(new window.KeyboardEvent('keydown',
        { key, bubbles: true, cancelable: true }));
    const size = () => {
        const c = document.activeElement;
        return c?.getAttribute('aria-label') ?? null;
    };

    cells[0].focus();
    const start = size();
    press('ArrowRight');
    const right = size();
    press('ArrowDown');
    const down = size();
    press('End');
    const end = size();
    press('Home');
    const home = size();

    // role="menu" promised arrow keys and delivered none, so the grid could
    // not be driven by keyboard at all under a screen reader.
    return start === '1 × 1' && right === '2 × 1' && down === '2 × 2'
        && end === '8 × 8' && home === '1 × 1';
});

check('the size grid stops at its edges instead of wrapping', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const cells = [...e.editorContainer.querySelectorAll('.table-size-grid button')];
    const grid = e.editorContainer.querySelector('.table-size-grid');
    cells[0].focus();
    for (const key of ['ArrowLeft', 'ArrowUp']) {
        grid.dispatchEvent(new window.KeyboardEvent('keydown',
            { key, bubbles: true, cancelable: true }));
    }
    return document.activeElement.getAttribute('aria-label') === '1 × 1';
});

check('every size is announced, not just left as a square', () =>
    [...makeEditor({ toolbar: FULL_BAR })
        .editorContainer.querySelectorAll('.table-size-grid button')]
        .every(c => /^\d+ × \d+$/.test(c.getAttribute('aria-label') ?? '')));

check('every toolbar button carries the name its tooltip shows', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const btns = [...e.editorContainer.querySelectorAll('.markdown-btn')];
    // The icon is aria-hidden and there is no text, so without this the name
    // came from `title` alone, which is the weakest source in the algorithm --
    // and the three tools that build their own buttons set aria-label, so the
    // toolbar was named two different ways.
    return btns.length > 10
        && btns.every(b => b.getAttribute('aria-label') === b.title && b.title);
});

check('the toolbar is one tab stop, not one per tool', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const bar = e.editorContainer.querySelector('[role=toolbar]');
    const btns = [...bar.querySelectorAll('.markdown-btn')];
    const stops = btns.filter(b => b.tabIndex >= 0);
    // It declared role="toolbar" from the start, which promises the arrow keys
    // move between tools. Every button was its own tab stop instead.
    return btns.length > 15 && stops.length === 1 && stops[0] === btns[0];
});

check('the arrow keys walk the toolbar, and wrap', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const bar = e.editorContainer.querySelector('[role=toolbar]');
    const btns = [...bar.querySelectorAll('.markdown-btn')].filter(b => !b.disabled);
    const press = key => document.activeElement.dispatchEvent(
        new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

    btns[0].focus();
    press('ArrowRight');
    const second = document.activeElement === btns[1];
    press('ArrowLeft');
    const back = document.activeElement === btns[0];
    press('ArrowLeft');
    const wrapped = document.activeElement === btns[btns.length - 1];
    press('Home');
    const home = document.activeElement === btns[0];
    press('End');
    const end = document.activeElement === btns[btns.length - 1];
    return second && back && wrapped && home && end;
});

check('the tab stop follows wherever the arrows left it', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const bar = e.editorContainer.querySelector('[role=toolbar]');
    const btns = [...bar.querySelectorAll('.markdown-btn')].filter(b => !b.disabled);
    btns[0].focus();
    document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',
        { key: 'ArrowRight', bubbles: true, cancelable: true }));
    // Tab away and back lands where you were, not back at the first tool.
    return btns.filter(b => b.tabIndex === 0).length === 1
        && btns[1].tabIndex === 0 && btns[0].tabIndex === -1;
});

check('the toolbar leaves its popover menus their own arrow keys', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const bar = e.editorContainer.querySelector('[role=toolbar]');
    const cell = e.editorContainer.querySelector('.table-size-grid button');
    cell.focus();
    const before = document.activeElement;
    // The size grid is inside the toolbar, so a toolbar handler that did not
    // check its target would steal this and walk the tools instead.
    cell.dispatchEvent(new window.KeyboardEvent('keydown',
        { key: 'ArrowRight', bubbles: true, cancelable: true }));
    return before !== document.activeElement
        && document.activeElement.getAttribute('aria-label') === '2 × 1';
});

// The maths warning fires whenever marked renders maths it cannot read, which
// is every one of these. It is asserted on its own elsewhere; here it is noise.
const quietly = (fn) => {
    const real = console.warn;
    console.warn = () => {};
    try { return fn(); } finally { console.warn = real; }
};
// `math` is opt-in rather than part of the default toolbar, so it has to be
// asked for by name.
const MATH_BAR = [...FULL_BAR, 'math'];

check('Alt+M wraps the selection in maths', () => quietly(() => {
    const e = makeEditor({ toolbar: MATH_BAR }, 'see x^2 here');
    const ta = e.usertextarea;
    const at = ta.value.indexOf('x^2');
    ta.setSelectionRange(at, at + 3);
    // code, not key: Alt composes a character on macOS, where key would be 'µ'
    ta.dispatchEvent(new window.KeyboardEvent('keydown',
        { key: 'm', code: 'KeyM', altKey: true, bubbles: true, cancelable: true }));
    return ta.value === 'see $x^2$ here';
}));

check('Alt+M toggles back off', () => quietly(() => {
    const e = makeEditor({ toolbar: MATH_BAR }, 'see $x^2$ here');
    const ta = e.usertextarea;
    const at = ta.value.indexOf('x^2');
    ta.setSelectionRange(at, at + 3);
    ta.dispatchEvent(new window.KeyboardEvent('keydown',
        { key: 'm', code: 'KeyM', altKey: true, bubbles: true, cancelable: true }));
    return ta.value === 'see x^2 here';
}));

check('plain M, and Ctrl+M, are left alone', () => quietly(() => {
    const e = makeEditor({ toolbar: MATH_BAR }, 'x^2');
    const ta = e.usertextarea;
    ta.setSelectionRange(0, 3);
    for (const mods of [{}, { ctrlKey: true }]) {
        ta.dispatchEvent(new window.KeyboardEvent('keydown',
            { key: 'm', code: 'KeyM', bubbles: true, cancelable: true, ...mods }));
    }
    return ta.value === 'x^2';
}));

check('the keys the other managers own are advertised too', () => {
    const e = makeEditor({ toolbar: MATH_BAR });
    const at = cls => e.editorContainer.querySelector(cls)?.title ?? '';
    // These worked all along; the tooltip just never said so, because the
    // keys belong to UndoRedoManager and IndentManager.
    return at('.undo-btn').includes('Ctrl+Z')
        && at('.redo-btn').includes('Ctrl+Shift+Z')
        && at('.indent-btn').includes('Tab')
        && at('.outdent-btn').includes('Shift+Tab')
        && at('.math-btn').includes('Alt+M');
});

check('a shortcut stays part of the accessible name', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const bold = e.editorContainer.querySelector('.bold-btn');
    // Mirroring in createButton would have named it "Bold", losing the hint
    // the title gains afterwards.
    return /Ctrl\+B|⌘B/.test(bold.getAttribute('aria-label'));
});

// --- the link and image dialogs prefill from the document --------------------
//
// Both dialogs are built by concatenation and inserted with
// insertAdjacentHTML, and both prefill their fields from the text around the
// cursor. The alt and link-text fields fall back to whatever is selected, so
// any document text reached an HTML attribute unescaped: selecting
// `"><img src=x onerror=...>` and pressing the button closed the value and ran
// the handler. Confirmed in Edge before the fix, on both tools.

const PAYLOAD = '"><img src=x onerror="window.__xss=1">';

const openDialog = (tool, btnClass, value, select) => {
    const e = makeEditor({ toolbar: ['bold', tool] }, value);
    const ta = e.usertextarea;
    const at = ta.value.indexOf(select);
    ta.setSelectionRange(at, at + select.length);
    e.editorContainer.querySelector('.' + btnClass).click();
    return e;
};

for (const [tool, btnClass] of [['link', 'link-btn'], ['image', 'image-link-btn']]) {
    check(`the ${tool} dialog does not execute text from the document`, () => {
        const e = openDialog(tool, btnClass, 'before ' + PAYLOAD + ' after', PAYLOAD);
        const dialog = e.editorContainer.querySelector('.markdown-modal');
        // Nothing was built from the payload: it is a value, not markup. The
        // escaped text still contains the word "onerror", which is harmless --
        // what matters is that no element carries it as an attribute.
        const handlers = dialog
            ? [...dialog.querySelectorAll('*')].filter(n => n.hasAttribute('onerror'))
            : [];
        return !!dialog
            && dialog.querySelectorAll('img').length === 0
            && handlers.length === 0;
    });

    check(`the ${tool} dialog still prefills the text it was given`, () => {
        // Escaping must not corrupt a legitimate value. The browser decodes
        // the entities when it parses the attribute, so the field reads back
        // exactly what was selected, quotes and ampersands included.
        const awkward = 'Tom & Jerry\'s "big" <day>';
        const e = openDialog(tool, btnClass, 'x ' + awkward + ' y', awkward);
        const field = e.editorContainer.querySelector(
            tool === 'link' ? '.link-text-input' : '.img-link-alt-input');
        return field?.value === awkward;
    });
}

check('escapeHtml covers the characters that matter in an attribute', async () => {
    const { escapeHtml } = await import('../dist/markdown-text-editor.es.js')
        .then(() => import('../src/utils/escapeHtml.js'));
    return escapeHtml('<&">\'') === '&lt;&amp;&quot;&gt;&#39;'
        // the ampersand has to be replaced first, or the entities it writes
        // get escaped a second time
        && escapeHtml('&lt;') === '&amp;lt;'
        && escapeHtml(null) === ''
        && escapeHtml(undefined) === '';
});

// --- editing behaviour the suite had been missing ----------------------------
//
// V8 coverage of a test run showed these two managers almost entirely
// unexecuted: autoIndent, handlePairs, handleBackspace, outdent, undo, redo.
// They own Tab, Enter, Backspace and Ctrl+Z -- the keys most used in the
// editor -- and a listener leak had already been sitting in one of them.

const typeKey = (e, key, extra = {}) => {
    const ev = new window.KeyboardEvent('keydown',
        { key, bubbles: true, cancelable: true, ...extra });
    e.usertextarea.dispatchEvent(ev);
    return ev;
};

check('typing an opening bracket closes it', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const ta = e.usertextarea;
    ta.setSelectionRange(0, 0);
    typeKey(e, '(');
    // The pair is inserted and the caret sits between the two halves.
    return ta.value === '()' && ta.selectionStart === 1;
});

check('wrapping a selection in brackets keeps the selection', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'word');
    const ta = e.usertextarea;
    ta.setSelectionRange(0, 4);
    typeKey(e, '(');
    return ta.value === '(word)';
});

check('typing a closing bracket steps over the one already there', () => {
    // `pairs` is keyed by the opening half, so the dispatcher never let `)`,
    // `]`, `}` or `>` reach handlePairs and the step-over was dead code for
    // them. Typing the `]` of `[text]` produced `[text]]`, which is the most
    // common thing anyone writes in markdown. Quotes worked, being both
    // halves of their own pair. Measured with real key presses in Edge.
    return [')', ']', '}', '>', '"', "'"].every(close => {
        const open = { ')': '(', ']': '[', '}': '{', '>': '<', '"': '"', "'": "'" }[close];
        const e = makeEditor({ toolbar: FULL_BAR }, open + close);
        const ta = e.usertextarea;
        ta.setSelectionRange(1, 1);
        const ev = typeKey(e, close);
        // The editor must claim the key, so the browser does not also type it.
        return ev.defaultPrevented && ta.selectionStart === 2;
    });
});

check('backspace between a pair takes both halves', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'a()b');
    const ta = e.usertextarea;
    ta.setSelectionRange(2, 2);
    typeKey(e, 'Backspace');
    return ta.value === 'ab';
});

check('Enter keeps the indent of the line above', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '    indented');
    const ta = e.usertextarea;
    ta.setSelectionRange(ta.value.length, ta.value.length);
    typeKey(e, 'Enter');
    return ta.value === '    indented\n    ';
});

check('Enter after a list item is left to the list manager', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '- item');
    const ta = e.usertextarea;
    ta.setSelectionRange(ta.value.length, ta.value.length);
    typeKey(e, 'Enter');
    // The list manager continues the bullet; autoIndent must not also fire
    // and leave a bare indent instead.
    return ta.value.split('\n').length === 2 && /- $/.test(ta.value);
});

check('Shift+Tab removes one level of indent', () => {
    // One level is four spaces, so outdenting the only level correctly leaves
    // none -- the first version of this expected a space to survive.
    const one = makeEditor({ toolbar: FULL_BAR }, '    text');
    one.usertextarea.setSelectionRange(6, 6);
    typeKey(one, 'Tab', { shiftKey: true });

    const two = makeEditor({ toolbar: FULL_BAR }, '        deep');
    two.usertextarea.setSelectionRange(10, 10);
    typeKey(two, 'Tab', { shiftKey: true });

    return one.usertextarea.value === 'text'
        && two.usertextarea.value === '    deep';
});

check('undo puts back what was there, and redo takes it away again', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'first');
    const ta = e.usertextarea;
    e.undoRedoManager._saveState();

    ta.value = 'first second';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    e.undoRedoManager._saveState();

    e.undoRedoManager.undo();
    const undone = ta.value;
    e.undoRedoManager.redo();
    return undone === 'first' && ta.value === 'first second';
});

check('undo with nothing to undo leaves the text alone', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'only');
    e.undoRedoManager.undo();
    e.undoRedoManager.undo();
    return e.usertextarea.value === 'only';
});

// --- what the hybrid highlighter produces ------------------------------------
//
// _highlight runs about ten regex passes over the WHOLE document on every
// keystroke, which costs 260ms at 150KB. Before that is rewritten to work a
// line at a time, these pin what it produces today so the rewrite has
// something exact to be judged against: seven of its nine patterns cannot
// match across a newline, so a line-based version must leave their output
// untouched.
//
// Compared as a structural signature rather than raw HTML, so a failure is
// readable. `dim[...]` is opacity-60, `half` 50, and the colours
// are the fj text utilities.

const NEWLINE = String.fromCharCode(10);

const SPAN_NAMES = {
    'fj:text-primary': 'primary',
    'fj:text-secondary': 'secondary',
    'fj:text-accent': 'accent',
    'fj:opacity-60': 'dim',
    'fj:opacity-50': 'half',
    'faux-bold': 'bold',
    'fj:line-through fj:opacity-70': 'strike',
    'fj:underline fj:opacity-50': 'linkurl',
};

const signature = (html) => {
    const box = document.createElement('div');
    box.innerHTML = html;
    const walk = (node) => [...node.childNodes].map(n => {
        if (n.nodeType === 3) return JSON.stringify(n.textContent);
        const cls = n.getAttribute('class');
        return (SPAN_NAMES[cls] ?? ('?' + cls)) + '[' + walk(n).join(' ') + ']';
    });
    return walk(box).join(' ');
};

const HIGHLIGHT_CASES = [
    ["heading h1", "# Title",
     "primary[dim[\"# \"] bold[\"Title\"]]"],
    ["heading h3", "### Deep",
     "primary[dim[\"### \"] bold[\"Deep\"]]"],
    ["bold", "**loud**",
     "secondary[dim[\"**\"] bold[\"loud\"] dim[\"**\"]]"],
    ["italic star", "*soft*",
     "accent[dim[\"*\"] \"soft\" dim[\"*\"]]"],
    ["italic underscore", "_soft_",
     "accent[dim[\"_\"] \"soft\" dim[\"_\"]]"],
    ["inline code", "`x = 1`",
     "dim[\"`\"] accent[\"x = 1\"] dim[\"`\"]"],
    ["strike double", "~~gone~~",
     "strike[dim[\"~~\"] \"gone\" dim[\"~~\"]]"],
    ["strike single", "~gone~",
     "strike[dim[\"~\"] \"gone\" dim[\"~\"]]"],
    ["bullet", "- item",
     "primary[\"- \"] \"item\""],
    ["ordered", "1. item",
     "primary[\"1. \"] \"item\""],
    ["task", "[ ] todo",
     "primary[\"[ ] \"] \"todo\""],
    ["link", "[text](https://a.b)",
     "dim[\"[\"] primary[\"text\"] dim[\"](\"] linkurl[\"https://a.b\"] half[\")\"]"],
    ["image", "![alt](https://a.b/i.png)",
     "dim[\"![\"] primary[\"alt\"] dim[\"](\"] linkurl[\"https://a.b/i.png\"] half[\")\"]"],
    ["escapes", "<script>a & b</script>",
     "\"<script>a & b</script>\""],
    ["bold then italic", "**a** and *b*",
     "secondary[dim[\"**\"] bold[\"a\"] dim[\"**\"]] \" and \" accent[dim[\"*\"] \"b\" dim[\"*\"]]"],
    ["code inside bold", "**a `c` b**",
     "secondary[dim[\"**\"] bold[\"a \" dim[\"`\"] accent[\"c\"] dim[\"`\"] \" b\"] dim[\"**\"]]"],
    ["two lines", "one\ntwo",
     "\"one\\ntwo\""],
    ["trailing newline", "one\n",
     "\"one\\n \""],
    ["fence", "```js\ncode();\n```",
     "dim[\"```js\"] \"\\ncode();\\n\" dim[\"```\"]"],
    ["fence with md", "```\n**not bold**\n# not heading\n```",
     "dim[\"```\"] \"\\n**not bold**\\n# not heading\\n\" dim[\"```\"]"],
    ["plain", "nothing special here",
     "\"nothing special here\""],
];

for (const [name, input, expected] of HIGHLIGHT_CASES) {
    check('hybrid highlight: ' + name, () => {
        const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
        return signature(e._highlight(input)) === expected;
    });
}

check('auto-grow stops measuring once the height is pinned', () => {
    // Measuring is almost the whole cost of a keystroke, because any geometry
    // read lays out the entire document first. Past maxHeight the container
    // cannot grow further and typing cannot shorten it, so the measurement is
    // skipped while the text only gets longer.
    //
    // happy-dom has no layout, so this checks the bookkeeping rather than the
    // pixels. The heights were measured in Edge: growing, capping, shrinking
    // back and re-measuring after a width change all still work.
    const e = makeEditor({ toolbar: FULL_BAR }, 'short');
    e._pinnedAt = 5;                       // pretend we hit the ceiling here

    e.usertextarea.value = 'short plus more';
    e._autoGrow();
    const keptWhileGrowing = e._pinnedAt === 5;

    e.usertextarea.value = 'tiny';         // shorter: the answer may differ now
    e._autoGrow();
    const reconsideredWhenShorter = e._pinnedAt !== 5;

    return keptWhileGrowing && reconsideredWhenShorter;
});

check('the width observer is set up and torn down', () => {
    // The pin is cleared by this observer rather than by _autoGrow reading
    // the width, which would cost exactly what the skip saves. That it
    // actually re-measures after a resize was checked in Edge: the same text
    // measured 567px wide and 1695px once the editor was narrowed.
    if (typeof ResizeObserver === 'undefined') return true;   // not simulated
    const e = makeEditor({ toolbar: FULL_BAR }, 'x');
    const watching = !!e._widthObserver;

    let disconnected = false;
    const real = e._widthObserver.disconnect.bind(e._widthObserver);
    e._widthObserver.disconnect = () => { disconnected = true; return real(); };
    e.destroy();

    return watching && disconnected;
});

check('hybrid highlight keeps the line count, which the DOM diff relies on', () => {
    // renderHybrid pairs highlighted lines against the previous render by
    // index, so a pass that merged or split a line would corrupt the overlay.
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    return ['a\nb\nc', '# h\n- i\n`c`', '```\nx\n```', '', 'one']
        .every(src => e._highlight(src).split('\n').length === src.split('\n').length);
});

// Ten tests below read _highlight, which does the whole document in one pass.
// renderHybrid is what ships, and it reuses the lines an edit did not touch.
// This is the only thing stopping the two drifting apart, which would leave
// every one of those ten asserting about code that never runs.
check('the hybrid path that ships matches the one the tests read', () => {
    const doc = '# h' + NEWLINE + '**b** `c` [t](u)' + NEWLINE + '```'
        + NEWLINE + 'x' + NEWLINE + '```' + NEWLINE + '<b> & plain' + NEWLINE;
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] }, doc);

    const live = [...e.displayLayer.children].map(node => node.innerHTML.replace(/\n$/, ''));
    // The highlighter writes `&#42;` for an asterisk so a later pass cannot
    // match it again. Reading innerHTML back gives the character the DOM
    // decoded it to, so the reference is decoded the same way before comparing.
    const reference = e._highlight(doc).replace(/&#42;/g, '*').split(NEWLINE);

    return live.length === reference.length
        && live.every((html, i) => html === reference[i]);
});

check('hybrid highlight escapes markup before anything else', () => {
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    const out = e._highlight('<img src=x onerror=alert(1)> & <b>');
    // The display layer is written with innerHTML, so this is the guard that
    // stops a document styling itself into real elements.
    return !/<img|<b>/.test(out)
        && out.includes('&lt;img')
        && out.includes('&amp;');
});

check('hybrid highlight leaves a fenced block as code', () => {
    // It used to style it: the fence pattern matched first and the inline
    // passes then swept the whole string, fenced content included, so `**x**`
    // inside a code block came out bold and `# x` came out as a heading.
    // Per line, a line inside a fence skips every inline pass.
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    const out = e._highlight('```' + NEWLINE + '**not bold**' + NEWLINE + '# no' + NEWLINE + '```');
    return !/faux-bold/.test(out) && !/fj:text-primary/.test(out)
        // the fence markers themselves are still marked
        && (out.match(/fj:opacity-60/g) ?? []).length === 2;
});

check('hybrid highlight marks a fence you are still typing', () => {
    // The old pattern needed the closing fence before it styled anything, so
    // a block being typed stayed plain until it was finished.
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    return /fj:opacity-60/.test(e._highlight('```js' + NEWLINE + 'code()'));
});

check('hybrid highlight does not read backticks in prose as a fence', () => {
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    return e._highlight('text ``` more') === 'text ``` more';
});

check('hybrid highlight no longer strikes a tilde across two lines', () => {
    // The single-tilde pattern's `[^~]+` used to reach over a newline. Per
    // line it cannot, which is the second deliberate change.
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    return e._highlight('~a' + NEWLINE + 'b~') === '~a' + NEWLINE + 'b~';
});

check('a bold marker is dimmed once, not twice', () => {
    // The emphasis pass used to re-process the asterisks the bold pass had
    // already wrapped, so a marker sat inside two opacity spans and rendered
    // at about 0.16 -- all but invisible, and 2.49:1 against the background in
    // the light theme, under even the 3:1 for interface parts. The bold pass
    // writes its asterisks as entities now, which the emphasis pattern cannot
    // match, and the markers read at 4.54:1.
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    return signature(e._highlight('**x**'))
        === 'secondary[dim["**"] bold["x"] dim["**"]]';
});

check('no marker is left at the contrast that failed', () => {
    // Measured in Edge by painting the oklch colours to a canvas and reading
    // the pixels back: opacity-40 composites to 2.49:1 in light, opacity-60 to
    // 4.54:1. happy-dom has no cascade, so this pins the class instead.
    const e = makeEditor({ mode: 'hybrid', toolbar: ['bold'] });
    const out = e._highlight('# h' + NEWLINE + '**b** `c` [t](u)' + NEWLINE + '```');
    return !/fj:opacity-40/.test(out) && !/fj:opacity-30/.test(out)
        && /fj:opacity-60/.test(out);
});

// --- surviving input nobody meant to write ------------------------------------
//
// Found by fuzzing: hostile documents, hostile options, hostile find
// patterns. 193 cases, of which five used to throw. These are the five.

const quietly2 = (fn) => {
    const warn = console.warn, error = console.error;
    console.warn = () => {}; console.error = () => {};
    try { return fn(); } finally { console.warn = warn; console.error = error; }
};

check('a toolbar that is not an array falls back instead of throwing', () =>
    quietly2(() => {
        // `toolbar: 'bold'` instead of `['bold']` threw "this.options.forEach
        // is not a function" and left no editor at all.
        const e = makeEditor({ toolbar: 'bold' }, 'x');
        return e.editorContainer.querySelectorAll('.markdown-btn').length > 10;
    }));

check('junk entries in the toolbar are skipped, not fatal', () =>
    quietly2(() => {
        // typeof null is 'object', so Object.keys(null) threw: one stray
        // comma in the array and the editor was gone.
        const e = makeEditor({ toolbar: [null, undefined, 42, {}, 'bold', 'nosuchtool'] }, 'x');
        return !!e.editorContainer.querySelector('.bold-btn');
    }));

check('a renderer that throws leaves the editor working', () =>
    quietly2(() => {
        const e = makeEditor({
            toolbar: FULL_BAR,
            renderer: () => { throw new Error('renderer exploded'); },
        }, '# hello');
        // The preview degrades to plain text; the document is untouched.
        const html = e.renderMarkdown('# hello');
        return e.usertextarea.value === '# hello' && html.includes('hello');
    }));

check('a renderer that throws escapes what it falls back to', () =>
    quietly2(() => {
        const e = makeEditor({
            toolbar: ['bold'],
            renderer: () => { throw new Error('nope'); },
        }, 'x');
        const html = e.renderMarkdown('<img src=x onerror=alert(1)>');
        return !/<img/.test(html) && html.includes('&lt;img');
    }));

check('deeply nested blockquotes do not take the editor down', () =>
    quietly2(() => {
        // marked overflows its own stack here, and this is a document someone
        // can paste. The text matters more than the preview of it.
        const e = makeEditor({ toolbar: ['bold'] }, '');
        const html = e.renderMarkdown('> '.repeat(3000));
        return typeof html === 'string';
    }));

check('documents made of punctuation do not throw', () =>
    quietly2(() => {
        const e = makeEditor({ mode: 'hybrid', toolbar: FULL_BAR });
        for (const doc of ['*'.repeat(3000), '`'.repeat(3000), '~'.repeat(3000),
                           '['.repeat(1000) + ']'.repeat(1000), '|' + '-|'.repeat(1000)]) {
            e._highlight(doc);
            e.renderMarkdown(doc);
        }
        return true;
    }));

// --- completing a variable as you type --------------------------------------

// The toolbar dropdown is the right answer once. After that, someone writing
// a template knows the name they want and should not leave the keyboard to
// pick it out of a menu.
const typeInto = (editor, text) => {
    editor.usertextarea.value = text;
    editor.usertextarea.setSelectionRange(text.length, text.length);
    editor.usertextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
};

const menuOf = (editor) => editor.editorContainer.querySelector('.variable-complete');
const optionsOf = (editor) =>
    [...(menuOf(editor)?.querySelectorAll('[role="option"]') ?? [])].map(b => b.textContent);

check('typing {{ offers the variables', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, 'Hello {{');
    return menuOf(e) !== null && optionsOf(e).length > 0;
});

check('typing narrows the list, and a miss closes it', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, 'Hello {{');
    const all = optionsOf(e).length;

    typeInto(e, 'Hello {{invoice');
    const narrowed = optionsOf(e).length;

    typeInto(e, 'Hello {{zzzzzz');
    const gone = menuOf(e) === null;

    return all > narrowed && narrowed > 0 && gone;
});

check('the completion follows whatever delimiter the values use', () => {
    // The placeholder is the host's to write. A trigger fixed at two braces
    // worked for Handlebars and quietly did nothing for anyone who chose
    // something else, which is the kind of thing nobody reports.
    const e = makeEditor({
        toolbar: barWith([{ label: 'Today', value: '<< today >>' }]),
    });
    typeInto(e, 'Sent <<');
    const opened = menuOf(e) !== null;

    press(e, { key: 'Enter' });
    return opened && e.usertextarea.value === 'Sent << today >>';
});

check('a closing of any shape is swallowed, not doubled', () => {
    const e = makeEditor({
        toolbar: barWith([{ label: 'Today', value: '<< today >>' }]),
    });
    // What an editor that auto-closes brackets leaves behind.
    e.usertextarea.value = 'Sent <<>>';
    e.usertextarea.setSelectionRange(7, 7);
    e.usertextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    press(e, { key: 'Enter' });
    return e.usertextarea.value === 'Sent << today >>';
});

check('two delimiters on one editor stay apart', () => {
    const e = makeEditor({
        toolbar: barWith([
            { label: 'Customer', value: '{{customer.name}}' },
            { label: 'Today', value: '<< today >>' },
        ]),
    });
    typeInto(e, 'Hi {{');
    const braces = optionsOf(e);
    typeInto(e, 'Hi <<');
    const angles = optionsOf(e);

    // A host mixing the two means them for different things.
    return braces.length === 1 && braces[0].includes('Customer')
        && angles.length === 1 && angles[0].includes('Today');
});

check('a value with no delimiter is left to the button', () => {
    const e = makeEditor({ toolbar: barWith([{ label: 'Today', value: 'today' }]) });
    typeInto(e, 'Sent t');
    // There is nothing to type that would mean "a variable starts here".
    return menuOf(e) === null && e.variableComplete.trigger === null;
});

check('the completion menu is placed in physical coordinates', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, 'Hi {{');
    const menu = menuOf(e);

    // The caret is measured by a mirror, which reports physical pixels.
    // inset-inline-start counts from the other edge in a right-to-left
    // document, so using it put the menu outside the editor by most of its
    // width. happy-dom has no layout, so this checks which property is
    // being set; the position itself was measured in Chrome, both ways.
    return menu !== null
        && menu.style.left !== ''
        && menu.style.insetInlineStart === '';
});

check('a space after the braces keeps the list open', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    // Handlebars writes {{today}}, Django and Jinja write {{ today }} and
    // print it that way in their own documentation. Someone used to the
    // second types the space out of habit.
    typeInto(e, 'Hi {{ ');
    const open = menuOf(e) !== null;

    typeInto(e, 'Hi {{ invoice');
    const narrowed = optionsOf(e).length;

    return open && narrowed > 0;
});

check('two spaces is prose, not a variable', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    // A menu that stays open through a sentence is worse than one that
    // closes early.
    typeInto(e, 'Hi {{  ');
    return menuOf(e) === null;
});

check('a spaced value inserts whole, spaces and all', () => {
    const e = makeEditor({
        toolbar: barWith([{ label: 'Today', value: '{{ today }}' }]),
    });
    typeInto(e, 'Sent {{ tod');
    press(e, { key: 'Enter' });
    // The braces already typed are replaced rather than left in front.
    return e.usertextarea.value === 'Sent {{ today }}';
});

check('Enter inserts the variable and closes the menu', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, 'Hello {{');
    const first = optionsOf(e)[0];
    press(e, { key: 'Enter' });

    // The whole `{{` goes, replaced by the placeholder, and the caret lands
    // after it rather than inside the braces.
    return menuOf(e) === null
        && e.usertextarea.value.startsWith('Hello {{')
        && e.usertextarea.value !== 'Hello {{'
        && first !== undefined
        && e.usertextarea.selectionStart === e.usertextarea.value.length;
});

check('the arrow keys move the selection', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, '{{');
    if (optionsOf(e).length < 2) return 'need at least two variables to test with';

    const selected = () => [...menuOf(e).querySelectorAll('[role="option"]')]
        .findIndex(b => b.getAttribute('aria-selected') === 'true');

    const first = selected();
    press(e, { key: 'ArrowDown' });
    const second = selected();
    press(e, { key: 'ArrowUp' });
    const back = selected();

    return first === 0 && second === 1 && back === 0;
});

check('Escape closes it and leaves the text alone', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, 'Hello {{');
    press(e, { key: 'Escape' });
    return menuOf(e) === null && e.usertextarea.value === 'Hello {{';
});

check('Enter does nothing special when the menu is closed', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, 'just text');
    // The list-continuation and indent handlers own these keys the rest of
    // the time, and this must not take them.
    return press(e, { key: 'Enter' }).defaultPrevented === false;
});

check('the menu tells a screen reader which option is current', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, '{{');
    const menu = menuOf(e);
    const active = e.usertextarea.getAttribute('aria-activedescendant');

    // The caret never leaves the textarea, so the textarea is what points at
    // the current option.
    return menu.getAttribute('role') === 'listbox'
        && active && menu.querySelector('#' + active) !== null;
});

check('variables takes the object form, list and setting together', () => {
    const e = makeEditor({
        toolbar: ['bold', 'variables', 'preview'],
        variables: { items: VARS },
    }, '');

    return e.variables.length === VARS.length && e.variableComplete !== undefined;
});

check('variableComplete says where it went rather than being ignored', () => {
    const said = [];
    const quiet = console.error;
    console.error = (...args) => said.push(args.join(' '));
    makeEditor({ toolbar: ['bold', 'variables', 'preview'],
                 variables: VARS, variableComplete: false });
    console.error = quiet;

    // A beta is not a contract, but a silent no-op reads as a broken feature
    return said.length === 1
        && said[0].includes('variables: { items: [...], complete: false }');
});

check('complete: false turns the typed trigger off', () => {
    const e = makeEditor({ toolbar: barWith([]), variables: { items: VARS, complete: false } });
    typeInto(e, 'Hello {{');
    return menuOf(e) === null && e.variableComplete === undefined;
});

check('no variables configured means nothing is attached', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    typeInto(e, 'Hello {{');
    return menuOf(e) === null && e.variableComplete === undefined;
});

check('destroy() takes the completion handlers with it', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    typeInto(e, 'Hello {{');
    e.destroy();
    return menuOf(e) === null;
});

// --- pasting formatted text -------------------------------------------------

// Copying from a web page or a word processor puts the formatting on the
// clipboard as HTML next to the plain text. Taking the plain text drops every
// link, heading and list.
//
// The conversion walks a sanitised DOM rather than parsing HTML, so these go
// through the editor's own sanitiser -- the same one the preview uses.
// Reads back both halves of the result: whether the editor took the paste
// over, and what the document says afterwards.
const pasteRich = (editor, opts) => {
    const event = paste(editor, opts);
    return { prevented: event.defaultPrevented, value: editor.usertextarea.value };
};

check('pasted HTML arrives as markdown, not as a wall of text', () => {
    // Sanitising is bypassed for the same reason the render cases bypass it:
    // DOMPurify strips the first element's tags under happy-dom, so the <h2>
    // would vanish here and not in a browser. The wiring is covered below.
    const e = makeEditor({ toolbar: FULL_BAR, sanitizer: (h) => h });
    const { prevented, value } = pasteRich(e, {
        html: '<h2>Title</h2><p>Some <strong>bold</strong> text and <a href="https://a.b">a link</a>.</p>',
        text: 'Title\nSome bold text and a link.',
    });
    return prevented
        && value.includes('## Title')
        && value.includes('**bold**')
        && value.includes('[a link](https://a.b)');
});

check('pasted lists keep their nesting', () => {
    const e = makeEditor({ toolbar: FULL_BAR, sanitizer: (h) => h });
    const { value } = pasteRich(e, {
        html: '<ul><li>one<ul><li>inner</li></ul></li><li>two</li></ul>',
        text: 'one inner two',
    });
    const N = String.fromCharCode(10);
    return value.includes('- one' + N + '  - inner' + N + '- two');
});

check('pasted markdown characters are escaped, so prose stays prose', () => {
    const e = makeEditor({ toolbar: FULL_BAR, sanitizer: (h) => h });
    // A paragraph on its own is not worth converting -- the plain text is
    // already right -- so the prose arrives next to something formatted,
    // which is how it turns up in practice.
    const { value } = pasteRich(e, {
        html: '<h3>Note</h3><p>Use * and _ and [brackets] carefully.</p>',
        text: 'Note Use * and _ and [brackets] carefully.',
    });
    // Without escaping, pasting this and rendering it gives italics and a
    // broken link reference rather than the sentence that was copied.
    return value.includes('\\*') && value.includes('\\_') && value.includes('\\[brackets\\]');
});

check('plain text with no formatting is left to the browser', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    // Some applications wrap plain text in a <div> on the clipboard. There is
    // nothing to convert, so the browser's own paste is the better one: it
    // keeps its place in the undo stack.
    const { prevented } = pasteRich(e, { html: '<div>just text</div>', text: 'just text' });
    return prevented === false;
});

check('pasteHtml: false leaves the plain-text paste alone', () => {
    const e = makeEditor({ toolbar: FULL_BAR, pasteHtml: false });
    const { prevented } = pasteRich(e, {
        html: '<h2>Title</h2><p><strong>bold</strong></p>',
        text: 'Title bold',
    });
    return prevented === false;
});

check('a URL pasted over a selection still wins over the HTML conversion', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'the docs');
    e.usertextarea.setSelectionRange(0, 8);
    // Copying a link from a browser's address bar brings an <a> along with it.
    // Wrapping the selection is the more specific thing to have meant.
    const { value } = pasteRich(e, {
        html: '<a href="https://a.b">https://a.b</a>',
        text: 'https://a.b',
    });
    return value === '[the docs](https://a.b)';
});

check('the paste goes through the configured sanitiser', () => {
    let saw = null;
    const e = makeEditor({
        toolbar: FULL_BAR,
        sanitizer: (html) => { saw = html; return html; },
    });
    pasteRich(e, { html: '<p><strong>x</strong></p>', text: 'x' });
    // Clipboard HTML comes from another application entirely, and is about to
    // be put through a DOM. It does not get to skip the sanitiser.
    return saw !== null && saw.includes('<strong>');
});

check('a converter that throws still pastes', () => {
    const e = makeEditor({
        toolbar: FULL_BAR,
        sanitizer: (html) => { if (html.includes('<h2')) throw new Error('nope'); return html; },
    });
    const { prevented } = quietly2(() => pasteRich(e, {
        html: '<h2>Title</h2>', text: 'Title',
    }));
    // Not preventing the event hands it back to the browser, which pastes the
    // plain text -- exactly what happened before any of this existed.
    return prevented === false;
});

// --- draft recovery ---------------------------------------------------------

// The textarea is this editor's only source of truth, which is the point of
// it. A stored draft is a second copy of the same text, and two copies
// disagree eventually, so nothing is ever restored without being asked for.

// happy-dom defines window.localStorage as a getter, so it is replaced
// rather than assigned.
const put = (value) => {
    for (const target of [globalThis, window]) {
        if (!target) continue;
        Object.defineProperty(target, 'localStorage',
            { value, writable: true, configurable: true });
    }
};

const store = {
    data: new Map(),
    install() {
        const self = this;
        globalThis.localStorage = {
            getItem: (k) => (self.data.has(k) ? self.data.get(k) : null),
            setItem: (k, v) => self.data.set(k, String(v)),
            removeItem: (k) => self.data.delete(k),
        };
        put(globalThis.localStorage);
    },
    reset() { this.data.clear(); },
    keys() { return [...this.data.keys()]; },
    only() { return this.data.get(this.keys()[0]); },
};
store.install();

const typed = (editor, text) => {
    editor.usertextarea.value = text;
    editor.usertextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const barOf = (editor) => editor.editorContainer.querySelector('.autosave-bar');
const barBtn = (editor, text) => [...(barOf(editor)?.querySelectorAll('button') ?? [])]
    .find(b => b.textContent === text);

check('autosave is off unless asked for', () => {
    store.reset();
    const e = makeEditor({ toolbar: FULL_BAR }, 'start');
    typed(e, 'start and more');
    e.autosave?.save();
    // Writing what someone types to a disk this library does not own is a
    // decision for the application, not a default.
    return e.autosave === undefined && store.keys().length === 0;
});

check('a draft is stored once something is typed', () => {
    store.reset();
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k1', debounce: 0 } }, 'start');
    typed(e, 'start and more');
    e.autosave.save();
    const saved = JSON.parse(store.only());
    return store.keys()[0] === 'mte:draft:k1' && saved.text === 'start and more';
});

check('text back at its starting value stores nothing', () => {
    store.reset();
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k2', debounce: 0 } }, 'start');
    typed(e, 'start and more');
    e.autosave.save();
    const had = store.keys().length === 1;

    typed(e, 'start');
    e.autosave.save();
    // Identical to what the page put there is not unsaved work.
    return had && store.keys().length === 0;
});

check('a stored draft is offered, never restored on its own', () => {
    store.reset();
    store.data.set('mte:draft:k3', JSON.stringify({ text: 'the draft', seed: '', at: Date.now() }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k3' } }, 'what the server sent');

    // Restoring here would put an old draft over newer text from the server
    // and say nothing about it.
    return e.usertextarea.value === 'what the server sent'
        && barOf(e) !== null
        && barBtn(e, 'Restore') !== undefined
        && barBtn(e, 'Discard') !== undefined;
});

check('Restore puts the draft in and clears the store', () => {
    store.reset();
    store.data.set('mte:draft:k4', JSON.stringify({ text: 'the draft', seed: '', at: Date.now() }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k4' } }, 'server text');
    barBtn(e, 'Restore').click();

    // Keeping it stored would offer it again next time against text that
    // already holds it.
    return e.usertextarea.value === 'the draft'
        && barOf(e) === null
        && store.keys().length === 0;
});

check('Discard leaves the text alone and clears the store', () => {
    store.reset();
    store.data.set('mte:draft:k5', JSON.stringify({ text: 'the draft', seed: '', at: Date.now() }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k5' } }, 'server text');
    barBtn(e, 'Discard').click();

    return e.usertextarea.value === 'server text'
        && barOf(e) === null
        && store.keys().length === 0;
});

check('a draft taken against older text says the document has moved on', () => {
    store.reset();
    // You typed, left without saving, and somebody else saved in between.
    // The draft is good work, but it was written against a version that no
    // longer exists: restoring it drops whatever they added.
    store.data.set('mte:draft:k11', JSON.stringify({
        text: 'some text here and more',
        seed: 'some text here',
        at: Date.now(),
    }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k11' } },
        'some text here and more and more');

    const bar = barOf(e);
    return bar !== null
        && bar.textContent.includes('changed since')
        && bar.className.includes('me-alert-warning')
        && !bar.className.includes('me-alert-info');
});

check('a draft taken against the same text does not cry wolf', () => {
    store.reset();
    store.data.set('mte:draft:k12', JSON.stringify({
        text: 'the draft',
        seed: 'what the server sent',
        at: Date.now(),
    }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k12' } }, 'what the server sent');

    const bar = barOf(e);
    return bar !== null
        && !bar.textContent.includes('changed since')
        && bar.className.includes('me-alert-info');
});

check('a draft with no seed recorded is not called stale', () => {
    store.reset();
    // Written by a version before the seed existed. Unknown is not the same
    // as changed, and warning about every old draft would teach people to
    // ignore the warning.
    store.data.set('mte:draft:k13', JSON.stringify({ text: 'the draft', at: Date.now() }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k13' } }, 'server text');

    const bar = barOf(e);
    return bar !== null && !bar.textContent.includes('changed since');
});

check('a draft identical to what is on screen is not offered', () => {
    store.reset();
    store.data.set('mte:draft:k6', JSON.stringify({ text: 'same', seed: '', at: Date.now() }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k6' } }, 'same');
    // Otherwise the strip appears on every single load offering to restore
    // the text already in front of you.
    return barOf(e) === null;
});

// --- what the draft costs to store ------------------------------------------
//
// The stored record used to carry a full copy of the text the page loaded
// with, so editing a long document wrote it twice on every save. localStorage
// holds about 5MB per origin and counts UTF-16, so the ceiling arrived at half
// the length anyone would guess, the write threw, and the throw was swallowed:
// a large paste simply was not there after a reload.

check('a draft stores one copy of the document, not two', () => {
    const doc = 'x'.repeat(20000);
    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'size', debounce: 0 } }, doc);
    e.usertextarea.value = doc + 'y';
    e.autosave.save();

    const raw = window.localStorage.getItem('mte:draft:size');
    window.localStorage.removeItem('mte:draft:size');

    // the seed is a fingerprint, so the record is the text plus a little
    return raw.length < doc.length * 1.2;
});

check('the fingerprint still tells a changed page from an unchanged one', () => {
    const page = 'theirs';
    window.localStorage.setItem('mte:draft:fp', JSON.stringify(
        { text: 'mine', seedHash: '6:' + 'nope', at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'fp' } }, page);
    const warned = e.editorContainer.querySelector('.autosave-bar')
        .textContent.includes('The document has changed since then');
    window.localStorage.removeItem('mte:draft:fp');
    return warned;
});

check('a draft written against the same text does not claim otherwise', () => {
    const page = 'unchanged';
    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'fp2', debounce: 0 } }, page);
    e.usertextarea.value = page + ' plus a draft';
    e.autosave.save();
    e.destroy();

    const again = makeEditor({ toolbar: ['bold'], autosave: { key: 'fp2' } }, page);
    const text = again.editorContainer.querySelector('.autosave-bar').textContent;
    window.localStorage.removeItem('mte:draft:fp2');
    return !text.includes('The document has changed since then');
});

check('a draft from before the fingerprint existed is still read', () => {
    const page = 'theirs';
    // the shape written by 2.0.0-beta.5 and earlier: a full copy of the seed
    window.localStorage.setItem('mte:draft:old', JSON.stringify(
        { text: 'mine', seed: 'something else entirely', at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'old' } }, page);
    const bar = e.editorContainer.querySelector('.autosave-bar');
    window.localStorage.removeItem('mte:draft:old');
    return bar !== null && bar.textContent.includes('The document has changed since then');
});

check('a refused write says so instead of failing quietly', () => {
    const real = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };

    const said = [];
    const quiet = console.error;
    console.error = (...args) => said.push(args.join(' '));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'quota', debounce: 0 } }, 'a');
    e.usertextarea.value = 'a draft that cannot be stored';
    e.autosave.save();
    e.autosave.save();   // twice: the message is once per editor, not per save

    console.error = quiet;
    window.localStorage.setItem = real;

    return said.length === 1 && said[0].includes('not being kept');
});

// --- the split the preview opens -------------------------------------------
//
// Written before the layout half of PreviewTool was pulled out for the draft
// comparison to share. Nothing covered any of it, so a refactor could have
// broken the preview in a way no test would have mentioned.

const splitState = (e) => {
    const pane = e.previewContent.parentNode;
    const wrap = e.markdownEditorDiv.querySelector('.textarea-wrapper');
    return {
        fullscreen: e.editorContainer.classList.contains('is-fullscreen'),
        twoColumns: e.markdownEditorDiv.classList.contains('fj:md:grid-cols-2'),
        paneShown: !pane.classList.contains('fj:hidden'),
        paneMinH: pane.classList.contains('fj:min-h-0'),
        textareaFull: wrap.querySelector('textarea').classList.contains('fj:h-full!'),
        bodyLocked: document.body.classList.contains('fj:overflow-hidden'),
    };
};

check('opening the preview puts the editor in a two-column fullscreen', () => {
    const e = makeEditor({ toolbar: ['bold', 'preview'] }, 'text');
    const before = splitState(e);
    e.previewTool.applySyntax();
    const after = splitState(e);
    e.previewTool.applySyntax();

    return Object.values(before).every(v => v === false)
        && Object.values(after).every(v => v === true);
});

check('closing the preview undoes every part of it', () => {
    const e = makeEditor({ toolbar: ['bold', 'preview'] }, 'text');
    e.previewTool.applySyntax();
    e.previewTool.applySyntax();
    const after = splitState(e);
    return Object.values(after).every(v => v === false);
});

check('Escape closes the preview', () => {
    const e = makeEditor({ toolbar: ['bold', 'preview'] }, 'text');
    e.previewTool.applySyntax();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    return splitState(e).twoColumns === false;
});

check('the other toolbar buttons are reachable again afterwards', () => {
    const e = makeEditor({ toolbar: ['bold', 'preview'] }, 'text');
    const bold = e.editorContainer.querySelector('.bold-btn');
    e.previewTool.applySyntax();
    const dimmed = bold.classList.contains('fj:opacity-25');
    e.previewTool.applySyntax();
    return dimmed && !bold.classList.contains('fj:opacity-25')
        && !bold.hasAttribute('aria-disabled');
});

// --- the draft comparison ---------------------------------------------------
//
// Restore used to be the only way to see what a draft held, so looking and
// committing were the same action, and the commit could not be undone.

check('lineDiff trims the matching lines off both ends', async () => {
    const { lineDiff } = await import('../src/utils/lineDiff.js');

    const d = lineDiff('a' + NEWLINE + 'b' + NEWLINE + 'c',
                       'a' + NEWLINE + 'B' + NEWLINE + 'c');
    return d.head === 1 && d.tail === 1
        && d.removed.join() === 'b' && d.added.join() === 'B';
});

check('lineDiff reports an identical pair as no change at all', async () => {
    const { lineDiff } = await import('../src/utils/lineDiff.js');
    const d = lineDiff('same' + NEWLINE + 'text', 'same' + NEWLINE + 'text');
    return d.removed.length === 0 && d.added.length === 0;
});

check('lineDiff never counts one line from both ends', async () => {
    const { lineDiff } = await import('../src/utils/lineDiff.js');
    // the added line is the only difference, and it matches its neighbours
    const d = lineDiff('x', 'x' + NEWLINE + 'x');
    return d.removed.length + d.added.length === 1;
});

const compareButton = (e) => [...e.editorContainer.querySelectorAll('.autosave-bar button')]
    .find(b => b.textContent === 'Compare');

const openCompare = (e) => {
    compareButton(e).click();
    return e.editorContainer.querySelector('.markdown-modal');
};

check('Compare opens a dialog and leaves the editor where it was', () => {
    const page = 'kept' + NEWLINE + 'theirs';
    window.localStorage.setItem('mte:draft:cmp', JSON.stringify(
        { text: 'kept' + NEWLINE + 'mine', seed: page, at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold', 'preview'], autosave: { key: 'cmp' } }, page);
    const dialog = openCompare(e);

    window.localStorage.removeItem('mte:draft:cmp');

    // a decision, not a mode: nothing about the editor's layout moves
    return dialog !== null
        && !e.editorContainer.classList.contains('is-fullscreen')
        && !e.markdownEditorDiv.classList.contains('fj:md:grid-cols-2')
        && !document.body.classList.contains('fj:overflow-hidden')
        && e.usertextarea.value === page;
});

check('the diff marks what goes and what comes, with context either side', () => {
    const page = ['one', 'two', 'theirs', 'four', 'five'].join(NEWLINE);
    const draft = ['one', 'two', 'mine', 'four', 'five'].join(NEWLINE);
    window.localStorage.setItem('mte:draft:diff', JSON.stringify(
        { text: draft, seed: page, at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'diff' } }, page);
    const rows = [...openCompare(e).querySelectorAll('.autosave-diff div')]
        .map(r => r.textContent);

    window.localStorage.removeItem('mte:draft:diff');

    return rows.includes('- theirs') && rows.includes('+ mine')
        // the lines around it say where in the document this happened
        && rows.includes('  two') && rows.includes('  four');
});

check('Restore and Discard are in the dialog, next to the evidence', () => {
    const page = 'theirs';
    window.localStorage.setItem('mte:draft:act', JSON.stringify(
        { text: 'mine', seed: page, at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'act' } }, page);
    const dialog = openCompare(e);
    dialog.querySelector('.compare-restore').click();

    const restored = e.usertextarea.value;
    e.undoRedoManager.undo();
    window.localStorage.removeItem('mte:draft:act');

    return restored === 'mine' && e.usertextarea.value === page;
});

check('Discard from the dialog takes the strip with it', () => {
    window.localStorage.setItem('mte:draft:disc', JSON.stringify(
        { text: 'mine', seed: 'theirs', at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'disc' } }, 'theirs');
    openCompare(e).querySelector('.compare-discard').click();

    const gone = window.localStorage.getItem('mte:draft:disc') === null
        && e.editorContainer.querySelector('.autosave-bar') === null;
    window.localStorage.removeItem('mte:draft:disc');
    return gone && e.usertextarea.value === 'theirs';
});

check('the document is written as text, never as markup', () => {
    const payload = '<img src=x onerror=alert(1)>';
    window.localStorage.setItem('mte:draft:xss', JSON.stringify(
        { text: payload, seed: 'before', at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'xss' } }, 'before');
    const dialog = openCompare(e);
    window.localStorage.removeItem('mte:draft:xss');

    return dialog.textContent.includes(payload) && dialog.querySelector('img') === null;
});

check('a translation cannot break out of the dialog markup', () => {
    window.localStorage.setItem('mte:draft:esc2', JSON.stringify(
        { text: 'mine', seed: 'theirs', at: Date.now() }));

    const e = makeEditor({
        toolbar: ['bold'],
        autosave: { key: 'esc2' },
        locale: { Compare: '" onfocus="steal()' },
    }, 'theirs');
    // the button carries the translation, so it is found by position here
    const buttons = [...e.editorContainer.querySelectorAll('.autosave-bar button')];
    buttons[0].click();
    const dialog = e.editorContainer.querySelector('.markdown-modal');
    window.localStorage.removeItem('mte:draft:esc2');

    return dialog.getAttribute('onfocus') === null
        && dialog.textContent.includes('" onfocus="steal()');
});

check('the comparison counts both sides, and translates the counts', () => {
    window.localStorage.setItem('mte:draft:cmp2', JSON.stringify(
        { text: 'abcd', seed: 'ab', at: Date.now() }));

    const e = makeEditor({
        toolbar: ['bold'],
        autosave: { key: 'cmp2' },
        locale: { 'Page {n} chars': 'Pagina {n}', 'Draft {n} chars': 'Borrador {n}' },
    }, 'ab');
    const shown = openCompare(e).textContent;
    window.localStorage.removeItem('mte:draft:cmp2');

    return shown.includes('Pagina 2') && shown.includes('Borrador 4');
});

check('Ctrl+Z puts back what Restore replaced', () => {
    const page = 'theirs, saved on the server';
    window.localStorage.setItem('mte:draft:cmp4', JSON.stringify(
        { text: 'mine, from Monday', seed: page, at: Date.now() }));

    const e = makeEditor({ toolbar: ['bold'], autosave: { key: 'cmp4' } }, page);
    const restore = [...e.editorContainer.querySelectorAll('.autosave-bar button')]
        .find(b => b.textContent === 'Restore');
    restore.click();

    const afterRestore = e.usertextarea.value;
    e.undoRedoManager.undo();
    window.localStorage.removeItem('mte:draft:cmp4');

    // Assigning `value` raises no input event, so nothing reached the undo
    // stack and this text was gone for good
    return afterRestore === 'mine, from Monday' && e.usertextarea.value === page;
});

check('a draft older than maxAge is dropped rather than offered', () => {
    store.reset();
    const old = Date.now() - 1000 * 60 * 60 * 24 * 30;
    store.data.set('mte:draft:k7', JSON.stringify({ text: 'ancient', seed: '', at: old }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k7' } }, 'current');
    return barOf(e) === null && store.keys().length === 0;
});

check('submitting the form clears the draft', () => {
    store.reset();
    const form = document.createElement('form');
    document.body.appendChild(form);
    const ta = document.createElement('textarea');
    ta.id = 'autosave-form-ta';
    ta.value = 'start';
    form.appendChild(ta);

    const e = new MarkdownEditor(ta, { toolbar: FULL_BAR, autosave: { key: 'k8', debounce: 0 } });
    typed(e, 'start and more');
    e.autosave.save();
    const had = store.keys().length === 1;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    // The application has the text now, so the local copy has done its job.
    return had && store.keys().length === 0;
});

check('storage that refuses does not break typing', () => {
    store.reset();
    const real = globalThis.localStorage;
    put({
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); },
        removeItem() { throw new Error('denied'); },
    });

    try {
        // Private browsing throws on access rather than returning null, and a
        // full quota throws on write. Neither is worth interrupting someone
        // mid-sentence for.
        const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k9', debounce: 0 } }, 'start');
        typed(e, 'start and more');
        e.autosave.save();
        return e.usertextarea.value === 'start and more' && barOf(e) === null;
    } finally {
        put(real);
    }
});

check('destroy() takes the bar and the handlers with it', () => {
    store.reset();
    store.data.set('mte:draft:k10', JSON.stringify({ text: 'draft', seed: '', at: Date.now() }));
    const e = makeEditor({ toolbar: FULL_BAR, autosave: { key: 'k10' } }, 'server');
    const had = barOf(e) !== null;
    e.destroy();
    return had && barOf(e) === null;
});

check('the draft key covers the whole address, not just the path', () => {
    store.reset();
    const at = (search, hash) => {
        // The editor reads window.location, so the probe moves it. Two
        // records behind a query string or a hash share a path, and sharing
        // a key there means one record's draft offered against another's
        // text -- the exact thing this feature exists to avoid.
        const real = { search: window.location.search, hash: window.location.hash };
        try {
            Object.defineProperty(window.location, 'search', { value: search, configurable: true });
            Object.defineProperty(window.location, 'hash', { value: hash, configurable: true });
            const ta = document.createElement('textarea');
            ta.id = 'keyed';
            document.body.appendChild(ta);
            return new MarkdownEditor(ta, { toolbar: ['bold'], autosave: true }).autosave.key;
        } finally {
            Object.defineProperty(window.location, 'search', { value: real.search, configurable: true });
            Object.defineProperty(window.location, 'hash', { value: real.hash, configurable: true });
        }
    };

    const seven = at('?id=7', '');
    const nine = at('?id=9', '');
    const routeA = at('', '#/posts/7');
    const routeB = at('', '#/posts/9');

    return seven !== nine && routeA !== routeB && seven.includes('id=7');
});

check('two editors on one page keep separate drafts without ids', () => {
    store.reset();
    // Position is the last resort and it says so in the console, because two
    // drafts change places if a textarea is added above them.
    const a = quietly2(() => makeEditor({ toolbar: FULL_BAR, autosave: { debounce: 0 } }, 'one'));
    const b = quietly2(() => makeEditor({ toolbar: FULL_BAR, autosave: { debounce: 0 } }, 'two'));
    return a.autosave.key !== b.autosave.key;
});

check('two editors on a page keep separate drafts', () => {
    store.reset();
    const a = makeEditor({ toolbar: FULL_BAR, autosave: { debounce: 0 } }, 'one');
    const b = makeEditor({ toolbar: FULL_BAR, autosave: { debounce: 0 } }, 'two');
    typed(a, 'one changed');
    typed(b, 'two changed');
    a.autosave.save();
    b.autosave.save();
    // The default key is built from the path and the field's own name, which
    // is what tells two editors on one page apart.
    return store.keys().length === 2;
});

// --- report -----------------------------------------------------------------

await Promise.all(pending);

console.log('\n  ' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
    failures.forEach(f => console.log('  FAIL  ' + f + '\n'));
    process.exit(1);
}
