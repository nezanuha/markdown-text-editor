import '../styles/main.css';
import { marked } from 'marked';
import Toolbar from './toolbar/Toolbar.js';
import Preview from './Preview.js';
import UndoRedoManager from '../utils/UndoRedoManager.js';

marked.setOptions({
    breaks: true
});

class MarkdownEditor {
    constructor(selector, options = {}) {
        this.usertextarea = typeof selector === 'string' ? document.querySelector(selector) : selector;
        this.options = options;
        this.preview = this.options.toolbar.includes('preview');
        this.init();

        // Initialize UndoRedoManager if 'undo' or 'redo' is in the toolbar
        if (this.options.toolbar.includes('undo') || this.options.toolbar.includes('redo')) {
            this.undoRedoManager = new UndoRedoManager(this);
        }
    }

    init() {
        this.createEditor();
        if (this.options.toolbar) this.addToolbar();
    }

    createEditor() {
        if (!this.isTextareaValid()) return;

        this.applyDefaultAttributes();
        this.buildEditorLayout();
        this.addInputListener();
        this.render();
    }

    isTextareaValid() {
        return this.usertextarea.tagName === 'TEXTAREA';
    }

    applyDefaultAttributes() {
        this.usertextarea.classList.add(
            "fj:dark:[scrollbar-color:var(--color-stone-600)_transparent]",
            "fj:focus:ring-0",
            "fj:focus:outline-0",
            "fj:border-0",
            "fj:p-1.5",
            "fj:max-w-full",
            "fj:size-full",
            "fj:bg-transparent",
            "fj:outline-0",
            "fj:appearance-none",
            "fj:prose",
            "fj:prose-sm",
            "fj:md:prose-base",
            "fj:dark:prose-invert",
            "fj:text-stone-700",
            "fj:dark:text-stone-200",
            "fj:overflow-y-auto",
            "fj:placeholder:text-stone-300",
            "fj:dark:placeholder:text-stone-600"
        );
        if (!this.usertextarea.hasAttribute('placeholder')) {
            this.usertextarea.placeholder = this.options.placeholder || 'Write your markdown...';
        }
    }

    buildEditorLayout() {
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = `
            markdown-editor-wrapper
            fj:border border-stone-200
            fj:dark:border-stone-700
            fj:rounded-md
            fj:overflow-hidden
        `;
        this.usertextarea.parentNode.insertBefore(this.editorContainer, this.usertextarea);

        this.markdownEditorDiv = document.createElement('div');
        this.markdownEditorDiv.className = `editor-layout relative`;
        this.editorContainer.appendChild(this.markdownEditorDiv);

        this.addTextareaWrapper();
        if (this.preview) this.addPreviewWrapper();
    }

    addTextareaWrapper() {
        const textareaContainer = document.createElement('div');
        textareaContainer.className = `
            fj:textarea-wrapper
            fj:h-full
            fj:p-2
            fj:bg-white
            fj:dark:bg-stone-900
            fj:grid
            fj:after:px-3.5
            fj:after:py-2.5
            fj:after:text-inherit
            fj:[&>textarea]:resize-none
            fj:[&>textarea]:[grid-area:1/1/2/2]
            fj:after:[grid-area:1/1/2/2]
            fj:after:whitespace-pre-wrap
            fj:after:invisible
            fj:after:content-[attr(data-cloned-val)_'_']
            fj:after:border
        `;
        textareaContainer.appendChild(this.usertextarea);
        this.markdownEditorDiv.appendChild(textareaContainer);
    }

    

    addPreviewWrapper() {
        const previewInstance = new Preview(this.markdownEditorDiv);
        this.previewContent = previewInstance.getPreviewContent();
    }

    addInputListener() {
        this.usertextarea.addEventListener('input', () => this.render());
        this.usertextarea.addEventListener('scroll', () => {
            const textarea = this.usertextarea;
            const previewPane = this.previewContent;
        
            // Calculate the proportion of the textarea that has been scrolled
            const textareaScrollRatio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
        
            // Apply the same scroll ratio to the preview pane
            previewPane.scrollTop = textareaScrollRatio * (previewPane.scrollHeight - previewPane.clientHeight);
        });
    }

    addToolbar() {
        new Toolbar(this, this.options.toolbar || ['bold', 'italic', 'strikethrough']);
    }

    insertText(text) {
        const { selectionStart, selectionEnd } = this.usertextarea;
        const value = this.usertextarea.value;
        this.usertextarea.value = `${value.substring(0, selectionStart)}${text}${value.substring(selectionEnd)}`;
        this.usertextarea.focus();
        this.usertextarea.setSelectionRange(selectionStart, selectionStart + text.length);

        // Scroll the textarea to the inserted text
        this.scrollToView();

        this.render();
    }

    scrollToView() {
        const textarea = this.usertextarea;
    
        // Calculate the position of the inserted text
        const selectionStart = textarea.selectionStart;
    
        // Get the line height (height of each row of text)
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        
        // Get how many rows fit into the visible area of the textarea
        const rowsInView = Math.floor(textarea.clientHeight / lineHeight);
    
        // Calculate the current line number of the selectionStart
        const currentLine = Math.floor(selectionStart / textarea.cols);
    
        // Scroll to the line number that places the inserted text in the center
        const targetScrollTop = (currentLine - Math.floor(rowsInView / 2)) * lineHeight;
    
        // Adjust scrollTop to center the cursor's line in the view
        textarea.scrollTop = targetScrollTop;
    }
    

    render() {
        const html = marked(this.usertextarea.value);
        if (this.preview) this.previewContent.innerHTML = html;
    }
}

export default MarkdownEditor;