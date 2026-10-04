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
        this.shortcut = config.shortcut;       // e.g. 'Ctrl+Shift+K'
        this.button = typeof this.action === 'function'
            ? this.createButton(config.icon || '')
            : null;

        if (!this.button) {
            console.warn('[MarkdownEditor] A custom tool needs an action function. Skipping it.', config);
        }
    }

    applySyntax(event) {
        this.action(this.editor, event);
    }
}

export default CustomTool;
