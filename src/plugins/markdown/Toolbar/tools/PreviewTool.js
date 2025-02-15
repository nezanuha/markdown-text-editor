// #components/Toolbar/tools/PreviewToggleTool.js
import MakeTool from '../MakeTool.js';

class PreviewTool extends MakeTool {
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
        editorDiv.parentNode.classList.toggle('z-[999]');
    
        previewWrapper.classList.toggle('hidden');

        // Add grid layout and divide classes to the editor div
        editorDiv.classList.remove(
            'md:grid',
            'md:grid-cols-2',
            'md:divide-x',
            'rtl:md:divide-x-reverse',
            'md:divide-stone-300',
            'dark:md:divide-stone-700'
        );

        editorDiv.querySelector(".textarea-wrapper").classList.remove(
            'h-[90lvh]',
            'hidden',
            'md:block'
        );
        this.editor.render(); // Re-render content in the preview

        editorDiv.querySelector(".textarea-wrapper").querySelector("textarea").classList.remove("!h-[90lvh]");
        
        document.querySelector("body").classList.remove('overflow-hidden');
    }

    // Method to show the preview (enable it)
    enablePreview(previewWrapper, editorDiv) {

        this.editor.preview = false;

        editorDiv.parentNode.classList.toggle('fixed');
        editorDiv.parentNode.classList.toggle('top-0');
        editorDiv.parentNode.classList.toggle('inset-x-0');
        editorDiv.parentNode.classList.toggle('rounded-md');
        editorDiv.parentNode.classList.toggle('z-[999]');

        previewWrapper.classList.toggle('hidden');
        // Remove grid layout and divide classes from the editor div
        editorDiv.classList.add(
            'md:grid',
            'md:grid-cols-2',
            'md:divide-x',
            'rtl:md:divide-x-reverse',
            'md:divide-stone-300',
            'dark:md:divide-stone-700'
        );

        editorDiv.querySelector(".textarea-wrapper").classList.add(
            'h-[90lvh]',
            'hidden',
            'md:block'
        );
        editorDiv.querySelector(".textarea-wrapper").querySelector("textarea").classList.add("!h-[90lvh]");

        document.querySelector("body").classList.add('overflow-hidden');
    }
}

export default PreviewTool;
