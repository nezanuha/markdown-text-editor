import BoldTool from '../components/toolbar/tools/BoldTool.js';
import ItalicTool from '../components/toolbar/tools/ItalicTool.js';
import StrikethroughTool from '../components/toolbar/tools/StrikethroughTool.js';
import CodeTool from '../components/toolbar/tools/CodeTool.js';
import LinkTool from '../components/toolbar/tools/LinkTool.js';
import HeadingTool from '../components/toolbar/tools/HeadingTool.js';
import ULTool from '../components/toolbar/tools/ULTool.js';
import MathTool from '../components/toolbar/tools/MathTool.js';

const DEFAULT_SHORTCUTS = [
    { key: 'b', ctrl: true,  shift: false, ToolClass: BoldTool,          label: 'Ctrl+B',       btnClass: 'bold-btn' },
    { key: 'i', ctrl: true,  shift: false, ToolClass: ItalicTool,        label: 'Ctrl+I',       btnClass: 'italic-btn' },
    { key: 'k', ctrl: true,  shift: false, ToolClass: LinkTool,          label: 'Ctrl+K',       btnClass: 'link-btn' },
    { key: '`', ctrl: true,  shift: false, ToolClass: CodeTool,          label: 'Ctrl+`',       btnClass: 'code-btn' },
    { key: 's', ctrl: true,  shift: true,  ToolClass: StrikethroughTool, label: 'Ctrl+Shift+S', btnClass: 'strikethrough-btn' },
    { key: 'l', ctrl: true,  shift: false, ToolClass: ULTool,            label: 'Ctrl+L',       btnClass: 'unordered-list-btn' },
    // Alt rather than Ctrl+Shift, which is where this editor puts its own
    // features (Alt+T for the table bar, Alt+C and friends in the find panel).
    // Typora uses Ctrl+Shift+M and Notion Ctrl+Shift+E, but Firefox spends both
    // on devtools, and a page does not get to argue. Matched on `code`, because
    // Alt composes a character on macOS and `key` would be 'µ'.
    { code: 'KeyM', alt: true, ctrl: false, shift: false, ToolClass: MathTool, label: 'Alt+M', btnClass: 'math-btn' },
];

/**
 * Keys these tools already answer to, owned by another manager.
 *
 * Undo and redo belong to UndoRedoManager, indent and outdent to
 * IndentManager, so this one never saw them and their tooltips advertised
 * nothing. The keys worked; there was just no way to find out.
 */
const BORROWED_HINTS = [
    { btnClass: 'undo-btn',    label: 'Ctrl+Z' },
    { btnClass: 'redo-btn',    label: 'Ctrl+Shift+Z' },
    { btnClass: 'indent-btn',  label: 'Tab' },
    { btnClass: 'outdent-btn', label: 'Shift+Tab' },
];

