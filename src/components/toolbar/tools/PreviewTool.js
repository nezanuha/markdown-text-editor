// #components/Toolbar/tools/PreviewToggleTool.js
import MakeTool from '../MakeTool.js';

class PreviewTool extends MakeTool {
    constructor(editor) {
        // No markdown syntax for preview toggle, so we call the parent constructor with empty values
        super(editor, 'Preview');
        this.preview = true;
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11 5H5V19H11V5ZM13 5V19H19V5H13ZM4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3Z"></path></svg>
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

        editorDiv.parentNode.classList.toggle('fj:fixed');
        editorDiv.parentNode.classList.toggle('fj:top-0');
        editorDiv.parentNode.classList.toggle('fj:inset-x-0');
        editorDiv.parentNode.classList.toggle('fj:rounded-md');
        editorDiv.parentNode.classList.toggle('fj:z-999');
    
        previewWrapper.classList.toggle('fj:hidden');

        // Add grid layout and divide classes to the editor div
        editorDiv.classList.remove(
            'fj:md:grid',
            'fj:md:grid-cols-2'
        );

        editorDiv.querySelector(".textarea-wrapper").classList.remove(
            'fj:h-[90lvh]',
            'fj:hidden',
            'fj:md:block'
        );
        this.editor.render(); // Re-render content in the preview

        editorDiv.querySelector(".textarea-wrapper").querySelector("textarea").classList.remove("fj:h-[90lvh]!");
        
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

        editorDiv.parentNode.classList.toggle('fj:fixed');
        editorDiv.parentNode.classList.toggle('fj:top-0');
        editorDiv.parentNode.classList.toggle('fj:inset-x-0');
        editorDiv.parentNode.classList.toggle('fj:rounded-md');
        editorDiv.parentNode.classList.toggle('fj:z-999');
        
        previewWrapper.classList.toggle('fj:hidden');
        // Remove grid layout and divide classes from the editor div
        editorDiv.classList.add(
            'fj:md:grid',
            'fj:md:grid-cols-2'
        );

        editorDiv.querySelector(".textarea-wrapper").classList.add(
            'fj:h-[90lvh]',
            'fj:hidden',
            'fj:md:block'
        );
        editorDiv.querySelector(".textarea-wrapper").querySelector("textarea").classList.add("fj:h-[90lvh]!");

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
