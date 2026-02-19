import '../styles/main.css';
import { marked } from 'marked';
import Toolbar from './toolbar/Toolbar.js';
import Preview from './Preview.js';
import UndoRedoManager from '../utils/UndoRedoManager.js';
import IndentManager from '../utils/IndentManager.js';
import ListManager from '../utils/ListManager.js';

marked.setOptions({
    breaks: true
});

class MarkdownEditor {
    constructor(selector, options = {}) {
        this.usertextarea = typeof selector === 'string' ? document.querySelector(selector) : selector;
        this.options = options;
        this.mode = options.mode || 'plain';
        this.preview = (this.options.toolbar) ? this.options.toolbar.includes('preview') : true;
        this.previewTimer = null;
        this.init();
        this.undoRedoManager = new UndoRedoManager(this);
        this.listManager = new ListManager(this);
        this.indentManager = new IndentManager(this);
    }

    init() {
        this.createEditor();
        this.addToolbar();
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
            "fj:focus:ring-0",
            "fj:focus:outline-0",
            "fj:border-0",
            "fj:px-4",
            "fj:py-2",
            "fj:max-w-full",
            "fj:size-full",
            "fj:bg-transparent",
            "fj:outline-0",
            "fj:appearance-none",
            "fj:overflow-y-auto",
        );
        if (!this.usertextarea.hasAttribute('placeholder')) {
            this.usertextarea.placeholder = this.options.placeholder || 'Write your markdown...';
        }
    }

    buildEditorLayout() {
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = `
            markdown-editor-wrapper
            fj:surface
            fj:surface-outline
            fj:surface-rounded
            fj:overflow-hidden
        `;
        this.usertextarea.parentNode.insertBefore(this.editorContainer, this.usertextarea);

        this.markdownEditorDiv = document.createElement('div');
        this.markdownEditorDiv.className = `editor-layout fj:relative fj:grid fj:grid-cols-1`;
        this.editorContainer.appendChild(this.markdownEditorDiv);

        this.addTextareaWrapper();
        if (this.preview) this.addPreviewWrapper();
    }

    addTextareaWrapper() {
        const textareaContainer = document.createElement('div');
        textareaContainer.className = `
            textarea-wrapper
            not-prose
            fj:surface
            fj:h-full
            fj:grid
        `;

        if(this.mode == 'hybrid'){
            this.displayLayer = document.createElement('div');
            this.displayLayer.setAttribute('data-placeholder', this.usertextarea.placeholder);
            this.displayLayer.setAttribute("aria-hidden", true);
            this.displayLayer.className = `
                display-layer
                fj:px-4
                fj:py-2
                fj:whitespace-pre-wrap fj:break-words 
                fj:pointer-events-none 
                fj:[grid-area:1/1/2/2]
                fj:size-full
                fj:m-0
                fj:box-border
                fj:z-0
                fj:overflow-y-auto
                fj:empty:after:content-[attr(data-placeholder)]
                fj:empty:after:absolute
                fj:empty:after:inset-0
                fj:empty:after:px-4
                fj:empty:after:py-2
                fj:empty:after:text-[CanvasText]
                fj:empty:after:opacity-50
            `;

            this.usertextarea.className += `
                fj:text-transparent 
                fj:caret-primary
                fj:resize-none
                fj:outline-none
                fj:[grid-area:1/1/2/2]
                fj:m-0
                fj:box-border
                fj:relative
                fj:z-10 
            `;

            textareaContainer.appendChild(this.displayLayer);
        }

        textareaContainer.appendChild(this.usertextarea);
        this.markdownEditorDiv.appendChild(textareaContainer);
    }

    

    addPreviewWrapper() {
        const previewInstance = new Preview(this.markdownEditorDiv);
        this.previewContent = previewInstance.getPreviewContent();
    }

    addInputListener() {
        this.usertextarea.addEventListener('input', () => {
            this.renderHybrid(); // Fast: Only Regex
            this.debouncedPreview(); // Slow: Heavy Markdown Parse
        });

        this.usertextarea.addEventListener('scroll', () => {
            if (this.mode === 'hybrid') {
                // PIXEL PERFECT SYNC: Do not use ratios for the hybrid layer
                this.displayLayer.scrollTop = this.usertextarea.scrollTop;
                this.displayLayer.scrollLeft = this.usertextarea.scrollLeft;
            }

            if (this.preview && this.previewContent) {
                // RATIO SYNC: Use ratio only for the fully rendered preview
                const textarea = this.usertextarea;
                const ratio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
                this.previewContent.scrollTop = ratio * (this.previewContent.scrollHeight - this.previewContent.clientHeight);
            }
        });
    }

    debouncedPreview() {
        if (!this.preview) return;
        clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => {
            this.previewContent.innerHTML = marked(this.usertextarea.value);
        }, 150); // 150ms delay feels instant but saves CPU
    }

    addToolbar() {
        new Toolbar(
            this,
            this.options.toolbar ||
            [
                // History/System (Usually far left)
                'undo', 
                'redo',
                
                // Block Structure
                'heading', 
                'blockquote', 
                
                // Lists & Indentation
                'ul', 
                'ol', 
                'checklist', 
                'outdent', 
                'indent', 
                
                // Inline Formatting
                'bold', 
                'italic', 
                'strikethrough', 
                
                // Rich Media/Links
                'link', 
                'image',
                
                // View/Preview (Usually far right)
                'preview'
            ]
        );
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
    

    renderHybrid() {
        if (this.mode !== 'hybrid') return;

        const rawValue = this.usertextarea.value;
        let highlighted = rawValue
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // SYNTAX HIGHLIGHTING CHAIN
        highlighted = highlighted

            // code block
            .replace(/```(\w+)?\n([\s\S]*?)```/g, 
                '<span class="fj:opacity-30">```$1</span>\n$2<span class="fj:opacity-30">```</span>')

            // 2. Inline Code (Single Backtick)
            .replace(/`([^`\n]+)`/g, 
                '<code class="fj:bg-surface">$1</code>')

            // 2. Headers
            .replace(/^(#+ )(.*)$/gm, 
                '<span class="fj:text-primary"><span class="fj:opacity-40">$1</span><span class="fj:font-bold fj:tracking-[-0.040em]">$2</span></span>')
        
            // 3. Bold 
            .replace(/\*\*(.*?)\*\*/g, 
                '<span class="fj:text-secondary"><span class="fj:opacity-40">**</span><span class="fj:font-bold fj:tracking-[-0.040em]">$1</span><span class="fj:opacity-40">**</span></span>')

             // 3. Lists (UL, OL, Checklist)
            // Matches: "- ", "* ", "1. ", "[ ] ", "[x] "
            .replace(/^([\s]*)([\-\*] |[\d]+\. |\[[\s xX]\] )(.*)$/gm, 
                '$1<span class="fj:text-primary fj:font-medium">$2</span>$3')

            // 5. Inline Italic (Supports both *italic* and _italic_)
            .replace(/(\*|_)(.*?)\1/g, 
                '<span class="fj:text-accent"><span class="fj:opacity-40">$1</span><span class="fj:italic">$2</span><span class="fj:opacity-40">$1</span></span>')

            // 6. Strikethrough
            // Double ~~text~~
            .replace(/~~(.*?)~~/g, 
                '<span class="fj:line-through fj:opacity-70"><span class="fj:opacity-40">~~</span>$1<span class="fj:opacity-40">~~</span></span>')
            
            // Single ~text~ (Optional, only if you want to support both)
            // We use a negative lookbehind/lookahead logic or simply run it after the double replace
            .replace(/(?<!~)(~)([^~]+)\1(?!~)/g, 
                '<span class="fj:line-through fj:opacity-70"><span class="fj:opacity-40">$1</span>$2<span class="fj:opacity-40">$1</span></span>')
    
            // 7. Links & Images
            // Matches ![alt](src) and [text](url)
            .replace(/(!?\[)(.*?)(\]\()(.*?)(\))/g, 
                '<span class="fj:opacity-40">$1</span><span class="fj:text-primary">$2</span><span class="fj:opacity-40">$3</span><span class="fj:underline fj:opacity-50">$4</span><span class="fj:opacity-50">$5</span>');
            

        // Ensure height sync when ending with newline
        if (rawValue.length > 0 && rawValue.endsWith('\n')) {
            highlighted += ' '; 
        }

        this.displayLayer.innerHTML = highlighted;
    }

    render() {
        // Initial render or manual trigger
        this.renderHybrid();
        if (this.preview) this.previewContent.innerHTML = marked(this.usertextarea.value);
    }
}

export default MarkdownEditor;