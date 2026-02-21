import MakeTool from '../MakeTool.js';
import { modal } from '../../modal.js';

class ImageTool extends MakeTool {
    constructor(editor, config = {}) {
        super(editor, 'Image link');
        this.config = config;
        this.fileInputConfig = config.fileInput || false;
        // Logic: Respect config or default to true
        this.altInputConfig = config.altInput !== undefined ? config.altInput : { required: true };
        
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01" /><path d="M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v6.5" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4" /><path d="M14 14l1 -1c.67 -.644 1.45 -.824 2.182 -.54" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>
        `);
    }

    applySyntax(event) {
        const editor = this.editor;
        const textarea = editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        const acceptFormats = this.fileInputConfig.accept
            ? this.fileInputConfig.accept.map(type => `image/${type}`).join(',')
            : 'image/*';

        const isAltRequired = typeof this.altInputConfig === 'boolean' 
            ? this.altInputConfig 
            : (this.altInputConfig.required !== false);

        const uploadUrl = this.fileInputConfig.uploadUrl || null;
        const customParams = this.fileInputConfig.params || {};

        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/;
        if (selectedText && imageRegex.test(selectedText)) {
            const match = selectedText.match(imageRegex);
            textarea.setRangeText(match[1], selectionStart, selectionEnd, 'select');
            return;
        }

        let fileInputTag = '';
        if (this.fileInputConfig) {
            fileInputTag = `
                <input type="file" accept="${acceptFormats}" class="img-file-input fj:input fj:w-full">
                <div class="fj:divider fj:my-1">OR</div>
            `;
        }

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">Image</div>
                <button type="button" class="fj:btn fj:btn-ghost fj:btn-xs fj:btn-circle" onclick="nezanuha_toggleModal.remove()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="fj:mt-4 fj:flex fj:flex-col fj:gap-y-4">
                ${fileInputTag}
                <input type="url" placeholder="URL" class="img-link-input fj:input fj:w-full" required>
                <input type="text" placeholder="Alt text" class="img-link-alt-input fj:input fj:w-full" value="${selectedText}" ${isAltRequired ? 'required' : ''}>
                <button type="button" class="submit-img-link fj:btn fj:btn-sm fj:self-end">Apply</button>
            </div>`;

        const modalElement = modal(event, 'fj:max-w-sm', bodyHTML);
        const submitBtn = modalElement.querySelector(".submit-img-link");

        submitBtn.addEventListener("click", async (e) => {
            e.preventDefault();

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
            if (hasFile && uploadUrl) {
                const file = fileInputSelector.files[0];
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';

                const formData = new FormData();
                formData.append('image_file', file);
                formData.append('image_alt', imgFileAltInput.value);

                Object.keys(customParams).forEach(key => {
                    formData.append(key, customParams[key]);
                });

                try {
                    const res = await fetch(uploadUrl, { method: 'POST', body: formData });
                    const result = await res.json();

                    if (result.success && result.image_path) {
                        urlInputSelector.value = result.image_path;
                        if (result.image_alt) imgFileAltInput.value = result.image_alt;
                    } else {
                        alert(result.error || result.message || 'Image upload failed.');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Apply';
                        urlInputSelector.required = true; // Restore
                        return;
                    }
                } catch (err) {
                    alert(result.error || result.message || 'Upload failed.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Apply';
                    urlInputSelector.required = true; // Restore
                    return;
                }
                
                submitBtn.disabled = false;
                submitBtn.textContent = 'Apply';
            }

            // --- 3. FINAL INSERTION ---
            const imgLink = urlInputSelector.value;
            const imgLinkAlt = imgFileAltInput.value || '';
            
            const newText = selectedText 
                ? `![${selectedText}](${imgLink})` 
                : `![${imgLinkAlt}](${imgLink})`;

            editor.insertText(newText);
            modalElement.close();
        });
    }
}

export default ImageTool;