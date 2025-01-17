// #components/Toolbar/tools/PreviewToggleTool.js
import MarkdownTool from './MarkdownTool.js';

class PreviewTool extends MarkdownTool {
    constructor(editor) {
        // No markdown syntax for preview toggle, so we call the parent constructor with empty values
        super(editor, '', 'Preview');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>
            </svg>
        `);
    }

    // Override applySyntax to handle preview toggling
    applySyntax() {
        const previewWrapper = this.editor.previewContent?.parentNode;
        const editorDiv = this.editor.markdownEditorDiv;

        if (!previewWrapper || !editorDiv) return;

        // Toggle the preview's visibility by switching between 'block' and 'hidden' classes
        if (this.editor.preview) {
            this.enablePreview(previewWrapper, editorDiv);
        } else {
            this.disablePreview(previewWrapper, editorDiv);
        }
    }

    // Method to hide the preview (disable it)
    disablePreview(previewWrapper, editorDiv) {

        this.editor.preview = true;

        editorDiv.parentNode.classList.toggle('fixed');
        editorDiv.parentNode.classList.toggle('top-0');
        editorDiv.parentNode.classList.toggle('inset-x-0');
        editorDiv.parentNode.classList.toggle('rounded-md');
    
        previewWrapper.classList.toggle('hidden');

        // Add grid layout and divide classes to the editor div
        editorDiv.classList.remove(
            'md:grid',
            'md:grid-cols-2',
            'md:divide-x',
            'md:divide-stone-300',
            'dark:md:divide-stone-700'
        );

        editorDiv.querySelector(".textarea-wrapper").classList.remove(
            'h-lvh',
            'hidden',
            'md:block'
        );
        this.editor.render(); // Re-render content in the preview
        
        document.querySelector("body").classList.remove('overflow-hidden');
    }

    // Method to show the preview (enable it)
    enablePreview(previewWrapper, editorDiv) {

        this.editor.preview = false;

        editorDiv.parentNode.classList.toggle('fixed');
        editorDiv.parentNode.classList.toggle('top-0');
        editorDiv.parentNode.classList.toggle('inset-x-0');
        editorDiv.parentNode.classList.toggle('rounded-md');

        previewWrapper.classList.toggle('hidden');
        // Remove grid layout and divide classes from the editor div
        editorDiv.classList.add(
            'md:grid',
            'md:grid-cols-2',
            'md:divide-x',
            'md:divide-stone-300',
            'dark:md:divide-stone-700'
        );

        editorDiv.querySelector(".textarea-wrapper").classList.add(
            'h-lvh',
            'hidden',
            'md:block'
        );
        // editorDiv.closest(".textarea-wrapper>textarea").classList.add("h-lvh");

        document.querySelector("body").classList.add('overflow-hidden');
    }
}

export default PreviewTool;
