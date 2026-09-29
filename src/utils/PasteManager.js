import { uploadImage } from './imageUpload.js';

// Deliberately strict: only a bare http(s) URL with no whitespace becomes a link.
// Pasting a sentence that happens to contain a URL should paste as written.
const BARE_URL = /^https?:\/\/\S+$/i;

/**
 * Handles pasting and dropping into the textarea:
 *
 *   - image files are uploaded and inserted, when image upload is configured
 *   - a bare URL pasted over a selection becomes [selection](url)
 *
 * Anything else falls through to the browser's own paste.
 */
export default class PasteManager {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;

        this._pasteHandler = (e) => this._onPaste(e);
        this._dropHandler = (e) => this._onDrop(e);
        this._dragOverHandler = (e) => { if (this._carriesFiles(e.dataTransfer)) e.preventDefault(); };

        this.textarea.addEventListener('paste', this._pasteHandler);
        this.textarea.addEventListener('drop', this._dropHandler);
        this.textarea.addEventListener('dragover', this._dragOverHandler);
    }

    destroy() {
        this.textarea.removeEventListener('paste', this._pasteHandler);
        this.textarea.removeEventListener('drop', this._dropHandler);
        this.textarea.removeEventListener('dragover', this._dragOverHandler);
    }

    _carriesFiles(dataTransfer) {
        return Array.from(dataTransfer?.types ?? []).includes('Files');
    }

    _imageFiles(dataTransfer) {
        return Array.from(dataTransfer?.files ?? []).filter(f => f.type?.startsWith('image/'));
    }

    _onPaste(event) {
        const images = this._imageFiles(event.clipboardData);
        if (images.length && this.editor.imageUpload) {
            event.preventDefault();
            this._uploadAll(images);
            return;
        }

        const pasted = event.clipboardData?.getData('text/plain')?.trim();
        const { selectionStart, selectionEnd } = this.textarea;
        const hasSelection = selectionEnd > selectionStart;

        if (pasted && hasSelection && BARE_URL.test(pasted)) {
            event.preventDefault();
            const selected = this.textarea.value.slice(selectionStart, selectionEnd);
            const link = `[${selected}](${pasted})`;
            this.editor.insertText(link, link.length, 0);
        }
    }

    _onDrop(event) {
        const images = this._imageFiles(event.dataTransfer);
        if (!images.length || !this.editor.imageUpload) return;
        event.preventDefault();
        this._uploadAll(images);
    }

    /**
     * Inserts a placeholder immediately so the editor does not appear frozen,
     * then swaps it for the real image once the upload resolves. Uploads run one
     * at a time so the placeholders stay in the order the files arrived.
     */
    async _uploadAll(files) {
        for (const file of files) {
            const token = `![${this.editor.label('Uploading...')}]()`;
            this.editor.insertText(token, token.length, 0);

            try {
                const { path, alt } = await uploadImage(file, this.editor.imageUpload);
                this._replace(token, `![${alt}](${path})`);
            } catch (err) {
                this._replace(token, '');
                console.error('[MarkdownEditor] Image upload failed.', err);
            }
        }
    }

    _replace(token, replacement) {
        const textarea = this.textarea;
        const at = textarea.value.indexOf(token);
        if (at === -1) return; // the user deleted it while the upload was in flight

        textarea.value = textarea.value.slice(0, at) + replacement + textarea.value.slice(at + token.length);
        const caret = at + replacement.length;
        textarea.setSelectionRange(caret, caret);

        this.editor.render();
        this.editor.notifyChange();
    }
}
