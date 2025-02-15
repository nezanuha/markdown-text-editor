// #markdown\Toolbar\index.js
import BoldTool from './tools/BoldTool.js';
import ItalicTool from './tools/ItalicTool.js';
import StrikethroughTool from './tools/StrikethroughTool.js';
import ULTool from './tools/ULTool.js';
import OLTool from './tools/OLTool.js';
import PreviewTool from './tools/PreviewTool.js'
import CheckListTool from './tools/CheckListTool.js';

class Toolbar {
    constructor(editor, options) {
        this.editor = editor;
        this.options = options;
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'toolbar flex space-x-1.5 p-1.5 bg-stone-100 dark:bg-stone-900 dark:text-stone-200 border-b border-stone-200 dark:border-stone-700';
        this.init();
    }

    init() {
        const toolMapping = {
            ul: ULTool,
            ol: OLTool,
            checklist: CheckListTool,
            bold: BoldTool,
            italic: ItalicTool,
            strikethrough: StrikethroughTool,
            preview: PreviewTool
        };

        this.options.forEach(tool => {
            const ToolClass = toolMapping[tool];
            if (ToolClass) {
                const toolInstance = new ToolClass(this.editor);
                this.toolbar.appendChild(toolInstance.button);
            }
        });

        this.editor.editorContainer.insertBefore(this.toolbar, this.editor.markdownEditorDiv);
    }
}

export default Toolbar;
