class Preview {
    constructor(container) {
        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'preview-wrapper fj:p-2 fj:hidden fj:surface fj:surface-outline fj:border-0 fj:border-l';
        this.previewContent = document.createElement('div');
        this.previewContent.className = 'preview-content fj:prose fj:prose-sm fj:md:prose-base fj:prose-frutjam fj:p-1.5 fj:overflow-y-auto fj:h-[90lvh] fj:max-w-full';
        this.previewContainer.appendChild(this.previewContent);
        container.appendChild(this.previewContainer);
    }

    getPreviewContent() {
        return this.previewContent;
    }
}

export default Preview;