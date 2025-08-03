class Preview {
    constructor(container) {

        this.divider = document.createElement('div');
        this.divider.className = 'editor-preview-divider fj:divider fj:divider-y fj:hidden';
        container.appendChild(this.divider);

        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'preview-wrapper fj:p-2 fj:hidden';
        this.previewContent = document.createElement('div');
        this.previewContent.className = 'preview-content fj:surface fj:surface-1 fj:prose fj:prose-sm fj:md:prose-base fj:dark:prose-invert fj:p-1.5 fj:overflow-y-auto fj:h-[90lvh] fj:max-w-full';
        this.previewContainer.appendChild(this.previewContent);
        container.appendChild(this.previewContainer);
    }

    getPreviewContent() {
        return this.previewContent;
    }
}

export default Preview;