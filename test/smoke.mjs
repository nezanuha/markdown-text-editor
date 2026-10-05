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
const check = (name, fn) => {
    try {
        const result = fn();
        if (result === true) { passed++; return; }
        failures.push(name + '\n      expected true, got ' + JSON.stringify(result));
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

check('heading menu items are translated', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Heading: 'Titulo' } });
    const wrapper = e.editorContainer.querySelector('.heading-btn').closest('.fj\\:me-popover');
    return [...wrapper.querySelectorAll(ITEM)].some(b => b.textContent === 'Titulo 1');
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

console.log('\n  ' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
    failures.forEach(f => console.log('  FAIL  ' + f + '\n'));
    process.exit(1);
}
