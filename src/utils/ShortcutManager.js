import BoldTool from '../components/toolbar/tools/BoldTool.js';
import ItalicTool from '../components/toolbar/tools/ItalicTool.js';
import StrikethroughTool from '../components/toolbar/tools/StrikethroughTool.js';
import CodeTool from '../components/toolbar/tools/CodeTool.js';
import LinkTool from '../components/toolbar/tools/LinkTool.js';
import HeadingTool from '../components/toolbar/tools/HeadingTool.js';
import ULTool from '../components/toolbar/tools/ULTool.js';

const DEFAULT_SHORTCUTS = [
    { key: 'b', ctrl: true,  shift: false, ToolClass: BoldTool,          label: 'Ctrl+B',       btnClass: 'bold-btn' },
    { key: 'i', ctrl: true,  shift: false, ToolClass: ItalicTool,        label: 'Ctrl+I',       btnClass: 'italic-btn' },
    { key: 'k', ctrl: true,  shift: false, ToolClass: LinkTool,          label: 'Ctrl+K',       btnClass: 'link-btn' },
    { key: '`', ctrl: true,  shift: false, ToolClass: CodeTool,          label: 'Ctrl+`',       btnClass: 'code-btn' },
    { key: 's', ctrl: true,  shift: true,  ToolClass: StrikethroughTool, label: 'Ctrl+Shift+S', btnClass: 'strikethrough-btn' },
    { key: 'l', ctrl: true,  shift: false, ToolClass: ULTool,            label: 'Ctrl+L',       btnClass: 'ul-btn' },
];

export default class ShortcutManager {
    constructor(editor) {
        this.editor = editor;
        this._handler = this._onKeyDown.bind(this);
        this._docHandler = this._onDocKeyDown.bind(this);
        editor.usertextarea.addEventListener('keydown', this._handler);
        document.addEventListener('keydown', this._docHandler);
        this._updateTooltips();
    }

    _onKeyDown(e) {
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const key = e.key.toLowerCase();

        // Fullscreen: Ctrl+Shift+F
        if (ctrl && shift && key === 'f') {
            e.preventDefault();
            this.editor.editorContainer.querySelector('.preview-btn')?.click();
            return;
        }

        // Heading shortcuts: Ctrl+1 / Ctrl+2 / Ctrl+3
        if (ctrl && !shift && ['1', '2', '3'].includes(e.key)) {
            e.preventDefault();
            new HeadingTool(this.editor).applyHeading(parseInt(e.key));
            return;
        }

        for (const shortcut of DEFAULT_SHORTCUTS) {
            if (key === shortcut.key && ctrl === shortcut.ctrl && shift === shortcut.shift) {
                e.preventDefault();
                new shortcut.ToolClass(this.editor).applySyntax(e);
                return;
            }
        }
    }

    _onDocKeyDown(e) {
        // F11 → toggle fullscreen when editor is focused or already in fullscreen
        if (e.key === 'F11') {
            const editorFocused = this.editor.editorContainer.contains(document.activeElement);
            const inFullscreen = this.editor.editorContainer.classList.contains('fj:h-dvh');
            if (editorFocused || inFullscreen) {
                e.preventDefault();
                this.editor.editorContainer.querySelector('.preview-btn')?.click();
            }
        }
    }

    _updateTooltips() {
        for (const { btnClass, label } of DEFAULT_SHORTCUTS) {
            const btn = this.editor.editorContainer.querySelector(`.${btnClass}`);
            if (btn) btn.title += ` (${label})`;
        }
        const headingBtn = this.editor.editorContainer.querySelector('.heading-btn');
        if (headingBtn) headingBtn.title += ' (Ctrl+1/2/3)';
        const previewBtn = this.editor.editorContainer.querySelector('.preview-btn');
        if (previewBtn) previewBtn.title += ' (F11)';
    }

    destroy() {
        this.editor.usertextarea.removeEventListener('keydown', this._handler);
        document.removeEventListener('keydown', this._docHandler);
    }
}
