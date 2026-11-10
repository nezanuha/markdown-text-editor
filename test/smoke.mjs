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

// --- report -----------------------------------------------------------------

await Promise.all(pending);

console.log('\n  ' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
    failures.forEach(f => console.log('  FAIL  ' + f + '\n'));
    process.exit(1);
}