/** Turns 'Ctrl+Shift+K' into something comparable against a keydown event. */
function parseShortcut(spec) {
    const parts = String(spec).split('+').map(s => s.trim().toLowerCase());
    const key = parts.pop();
    if (!key) return null;
    return {
        key,
        ctrl: parts.includes('ctrl') || parts.includes('cmd') || parts.includes('meta'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
    };
}

export default class ShortcutManager {
    constructor(editor) {
        this.editor = editor;
        // Shortcuts declared by tools, including custom ones. Collected once,
        // after the toolbar exists, so a tool only has to set this.shortcut.
        this.toolShortcuts = (editor.toolbarInstance?.tools ?? [])
            .filter(tool => tool.shortcut)
            .map(tool => ({ tool, combo: parseShortcut(tool.shortcut) }))
            .filter(entry => entry.combo);

        // Ctrl+1/2/3 must offer the same levels the dropdown does, or the
        // keyboard inserts a heading the toolbar says is unavailable. With no
        // heading tool in the toolbar there is nothing to disagree with, so the
        // shortcuts keep working on all six.
        const headingTool = (editor.toolbarInstance?.tools ?? [])
            .find(tool => tool instanceof HeadingTool);
        this.headingLevels = headingTool?.levels ?? [1, 2, 3, 4, 5, 6];

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

        // Heading shortcuts: Ctrl+1 / Ctrl+2 / Ctrl+3, for the levels on offer
        if (ctrl && !shift && ['1', '2', '3'].includes(e.key)
            && this.headingLevels.includes(parseInt(e.key))) {
            e.preventDefault();
            new HeadingTool(this.editor).applyHeading(parseInt(e.key));
            return;
        }

        // Tool-declared shortcuts win, so a custom tool can deliberately take
        // over a combination the editor would otherwise handle.
        for (const { tool, combo } of this.toolShortcuts) {
            if (key === combo.key && ctrl === combo.ctrl && shift === combo.shift && e.altKey === combo.alt) {
                e.preventDefault();
                tool.applySyntax(e);
                return;
            }
        }

        for (const shortcut of DEFAULT_SHORTCUTS) {
            // An entry gives either `key` or `code`: `code` for the Alt ones,
            // where macOS composes a character and `key` is no longer the
            // letter that was pressed.
            const hit = shortcut.code ? e.code === shortcut.code : key === shortcut.key;
            if (hit && ctrl === shortcut.ctrl && shift === shortcut.shift
                && e.altKey === !!shortcut.alt) {
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
            const inFullscreen = this.editor.editorContainer.classList.contains('is-fullscreen');
            if (editorFocused || inFullscreen) {
                e.preventDefault();
                this.editor.editorContainer.querySelector('.preview-btn')?.click();
            }
        }
    }

    /**
     * Writes a shortcut onto a button: into the tooltip, where a pointer
     * finds it, and into aria-keyshortcuts, where assistive technology does.
     *
     * The two want different spellings. A tooltip says Ctrl, because that is
     * what is printed on the key; aria-keyshortcuts says Control, because the
     * attribute takes key names rather than abbreviations. It also takes a
     * space-separated list, which is how the heading button advertises three
     * shortcuts at once -- "Control+1 Control+2 Control+3" -- where its
     * tooltip says the shorter Ctrl+1/2/3.
     *
     * A screen reader can then offer the key alongside the button's name,
     * and a user can ask what the shortcuts on a page are and be told.
     */
    _hint(btn, tooltip, ariaKeys = tooltip.replace(/\bCtrl\b/g, 'Control')) {
        if (!btn) return;
        btn.title += ` (${tooltip})`;
        btn.setAttribute('aria-keyshortcuts', ariaKeys);
    }

    _updateTooltips() {
        const find = (cls) => this.editor.editorContainer.querySelector(`.${cls}`);

        for (const { btnClass, label } of DEFAULT_SHORTCUTS) {
            this._hint(find(btnClass), label);
        }

        const headingKeys = this.headingLevels.filter(n => n <= 3);
        if (headingKeys.length) {
            this._hint(find('heading-btn'), `Ctrl+${headingKeys.join('/')}`,
                headingKeys.map(n => `Control+${n}`).join(' '));
        }

        this._hint(find('preview-btn'), 'F11');

        for (const { btnClass, label } of BORROWED_HINTS) {
            this._hint(find(btnClass), label);
        }

        // Tool-declared shortcuts get the same treatment as the built-ins
        for (const { tool } of this.toolShortcuts) {
            this._hint(tool.button, tool.shortcut);
        }

        // The title is the accessible name for most tools, since the icon is
        // aria-hidden and there is no text in the button. It works, but it is
        // the weakest source in the naming algorithm, and the three tools that
        // build their own buttons set aria-label instead, so the toolbar was
        // named two different ways. Mirroring here rather than in createButton
        // is what keeps the shortcut in the name: the hints above are appended
        // after the button is built.
        for (const btn of this.editor.editorContainer.querySelectorAll('.markdown-btn')) {
            if (btn.title) btn.setAttribute('aria-label', btn.title);
        }
    }

    destroy() {
        this.editor.usertextarea.removeEventListener('keydown', this._handler);
        document.removeEventListener('keydown', this._docHandler);
    }
}
