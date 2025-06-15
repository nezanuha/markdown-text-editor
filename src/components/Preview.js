class Preview {
    constructor(container) {
        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'fj:preview-wrapper fj:bg-white fj:dark:bg-stone-900 fj:p-2 fj:hidden';
        this.previewContent = document.createElement('div');
        this.previewContent.className = 'preview-content fj:dark:[scrollbar-color:var(--color-stone-600)_transparent] fj:prose fj:prose-sm fj:md:prose-base fj:dark:prose-invert fj:p-1.5 fj:overflow-y-auto fj:h-[90lvh] fj:max-w-full';
        this.previewContainer.appendChild(this.previewContent);
        container.appendChild(this.previewContainer);
    }

    getPreviewContent() {
        return this.previewContent;
    }
}

export default Preview;