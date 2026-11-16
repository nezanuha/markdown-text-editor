import { uploadImage } from './imageUpload.js';
import { htmlToMarkdown } from './htmlToMarkdown.js';

// Deliberately strict: only a bare http(s) URL with no whitespace becomes a link.
// Pasting a sentence that happens to contain a URL should paste as written.
const BARE_URL = /^https?:\/\/\S+$/i;

// An editor that puts plain text on the clipboard often puts a wrapper of
// HTML around it too, so the presence of text/html is not enough to act on.
// These are the tags worth converting: if none appears, the plain text is
// already the better paste.
const WORTH_CONVERTING = /<(h[1-6]|strong|b|em|i|del|s|code|pre|a|img|ul|ol|li|blockquote|table|hr)\b/i;

/**
 * Handles pasting and dropping into the textarea:
 *
 *   - image files are uploaded and inserted, when image upload is configured
 *   - a bare URL pasted over a selection becomes [selection](url)
 *   - formatted HTML becomes markdown, unless `pasteHtml: false`
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
        if (images.length) {
            if (!this.editor.imageUpload) {
                // Nothing to prevent here, a textarea cannot paste an image anyway,
                // but say why nothing happened rather than leaving it a mystery.
                console.warn('[MarkdownEditor] An image was pasted but no upload endpoint is configured. Add { image: { fileInput: { uploadUrl: "..." } } } to the toolbar to enable it.');
                return;
            }
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
            return;
        }

        this._pasteAsMarkdown(event);
    }

    /**
     * Copying from a web page or a word processor puts the formatting on the
     * clipboard as HTML alongside the plain text. Taking the plain text drops
     * every link, heading and list, and the person puts them back by hand.
     *
     * Converting instead, when there is anything worth converting. A URL
     * pasted over a selection is handled before this and wins, because that
     * is the more specific thing to have meant.
     */
    _pasteAsMarkdown(event) {
        if (this.editor.options?.pasteHtml === false) return;

        const html = event.clipboardData?.getData('text/html');
        if (!html || !WORTH_CONVERTING.test(html)) return;

        let markdown;
        try {
            // The same sanitiser the preview uses. This HTML came off the
            // clipboard, which is to say from somewhere else entirely, and it
            // is about to be put through a DOM to be read.
            markdown = htmlToMarkdown(html, (dirty) => this.editor.sanitizeHtml(dirty));
        } catch (err) {
            // A paste that throws must still paste. Letting the browser have
            // it gives the plain text, which is what used to happen anyway.
            console.error('[MarkdownEditor] Could not convert the pasted HTML, '
                + 'so it was pasted as plain text.', err);
            return;
        }

        const plain = event.clipboardData?.getData('text/plain') ?? '';
        // Nothing gained: let the browser do its own paste, which keeps its
        // undo entry rather than making one of ours.
        if (!markdown || markdown === plain.trim()) return;

        event.preventDefault();
        this.editor.insertText(markdown, markdown.length, 0);
    }

    _onDrop(event) {
        if (!this._carriesFiles(event.dataTransfer)) return;

        // Always swallow file drops. The browser's default is to navigate to the
        // dropped file, which would throw away everything the user has written,
        // and dragover has already advertised the textarea as a drop target.
        event.preventDefault();

        const images = this._imageFiles(event.dataTransfer);
        if (!images.length) return;

        if (!this.editor.imageUpload) {
            console.warn('[MarkdownEditor] An image was dropped but no upload endpoint is configured. Add { image: { fileInput: { uploadUrl: "..." } } } to the toolbar to enable it.');
            return;
        }

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
                // Leave a visible marker rather than silently removing the
                // placeholder. Without devtools open, a vanishing placeholder
                // looks like nothing happened at all.
                this._replace(token, `![${this.editor.label('Upload failed')}]()`);
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
