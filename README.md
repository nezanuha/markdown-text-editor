## MarkdownEditor – Best JavaScript Markdown Editor Plugin

[![npm installs][npm_installs]](https://www.npmjs.com/package/markdown-text-editor)
[![Jsdelivr hits][jsdelivr]](https://cdn.jsdelivr.net/npm/markdown-text-editor)
[![Latest Release](https://img.shields.io/npm/v/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/releases)
[![License](https://img.shields.io/npm/l/markdown-text-editor.svg)](https://github.com/nezanuha/markdown-text-editor/blob/master/LICENSE)
[![Secured](https://img.shields.io/badge/Security-Passed-green)](https://snyk.io/test/github/nezanuha/markdown-text-editor)
![GitHub Repo stars](https://img.shields.io/github/stars/nezanuha/markdown-text-editor?style=flat)


Welcome to **MarkdownEditor**, the leading open source JavaScript markdown editor plugin. Enjoy a simple, powerful, and embeddable markdown editor with real-time preview, syntax highlighting, responsive design, and seamless integration for all web projects.

## Built With

This Markdown editor is built using [frutjam](https://frutjam.com), a customizable Tailwind CSS UI library.

---
## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [Markdown Content Retrieval](#markdown-content-retrieval)
  - [JavaScript Value Retrieval](#javascript-value-retrieval)
  - [HTML Template Form Submission](#html-template-form-submission)
- [Set Markdown Content to Editor](#set-markdown-content-to-editor)
- [Configuration Options](#configuration-options)
- [Toolbar Customization](#toolbar-customization)
- [Example Implementations](#full-html-example-implementations)
- [Contribution Guidelines](#contribute)
- [License](#license)

---
## Features
- ✅ **Effortless Frutjam UI Integration**: Easily integrate the Frutjam UI library with automatic editor theme adjustments based on the selected theme.
- ✅ **Actively Maintenaning**: The plugin receives regular updates to stay up to date. 
- ✅ **User-Friendly**: It offers a WYSIWYG-style interface, making it great for non-technical users.  
- ✅ **Simple Markdown _Get/Set_**: No complicated techniques are required to get and set the markdown content. You can use the <textarea> value or name attribute to get and set markdown content. 
- ✅ **Responsive**: The editor is fully responsive, providing a seamless experience across all screen sizes.  
- ✅ **RTL Support**: By default Right-to-Left (RTL) text is supported, making it ideal for languages like Arabic, Urdu, and Farsi.  
- ✅ **Module Support**: Supports ESM, UMD, and CommonJS modules, making it easy to integrate with different module systems.
- ✅ **Live Preview Mode**: Watch your markdown content render while you type, providing a real-time preview of formatting, links, images, and more.
- ✅ **Automatic Dark Mode Support**: The editor follows your system's or website's dark mode settings, giving a seamless experience.

---

## Overview

The MarkdownEditor Plugin is designed to be the **best, simple, and embeddable JavaScript markdown editor plugin** available. It is an open source project that boasts:

- **Real-time Preview:** See your markdown rendered instantly as you type.
- **Syntax Highlighting:** Enhanced readability with clear code and markdown formatting.
- **Easy Integration:** Seamlessly integrate into any web project with minimal setup.
- **Customizable Toolbar:** Dynamically configure and reorder toolbar options like **bold**, **italic**, and more.

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
    toolbar: ['heading', 'bold', 'italic', 'strikethrough', 'ul', 'ol', 'checklist', 'blockquote', 'link', 'preview'],
});
```

---

## CSS Setup

import the CSS file directly in your js code:

```javascript
import 'markdown-text-editor/dist/markdown-text-editor.css';
```

### Using a CDN

Alternatively, include the following CDN links in your HTML:

#### JavaScript:

```html
<script src="https://cdn.jsdelivr.net/npm/markdown-text-editor@0.4.0/dist/markdown-text-editor.min.js"></script>
```

#### CSS:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markdown-text-editor@0.4.0/dist/markdown-text-editor.min.css">
```

---

## Markdown Content Retrieval

### JavaScript Value Retrieval

In this method, you can access the markdown content entered into the editor directly using JavaScript. This is helpful when you want to dynamically retrieve the value and process it in your application (e.g., displaying it elsewhere or sending it via AJAX).


#### HTML

```html
<form>
  <textarea class="editor-container h-48" rows="5"></textarea>
  <button type="button" id="submit-btn">Submit</button>
  <div class="output"></div>
</form>
```

#### JavaScript

```javascript
const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Start writing...',
    toolbar: ['bold', 'italic', 'preview'],
});

document.getElementById('submit-btn').addEventListener('click', function() {
    const markdownValue = document.querySelector('.editor-container').value;
    console.log(markdownValue);
    document.querySelector('.output').innerHTML = `<pre>${markdownValue}</pre>`;
});
```

### HTML Template Form Submission

If you prefer a traditional form submission approach (for example, in server-side applications like Django), you can integrate the markdown editor into a form that submits the value to the server for processing.

#### HTML (Form Submission)

```html
<form method="POST" action="/your-server-endpoint">
    <textarea class="editor-container h-48" rows="5" name="markdown"></textarea>
    <button type="submit">Submit</button>
</form>
```

you can retrieve the value from a traditional `<textarea>` in a form submission without any custom element. When the form is submitted, the content inside the `<textarea>` is automatically included as part of the form data, using the name attribute of the `<textarea>`. 

#### JavaScript (MarkdownEditor Initialization)

```javascript
const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Write your markdown...',
    toolbar: ['preview', 'bold', 'italic'],
});
```

## Set Markdown Content to Editor

```HTML
<form method="POST" action="/your-server-endpoint">
    <textarea class="editor-container h-48" rows="5" name="markdown">Add your markdown content here</textarea>
    <button type="submit">Submit</button>
</form>
```

## Configuration Options

Customize your Markdown editor by passing an `options` object during initialization. Below are some key configuration options:

| Option        | Type     | Default                      | Description                                               |
|---------------|----------|------------------------------|-----------------------------------------------------------|
| `placeholder` | `string` | `'Write your markdown...'`   | Sets the placeholder text for the textarea (optional, as you can also use the standard HTML textarea attribute)            |
| `toolbar`     | `array`  | `['heading', 'bold', 'italic', 'strikethrough', 'ul', 'ol', 'checklist', 'blockquote', 'link', 'image', 'undo', 'redo', 'preview']` | Determines which tools appear in the toolbar and their order. |

---

## Toolbar Customization

Tailor the toolbar to suit your needs by choosing which formatting options to include. The MarkdownEditor Plugin supports several tools, including:

- `bold`: Enables bold text formatting.
- `italic`: Enables italic text formatting.
- `strikethrough`: Allows text to be struck through.
- `ol`: (Ordered List): Converts text into a numbered list format.
- `ul`: (Unordered List): Converts text into a bullet point list.
- `checklist`: Adds checkboxes to your text, making it great for tasks, to-do lists, or tracking completion status.
- `image`: Allows you to insert images via markdown syntax.
- `link`: Lets you add hyperlinks to your text.
- `undo (beta)`: To reverse the last changes
- `redo (beta)`: To reapply the last undone changes 
- `preview`: Toggles the real-time markdown preview.

**Example:**

```javascript
const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Start writing...',
    toolbar: [
      'bold',
      'italic',
      'strikethrough',
      'ul',
      'ol',
      'checklist',
      'image',
      'link',
      'preview'
    ],
});
```
### Advanced Image Upload

  * The image tool supports a `fileInput` configuration that allows:

    * `accept`: Array of allowed image file types (e.g., `'webp'`, `'avif'`).
    * `uploadUrl`: The endpoint where image files will be uploaded.
  * After a successful upload, the server must return the image path, which will be automatically populated in the URL field.

  **Usage example:**

  ```js
  const options = {
      placeholder: 'Start writing...',
      toolbar: [
          'link',
          {
              image: {
                  fileInput: {
                      accept: ['webp', 'avif'],
                      uploadUrl: '/api/upload', // Your upload endpoint
                  },
              }
          },
          'preview'
      ],
  }
  const editor = new MarkdownEditor(element, options);
  ```
  * **If `fileInput` is not configured,** the image modal will default to only showing the `URL` and `alt text` fields.
   
     **Usage example:**
    
      ```js
      const options = {
          placeholder: 'Start writing...',
          toolbar: [
              'link',
              'image',
              'preview'
          ],
      }
      const editor = new MarkdownEditor(element, options);

### Image Alt Text Validation (`altInput`)

You can configure whether the alt text input for images in the markdown editor is required.

```js
{
  image: {
    fileInput: {
      accept: ['webp', 'avif'],
      uploadUrl: '/api/upload' // Your upload endpoint
    },
    altInput: {
      required: false // Optional: disables alt text validation (default is true)
    }
  }
}
```

* `required: true` (default): Enforces alt text input for better SEO and accessibility.
* `required: false`: Allows inserting images without alt text.

This configuration helps developers control alt text validation for each markdown editor instance. For example, when using multiple editors in the same app, you can define different alt text rules per instance.

---

**Tip:**
You can reorder or remove any toolbar buttons by modifying the toolbar array during initialization.

## Full HTML Example Implementations

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
  <textarea class="editor-container h-56" rows="6"></textarea>

  <script src="dist/markdown-editor-plugin.js"></script>
  <script>
    const editor = new MarkdownEditor('.editor-container', {
      placeholder: 'Type your markdown...',
      toolbar: [
        'bold',
        'italic',
        'strikethrough',
        'ul',
        'ol',
        'checklist',
        'link',
         {
              image: {
                  fileInput: {
                      accept: ['webp', 'avif'],
                      uploadUrl: '/api/upload', // Your upload endpoint
                  },
              }
         },
        'preview'
      ],
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
    toolbar: [
      'bold',
      'italic',
      'strikethrough',
      'ul',
      'ol',
      'checklist',
      'image',
      'link',
      'preview'
    ],
});
```
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