// markdown\preview.js
class Preview {
    constructor(container) {
        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'preview-wrapper bg-white dark:bg-stone-800 p-2 hidden';
        this.previewContent = document.createElement('div');
        this.previewContent.className = 'preview-content prose prose-sm md:prose-base dark:prose-invert p-1.5 overflow-y-auto h-[90lvh] max-w-full';
        this.previewContainer.appendChild(this.previewContent);
        container.appendChild(this.previewContainer);
    }

    getPreviewContent() {
        return this.previewContent;
    }
}

export default Preview;