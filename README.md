# markdownEditor Plugin Documentation

This document explains how to use the **markdownEditor Plugin**, a customizable, reusable markdown editor with toolbar functionality that allows options like **bold** and **italic** formatting. Users can dynamically set which tools to display and in what order. The plugin is built with Tailwind CSS for styling and provides easy integration into any project.

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


Import the `markdownEditor` class from nezanuha/markdown-editor:


```
import { markdownEditor } from "nezanuha/markdown-editor";
```

### Basic Example:

To initialize the Markdown editor, you need an empty container (like a `div`) in your HTML and initialize the editor by passing the container's ID and options.

#### HTML:
```html
<div id="editor-container"></div>
```

#### JavaScript:
```javascript
import { markdownEditor } from 'nezanuha/markdown-editor';

const editor = new markdownEditor('editor-container', {
    placeholder: 'Write your markdown...',
    toolbar: ['bold', 'italic'], // Define the tools you want in the toolbar
});
```

This will create a markdown editor with a toolbar at the top and a preview area below the text input.

### Dynamic Toolbar:

You can specify which formatting options you want in the toolbar. The plugin supports different tools that can be reordered.

For example:
```javascript
const editor = new markdownEditor('editor-container', {
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
const editor = new markdownEditor('editor-container', {
    placeholder: 'Your markdown here...',
    toolbar: ['italic', 'bold'], // Shows italic first, then bold
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
    <div id="editor-container"></div>

    <script src="dist/markdown-editor-plugin.js"></script>
    <script>
        const editor = new markdownEditor('editor-container', {
            placeholder: 'Type some markdown...',
            toolbar: ['bold', 'italic'] // Toolbar order: bold first, then italic
        });
    </script>
</body>
</html>
```

### Webpack Example:

To use the plugin with Webpack, import the plugin and initialize it as shown below:

```javascript
import { markdownEditor } from 'nezanuha/markdown-editor';

const editor = new markdownEditor('editor-container', {
    placeholder: 'Write markdown...',
    toolbar: ['bold', 'italic'],  // Custom toolbar options
});
```

### Customizing Styles with Tailwind:

You can modify the appearance of the editor and toolbar using Tailwind utility classes. For example:

- The toolbar and editor area are styled with Tailwind by default.
- You can override these classes in your custom Tailwind config to suit your design.

## Conclusion

This **markdownEditor Plugin** allows easy setup of markdown editing with dynamic toolbar controls, making it flexible and reusable for various projects.