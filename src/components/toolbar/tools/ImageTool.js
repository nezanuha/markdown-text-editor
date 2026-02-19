import MakeTool from '../MakeTool.js';
import { modal } from '../../modal.js';

class ImageTool extends MakeTool {
    constructor(editor, config = {}) {
        super(editor, 'Image link');
        this.config = config;
        this.fileInputConfig = config.fileInput || false;
        this.altInputConfig = config.altInput || true;
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01" /><path d="M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v6.5" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4" /><path d="M14 14l1 -1c.67 -.644 1.45 -.824 2.182 -.54" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>
        `);
    }

    applySyntax(event) {
        let editor = this.editor;
        let textarea = editor.usertextarea;
        let { selectionStart, selectionEnd } = textarea;
        let selectedText = textarea.value.substring(selectionStart, selectionEnd);
        
        const acceptFormats = this.fileInputConfig.accept
            ? this.fileInputConfig.accept.map(type => `image/${type}`).join(',')
            : 'image/*';

        const altRequired = this.altInputConfig.required === undefined ? true : this.altInputConfig.required;
        const uploadUrl = this.fileInputConfig.uploadUrl || null;
        // Get custom params from config
        const customParams = this.fileInputConfig.params || {}; 

        let fileInputTag = '';
        if(this.fileInputConfig){
            fileInputTag = `
                <input type="file" accept="${acceptFormats}" class="img-file-input fj:input fj:w-full">
                <div class="fj:divider fj:my-1">OR</div>
            `;
        }

        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/;

        if (selectedText && imageRegex.test(selectedText)) {
            const match = selectedText.match(imageRegex);
            const altText = match[1];
            textarea.setRangeText(altText, selectionStart, selectionEnd, 'select');
        } else {
            const bodyHTML =`
                <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                    <div class="fj:font-medium">Image</div>
                    <button type="button" class="fj:btn fj:btn-ghost fj:btn-xs fj:btn-circle" onclick="nezanuha_toggleModal.remove()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                <form method="post">
                    <div class="fj:flex fj:flex-col fj:justify-center fj:gap-y-4.5 fj:mt-4">
                        ${fileInputTag}
                        <input type="url" placeholder="URL" class="img-link-input fj:input fj:w-full" required>
                        <input type="text" placeholder="Alt text" class="img-link-alt-input fj:input fj:w-full" value="${selectedText}" ${(altRequired) && 'required'}>
                        <button type="submit" class="submit-img-link fj:btn fj:btn-sm fj:self-end">Apply</button>
                    </div>
                </form>`;

            const modalElement = modal(event, 'fj:max-w-sm', bodyHTML);

            if(this.fileInputConfig){
                const fileInputSelector = modalElement.querySelector(".img-file-input");
                const urlInputSelector = modalElement.querySelector(".img-link-input");
                const imgFileAltInput = modalElement.querySelector(".img-link-alt-input");
                const submitBtnSelector = modalElement.querySelector(".submit-img-link");

                fileInputSelector.addEventListener("change", async () => {
                    const file = fileInputSelector.files[0];
                    if (!file || !uploadUrl) return;
                
                    submitBtnSelector.disabled = true;
                    submitBtnSelector.textContent = 'Uploading...';
                
                    const formData = new FormData();
                    formData.append('image_file', file);
                    const altValue = imgFileAltInput ? imgFileAltInput.value : '';
                    formData.append('image_alt', altValue);


                    if (this.fileInputConfig.params) {
                        Object.keys(customParams).forEach(key => {
                            formData.append(key, customParams[key]);
                        });
                    }
                
                    try {
                        const res = await fetch(uploadUrl, {
                            method: 'POST',
                            body: formData
                            // Note: Do NOT set Content-Type header manually when sending FormData
                        });
                        const result = await res.json();
                
                        if (result.success && result.image_path) {
                            urlInputSelector.value = result.image_path;
                            imgFileAltInput.value = result.image_alt || imgFileAltInput.value;
                            submitBtnSelector.disabled = false;
                            submitBtnSelector.textContent = 'Apply';
                        } else {
                            alert(result.message || 'Image upload failed.');
                            fileInputSelector.value = '';
                            submitBtnSelector.disabled = false;
                            submitBtnSelector.textContent = 'Apply';
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Upload error.');
                        fileInputSelector.value = '';
                        submitBtnSelector.disabled = false;
                        submitBtnSelector.textContent = 'Apply';
                    }
                });
            }

            modalElement.querySelector(".submit-img-link").addEventListener("click", function(e){
                e.preventDefault();
                let imgLinkInput = modalElement.querySelector(".img-link-input");
                let imgLinkAltInput = modalElement.querySelector(".img-link-alt-input");

                if (!imgLinkInput.validity.valid) {
                    imgLinkInput.reportValidity();
                } else if (!imgLinkAltInput.validity.valid) {
                    imgLinkAltInput.reportValidity();
                } else {
                    const imgLink = imgLinkInput.value;
                    let imgLinkAlt = imgLinkAltInput.value;
                    if(imgLinkAlt == ''){
                        imgLinkAlt = '';
                    }

                    let newText = '';
                    if (selectedText) {
                        newText = `![${selectedText}](${imgLink})`; // Insert the link with selected text
                    } else {
                        newText = `![${imgLinkAlt}](${imgLink})`; // Insert a placeholder text if nothing is selected
                    }
                    editor.insertText(newText); // Insert the constructed link markdown
                    
                    imgLinkInput.value = '';
                    imgLinkAltInput.value = '';
                    modalElement.close();
                }
            });
        }
    }
}
export default ImageTool;