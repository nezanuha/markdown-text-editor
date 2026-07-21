class Preview {
    constructor(container) {
        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'preview-wrapper fj:p-2 fj:hidden fj:me-surface fj:me-surface-outline fj:border-base-soft fj:border-0 fj:border-l';
        this.previewContainer.setAttribute('role', 'region');
        this.previewContainer.setAttribute('aria-label', 'Preview');
        this.previewContent = document.createElement('div');
        this.previewContent.className = 'preview-content fj:mte-prose fj:mte-prose-sm fj:md:mte-prose-base fj:me-prose-frutjam fj:p-1.5 fj:overflow-y-auto fj:h-full fj:max-w-full';
        this.previewContainer.appendChild(this.previewContent);
        container.appendChild(this.previewContainer);
    }

    getPreviewContent() {
        return this.previewContent;
    }
}

export default Preview;