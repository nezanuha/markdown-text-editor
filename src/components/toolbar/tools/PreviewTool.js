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
    
        // Add grid layout and divide classes to the editor div
        editorDiv.classList.remove(
            'fj:md:grid-cols-2'
        );
        previewWrapper.classList.add('fj:hidden');
        textareaWrapper.classList.remove("fj:hidden", "md:grid");

        textareaWrapper.classList.remove(
            'fj:h-[90lvh]',
        );
        this.editor.render(); // Re-render content in the preview

        textareaWrapper.querySelector("textarea").classList.remove("fj:h-[90lvh]!");

        if(textareaWrapper.querySelector(".display-layer")){
            textareaWrapper.querySelector(".display-layer").classList.remove("fj:h-[90lvh]!");
        }
        
        document.querySelector("body").classList.remove('fj:overflow-hidden');

        document.querySelectorAll('.markdown-btn').forEach(button => {
            if (!button.classList.contains('preview-btn')) {
                button.classList.remove('fj:pointer-events-none', 'fj:md:pointer-events-auto', 'fj:opacity-25', 'fj:md:opacity-100');
            }else{
                button.classList.remove('fj:btn-active');
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

        // Remove grid layout and divide classes from the editor div
        editorDiv.classList.add(
            'fj:md:grid-cols-2'
        );
        previewWrapper.classList.remove('fj:hidden');
        textareaWrapper.classList.add("fj:hidden", "fj:md:grid");

        textareaWrapper.classList.add(
            'fj:h-[90lvh]',
        );

        textareaWrapper.querySelector("textarea").classList.add("fj:h-[90lvh]!");

        if(textareaWrapper.querySelector(".display-layer")){
            textareaWrapper.querySelector(".display-layer").classList.add("fj:h-[90lvh]!");
        }

        document.querySelector("body").classList.add('fj:overflow-hidden');

        document.querySelectorAll('.markdown-btn').forEach(button => {
            if (!button.classList.contains('preview-btn')) {
                button.classList.add('fj:pointer-events-none', 'fj:md:pointer-events-auto', 'fj:opacity-25', 'fj:md:opacity-100');
            }else{
                button.classList.add('fj:btn-active');
            }
        });
    }
}

export default PreviewTool;
