import BoldTool from '../components/toolbar/tools/BoldTool.js';
import ItalicTool from '../components/toolbar/tools/ItalicTool.js';
import StrikethroughTool from '../components/toolbar/tools/StrikethroughTool.js';
import CodeTool from '../components/toolbar/tools/CodeTool.js';
import LinkTool from '../components/toolbar/tools/LinkTool.js';

const DEFAULT_SHORTCUTS = [
    { key: 'b',     ctrl: true,  shift: false, ToolClass: BoldTool,          label: 'Ctrl+B',       btnClass: 'bold-btn' },
    { key: 'i',     ctrl: true,  shift: false, ToolClass: ItalicTool,        label: 'Ctrl+I',       btnClass: 'italic-btn' },
    { key: 'k',     ctrl: true,  shift: false, ToolClass: LinkTool,          label: 'Ctrl+K',       btnClass: 'link-btn' },
    { key: '`',     ctrl: true,  shift: false, ToolClass: CodeTool,          label: 'Ctrl+`',       btnClass: 'code-btn' },
    { key: 's',     ctrl: true,  shift: true,  ToolClass: StrikethroughTool, label: 'Ctrl+Shift+S', btnClass: 'strikethrough-btn' },
];

export default class ShortcutManager {
    constructor(editor) {
        this.editor = editor;
        this._handler = this._onKeyDown.bind(this);
        editor.usertextarea.addEventListener('keydown', this._handler);
        this._updateTooltips();
    }

    _onKeyDown(e) {
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const key = e.key.toLowerCase();

        for (const shortcut of DEFAULT_SHORTCUTS) {
            if (key === shortcut.key && ctrl === shortcut.ctrl && shift === shortcut.shift) {
                e.preventDefault();
                const tool = new shortcut.ToolClass(this.editor);
                tool.applySyntax(e);
                return;
            }
        }
    }

    _updateTooltips() {
        for (const { btnClass, label } of DEFAULT_SHORTCUTS) {
            const btn = this.editor.editorContainer.querySelector(`.${btnClass}`);
            if (btn) btn.title += ` (${label})`;
        }
    }

    destroy() {
        this.editor.usertextarea.removeEventListener('keydown', this._handler);
    }
}
