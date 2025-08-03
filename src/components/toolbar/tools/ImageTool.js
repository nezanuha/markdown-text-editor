import MakeTool from '../MakeTool.js';
import { modal } from '../../modal.js';

class ImageTool extends MakeTool {
    constructor(editor, config = {}) {
        super(editor, 'Image link');
        this.config = config;
        this.fileInputConfig = config.fileInput || false;
        this.altInputConfig = config.altInput || true;
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>
            </svg>
        `);
    }

    // Apply link syntax [text](url)
    applySyntax(event) {
        let editor = this.editor;
        let textarea = editor.usertextarea;
        let { selectionStart, selectionEnd } = textarea;
        let selectedText = textarea.value.substring(selectionStart, selectionEnd);
        
        const acceptFormats = this.fileInputConfig.accept
        ? this.fileInputConfig.accept.map(type => `image/${type}`).join(',')
        : 'image/*'; // Handle file formats

        const altRequired = this.altInputConfig.required === undefined ? true : this.altInputConfig.required;

        const uploadUrl = this.fileInputConfig.uploadUrl || null;

        let fileInputTag = '';
        if(this.fileInputConfig){
            fileInputTag = `
                <input type="file" accept="${acceptFormats}" class="img-file-input fj:input fj:w-full">
                <div class="fj:divider fj:my-1">OR</div>
            `;
        }
            // Check if the selected text contains an image markdown syntax ![alt text](url)
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/;

        if (selectedText && imageRegex.test(selectedText)) {
            // If the selected text is already an image markdown, extract the alt text and URL
            const match = selectedText.match(imageRegex);
            const altText = match[1];  // Alt text inside the square brackets
            // const imageUrl = match[2]; // URL inside the parentheses

            // Replace the selected text with just the text
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
                const submitBtnSelector = modalElement.querySelector(".submit-img-link");

                fileInputSelector.addEventListener("change", async () => {
                    const file = fileInputSelector.files[0];
                    if (!file || !uploadUrl) return;
                
                    submitBtnSelector.disabled = true;
                    submitBtnSelector.textContent = 'Uploading...';
                
                    const formData = new FormData();
                    formData.append('image', file);
                
                    try {
                        const res = await fetch(uploadUrl, {
                            method: 'POST',
                            body: formData
                        });
                        const result = await res.json();
                
                        if (result.success && result.path) {
                            urlInputSelector.value = result.path;
                            submitBtnSelector.disabled = false;
                            submitBtnSelector.textContent = 'Apply';
                        } else {
                            alert('Image upload failed.');
                            fileInputSelector.value = ''; // ✅ Reset file input
                            submitBtnSelector.disabled = false;
                            submitBtnSelector.textContent = 'Apply';
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Upload error.');
                        fileInputSelector.value = ''; // ✅ Reset file input
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