# MarkdownEditor — The Native-First JavaScript Markdown Editor

[![npm installs][npm_installs]](https://www.npmjs.com/package/markdown-text-editor)
[![Jsdelivr hits][jsdelivr]](https://cdn.jsdelivr.net/npm/markdown-text-editor)
[![Latest Release](https://img.shields.io/npm/v/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/releases)
[![License](https://img.shields.io/npm/l/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/blob/master/LICENSE)
[![Secured](https://img.shields.io/badge/Security-Passed-green)](https://snyk.io/test/github/nezanuha/markdown-text-editor)
![GitHub Repo stars](https://img.shields.io/github/stars/nezanuha/markdown-text-editor?style=flat)

A lightweight, developer-friendly Markdown editor that transforms a standard HTML `<textarea>` into a feature-rich editing experience without breaking native form submission.

> A native `<textarea>` can be enhanced into an advanced Markdown editor while still functioning like a standard textarea, allowing developers to submit its content through a normal form, retrieve the Markdown value using JavaScript via `id`, `name`, or any selector, and set the content programmatically with the editor automatically reflecting the changes.

## 💡 The Concept: Native Power

Most advanced editors require complex APIs to get or set data. This editor stays true to the web: **if you know how to use a `<textarea>`, you know how to use this editor**.

It acts as a transparent layer over your native element. This means:

- **Automatic Form Submission**: Since it's a `<textarea>`, the content is automatically included in your POST requests
- **No New Syntax**: Use standard JavaScript to get or set values
- **Seamless Integration**: Works with any backend (Node, PHP, Python, etc.) just like a normal form field

## 🚀 Quick Start

### 1. Installation

#### NPM

```bash
npm install markdown-text-editor
```

——— OR ———

#### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/markdown-text-editor@1.1.2/dist/markdown-text-editor.min.js"></script>
```

### 2. The HTML Structure

Simply place a `<textarea>` inside your standard form. No special wrappers required.

```html
<form method="post" action="api/submit-form">
  <input type="text" name="title" placeholder="Article Title">

  <textarea id="markdown-editor" name="content"># Heading level 1</textarea>

  <button type="submit">Submit Post</button>
</form>
```

### 3. Initialization

Works out of the box with any bundler (Vite, webpack, Rollup) or via CDN — no extra configuration needed. CSS is injected automatically, so a single import is all you need.

```javascript
import MarkdownEditor from "markdown-text-editor";

// Plain mode (default) — raw Markdown syntax
const editor = new MarkdownEditor('#markdown-editor');

// Hybrid mode — WYSIWYG-inspired, renders formatting live as you type
const editor = new MarkdownEditor('#markdown-editor', { mode: 'hybrid' });
```

## 🛠 Developer Workflow

### Getting Content

You don't need a custom library method to get the text. Just target the ID:

```javascript
const markdown = document.getElementById('markdown-editor').value;
console.log(markdown);
```

### Setting Content

The editor listens for changes. When you update the textarea value via JavaScript, the preview/editor UI updates automatically:

```javascript
const textarea = document.getElementById('markdown-editor');
textarea.value = "## New Content Loaded via JS";

// The editor UI reflects this immediately
```

## ✨ Features

- 🔌 **Native Form Integration**: Works exactly like a standard `<textarea>`. No complex APIs—just use the `value` or `name` attribute to get or set content. It "just works" with standard HTML form submissions
- 🖼️ **Advanced Image Upload**: Easily configure image uploads to your own server. Set your custom image paths via an API to ensure faster page loads and better SEO by avoiding heavy Base64 strings
- 🔀 **Hybrid & Plain Modes**: Choose between a **Hybrid (WYSIWYG)** experience for visual editing or a Plain Markdown mode for a traditional coding feel
- ⚡ **Real-time Live Preview**: Watch your Markdown render instantly as you type, including support for links, images, and complex formatting. Task list checkboxes in the preview pane are clickable and sync back to the markdown source instantly
- ♿ **Accessible by Default**: Full ARIA support out of the box — toolbar landmark (`role="toolbar"`), labelled preview region, screen-reader-friendly tool buttons (SVGs marked `aria-hidden`), `aria-pressed` on the preview toggle, `aria-disabled` on inactive buttons, and correct focus restoration when modals close
- 🛡️ **Zero CSS Conflicts**: Editor styles are fully scoped to the `.markdown-editor-wrapper` element and Tailwind's global preflight is excluded — no bleed into Bootstrap, Tailwind, or any other CSS framework on the same page
- 🌍 **Built-in RTL Support**: Native support for Right-to-Left (RTL) languages like Arabic, Urdu, and Farsi, making it globally accessible
- 🌙 **Adaptive Theming**: Features automatic Dark Mode support that follows your system or website settings for a seamless visual experience
- 🎨 **Frutjam UI Ready**: Effortless integration with the **Frutjam** UI library, including automatic theme adjustments to match your UI components
- 🚀 **High Performance**:
    - **Lightweight**: Tiny bundle size (~116KB minified)
    - **Heavy Content**: Optimized to handle long documents and large files without performance lag
    - **Smart rendering**: Debounced preview updates, cached style calculations, and conflict-free keyboard handling between list continuation and indentation
- 📱 **Fully Responsive**: A fluid UI that adapts perfectly to desktops, tablets, and smartphones
- 📝 **Smart Editing**: GitHub-style automatic list continuation—press `Enter` and the editor handles the bullets/numbers for you. Supports ordered lists, unordered lists, and checklists
- 🔄 **Undo / Redo**: Full history system using granular diffs — restores both text content and exact cursor position. Integrated with `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z`
- 🎛️ **Effortless Customization**: Quickly match your brand's look and feel using simple CSS variables
- 📦 **Universal Module Support**: Compatible with **ESM**, **UMD**, **CommonJS**, and **IIFE** — works with Vite, webpack, Rollup, or directly via CDN (`<script src>`) with no extra configuration
- 🔄 **Actively Maintained**: Regularly updated with new features, optimizations, and community-driven improvements

## 📖 Documentation

For the complete API reference, advanced configuration, and styling guides, visit the official [Markdown Editor Documentation](https://frutjam.com/plugins/markdown-editor).

## WYSIWYG (Hybrid) & Plain Mode Markdown Editing Experience

### Hybrid Mode (WYSIWYG + Markdown): See how the editor combines WYSIWYG and Markdown editing in one interface

![Hybrid mode WYSIWYG styled markdown editor](https://cdn.frutjam.com/media/plugins/hybrid-mode-markdown-editor.webp)

### Plain Markdown Mode: Experience editing Markdown directly with full control over formatting

![Plain mode markdown editor](https://cdn.frutjam.com/media/plugins/plain-mode-markdown-editor.webp)

---

## Contribute

Contributions to this **open source project** are highly encouraged! If you have bug fixes, feature enhancements, or new ideas, please consider opening an issue or submitting a pull request. Your help will ensure that this **best, simple, embeddable JavaScript markdown editor plugin** continues to evolve and serve the community with **real-time preview** and **syntax highlighting** capabilities.

---

## License

This project is released under the [MIT License](LICENSE).

---

Thank you for choosing the MarkdownEditor Plugin – your reliable, feature-rich solution for seamless markdown editing and content creation with **easy integration**. Happy coding!

## ⭐ Support

If you like this project, consider giving it a star! 🌟

[![GitHub stars](https://img.shields.io/github/stars/nezanuha/markdown-text-editor.svg?style=social&label=Star&maxAge=2592000)](https://github.com/nezanuha/markdown-text-editor/stargazers)

---

[jsdelivr]: https://badgen.net/jsdelivr/hits/npm/markdown-text-editor
[npm_installs]: https://badgen.net/npm/dt/markdown-text-editor
