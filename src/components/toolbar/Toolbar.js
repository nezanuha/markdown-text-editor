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
            } else if (typeof tool === 'object') {
                const toolName = Object.keys(tool)[0];
                config = tool[toolName];
                ToolClass = toolMapping[toolName];
            }

            if (ToolClass) {
                const toolInstance = new ToolClass(this.editor, config);
                this.tools.push(toolInstance);
                // A tool may decline to render, e.g. variables with nothing configured
                if (toolInstance.button) this.toolbar.appendChild(toolInstance.button);
            }
        });

        // A standalone toolbar belongs to someone else's textarea: no preview
        // button, and the caller decides where to put it.
        if (this.standalone) return;

        // Append preview button at the end
        if (this.options.includes('preview')) {
            const previewToolInstance = new PreviewTool(this.editor);
            this.editor.previewTool = previewToolInstance;
            this.toolbar.appendChild(previewToolInstance.button);
        }

        this.editor.editorContainer.insertBefore(this.toolbar, this.editor.markdownEditorDiv);
    }
}

export default Toolbar;
