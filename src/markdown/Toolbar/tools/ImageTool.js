import MakeTool from '../MakeTool.js';
import { modal } from '../../components/modal.js';

class ImageTool extends MakeTool {
    constructor(editor, config = {}) {
        super(editor, 'Image link');
        this.config = config;
        this.fileInputConfig = config.fileInput || false; 
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>
            </svg>
        `);
    }

    // Apply link syntax [text](url)
    applySyntax(event) {
        const acceptFormats = this.fileInputConfig.accept
        ? this.fileInputConfig.accept.map(type => `image/${type}`).join(',')
        : 'image/*'; // Handle file formats

        const uploadUrl = this.fileInputConfig.uploadUrl || null;

        let fileInputTag = '';
        if(this.fileInputConfig){
            fileInputTag = `
                <input type="file" accept="${acceptFormats}" class="input w-full img-file-input">
                <div class="divider my-1">OR</div>
            `;
        }
    
        const bodyHTML =`
            <div class="flex justify-between items-center gap-3">
                <div class="font-medium">Image</div>
                <button type="button" class="btn btn-ghost btn-xs btn-circle" onclick="nezanuha_toggleModal.remove()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <form method="post">
                <div class="flex flex-col justify-center gap-y-4.5 mt-4">
                    ${fileInputTag}
                    <input type="url" placeholder="URL" class="input w-full img-link-input" required>
                    <input type="text" placeholder="Alt text" class="input w-full img-link-alt-input" value="" required>
                    <button type="submit" class="btn btn-sm submit-img-link self-end">Apply</button>
                </div>
            </form>`;

        const modalElement = modal(event, 'max-w-sm', bodyHTML);

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
                    imgLinkAlt = 'Alt Text';
                }

                let newText = '';
                if (selectedText) {
                    newText = `[${selectedText}](${imgLink})`; // Insert the link with selected text
                } else {
                    newText = `[${imgLinkAlt}](${imgLink})`; // Insert a placeholder text if nothing is selected
                }
                editor.insertText(newText); // Insert the constructed link markdown
                
                imgLinkInput.value = '';
                imgLinkAltInput.value = '';
                modalElement.close();
            }
        });
    }
    
}
export default ImageTool;