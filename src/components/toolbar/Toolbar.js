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

class Toolbar {
    constructor(editor, options) {
        this.editor = editor;
        this.options = options;
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'toolbar fj:flex fj:space-x-1.5 fj:p-1.5 fj:bg-stone-100 fj:dark:bg-stone-800 fj:text-stone-700 fj:dark:text-stone-200 fj:border-b fj:border-stone-200 fj:dark:border-stone-700 fj:overflow-x-auto';
        this.init();
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
            link: LinkTool,
            image: ImageTool,
            undo: UndoTool,
            redo: RedoTool
        };

        // Append all tools except preview
        // this.options.forEach(tool => {
        //     if (tool !== 'preview') {
        //         const ToolClass = toolMapping[tool];
        //         if (ToolClass) {
        //             const toolInstance = new ToolClass(this.editor);
        //             this.toolbar.appendChild(toolInstance.button); // Directly append to toolbar
        //         }
        //     }
        // });

        this.options.forEach(tool => {
            let ToolClass, config;
        
            if (typeof tool === 'string') {
                ToolClass = toolMapping[tool];
            } else if (typeof tool === 'object') {
                const toolName = Object.keys(tool)[0];
                config = tool[toolName];
                ToolClass = toolMapping[toolName];
            }
        
            if (ToolClass) {
                const toolInstance = new ToolClass(this.editor, config);
                this.toolbar.appendChild(toolInstance.button);
            }
        });

        // Append preview button at the end
        if (this.options.includes('preview')) {
            const previewToolInstance = new PreviewTool(this.editor);
            this.toolbar.appendChild(previewToolInstance.button); // Directly append to toolbar at the end
        }

        this.editor.editorContainer.insertBefore(this.toolbar, this.editor.markdownEditorDiv);
    }
}

export default Toolbar;
