# Markdown Text Editor

### Toolbar, live preview and WYSIWYG on the textarea you already have

> **Version 2.0 is in beta** — `npm install markdown-text-editor@beta`
>
> The interface is translated into 56 languages, and the stylesheet is now a
> separate file you link yourself — that last part is the breaking change.
> 1.x stays on `latest` until 2.0 ships.
> [What is in 2.0](https://github.com/nezanuha/markdown-text-editor/blob/2.0.0/CHANGELOG.md)

[![npm installs][npm_installs]](https://www.npmjs.com/package/markdown-text-editor)
[![Jsdelivr hits][jsdelivr]](https://cdn.jsdelivr.net/npm/markdown-text-editor)
[![Latest Release](https://img.shields.io/npm/v/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/releases)
[![License](https://img.shields.io/npm/l/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/blob/master/LICENSE)
[![Secured](https://img.shields.io/badge/Security-Passed-green)](https://snyk.io/test/github/nezanuha/markdown-text-editor)
![GitHub Repo stars](https://img.shields.io/github/stars/nezanuha/markdown-text-editor?style=flat)

A lightweight, embeddable JavaScript Markdown editor that enhances a standard HTML `<textarea>` instead of replacing it, so native form submission, validation and `required` fields keep working. No data binding, no API to learn. Toolbar, live preview and WYSIWYG hybrid mode. Works with any backend: Django, Laravel, PHP, Node.js, Rails.

```bash
npm install markdown-text-editor
```

**[Try the live demo and read the docs](https://frutjam.com/plugins/markdown-editor)** · [Quick Start](#-quick-start) · [Why not EasyMDE?](#-why-developers-choose-this-over-easymde--simplemde)

![Hybrid mode: headings, bold text and list markers styled live inside the textarea while the Markdown syntax stays visible](https://cdn.frutjam.com/media/plugins/hybrid-mode-markdown-editor.webp)

<sub>Hybrid mode. Text is styled as you type and the Markdown stays where it is, because this is your `<textarea>`, not a copy of it.</sub>

**Works standalone.** No Frutjam, no Tailwind, no framework required. One script and one stylesheet.

**Looks like the rest of your app.** It takes the typeface and size from the page it sits on, and picks up `data-theme` from any ancestor, so it doesn't turn up looking like someone else's component.

## ⭐ Why developers choose this over EasyMDE / SimpleMDE

Most JavaScript markdown editors (EasyMDE, SimpleMDE, CodeMirror-based editors) hide your `<textarea>` and edit a copy, writing the value back when the form is submitted. That holds up until something else needs the field: a `required` input the browser cannot focus blocks the submit entirely, and `.value` or `FormData` read before submit returns an empty string, which breaks htmx, Turbo, Livewire, autosave and unsaved-changes guards.

**MarkdownEditor is different.** It sits transparently on top of your existing `<textarea>`:

| Feature | MarkdownEditor | EasyMDE / SimpleMDE |
|---|---|---|
| Native `<textarea>` preserved | ✅ | ❌ Hidden, edited as a copy |
| Works with `required` fields | ✅ | ❌ Browser blocks the submit |
| `.value` correct before submit | ✅ | ❌ Empty until the form submits |
| Serialises with `FormData`, htmx, Turbo | ✅ | ❌ Needs the editor's own API |
| WYSIWYG hybrid mode | ✅ | ❌ |
| Inline event handlers (CSP) | ✅ None | Some |
| RTL support | ✅ Built in | Via CodeMirror's `direction` option |
| Built-in Find & Replace | ✅ | ❌ |
| Draft recovery that asks before restoring | ✅ | ❌ |
| Upload from paste and drop, one endpoint | ✅ | Partial |
| Swap the markdown parser | ✅ | ❌ |
| Keyboard shortcuts | ✅ | Partial |
| Dark mode / theming | ✅ | Limited |
| Bundle size, gzipped | 72 KB (JS + CSS) via `<script>`, 49 KB with a bundler | 107 KB (JS + CSS) |

## 🚀 Quick Start

### NPM (bundlers: Vite, webpack, Rollup, etc.)

```bash
npm install markdown-text-editor
```

```javascript
import 'markdown-text-editor/style.css';
import MarkdownEditor from 'markdown-text-editor';

new MarkdownEditor('#markdown-editor');
```

Import the stylesheet **or** link it, never both. If you forget it entirely the editor still works, and tells you so in the console.

### CDN: ES module

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.css">

<script type="module">
  import MarkdownEditor from 'https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.es.js';
  new MarkdownEditor('#markdown-editor');
</script>
```

### CDN: global script tag (IIFE)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.css">

<form method="post" action="/submit">
  <textarea id="markdown-editor" name="content"># Hello World</textarea>
  <button type="submit">Save</button>
</form>

<script src="https://cdn.jsdelivr.net/npm/markdown-text-editor"></script>
<script>
  new MarkdownEditor('#markdown-editor');
</script>
```

**Via CDN**: no import needed, `MarkdownEditor` is available globally.

That's it. Form submission, `.value` access, and all native textarea behaviour work exactly as before.

### Upgrading from 1.x

**Add the stylesheet.** It used to be carried inside the JavaScript and injected as a `<style>` element. It is now a real file, so an existing setup keeps working but renders unstyled until you link or import it. The editor says so in the console rather than leaving you to guess.

```javascript
import 'markdown-text-editor/style.css';   // bundlers
```

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.css">
```

If you load the editor from an unpinned CDN URL, this reaches you the moment 2.0.0 publishes. Pin a version if you are not ready.

That is the whole breaking change. `labels` was renamed to `locale` and still works under the old name, so nothing else needs touching.

## ✨ Features

- 🔌 **Native Form Integration** — Works exactly like a standard `<textarea>`. No complex APIs — just use `.value` or the `name` attribute. Compatible with Django, Laravel, PHP, Rails, Node.js, and with React or Vue via a ref and `destroy()` on unmount
- 🔀 **WYSIWYG Hybrid Mode** — Renders bold, italic, headings, and code live as you type while keeping the underlying Markdown. Switch to plain mode for raw syntax editing
- ⚡ **Live Preview** — Full side-by-side Markdown preview with clickable task list checkboxes that sync back to the source instantly
- 🔧 **Bring Your Own Renderer** — Swap marked for markdown-it or any other parser so the preview matches whatever your backend renders. The sanitizer is replaceable too, and DOMPurify still runs by default
- 🏷️ **Variables, From a List or as You Type** — Give template authors a menu of readable names that insert placeholders like `{{customer.name}}`, so nobody is typing a precise string from memory. Entries can be grouped, a sample value can stand in for the placeholder in the preview, and typing the opening of a placeholder completes it under the caret. Whatever punctuation your own values use is what opens it
- 🖼️ **Uploads, in One Place** — `upload: '/api/upload'` and the toolbar button, pasting a screenshot and dropping a file all go to it. A CSRF token in a header, your endpoint's own response shape, a size limit and a progress callback are all options rather than forks. Images by default; widen `accept` and a video arrives as a `<video>`, a PDF as a link. Or hand it a function and upload to S3 yourself, so the bytes never touch your server
- 💾 **Draft Recovery** — `autosave: true` keeps what is being written in the browser. If the tab dies, the next load *offers* the draft back with the time it was taken and lets the writer choose. It never restores on its own, because the text on the page may be the newer of the two
- 📊 **Table Editing** — Click inside a table, or press `Alt+T`, and a bar appears beside it: add or delete the row or column you are in, align it, tidy the pipes. `Tab` moves between cells
- 📋 **Paste Keeps Its Formatting** — Copy from a web page or a word processor and the headings, links, lists, code and tables arrive as markdown instead of a wall of plain text. The HTML goes through the same sanitizer as the preview
- 🔍 **Find & Replace** — Built-in panel (`Ctrl+F` / `Ctrl+H`) with live match counter, next/prev navigation, case-sensitive toggle, and replace all
- ⌨️ **Keyboard Shortcuts** — `Ctrl+B`, `Ctrl+I`, `Ctrl+K`, `Ctrl+Z`, `Ctrl+1`–`Ctrl+3` for headings, and more
- 📝 **Smart List Continuation** — GitHub-style: press `Enter` inside a list and the bullet/number continues automatically
- 🔄 **Undo / Redo** — History of what changed rather than copies of the document, with exact cursor restoration, and no cost that grows with the length of the file. Works with `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`
- ♿ **Accessible by Default** — `role="toolbar"`, `aria-pressed`, `aria-disabled`, `disabled`, screen-reader-friendly SVGs, and correct focus restoration on modal close
- 🛡️ **XSS Safe** — Preview output sanitized via [DOMPurify](https://github.com/cure53/DOMPurify) before rendering, including the output of a custom renderer
- 🛡️ **CSP Compatible** — No inline event handlers, no `eval`, and no injected `<style>` element. The stylesheet is a real file you link, so a strict policy needs no `'unsafe-inline'` exception for either `script-src` or `style-src` ([#42](https://github.com/nezanuha/markdown-text-editor/issues/42))
- 🌍 **RTL Support** — Native Right-to-Left support for Arabic, Urdu, Farsi, and other RTL languages
- 🗣️ **Translatable Interface** — Every tooltip, menu item, dialog field and screen reader name goes through the `locale` option, keyed by the English string. `locale/template.js` lists all 72 of them so you don't have to go looking. Fifty-six languages ship with the package; you import the one you need
- 🎨 **Inherits Your UI** — Uses the typeface and size of the page it's dropped into, so it matches your forms rather than imposing its own look. Nothing to configure
- 🌙 **Dark Mode & Theming** — Picks up `data-theme` from any ancestor element, and follows the system setting when there isn't one. Built-in light, dark, snowberry, and darkberry themes. Fully customizable via CSS variables
- 🧩 **Custom Tools** — Add your own toolbar button with `{ custom: { title, icon, action } }`, or extend `MarkdownEditor.Tool` when it builds its own markup. Keyboard shortcuts, translation and teardown work exactly as they do for the built-ins. No fork, no patching
- 🎛️ **Modular Toolbar** — Pick exactly which tools appear and in what order
- 🟦 **TypeScript Ready** — Definitions ship with the package. Options, toolbar entries and variable shapes are all checked, so a mistyped tool name is a compile error rather than a silently missing button
- 🖥️ **SSR Safe** — Importing it on the server doesn't throw, so Next.js, Remix and Nuxt need no `dynamic(..., { ssr: false })` wrapper. The `<textarea>` is in the server HTML with its content, and the editor enhances it after hydration, so there's no markup mismatch and nothing pops in
- 📦 **Universal Module Support** — ESM, CommonJS, UMD, and IIFE. Works with Vite, webpack, Rollup, or directly via `<script src>` CDN — no configuration needed
- 🚀 **High Performance** — ~57KB gzipped JS plus ~16KB gzipped CSS, cached separately, or ~34KB of JS with a bundler, where marked and DOMPurify are yours to dedupe. The preview is debounced and skipped entirely while it is closed, the hybrid highlighter redraws only the lines that changed, layout is measured only when it can have moved, and Tab/Enter handling is conflict-free

## 🛠 Developer Workflow

### Getting & Setting Content

```javascript
// Get — just like any textarea
const markdown = document.getElementById('markdown-editor').value;

// Set — editor UI updates automatically
document.getElementById('markdown-editor').value = '## Updated content';
```

### React to every change with `onChange`

```javascript
const editor = new MarkdownEditor('#markdown-editor', {
    onChange(value) {
        console.log('Content changed:', value.length, 'characters');
    }
});
```

### Recover a draft after the tab dies

```javascript
new MarkdownEditor('#markdown-editor', { autosave: true });
```

That is the whole thing. The draft is written to `localStorage` as you type and,
if the tab died with unsaved text, the next load offers it back with the time it
was taken.

It offers rather than restores, deliberately. The text already on the page came
from your database and may be the newer of the two, so silently overwriting it
can lose an edit made somewhere else. The writer sees both and picks.

```javascript
new MarkdownEditor('#markdown-editor', {
    autosave: {
        key: 'post-42',                   // defaults to the URL plus the textarea id
        maxAge: 7 * 24 * 60 * 60 * 1000,  // older drafts are dropped, not offered
        debounce: 1000,                   // how long typing pauses before a write
    },
});
```

### Upload images, pasted screenshots and dropped files

```javascript
new MarkdownEditor('#markdown-editor', { upload: '/api/upload/' });
```

Your endpoint receives `image_file` as multipart form data and answers with a
URL. All three routes in — the toolbar button, a paste, a drop — use it.

```python
# Django
@require_POST
def upload(request):
    file = request.FILES["image_file"]
    saved = default_storage.save(f"uploads/{uuid.uuid4().hex}{Path(file.name).suffix}", file)
    return JsonResponse({"url": default_storage.url(saved)})
```

A framework that wants its CSRF token in a header, an endpoint that already
answers in its own shape, a size limit, file types past images:

```javascript
new MarkdownEditor('#markdown-editor', {
    upload: {
        url: '/api/upload/',
        headers: { 'X-CSRFToken': csrf },        // or X-CSRF-TOKEN for Laravel
        response: body => body.data.url,         // only if yours differs
        accept: ['image/*', 'video/mp4'],        // defaults to ['image/*']
        maxSize: 50 * 1024 * 1024,
        onProgress: (file, loaded, total) => { bar.value = loaded / total; },
    },
});
```

`accept` and `maxSize` stop a 200 MB file leaving the browser. They stop nothing
reaching your endpoint by other means, so check both server-side too.

### Add your own toolbar button

Most tools are just a title, an icon and a function. No class, no fork:

```javascript
new MarkdownEditor('#markdown-editor', {
    toolbar: ['bold', 'italic', {
        custom: {
            title: 'Callout',            // tooltip, and the .callout-btn class
            icon: '<svg>…</svg>',
            shortcut: 'Ctrl+Shift+C',    // optional, shown in the tooltip
            action(editor) {
                editor.insertText('> [!NOTE]\n> ');
            }
        }
    }, 'preview']
});
```

Use `editor.insertText(text, caretOffset, trailingLength)` rather than writing to the textarea yourself — it replaces the selection, restores focus, moves the caret, re-renders the preview, fires `onChange`, and keeps undo working.

A tool that builds its own markup, such as a dropdown or a dialog, extends the base class instead:

```javascript
class EmbedTool extends MarkdownEditor.Tool {
    constructor(editor) {
        super(editor, 'Embed video');
        this.button = this.createButton('<svg>…</svg>');
    }
    applySyntax(event) {
        // MarkdownEditor.modal is the same dialog the link and image tools use
        const dialog = MarkdownEditor.modal(event, 'fj:max-w-sm', '…', 'Embed');
    }
}

new MarkdownEditor('#markdown-editor', { toolbar: ['bold', EmbedTool, 'preview'] });
```

Two helpers exist for tools that need them: `editor.renderMarkdown(md)` returns sanitized HTML exactly as the preview does, and `editor.createToolbar(textarea, ['bold', 'italic'])` builds a real toolbar bound to another textarea, for a tool collecting rich text in its own dialog.

### Translate the interface

Every tooltip, menu item, dialog field and screen reader name goes through the `locale` option, keyed by the English string. Anything you leave out stays in English.

```javascript
import fr from 'markdown-text-editor/locale/fr.js';

new MarkdownEditor('#markdown-editor', { locale: fr });
```

`locale` takes the strings, not a language code. `locale: 'fr'` is a compile error in TypeScript and logs what to write instead in JavaScript. Importing the one language you want is why nobody downloads the other fifty-five.

<details>
<summary><strong>56 languages ship with the package</strong></summary>

`ar` Arabic · `az` Azerbaijani · `bg` Bulgarian · `bn` Bengali · `bs` Bosnian · `ca` Catalan · `cs` Czech · `da` Danish · `de` German · `el` Greek · `es` Spanish · `et` Estonian · `fa` Persian · `fi` Finnish · `fil` Filipino · `fr` French · `ga` Irish · `he` Hebrew · `hi` Hindi · `hr` Croatian · `hu` Hungarian · `hy` Armenian · `id` Indonesian · `is` Icelandic · `it` Italian · `ja` Japanese · `kn` Kannada · `ko` Korean · `lt` Lithuanian · `lv` Latvian · `mk` Macedonian · `mr` Marathi · `ms` Malay · `mt` Maltese · `nl` Dutch · `no` Norwegian · `pl` Polish · `pt` Portuguese · `ro` Romanian · `ru` Russian · `sk` Slovak · `sl` Slovenian · `sq` Albanian · `sr` Serbian · `sv` Swedish · `sw` Swahili · `ta` Tamil · `te` Telugu · `th` Thai · `tr` Turkish · `uk` Ukrainian · `ur` Urdu · `uz` Uzbek · `vi` Vietnamese · `zh` Chinese (Simplified) · `zh-hk` Chinese (Hong Kong)

English needs no file; it is what the editor falls back to.

None of these has been checked by a native speaker yet, so each file exports `reviewed = false` and says so in its header. If one reads wrong to you, [a pull request](https://github.com/nezanuha/markdown-text-editor/issues) correcting a single line is welcome and genuinely useful. Languages with more than one plural form, such as Polish and Arabic, currently get one wording that reads correctly for most counts but not all.

</details>

Partial is fine, and you can override a shipped translation without forking it:

```javascript
import fr from 'markdown-text-editor/locale/fr.js';

new MarkdownEditor('#markdown-editor', {
    locale: { ...fr, 'Image': 'Photo' }   // your wording wins
});
```

**`locale/template.js` lists every string**, English on both sides. Copy it to add a language, or map it through a translation system you already have, which keeps the editor's wording consistent with the rest of your interface:

```javascript
import template from 'markdown-text-editor/locale/template.js';

const locale = Object.fromEntries(
    Object.keys(template).map(key => [key, i18n.t(`editor.${key}`)])
);

new MarkdownEditor('#markdown-editor', { locale });
```

Counts carry a `{n}` placeholder, so `'{n} words'` can become `'{n} mots'` or `'mots : {n}'` and the number lands where that language wants it. CSS class names never change, so `.bold-btn` stays `.bold-btn` in every language.

### Tear down in SPAs

```javascript
// Removes editor UI, restores original textarea, cleans up all event listeners
editor.destroy();
```

In React, create the editor in an effect and return `destroy` as the cleanup — that also covers StrictMode running effects twice in development:

```jsx
// Options are read once, so reach the latest onChange through a ref rather
// than rebuilding the editor whenever the parent re-renders
const onChangeRef = useRef(onChange);
onChangeRef.current = onChange;

useEffect(() => {
    const editor = new MarkdownEditor(ref.current, {
        onChange: (value) => onChangeRef.current?.(value),
    });
    return () => editor.destroy();
}, []);
```

Use `defaultValue`, not `value`. The editor writes to the textarea directly, so a controlled binding (or Vue's `:value`) would overwrite what the user is typing. Full React and Vue examples are in the [documentation](https://frutjam.com/plugins/markdown-editor).

The same two rules cover Svelte, Angular and anything else: don't bind the value, and call `destroy()` on unmount. In Angular, `onChange` fires outside the zone, so wrap it in `zone.run()` for change detection to notice.

This is also all you need for server-side rendering. `useEffect`, `onMounted` and `onMount` never run on the server, so the DOM work stays in the browser and importing the package server-side is safe. Next.js, Remix and Nuxt need no `ssr: false` wrapper, and the `<textarea>` ships in the server HTML with its content already in it.

Options are read once when the editor is constructed. Changing them later has no effect — destroy the editor and create a new one instead.

## 📖 Documentation

Full API reference, configuration options, theming guide, and advanced image upload docs:
👉 **[frutjam.com/plugins/markdown-editor](https://frutjam.com/plugins/markdown-editor)**

## WYSIWYG Hybrid Mode vs Plain Mode

### Hybrid Mode — live formatting as you type

![Hybrid mode WYSIWYG styled markdown editor](https://cdn.frutjam.com/media/plugins/hybrid-mode-markdown-editor.webp)

### Plain Mode — raw Markdown syntax

![Plain mode markdown editor](https://cdn.frutjam.com/media/plugins/plain-mode-markdown-editor.webp)

---

## 🤝 Contributing

Contributions are welcome! Bug fixes, feature requests, and improvements — open an issue or submit a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, project layout, and how to add a toolbar tool.

---

## License

[MIT License](LICENSE)

---

## ⭐ Support

If this saves you time, consider giving it a star — it helps others find this project!

[![GitHub stars](https://img.shields.io/github/stars/nezanuha/markdown-text-editor.svg?style=social&label=Star&maxAge=2592000)](https://github.com/nezanuha/markdown-text-editor)

---

[jsdelivr]: https://badgen.net/jsdelivr/hits/npm/markdown-text-editor
[npm_installs]: https://badgen.net/npm/dt/markdown-text-editor
