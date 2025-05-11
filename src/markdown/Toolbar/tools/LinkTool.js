import MakeTool from '../MakeTool.js';
import { modal } from '../../components/modal.js';

class LinkTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Link');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M18.3638 15.5355L16.9496 14.1213L18.3638 12.7071C20.3164 10.7545 20.3164 7.58866 18.3638 5.63604C16.4112 3.68341 13.2453 3.68341 11.2927 5.63604L9.87849 7.05025L8.46428 5.63604L9.87849 4.22182C12.6122 1.48815 17.0443 1.48815 19.778 4.22182C22.5117 6.95549 22.5117 11.3876 19.778 14.1213L18.3638 15.5355ZM15.5353 18.364L14.1211 19.7782C11.3875 22.5118 6.95531 22.5118 4.22164 19.7782C1.48797 17.0445 1.48797 12.6123 4.22164 9.87868L5.63585 8.46446L7.05007 9.87868L5.63585 11.2929C3.68323 13.2455 3.68323 16.4113 5.63585 18.364C7.58847 20.3166 10.7543 20.3166 12.7069 18.364L14.1211 16.9497L15.5353 18.364ZM14.8282 7.75736L16.2425 9.17157L9.17139 16.2426L7.75717 14.8284L14.8282 7.75736Z"></path>
            </svg>
        `);
    }

    // Apply link syntax [text](url)
    applySyntax(event) {
        let editor = this.editor;
        let textarea = editor.usertextarea;
        let { selectionStart, selectionEnd } = textarea;
        let selectedText = textarea.value.substring(selectionStart, selectionEnd);
    
        // Check if the selected text contains a link syntax [text](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
    
        if (selectedText && linkRegex.test(selectedText)) {
            // If the selected text is already a link, extract the text inside the brackets
            const match = selectedText.match(linkRegex);
            const linkText = match[1];  // Text inside the square brackets
    
            // Replace the selected text with just the text
            textarea.setRangeText(linkText, selectionStart, selectionEnd, 'select');
        } else {
            // If no link syntax, prompt for the URL and apply the syntax
            
            const bodyHTML =`
                <div class="flex justify-between items-center gap-3">
                    <div class="font-medium">Link</div>
                    <button type="button" class="btn btn-ghost btn-xs btn-circle" onclick="toggleModal.remove()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                <form method="post">
                    <div class="flex flex-col justify-center gap-y-4.5 mt-4">
                        <input type="url" placeholder="URL" class="input w-full link-input" required>
                        <input type="text" placeholder="Link text" class="input w-full link-text-input" value="${selectedText}" required>
                        <button type="submit" class="btn btn-sm submit-link self-end">Apply</button>
                    </div>
                </form>`;

            const modalElement = modal(event, 'max-w-sm', bodyHTML);

            modalElement.querySelector(".submit-link").addEventListener("click", function(e){
                e.preventDefault();
                let linkInput = modalElement.querySelector(".link-input");
                let linkTextInput = modalElement.querySelector(".link-text-input");

                if (!linkInput.validity.valid) {
                    linkInput.reportValidity();
                } else if (!linkTextInput.validity.valid) {
                    linkTextInput.reportValidity();
                } else {
                    const link = linkInput.value;
                    let linkText = linkTextInput.value;

                    if(linkText == ''){
                        linkText = 'Link Text';
                    }

                    let newText = '';
                    if (selectedText) {
                        newText = `[${selectedText}](${link})`; // Insert the link with selected text
                    } else {
                        newText = `[${linkText}](${link})`; // Insert a placeholder text if nothing is selected
                    }
                    editor.insertText(newText); // Insert the constructed link markdown
                    
                    linkInput.value = '';
                    linkTextInput.value = '';
                    modalElement.close();
                }
            });
        }
    }
    
}

export default LinkTool;