import '../styles/main.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Toolbar from './toolbar/Toolbar.js';
import Preview from './Preview.js';
import Footer from './Footer.js';
import UndoRedoManager from '../utils/UndoRedoManager.js';
import IndentManager from '../utils/IndentManager.js';
import ListManager from '../utils/ListManager.js';
import ShortcutManager from '../utils/ShortcutManager.js';
import FindReplace from '../utils/FindReplace.js';

marked.setOptions({
    breaks: true
});

class MarkdownEditor {
    constructor(selector, options = {}) {
        this.usertextarea = typeof selector === 'string' ? document.querySelector(selector) : selector;
        this.options = options;
        this.mode = options.mode || 'plain';
        this.preview = (this.options.toolbar) ? this.options.toolbar.includes('preview') : true;
        this.footerOptions = this._parseFooterOptions(options.footer);
        this.previewTimer = null;
        this.init();
        this.undoRedoManager = new UndoRedoManager(this);
        this.listManager = new ListManager(this);
        this.indentManager = new IndentManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.findReplace = new FindReplace(this);
    }

    _parseFooterOptions(footer) {
        if (footer === false) return null;
        const opts = footer ?? {};
        return {
            line:  opts.line  !== false,
            col:   opts.col   !== false,
            chars: opts.chars !== false,
            words: opts.words === true,
        };
    }

    init() {
        this.createEditor();
        this.addToolbar();
        this.addFooter();
        this._toolbarH = this.editorContainer.querySelector('.toolbar')?.offsetHeight ?? 0;
        this._footerH = this.editorContainer.querySelector('.editor-footer')?.offsetHeight ?? 0;
        this._autoGrow();
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
        const hasLabel = (this.usertextarea.id && document.querySelector(`label[for="${this.usertextarea.id}"]`))
            || this.usertextarea.getAttribute('aria-label')
            || this.usertextarea.getAttribute('aria-labelledby');
        if (!hasLabel) {
            this.usertextarea.setAttribute('aria-label', this.options.label || 'Markdown editor');
            this._addedAriaLabel = true;
        }

        this.usertextarea.classList.add(
            "editor-textarea",
            "fj:focus:ring-0",
            "fj:focus:outline-0",
            "fj:border-0",
            "fj:border-base-soft",
            "fj:px-4",
            "fj:py-2",
            "fj:max-w-full",
            "fj:w-full",
            "fj:h-full",
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
            fj:me-surface
            fj:me-surface-outline
            fj:me-surface-rounded
            fj:overflow-hidden
            fj:flex
            fj:flex-col
        `;
        const theme = this.options.theme
            ?? this.usertextarea.closest('[data-theme]')?.getAttribute('data-theme');
        if (theme) this.editorContainer.setAttribute('data-theme', theme);
        this.editorContainer.style.minHeight = (this.options.minHeight ?? 200) + 'px';
        this.usertextarea.parentNode.insertBefore(this.editorContainer, this.usertextarea);

        this.markdownEditorDiv = document.createElement('div');
        this.markdownEditorDiv.className = `editor-layout fj:relative fj:grid fj:grid-cols-1 fj:flex-1 fj:min-h-0`;
        this.editorContainer.appendChild(this.markdownEditorDiv);

        this.addTextareaWrapper();
        if (this.preview) this.addPreviewWrapper();
    }

    addTextareaWrapper() {
        const textareaContainer = document.createElement('div');
        textareaContainer.className = `
            textarea-wrapper
            not-prose
            fj:me-surface
            fj:h-full
            fj:min-h-0
            fj:relative
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
                fj:whitespace-pre-wrap fj:wrap-break-word
                fj:pointer-events-none
                fj:absolute
                fj:inset-0
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
            this._autoGrow();
            this.renderHybrid(); // Fast: Only Regex
            this.debouncedPreview(); // Slow: Heavy Markdown Parse
            if (this.options.onChange) this.options.onChange(this.usertextarea.value);
        });

