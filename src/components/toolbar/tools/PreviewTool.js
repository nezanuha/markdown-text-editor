// #components/Toolbar/tools/PreviewToggleTool.js
import MakeTool from '../MakeTool.js';

class PreviewTool extends MakeTool {
    constructor(editor) {
        // No markdown syntax for preview toggle, so we call the parent constructor with empty values
        super(editor, 'Preview');
        this.preview = true;
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 4v16" /><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" /><path d="M12 13l7.5 -7.5" /><path d="M12 18l8 -8" /><path d="M15 20l5 -5" /><path d="M12 8l4 -4" /></svg>
        `);
        const btn = this.button.querySelector('button');
        if (btn) btn.setAttribute('aria-pressed', 'false');
    }

    // Override applySyntax to handle preview toggling
    applySyntax() {
        const previewWrapper = this.editor.previewContent?.parentNode;
        const editorDiv = this.editor.markdownEditorDiv;

        if (!previewWrapper || !editorDiv) return;

        // Toggle the preview's visibility by switching between 'block' and 'hidden' classes
        if (this.editor.preview && this.preview) {
            this.enablePreview(previewWrapper, editorDiv);
        } else {
            this.disablePreview(previewWrapper, editorDiv);
        }
    }

    // Method to hide the preview (disable it)
    disablePreview(previewWrapper, editorDiv) {

        this.preview = true;

        const textareaWrapper = editorDiv.querySelector(".textarea-wrapper");

        editorDiv.parentNode.classList.toggle('fj:fixed');
        editorDiv.parentNode.classList.toggle('fj:top-0');
        editorDiv.parentNode.classList.toggle('fj:inset-x-0');
        editorDiv.parentNode.classList.toggle('fj:rounded-md');
        editorDiv.parentNode.classList.toggle('fj:z-999');

        editorDiv.classList.remove('fj:md:grid-cols-2');
        previewWrapper.classList.add('fj:hidden');
        textareaWrapper.classList.remove("fj:hidden", "fj:md:grid");

        textareaWrapper.querySelector("textarea").classList.remove("fj:h-full!");

        if(textareaWrapper.querySelector(".display-layer")){
            textareaWrapper.querySelector(".display-layer").classList.remove("fj:h-full!");
        }

        previewWrapper.classList.remove('fj:min-h-0');

        document.querySelector("body").classList.remove('fj:overflow-hidden');

        editorDiv.parentNode.classList.remove('fj:h-dvh', 'fj:resize-none');

        document.removeEventListener('keydown', this._escHandler);

        this.editor._autoGrow();

        this.editor.editorContainer.querySelectorAll('.markdown-btn').forEach(button => {
            if (!button.classList.contains('preview-btn')) {
                button.classList.remove('fj:pointer-events-none', 'fj:md:pointer-events-auto', 'fj:opacity-25', 'fj:md:opacity-100');
                button.removeAttribute('aria-disabled');
            } else {
                button.classList.remove('fj:me-btn-active');
                button.setAttribute('aria-pressed', 'false');
            }
        });

    }

    // Method to show the preview (enable it)
    enablePreview(previewWrapper, editorDiv) {

        this.preview = false;

        const textareaWrapper = editorDiv.querySelector(".textarea-wrapper");

        editorDiv.parentNode.classList.toggle('fj:fixed');
        editorDiv.parentNode.classList.toggle('fj:top-0');
        editorDiv.parentNode.classList.toggle('fj:inset-x-0');
        editorDiv.parentNode.classList.toggle('fj:rounded-md');
        editorDiv.parentNode.classList.toggle('fj:z-999');

        editorDiv.classList.add('fj:md:grid-cols-2');
        previewWrapper.classList.remove('fj:hidden');
        textareaWrapper.classList.add("fj:hidden", "fj:md:grid");

        // Clear inline height so fj:h-dvh (added below) can take effect
        this.editor.editorContainer.style.height = '';

        textareaWrapper.querySelector("textarea").classList.add("fj:h-full!");

        if(textareaWrapper.querySelector(".display-layer")){
            textareaWrapper.querySelector(".display-layer").classList.add("fj:h-full!");
        }

        previewWrapper.classList.add('fj:min-h-0');

        document.querySelector("body").classList.add('fj:overflow-hidden');

        editorDiv.parentNode.classList.add('fj:h-dvh', 'fj:resize-none');

        this._escHandler = (e) => {
            if (e.key === 'Escape') this.applySyntax();
        };
        document.addEventListener('keydown', this._escHandler);

        this.editor.render();

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        this.editor.editorContainer.querySelectorAll('.markdown-btn').forEach(button => {
            if (!button.classList.contains('preview-btn')) {
                button.classList.add('fj:pointer-events-none', 'fj:md:pointer-events-auto', 'fj:opacity-25', 'fj:md:opacity-100');
                button.setAttribute('aria-disabled', isMobile ? 'true' : 'false');
            } else {
                button.classList.add('fj:me-btn-active');
                button.setAttribute('aria-pressed', 'true');
            }
        });
    }

    destroy() {
        if (!this.preview) {
            document.removeEventListener('keydown', this._escHandler);
            document.querySelector('body')?.classList.remove('fj:overflow-hidden');
        }
    }
}

export default PreviewTool;
