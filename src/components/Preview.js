/**
 * What makes rendered markdown look like this editor's preview.
 *
 * Exported because the draft comparison renders markdown too, and a second
 * copy of this list drifted immediately: it was written as three of these
 * classes and lost `me-prose-frutjam`, the one that points the typography at
 * frutjam's palette. Without it the plugin's own colours show through, and on
 * a dark theme that is near-black headings on a near-black background --
 * legible enough in the editor's own preview that nobody would think to check
 * the other place.
 *
 * Typography only. Where the box sits, how it scrolls and how tall it is are
 * the caller's, since the pane and the dialog disagree about all three.
 */
export const PROSE_CLASSES = `
    fj:mte-prose fj:mte-prose-sm fj:md:mte-prose-base fj:me-prose-frutjam
    fj:max-w-full
    fj:mte-prose-p:first:mt-0
    fj:mte-prose-table:border-collapse
    fj:mte-prose-table:border fj:mte-prose-table:border-base-soft
    fj:mte-prose-th:border fj:mte-prose-th:border-base-soft fj:mte-prose-th:px-2
    fj:mte-prose-td:border fj:mte-prose-td:border-base-soft fj:mte-prose-td:px-2
`;

class Preview {
    /**
     * @param label Translator for the pane's own name, the same shape Footer
     *              takes. Defaults to English so the class stands alone.
     */
    constructor(container, label = text => text) {
        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'preview-wrapper fj:p-2 fj:hidden fj:me-surface fj:me-surface-outline fj:border-base-soft fj:border-0 fj:border-l';
        this.previewContainer.setAttribute('role', 'region');
        // The region a screen reader announces when it reaches the preview.
        // 'Preview' is already a key, since the toolbar button uses it.
        this.previewContainer.setAttribute('aria-label', label('Preview'));
        this.previewContent = document.createElement('div');
        // The element variants are named after the typography plugin's own
        // className, which main.css sets to mte-prose: fj:mte-prose-td:*, not
        // fj:prose-td:*. The default spelling compiles to nothing at all,
        // which looks like a rule that is simply being overridden.
        //
        // Tables come out of the plugin with a rule under the heads and one
        // between the rows, and nothing else: no frame and no lines down the
        // columns. Markdown tables are read as a grid, so they get all four
        // sides, in base-soft: the colour the wrapper's own border is drawn
        // in, and what the plugin's rules already resolve to, so the grid
        // follows the theme and names the same token as the rest of the file.
        //
        // border-collapse is ours to set, because the editor imports
        // tailwindcss/theme and tailwindcss/utilities but not preflight: the
        // reset that normally collapses every table is not in this bundle,
        // and separated borders would draw each cell its own box.
        //
        // px-2 goes back on because the plugin takes the outside padding off
        // the first and last cell in a row, to sit flush with text that has
        // no frame. With a frame there, the text touched the line.
        this.previewContent.className = `
            preview-content
            ${PROSE_CLASSES}
            fj:p-1.5 fj:overflow-y-auto fj:h-full
        `;
        this.previewContainer.appendChild(this.previewContent);
        container.appendChild(this.previewContainer);
    }

    getPreviewContent() {
        return this.previewContent;
    }
}

export default Preview;
