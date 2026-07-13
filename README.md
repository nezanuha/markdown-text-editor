# MarkdownEditor — Lightweight JavaScript Markdown Editor with WYSIWYG & Plain Mode

### The Native-First JavaScript Markdown Editor

[![npm installs][npm_installs]](https://www.npmjs.com/package/markdown-text-editor)
[![Jsdelivr hits][jsdelivr]](https://cdn.jsdelivr.net/npm/markdown-text-editor)
[![Latest Release](https://img.shields.io/npm/v/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/releases)
[![License](https://img.shields.io/npm/l/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/blob/master/LICENSE)
[![Secured](https://img.shields.io/badge/Security-Passed-green)](https://snyk.io/test/github/nezanuha/markdown-text-editor)
![GitHub Repo stars](https://img.shields.io/github/stars/nezanuha/markdown-text-editor?style=flat)

A lightweight, embeddable JavaScript Markdown editor that transforms a standard HTML `<textarea>` into a full-featured editing experience — without breaking native form submission. Works with any backend (Django, Laravel, PHP, Node.js, Rails) out of the box.

A native-first Markdown editor built on a standard textarea. No data binding, no API — just drop it in and your forms keep working as-is.

> **No complex APIs. No data binding. No JSON schemas.** Just a `<textarea>` that types Markdown and submits like any normal form field — enhanced with a rich toolbar, live preview, and WYSIWYG hybrid mode.

## ⭐ Why developers choose this over EasyMDE / SimpleMDE

Most JavaScript markdown editors (EasyMDE, SimpleMDE, CodeMirror-based editors) replace your `<textarea>` with a custom element — which means you have to write extra code to extract the value before form submission, sync state manually, and learn a new API just to read or set content.

**MarkdownEditor is different.** It sits transparently on top of your existing `<textarea>`:

| Feature | MarkdownEditor | EasyMDE / SimpleMDE |
|---|---|---|
| Native `<textarea>` preserved | ✅ | ❌ Replaced |
| Form submission works as-is | ✅ | ❌ Requires extra JS |
| Get/set value via `.value` | ✅ | ❌ Custom API needed |
| WYSIWYG hybrid mode | ✅ | ❌ |
| CSP-compatible (no inline JS) | ✅ | ❌ |
| Zero CSS conflicts | ✅ | ❌ |
| RTL support | ✅ | ❌ |
| Built-in Find & Replace | ✅ | ❌ |
| Keyboard shortcuts | ✅ | Partial |
| Dark mode / theming | ✅ | Limited |
| ~116KB bundle | ✅ | ~300KB+ |

## 🚀 Quick Start

### Install via NPM

```bash
npm install markdown-text-editor
```

### Or use a CDN

```html
<script src="https://cdn.jsdelivr.net/npm/markdown-text-editor"></script>
```

### Basic Setup

```html
<form method="post" action="/submit">
  <textarea id="markdown-editor" name="content"># Hello World</textarea>
  <button type="submit">Save</button>
</form>

<script>
  import MarkdownEditor from "markdown-text-editor";
  new MarkdownEditor('#markdown-editor');
</script>
```

That's it. Form submission, `.value` access, and all native textarea behaviour work exactly as before.

## ✨ Features

- 🔌 **Native Form Integration** — Works exactly like a standard `<textarea>`. No complex APIs — just use `.value` or the `name` attribute. Compatible with Django, Laravel, PHP, Rails, Node.js
- 🔀 **WYSIWYG Hybrid Mode** — Renders bold, italic, headings, and code live as you type while keeping the underlying Markdown. Switch to plain mode for raw syntax editing
- ⚡ **Live Preview** — Full side-by-side Markdown preview with clickable task list checkboxes that sync back to the source instantly
- 🖼️ **Advanced Image Upload** — Upload images directly to your server or S3. Avoids heavy Base64 strings for better performance and SEO
- 🔍 **Find & Replace** — Built-in panel (`Ctrl+F` / `Ctrl+H`) with live match counter, next/prev navigation, case-sensitive toggle, and replace all
- ⌨️ **Keyboard Shortcuts** — `Ctrl+B`, `Ctrl+I`, `Ctrl+K`, `Ctrl+Z`, `Ctrl+1`–`Ctrl+3` for headings, and more
- 📝 **Smart List Continuation** — GitHub-style: press `Enter` inside a list and the bullet/number continues automatically
- 🔄 **Undo / Redo** — Full diff-based history with exact cursor restoration. Works with `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`
- ♿ **Accessible by Default** — `role="toolbar"`, `aria-pressed`, `aria-disabled`, `disabled`, screen-reader-friendly SVGs, and correct focus restoration on modal close
- 🛡️ **XSS Safe** — Preview output sanitized via [DOMPurify](https://github.com/cure53/DOMPurify) before rendering
- 🛡️ **CSP Compatible** — No inline event handlers. Works with strict Content Security Policy headers
- 🌍 **RTL Support** — Native Right-to-Left support for Arabic, Urdu, Farsi, and other RTL languages
- 🌙 **Dark Mode & Theming** — Inherits `data-theme` from any ancestor element. Built-in light, dark, snowberry, and darkberry themes. Fully customizable via CSS variables
- 🎛️ **Modular Toolbar** — Pick exactly which tools appear and in what order
- 📦 **Universal Module Support** — ESM, CommonJS, UMD, and IIFE. Works with Vite, webpack, Rollup, or directly via `<script src>` CDN — no configuration needed
- 🚀 **High Performance** — ~116KB bundle. Debounced preview, cached layout calculations, conflict-free Tab/Enter handling for large documents

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

### Auto-save draft to localStorage

```javascript
const textarea = document.getElementById('markdown-editor');
const saved = localStorage.getItem('draft');
if (saved && !textarea.value) textarea.value = saved;

const editor = new MarkdownEditor('#markdown-editor', {
    onChange(value) {
        localStorage.setItem('draft', value);
    }
});
```

### Tear down in SPAs

```javascript
// Removes editor UI, restores original textarea, cleans up all event listeners
editor.destroy();
```

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

---

## License

[MIT License](LICENSE)

---

## ⭐ Support

If this saves you time, consider giving it a star — it helps others find this project!

[![GitHub stars](https://img.shields.io/github/stars/nezanuha/markdown-text-editor.svg?style=social&label=Star&maxAge=2592000)](https://github.com/nezanuha/markdown-text-editor/stargazers)

---

[jsdelivr]: https://badgen.net/jsdelivr/hits/npm/markdown-text-editor
[npm_installs]: https://badgen.net/npm/dt/markdown-text-editor
