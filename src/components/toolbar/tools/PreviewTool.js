// #components/Toolbar/tools/PreviewToggleTool.js
import Tool from '../Tool.js';

// The same frame in both states, so the button keeps its silhouette and does
// not appear to jump when it is pressed. Only what is inside the frame
// changes, and it describes the pane rather than the click: a split pane with
// the rendered half hatched, or, once the preview is open, hatching the whole
// way across, because the rendered document is the whole of the pane now.
//
// Tabler's geometry throughout: a 24-unit box, stroke 2, hatch lines running
// up to the right on x + y = 10, 15, 20 ... so the two icons share one rhythm
// and the lines of the split half do not move when the rest arrives.
const FRAME = '<path stroke="none" d="M0 0h24v24H0z" fill="none"/>'
    + '<path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" />';

const svgIcon = (inner) => `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FRAME}${inner}</svg>
        `;

// Preview closed: text on the left, rendered output on the right.
const ICON_SPLIT = svgIcon(
    '<path d="M12 4v16" />'
    + '<path d="M12 8l4 -4" />'
    + '<path d="M12 13l7.5 -7.5" />'
    + '<path d="M12 18l8 -8" />'
    + '<path d="M15 20l5 -5" />'
);

// Preview open: no divider, and the hatch carries on across the left half on
// the same lines, so the four strokes above stay exactly where they were.
const ICON_FULL = svgIcon(
    '<path d="M4 6l2 -2" />'
    + '<path d="M4 11l7 -7" />'
    + '<path d="M4 16l12 -12" />'
    + '<path d="M5 20l15 -15" />'
    + '<path d="M10 20l10 -10" />'
    + '<path d="M15 20l5 -5" />'
);

class PreviewTool extends Tool {
    constructor(editor) {
        // No markdown syntax for preview toggle, so we call the parent constructor with empty values
        super(editor, 'Preview');
        this.preview = true;
        this.button = this.createButton(ICON_SPLIT);
        this._btn = this.button.querySelector('button');
        if (this._btn) this._btn.setAttribute('aria-pressed', 'false');
    }

    /**
     * Swaps the drawing inside the button.
     *
     * The icon is decoration: the button is already named by its title and
     * reports itself with aria-pressed, so the new svg is hidden from a
     * screen reader exactly as createButton hides the first one. Without
     * that, opening the preview would start announcing an image.
     */
    _setIcon(icon) {
        if (!this._btn) return;
        this._btn.innerHTML = icon;
        this._btn.querySelector('svg')?.setAttribute('aria-hidden', 'true');
    }

    /**
     * Keeps the name a screen reader reads still, so only the tooltip moves.
     *
     * Letting the name change with the state would undo aria-pressed, which
     * already carries it: "Close preview, pressed" reads as the opposite of
     * itself. ShortcutManager mirrors every toolbar button's title into an
     * aria-label once the shortcut hints are on, which pins the name for us
     * -- but only when shortcuts are on at all, so the mirror is done here
     * too if nothing else has.
     *
     * The closed tooltip is kept whole rather than rebuilt, because by now it
     * carries the ' (F11)' that ShortcutManager appended after this class had
     * finished with the button, and rebuilding it would drop that.
     */
    _freezeName() {
        if (!this._btn) return;
        this._closedTitle ??= this._btn.title;
        if (!this._btn.hasAttribute('aria-label')) {
            this._btn.setAttribute('aria-label', this._btn.title);
        }
    }

    // Override applySyntax to handle preview toggling
    applySyntax() {
        const previewWrapper = this.editor.previewContent?.parentNode;
        const editorDiv = this.editor.markdownEditorDiv;

        if (!previewWrapper || !editorDiv) return;

        this._freezeName();

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

        editorDiv.parentNode.classList.remove('is-fullscreen');

        editorDiv.classList.remove('fj:md:grid-cols-2');
        previewWrapper.classList.add('fj:hidden');
        textareaWrapper.classList.remove("fj:hidden", "fj:md:grid");

        textareaWrapper.querySelector("textarea").classList.remove("fj:h-full!");

        if(textareaWrapper.querySelector(".display-layer")){
            textareaWrapper.querySelector(".display-layer").classList.remove("fj:h-full!");
        }

        previewWrapper.classList.remove('fj:min-h-0');

        document.querySelector("body").classList.remove('fj:overflow-hidden');

        document.removeEventListener('keydown', this._escHandler);

        this.editor._autoGrow();

        this.editor.editorContainer.querySelectorAll('.markdown-btn').forEach(button => {
            if (!button.classList.contains('preview-btn')) {
                button.classList.remove('fj:pointer-events-none', 'fj:md:pointer-events-auto', 'fj:opacity-25', 'fj:md:opacity-100');
                button.removeAttribute('aria-disabled');
            } else {
                button.classList.remove('fj:me-btn-active');
                button.setAttribute('aria-pressed', 'false');
            }
        });

        this._setIcon(ICON_SPLIT);
        // Whatever it said at the start, shortcut suffix and all.
        if (this._btn && this._closedTitle) this._btn.title = this._closedTitle;
    }

    // Method to show the preview (enable it)
    enablePreview(previewWrapper, editorDiv) {

        this.preview = false;

        const textareaWrapper = editorDiv.querySelector(".textarea-wrapper");

        editorDiv.parentNode.classList.add('is-fullscreen');

        editorDiv.classList.add('fj:md:grid-cols-2');
        previewWrapper.classList.remove('fj:hidden');
        textareaWrapper.classList.add("fj:hidden", "fj:md:grid");

        // Clear inline height set by _autoGrow. An inline style would beat
        // the height in the .is-fullscreen rule.
        this.editor.editorContainer.style.height = '';

        textareaWrapper.querySelector("textarea").classList.add("fj:h-full!");

        if(textareaWrapper.querySelector(".display-layer")){
            textareaWrapper.querySelector(".display-layer").classList.add("fj:h-full!");
        }

        previewWrapper.classList.add('fj:min-h-0');

        document.querySelector("body").classList.add('fj:overflow-hidden');

        this._escHandler = (e) => {
            if (e.key === 'Escape') this.applySyntax();
        };
        document.addEventListener('keydown', this._escHandler);

        this.editor.render();

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        this.editor.editorContainer.querySelectorAll('.markdown-btn').forEach(button => {
            if (!button.classList.contains('preview-btn')) {
                button.classList.add('fj:pointer-events-none', 'fj:md:pointer-events-auto', 'fj:opacity-25', 'fj:md:opacity-100');
                button.setAttribute('aria-disabled', isMobile ? 'true' : 'false');
            } else {
                button.classList.add('fj:me-btn-active');
                button.setAttribute('aria-pressed', 'true');
            }
        });

        this._setIcon(ICON_FULL);
        // Escape rather than F11: F11 was on the tooltip in the other state,
        // and Escape is the one nobody would guess. The key itself is not
        // translated, the same way the find panel leaves its keys alone.
        if (this._btn) this._btn.title = this.editor.label('Close preview') + ' (Esc)';
    }

    destroy() {
        if (!this.preview) {
            document.removeEventListener('keydown', this._escHandler);
            document.querySelector('body')?.classList.remove('fj:overflow-hidden');
        }
    }
}

export default PreviewTool;
