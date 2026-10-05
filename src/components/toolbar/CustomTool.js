import Tool from './Tool.js';

/**
 * Wraps the declarative form of a custom tool:
 *
 *   { custom: { title, icon, action(editor, event) {} } }
 *
 * so writing a toolbar button needs no class and no knowledge of Tool. The
 * class form stays available for tools that build their own markup, such as a
 * dropdown, which this cannot express.
 */
class CustomTool extends Tool {
    constructor(editor, config = {}) {
        super(editor, config.title || 'Custom');
        this.action = config.action;
        this.button = typeof this.action === 'function'
            ? this.createButton(config.icon || '')
            : null;
        // A tool that will not render must not claim a keyboard shortcut either,
        // or pressing it swallows the keystroke and throws on every press.
        this.shortcut = this.button ? config.shortcut : undefined;  // e.g. 'Ctrl+Shift+K'

        if (!this.button) {
            console.warn('[MarkdownEditor] A custom tool needs an action function. Skipping it.', config);
        }
    }

    applySyntax(event) {
        this.action(this.editor, event);
    }
}

export default CustomTool;