        this.usertextarea.addEventListener('scroll', () => {
            if (this._scrollRaf) return;
            this._scrollRaf = requestAnimationFrame(() => {
                this._scrollRaf = null;

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
        });
    }

    debouncedPreview() {
        if (!this.preview) return;
        clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => {
            this.previewContent.innerHTML = DOMPurify.sanitize(marked(this.usertextarea.value));
            this.wirePreviewCheckboxes();
            const textarea = this.usertextarea;
            const ratio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
            this.previewContent.scrollTop = ratio * (this.previewContent.scrollHeight - this.previewContent.clientHeight);
        }, 150); // 150ms delay feels instant but saves CPU
    }

    wirePreviewCheckboxes() {
        const checkboxes = this.previewContent.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            checkbox.removeAttribute('disabled');
            checkbox.addEventListener('click', (e) => {
                e.preventDefault();
                const lines = this.usertextarea.value.split('\n');
                let count = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (/^(\s*)([-*] \[[ xX]\] )/.test(lines[i])) {
                        if (count === index) {
                            if (checkbox.checked) {
                                lines[i] = lines[i].replace(/\[ \]/, '[x]');
                            } else {
                                lines[i] = lines[i].replace(/\[[xX]\]/, '[ ]');
                            }
                            break;
                        }
                        count++;
                    }
                }
                this.usertextarea.value = lines.join('\n');
                this.render();
            });
        });
    }

    addFooter() {
        if (!this.footerOptions) return;
        const { line, col, chars } = this.footerOptions;
        if (!line && !col && !chars) return;
        this.footer = new Footer(this.editorContainer, this.footerOptions);
        this.footer.update(this.usertextarea);

        const update = () => this.footer.update(this.usertextarea);
        this.usertextarea.addEventListener('input', update);
        this.usertextarea.addEventListener('click', update);
        this.usertextarea.addEventListener('keyup', update);
        this.usertextarea.addEventListener('focus', update);
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
                'code',

                // Block Formatting
                'codeblock',
                'hr',
                'table',

                // Rich Media/Links
                'link',
                'image',
                
                // View/Preview (Usually far right)
                'preview'
            ]
        );
    }

    insertText(text, selectionOffset = 0, trailingLength = 0) {
        const { selectionStart, selectionEnd } = this.usertextarea;
        const value = this.usertextarea.value;
        this.usertextarea.value = `${value.substring(0, selectionStart)}${text}${value.substring(selectionEnd)}`;
        this.usertextarea.focus();
        this.usertextarea.setSelectionRange(selectionStart + selectionOffset, selectionStart + text.length - trailingLength);

        // Scroll the textarea to the inserted text
        this.scrollToView();

        this.render();
        this.triggerChange();
    }

    scrollToView() {
        const textarea = this.usertextarea;
        const selectionStart = textarea.selectionStart;

        if (!this._lineHeight) {
            this._lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        }

        const lineHeight = this._lineHeight;
        const rowsInView = Math.floor(textarea.clientHeight / lineHeight);
        const currentLine = Math.floor(selectionStart / textarea.cols);
        textarea.scrollTop = (currentLine - Math.floor(rowsInView / 2)) * lineHeight;
    }
    

    _highlight(rawValue) {
        let out = rawValue
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        out = out
            .replace(/```(\w+)?\n([\s\S]*?)```/g,
                '<span class="fj:opacity-30">```$1</span>\n$2<span class="fj:opacity-30">```</span>')
            .replace(/`([^`\n]+)`/g,
                '<span class="fj:opacity-40">`</span><span class="fj:text-accent">$1</span><span class="fj:opacity-40">`</span>')
            .replace(/^(#+ )(.*)$/gm,
                '<span class="fj:text-primary"><span class="fj:opacity-40">$1</span><span class="faux-bold">$2</span></span>')
            .replace(/\*\*(.*?)\*\*/g,
                '<span class="fj:text-secondary"><span class="fj:opacity-40">**</span><span class="faux-bold">$1</span><span class="fj:opacity-40">**</span></span>')
            .replace(/^([\s]*)([\-\*] |[\d]+\. |\[[\s xX]\] )(.*)$/gm,
                '$1<span class="fj:text-primary">$2</span>$3')
            .replace(/(\*|_)(.*?)\1/g,
                '<span class="fj:text-accent"><span class="fj:opacity-40">$1</span>$2<span class="fj:opacity-40">$1</span></span>')
            .replace(/~~(.*?)~~/g,
                '<span class="fj:line-through fj:opacity-70"><span class="fj:opacity-40">~~</span>$1<span class="fj:opacity-40">~~</span></span>')
            .replace(/(?<!~)(~)([^~]+)\1(?!~)/g,
                '<span class="fj:line-through fj:opacity-70"><span class="fj:opacity-40">$1</span>$2<span class="fj:opacity-40">$1</span></span>')
            .replace(/(!?\[)(.*?)(\]\()(.*?)(\))/g,
                '<span class="fj:opacity-40">$1</span><span class="fj:text-primary">$2</span><span class="fj:opacity-40">$3</span><span class="fj:underline fj:opacity-50">$4</span><span class="fj:opacity-50">$5</span>');

        if (rawValue.endsWith('\n')) out += ' ';
        return out;
    }

    renderHybrid() {
        if (this.mode !== 'hybrid') return;

        const rawValue = this.usertextarea.value;
        if (rawValue === this._lastRaw) return;
        this._lastRaw = rawValue;

        const highlighted = this._highlight(rawValue);
        const newLines = highlighted.split('\n');
        const lastLines = this._lastLines;

        if (!lastLines || lastLines.length !== newLines.length) {
            this.displayLayer.innerHTML = '';
            this._lineNodes = newLines.map((line, i) => {
                const node = document.createElement('span');
                node.innerHTML = line + (i < newLines.length - 1 ? '\n' : '');
                this.displayLayer.appendChild(node);
                return node;
            });
            this._lastLines = newLines.slice();
            return;
        }

        for (let i = 0; i < newLines.length; i++) {
            if (newLines[i] !== lastLines[i]) {
                this._lineNodes[i].innerHTML = newLines[i] + (i < newLines.length - 1 ? '\n' : '');
                lastLines[i] = newLines[i];
            }
        }
    }

    _autoGrow() {
        if (this.editorContainer.classList.contains('fj:h-dvh')) return;

        const textarea = this.usertextarea;
        // Shrink to 1px to measure natural content height (bypasses h-full)
        textarea.style.height = '1px';
        const contentHeight = textarea.scrollHeight;
        textarea.style.height = ''; // restore — h-full class takes over

        const maxHeight = this.options.maxHeight ?? 500;
        this.editorContainer.style.height = (Math.min(contentHeight, maxHeight) + this._toolbarH + this._footerH + 1) + 'px';
    }

    triggerChange() {
        if (this.options.onChange) this.options.onChange(this.usertextarea.value);
    }

    render() {
        this._autoGrow();
        this.renderHybrid();
        if (this.preview) {
            this.previewContent.innerHTML = DOMPurify.sanitize(marked(this.usertextarea.value));
            this.wirePreviewCheckboxes();
        }
    }

    destroy() {
        this.shortcutManager?.destroy();
        this.findReplace?.destroy();

        const parent = this.editorContainer.parentNode;
        if (!parent) return;

        // Strip classes added by applyDefaultAttributes
        const addedClasses = [
            'editor-textarea', 'fj:focus:ring-0', 'fj:focus:outline-0', 'fj:border-0',
            'fj:border-base-soft', 'fj:px-4', 'fj:py-2', 'fj:max-w-full', 'fj:w-full',
            'fj:h-full', 'fj:bg-transparent', 'fj:outline-0', 'fj:appearance-none', 'fj:overflow-y-auto',
            'fj:text-transparent', 'fj:caret-primary', 'fj:resize-none', 'fj:outline-none',
            'fj:m-0', 'fj:box-border', 'fj:relative', 'fj:z-10',
        ];
        addedClasses.forEach(cls => this.usertextarea.classList.remove(cls));

        if (this._addedAriaLabel) this.usertextarea.removeAttribute('aria-label');
        this.usertextarea.style.height = '';

        parent.insertBefore(this.usertextarea, this.editorContainer);
        this.editorContainer.remove();
    }
}

export default MarkdownEditor;