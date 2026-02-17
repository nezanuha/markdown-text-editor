import MakeTool from '../MakeTool.js';
import { modal } from '../../modal.js';

class LinkTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Link');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg>
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
                <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                    <div class="fj:font-medium">Link</div>
                    <button type="button" class="fj:btn fj:btn-ghost fj:btn-xs fj:btn-circle" onclick="nezanuha_toggleModal.remove()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                <form method="post">
                    <div class="fj:flex fj:flex-col fj:justify-center fj:gap-y-4.5 fj:mt-4">
                        <input type="url" placeholder="URL" class="link-input fj:input fj:w-full" required>
                        <input type="text" placeholder="Link text" class="link-text-input fj:input fj:w-full" value="${selectedText}" required>
                        <button type="submit" class="submit-link fj:btn fj:btn-sm fj:self-end">Apply</button>
                    </div>
                </form>`;

            const modalElement = modal(event, 'fj:max-w-sm', bodyHTML);

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