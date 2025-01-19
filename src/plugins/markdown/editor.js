// #markdown\editor.js
import './styles/main.css';
import { marked } from 'marked';
import Toolbar from './Toolbar/index.js';
import Preview from './preview.js';

marked.setOptions({
    breaks: true
});

class MarkdownEditor {
    constructor(selector, options = {}) {
        this.usertextarea = typeof selector === 'string' ? document.querySelector(selector) : selector;
        this.options = options;
        this.preview = this.options.toolbar.includes('preview');
        this.init();
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
            "text-stone-700",
            "dark:text-stone-200",
            "overflow-y-auto"
        );
        if (!this.usertextarea.hasAttribute('placeholder')) {
            this.usertextarea.placeholder = this.options.placeholder || 'Write your markdown...';
        }
    }

    buildEditorLayout() {
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = `
            markdown-editor-wrapper
            border border-stone-200
            dark:border-stone-700
            rounded-md
            overflow-hidden
        `;
        this.usertextarea.parentNode.insertBefore(this.editorContainer, this.usertextarea);

        this.markdownEditorDiv = document.createElement('div');
        this.markdownEditorDiv.className = `editor-layout`;
        this.editorContainer.appendChild(this.markdownEditorDiv);

        this.addTextareaWrapper();
        if (this.preview) this.addPreviewWrapper();
    }

    addTextareaWrapper() {
        const textareaContainer = document.createElement('div');
        textareaContainer.className = `
            textarea-wrapper
            p-2
            bg-white
            dark:bg-stone-800
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
        const preview = new Preview(this.markdownEditorDiv);
        this.previewContent = preview.getPreviewContent();
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
        this.render();
    }

    render() {
        const html = marked(this.usertextarea.value);
        this.previewContent.innerHTML = html;
    }
}

export default MarkdownEditor;