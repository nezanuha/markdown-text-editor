## MarkdownEditor Plugin Documentation

Welcome to the documentation for the **MarkdownEditor Plugin** – an **open source project** offering the **best, simple, embeddable JavaScript Markdown editor plugin or library**. This powerful tool provides **real-time preview**, **syntax highlighting**, and **easy integration** into your projects. Whether you’re building a blog, note-taking app, or any content-rich website, this plugin delivers a robust and customizable markdown editing experience.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration Options](#configuration-options)
- [Toolbar Customization](#toolbar-customization)
- [Example Implementations](#example-implementations)
- [Contribution Guidelines](#contribute)
- [License](#license)

---

## Overview

The MarkdownEditor Plugin is designed to be the **best, simple, and embeddable JavaScript markdown editor plugin** available. It is an open source project that boasts:

- **Real-time Preview:** See your markdown rendered instantly as you type.
- **Syntax Highlighting:** Enhanced readability with clear code and markdown formatting.
- **Easy Integration:** Seamlessly integrate into any web project with minimal setup.
- **Customizable Toolbar:** Dynamically configure and reorder toolbar options like **bold**, **italic**, and more.

Built with **Tailwind CSS** for modern styling, this plugin is perfect for developers seeking a lightweight yet feature-rich markdown editor.

---

## Installation

Integrating the MarkdownEditor Plugin into your project is straightforward. You can install it using NPM, import the JavaScript file directly, or use a CDN for rapid deployment.

### Install via NPM

For projects utilizing bundling tools like Webpack, run:

```bash
npm install markdown-text-editor
```

---

## Usage

After installation, import the `MarkdownEditor` class from the package:

```javascript
import MarkdownEditor from "markdown-text-editor";
```

### Basic Initialization

To get started, include a `<textarea>` element in your HTML and initialize the editor by targeting its container:

#### HTML

```html
<textarea class="editor-container"></textarea>
```

#### JavaScript

```javascript
const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Write your markdown...',
    toolbar: ['preview', 'bold', 'italic'], // Customize toolbar options as needed
});
```

---

## CSS Setup

### Using TailwindCSS

If you’re leveraging **TailwindCSS**, add the following configuration to your `tailwind.config.js`:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    'node_modules/markdown-text-editor/**/*.js',
    // Add your project paths here
  ],
};
```

### Without TailwindCSS

For projects not using TailwindCSS, simply import the CSS file directly:

```javascript
import 'markdown-text-editor/dist/markdown-text-editor.css';
```

### Using a CDN

Alternatively, include the following CDN links in your HTML:

#### JavaScript:

```html
<script src="https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.js"></script>
```

#### CSS:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.min.css">
```

---

## Configuration Options

Customize your Markdown editor by passing an `options` object during initialization. Below are some key configuration options:

| Option        | Type     | Default                      | Description                                               |
|---------------|----------|------------------------------|-----------------------------------------------------------|
| `placeholder` | `string` | `'Write your markdown...'`   | Sets the placeholder text for the textarea.             |
| `toolbar`     | `array`  | `['bold', 'italic', 'strikethrough']` | Determines which tools appear in the toolbar and their order. |

---

## Toolbar Customization

Tailor the toolbar to suit your needs by choosing which formatting options to include. The MarkdownEditor Plugin supports several tools, including:

- **`bold`**: Enables bold text formatting.
- **`italic`**: Enables italic text formatting.
- **`strikethrough`**: Allows text to be struck through.
- **`preview`**: Toggles the real-time markdown preview.

**Example:**

```javascript
const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Start writing...',
    toolbar: ['bold', 'italic', 'strikethrough', 'preview'],
});
```

---

## Example Implementations

### Full HTML Example

Below is a complete HTML example demonstrating how to integrate the MarkdownEditor Plugin into your project:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Editor Example</title>
  <link rel="stylesheet" href="dist/markdown-editor-plugin.css">
</head>
<body>
  <textarea class="editor-container"></textarea>

  <script src="dist/markdown-editor-plugin.js"></script>
  <script>
    const editor = new MarkdownEditor('.editor-container', {
      placeholder: 'Type your markdown...',
      toolbar: ['preview', 'bold', 'italic']
    });
  </script>
</body>
</html>
```

### Webpack Integration Example

For projects using Webpack, import and initialize the editor as follows:

```javascript
import MarkdownEditor from 'markdown-text-editor';

const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Write markdown...',
    toolbar: ['preview', 'bold', 'italic'],
});
```

### Customizing Styles with TailwindCSS

Customize the appearance of the editor using Tailwind utility classes. The plugin’s default styling can be easily overridden in your custom Tailwind configuration.

---

## Contribute

Contributions to this **open source project** are highly encouraged! If you have bug fixes, feature enhancements, or new ideas, please consider opening an issue or submitting a pull request. Your help will ensure that this **best, simple, embeddable JavaScript markdown editor plugin** continues to evolve and serve the community with **real-time preview** and **syntax highlighting** capabilities.

---

## License

This project is released under the [MIT License](LICENSE).

---

Thank you for choosing the MarkdownEditor Plugin – your reliable, feature-rich solution for seamless markdown editing and content creation with **easy integration**. Happy coding!