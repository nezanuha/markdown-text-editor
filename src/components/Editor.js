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
            "textarea",
            "focus:ring-0",
            "focus:outline-0",
            "border-0",
            "p-1.5",
            "max-w-full",
            "size-full",
            "bg-transparent",
            "outline-0",
            "appearance-none",
            "prose",
            "prose-sm",
            "md:prose-base",
            "dark:prose-invert",
            "overflow-y-auto",
        );
        if (!this.usertextarea.hasAttribute('placeholder')) {
            this.usertextarea.placeholder = this.options.placeholder || 'Write your markdown...';
        }
    }

    buildEditorLayout() {
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = `
            markdown-editor-wrapper
            surface surface-1 surface-outline surface-rounded
            overflow-hidden
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
            textarea-wrapper
            h-full
            p-2
            surface
            grid
            after:px-3.5
            after:py-2.5
            after:text-inherit
            [&>textarea]:resize-none
            [&>textarea]:[grid-area:1/1/2/2]
            after:[grid-area:1/1/2/2]
            after:whitespace-pre-wrap
            after:invisible
            after:content-[attr(data-cloned-val)_'_']
            after:border
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