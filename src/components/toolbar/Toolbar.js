import BoldTool from './tools/BoldTool.js';
import ItalicTool from './tools/ItalicTool.js';
import StrikethroughTool from './tools/StrikethroughTool.js';
import ULTool from './tools/ULTool.js';
import OLTool from './tools/OLTool.js';
import PreviewTool from './tools/PreviewTool.js'
import CheckListTool from './tools/CheckListTool.js';
import BlockQuoteTool from './tools/BlockQuoteTool.js';
import LinkTool from './tools/LinkTool.js'
import HeadingTool from './tools/HeadingTool.js';
import ImageTool from './tools/ImageTool.js';
import UndoTool from './tools/UndoTool.js';
import RedoTool from './tools/RedoTool.js';
import IndentTool from './tools/IndentTool.js';
import OutdentTool from './tools/OutdentTool.js';
import CodeTool from './tools/CodeTool.js';
import MathTool from './tools/MathTool.js';
import CodeBlockTool from './tools/CodeBlockTool.js';
import HrTool from './tools/HrTool.js';
import TableTool from './tools/TableTool.js';
import VariableTool from './tools/VariableTool.js';
import CustomTool from './CustomTool.js';

class Toolbar {
    /**
     * @param standalone Built for another textarea by createToolbar(), so it
     *                   neither adds the preview button nor mounts itself.
     */
    constructor(editor, options, { standalone = false } = {}) {
        this.editor = editor;
        this.options = options;
        this.standalone = standalone;
        this.tools = [];
        this.toolbar = document.createElement('div');
        this.toolbar.className = standalone
            ? 'toolbar not-prose fj:flex fj:items-center fj:gap-x-1'
            : 'toolbar not-prose fj:me-surface fj:me-surface-outline fj:border-base-soft fj:border-0 fj:border-b fj:flex fj:items-center fj:gap-x-1 fj:p-1.5 fj:overflow-x-auto';
        this.toolbar.setAttribute('role', 'toolbar');
        this.toolbar.setAttribute('aria-label', editor.label('Editor toolbar'));
        this.init();
    }

    /** Lets the editor tear down tools that registered listeners of their own. */
    destroy() {
        this.tools.forEach(tool => tool.destroy?.());
        if (this._onFocusIn) this.toolbar.removeEventListener('focusin', this._onFocusIn);
        if (this._onKey) this.toolbar.removeEventListener('keydown', this._onKey);
    }

    init() {
        const toolMapping = {
            heading: HeadingTool,
            ul: ULTool,
            ol: OLTool,
            checklist: CheckListTool,
            bold: BoldTool,
            italic: ItalicTool,
            strikethrough: StrikethroughTool,
            blockquote: BlockQuoteTool,
            code: CodeTool,
            math: MathTool,
            codeblock: CodeBlockTool,
            hr: HrTool,
            table: TableTool,
            link: LinkTool,
            image: ImageTool,
            undo: UndoTool,
            redo: RedoTool,
            indent: IndentTool,
            outdent: OutdentTool,
            variables: VariableTool
        };

        this.options.forEach(tool => {
            let ToolClass, config;

            if (typeof tool === 'string') {
                ToolClass = toolMapping[tool];
            } else if (typeof tool === 'function') {
                // A class of your own, extending MarkdownEditor.Tool
                ToolClass = tool;
            } else if (tool && typeof tool.tool === 'function') {
                // The same, with configuration: { tool: MyTool, config: {...} }
                ToolClass = tool.tool;
                config = tool.config;
            } else if (tool && tool.custom) {
                // Declarative: { custom: { title, icon, action } }, no class needed
                ToolClass = CustomTool;
                config = tool.custom;
            } else if (tool && typeof tool === 'object') {
                // `tool &&` because typeof null is 'object', and Object.keys
                // on it threw "Cannot convert undefined or null to object" --
                // one stray comma in the array and the editor was gone.
                const toolName = Object.keys(tool)[0];
                config = tool[toolName];
                ToolClass = toolMapping[toolName];
            }

            // An entry nothing recognises is skipped rather than silently
            // dropped, so a typo in a tool name is findable.
            if (!ToolClass && tool !== undefined && tool !== null) {
                console.warn('[MarkdownEditor] toolbar: no tool matches '
                    + JSON.stringify(typeof tool === 'object' ? Object.keys(tool)[0] : tool)
                    + ', skipping it.');
            }

            if (ToolClass) {
                const toolInstance = new ToolClass(this.editor, config);
                this.tools.push(toolInstance);
                // A tool may decline to render, e.g. variables with nothing configured
                if (toolInstance.button) this.toolbar.appendChild(toolInstance.button);
            }
        });

        // A standalone toolbar belongs to someone else's textarea: no preview
        // button, and the caller decides where to put it. It still gets the
        // keyboard handling, since it is the same control.
        if (this.standalone) { this._keyboard(); return; }

        // Append preview button at the end
        if (this.options.includes('preview')) {
            const previewToolInstance = new PreviewTool(this.editor);
            this.editor.previewTool = previewToolInstance;
            this.toolbar.appendChild(previewToolInstance.button);
        }

        this.editor.editorContainer.insertBefore(this.toolbar, this.editor.markdownEditorDiv);
        this._keyboard();
    }

    /** Every tool button, in the order they sit in the bar. */
    _buttons() {
        // Only the toolbar's own buttons: the menu items inside the heading,
        // variables and table popovers are not `markdown-btn`, and walking into
        // them would take the arrow keys away from the menus.
        return [...this.toolbar.querySelectorAll('.markdown-btn')];
    }

    /**
     * One tab stop for the whole toolbar, the arrow keys inside it.
     *
     * It has declared `role="toolbar"` all along, which tells a screen reader
     * the arrow keys move between the tools. They did not: every button was its
     * own tab stop, so crossing the toolbar cost nineteen presses of Tab on the
     * default set, and a screen reader in its own navigation mode captured the
     * arrows and nothing happened. This is the pattern the table bar already
     * follows.
     */
    _keyboard() {
        const roving = (target) => {
            const items = this._buttons();
            const enabled = items.filter(b => !b.disabled);
            // A disabled tool must not hold the only tab stop, or the toolbar
            // cannot be entered at all. Preview disables itself on a phone.
            const chosen = (target && !target.disabled) ? target
                : (enabled.includes(this._stop) ? this._stop : enabled[0]);
            this._stop = chosen;
            for (const b of items) b.tabIndex = b === chosen ? 0 : -1;
        };
        roving(null);

        this._onFocusIn = (e) => {
            if (e.target.classList?.contains('markdown-btn')) roving(e.target);
        };
        this._onKey = (e) => {
            // Ignore anything coming from inside a popover this toolbar owns:
            // those menus want their own arrow keys.
            if (!e.target.classList?.contains('markdown-btn')) return;

            const items = this._buttons().filter(b => !b.disabled);
            const i = items.indexOf(e.target);
            if (i === -1) return;

            const to = {
                ArrowRight: i + 1,
                ArrowLeft: i - 1,
                Home: 0,
                End: items.length - 1,
            }[e.key];
            if (to === undefined) return;

            e.preventDefault();
            // Wraps, unlike the size grid: a toolbar is a ring of equals, where
            // the grid is a shape whose corners mean something.
            const next = items[(to + items.length) % items.length];
            roving(next);
            next.focus();
        };

        this.toolbar.addEventListener('focusin', this._onFocusIn);
        this.toolbar.addEventListener('keydown', this._onKey);
        this._roving = roving;
    }
}

export default Toolbar;
