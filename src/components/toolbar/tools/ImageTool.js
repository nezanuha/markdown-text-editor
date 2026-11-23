import Tool from '../Tool.js';
import { modal } from '../../modal.js';
import { escapeHtml } from '../../../utils/escapeHtml.js';

class ImageTool extends Tool {
    constructor(editor, config = {}) {
        super(editor, 'Image link');
        this.config = config;
        // Logic: Respect config or default to true
        this.altInputConfig = config.altInput !== undefined ? config.altInput : { required: true };
        
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01" /><path d="M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v6.5" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4" /><path d="M14 14l1 -1c.67 -.644 1.45 -.824 2.182 -.54" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>
        `);
    }

    applySyntax(event) {
        const editor = this.editor;
        const textarea = editor.usertextarea;
        let { selectionStart, selectionEnd } = textarea;
        const fullText = textarea.value;

        // Auto-expand selection if the selected text is inside an existing image ![alt](url)
        const before = fullText.substring(0, selectionStart);
        const after = fullText.substring(selectionEnd);
        if (before.endsWith('![') && /^\]\([^)]+\)/.test(after)) {
            const urlMatch = after.match(/^\]\(([^)]+)\)/);
            if (urlMatch) {
                selectionStart = before.length - 2;
                selectionEnd = selectionEnd + urlMatch[0].length;
                textarea.setSelectionRange(selectionStart, selectionEnd);
            }
        }

        const selectedText = fullText.substring(selectionStart, selectionEnd);

        // Upload is the editor's, not the button's: a host may configure it
        // top level and never put this tool on the toolbar at all.
        const upload = editor.upload;
        // The image button offers images, whatever else `upload` may accept.
        const imageTypes = upload?.accept.filter(type => type.startsWith('image/')) ?? [];
        const acceptFormats = imageTypes.length ? imageTypes.join(',') : 'image/*';

        const isAltRequired = typeof this.altInputConfig === 'boolean'
            ? this.altInputConfig
            : (this.altInputConfig.required !== false);

        const imageRegex = /^!\[([^\]]*)\]\(([^)]+)\)$/;
        const imageMatch = selectedText && selectedText.match(imageRegex);
        const prefillAlt = imageMatch ? imageMatch[1] : selectedText;
        const prefillUrl  = imageMatch ? imageMatch[2] : '';

        let fileInputTag = '';
        if (upload) {
            fileInputTag = `
                <input type="file" accept="${escapeHtml(acceptFormats)}" class="img-file-input fj:me-input fj:w-full">
                <div class="fj:me-divider fj:my-1">${escapeHtml(editor.label('OR'))}</div>
            `;
        }

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">${editor.label('Image')}</div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="${escapeHtml(editor.label('Close'))}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="fj:mt-4 fj:flex fj:flex-col fj:gap-y-4">
                ${fileInputTag}
                <input type="url" placeholder="${escapeHtml(editor.label('URL'))}" class="img-link-input fj:me-input fj:w-full" value="${escapeHtml(prefillUrl)}" required>
                <input type="text" placeholder="${escapeHtml(editor.label('Alt text'))}" class="img-link-alt-input fj:me-input fj:w-full" value="${escapeHtml(prefillAlt)}" ${isAltRequired ? 'required' : ''}>
                <p class="img-upload-error fj:me-alert fj:me-alert-soft fj:me-alert-error fj:me-alert-sm" role="alert" hidden></p>
                <button type="button" class="submit-img-link fj:me-btn fj:me-btn-sm fj:self-end">${editor.label('Apply')}</button>
            </div>`;

        const modalElement = modal(event, 'fj:max-w-sm', bodyHTML, editor.label('Image'));
        modalElement.querySelector(".modal-close-btn").addEventListener("click", () => modalElement.close());
        const submitBtn = modalElement.querySelector(".submit-img-link");

        const errorEl = modalElement.querySelector('.img-upload-error');

        submitBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            errorEl.hidden = true;

            const fileInputSelector = modalElement.querySelector(".img-file-input");
            const urlInputSelector = modalElement.querySelector(".img-link-input");
            const imgFileAltInput = modalElement.querySelector(".img-link-alt-input");

            const hasFile = fileInputSelector?.files[0];

            // --- 1. PRE-VALIDATION ---
            // If we are uploading a file, the URL is currently empty, so we temporarily
            // disable the 'required' on URL just to check the Alt text.
            if (hasFile) {
                urlInputSelector.required = false; 
            }

            // Check if Alt (and URL if no file) are valid according to config
            if (isAltRequired && !imgFileAltInput.validity.valid) {
                imgFileAltInput.reportValidity();
                if (hasFile) urlInputSelector.required = true; // Restore
                return;
            }

            if (!hasFile && !urlInputSelector.validity.valid) {
                urlInputSelector.reportValidity();
                return;
            }

            // --- 2. ASYNC UPLOAD ---
            if (hasFile && upload) {
                const file = fileInputSelector.files[0];
                submitBtn.disabled = true;
                submitBtn.textContent = editor.label('Uploading...');

                try {
                    const { path, alt } = await upload.upload(file, imgFileAltInput.value,
                        (_file, loaded, total) => {
                            // A video takes a minute. A button that says nothing
                            // for a minute reads as a button that is broken.
                            const percent = Math.round((loaded / total) * 100);
                            submitBtn.textContent = editor.label('Uploading...') + ' ' + percent + '%';
                        });

                    urlInputSelector.value = path;
                    // Only take the server's suggestion when the user wrote nothing,
                    // so a typed description is never silently replaced.
                    if (alt && !imgFileAltInput.value.trim()) imgFileAltInput.value = alt;
                } catch (err) {
                    // In the dialog rather than an alert(): a native alert is
                    // unstyled, ignores the theme, blocks the page and puts the
                    // message somewhere the file input is not. role="alert"
                    // announces it without moving focus off the field.
                    //
                    // A rule the host set rejects with a translated message;
                    // the server's own error arrives worded as the server wrote
                    // it. The detail names the type or the size, which is for
                    // the console and not for whoever picked the file.
                    errorEl.textContent = err.message || editor.label('Upload failed');
                    errorEl.hidden = false;
                    if (err.detail) console.error('[MarkdownEditor] Upload refused:', err.detail);
                    submitBtn.disabled = false;
                    submitBtn.textContent = editor.label('Apply');
                    urlInputSelector.required = true; // Restore
                    return;
                }

                submitBtn.disabled = false;
                submitBtn.textContent = editor.label('Apply');
            }

            // --- 3. FINAL INSERTION ---
            const imgLink = urlInputSelector.value;
            const imgLinkAlt = imgFileAltInput.value || '';
            const newText = `![${imgLinkAlt}](${imgLink})`;

            editor.insertText(newText);
            modalElement.close();
        });
    }
}

export default ImageTool;