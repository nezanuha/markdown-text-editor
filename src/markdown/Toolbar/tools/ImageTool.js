import MakeTool from '../MakeTool.js';
import { modal } from '../../components/modal.js';

class ImageTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Image link');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>
            </svg>
        `);
    }

    // Apply link syntax [text](url)
    applySyntax(event) {
        const bodyHTML =`
            <div class="flex justify-between items-center gap-3">
                <div class="heading-6">Image</div>
                <button type="button" class="btn-secondary btn-xs btn-circle" onclick="toggleModal.remove()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="divider-base divider-x"></div>
            <form method="post">
                <div class="flex flex-col justify-center gap-y-4.5 mt-4">
                    <input type="url" placeholder="URL" class="input-primary w-full link-input" required>
                    <input type="text" placeholder="Alt text" class="input-primary w-full link-alt-input" value="" required>
                    <button type="submit" class="btn-primary btn-sm submit-img-link self-end">Submit</button>
                </div>
            </form>`;

        const modalElement = modal(event, 'max-w-sm', bodyHTML);

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