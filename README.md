# MarkdownEditor Plugin Documentation

This document explains how to use the **MarkdownEditor Plugin**, a customizable, reusable markdown editor with toolbar functionality that allows options like **bold** and **italic** formatting. Users can dynamically set which tools to display and in what order. The plugin is built with Tailwind CSS for styling and provides easy integration into any project.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [Configuration Options](#configuration-options)
- [Toolbar Options](#toolbar-options)
- [Methods](#methods)
- [Example Usage](#example-usage)
- [License](#license)

## Installation

To install the plugin in your project, you can include the plugin JavaScript file and its associated styles.

1. **Install via NPM** (for bundling tools like Webpack):
   ```
   npm install markdown-text-editor
   ```

## Usage


Import the `MarkdownEditor` class from markdown-text-editor:


```
import MarkdownEditor from "markdown-text-editor";
```

## Basic Example:

To initialize the Markdown editor, you need to add `textarea` tag in your HTML and initialize the editor by passing the container's ID or class and options.

### HTML:
```html
<textarea class="editor-container"></textarea>
```

### CSS Setup

#### Using TailwindCSS

If you are using **TailwindCSS**, add the following configuration to your `tailwind.config.js` file:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    // './src/**/*.{html,js}',
    'node_modules/markdown-text-editor/**/*.js',
  ]
}
```

#### Without TailwindCSS
If you are not using TailwindCSS, you can directly import the CSS file into your project:

```javascript
import 'markdown-text-editor/dist/markdown-text-editor.css';
```

#### Using CDN
For projects using a CDN, you can include the following links:

**JavaScript:**
```javascript
<script src="https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.js"></script>
```

**CSS:**
```javascript
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markdown-text-editor/dist/markdown-text-editor.min.css">
```


#### Using a bundler e.g. Webpack:
```javascript
import MarkdownEditor from 'markdown-text-editor';

const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Write your markdown...',
    toolbar: ['preview', 'bold', 'italic'], // Define the tools you want in the toolbar
});
```

This will create a markdown editor with a toolbar at the top and a preview area below the text input.

### Dynamic Toolbar:

You can specify which formatting options you want in the toolbar. The plugin supports different tools that can be reordered.

**For example:**
```javascript
const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Start writing...',
    toolbar: ['bold', 'italic', 'strikethrough', 'preview'],
});
```

## Configuration Options

You can customize the Markdown editor by passing an `options` object when initializing it.

| Option      | Type     | Default                    | Description                                         |
|-------------|----------|----------------------------|-----------------------------------------------------|
| `placeholder` | `string` | `'Write your markdown...'` | The placeholder text for the textarea.               |
| `toolbar`   | `array`  | `['bold', 'italic', 'strikethrough']`        | The tools to display in the toolbar and their order. |

## Toolbar Options

The toolbar can be customized to include the following options (you can add more tools as needed):

- `bold`: Adds a bold button to the toolbar.
- `italic`: Adds an italic button to the toolbar.

Example:

```javascript
const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Your markdown here...',
    toolbar: ['preview', 'italic', 'bold'], // Shows italic first, then bold
});
```

## Example Usage

### Full Example:

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
  <textarea class="editor"></textarea>

    <script src="dist/markdown-editor-plugin.js"></script>
    <script>
        const editor = new MarkdownEditor('.editor-container', {
            placeholder: 'Type some markdown...',
            toolbar: ['preview', 'bold', 'italic'] // Toolbar order: bold first, then italic
        });
    </script>
</body>
</html>
```

### Webpack Example:

To use the plugin with Webpack, import the plugin and initialize it as shown below:

```javascript
import MarkdownEditor from 'markdown-text-editor';

const editor = new MarkdownEditor('.editor-container', {
    placeholder: 'Write markdown...',
    toolbar: ['preview', 'bold', 'italic'],  // Custom toolbar options
});
```

### Customizing Styles with Tailwind:

You can modify the appearance of the editor and toolbar using Tailwind utility classes. For example:

- The toolbar and editor area are styled with Tailwind by default.
- You can override these classes in your custom Tailwind config to suit your design.

## Contribute to the Project

If you're interested in improving this editor, I welcome contributions! Feel free to open issues or submit pull requests with bug fixes, features, or enhancements. Your contributions will help keep the project active and thriving.

Thank you for your support and consideration. Let’s continue to improve Markdown editing together!

## A Product of Nezanuha