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
        const fullText = textarea.value;

        // Auto-expand selection if the selected text is inside an existing link [text](url)
        const before = fullText.substring(0, selectionStart);
        const after = fullText.substring(selectionEnd);
        if (before.endsWith('[') && /^\]\([^)]+\)/.test(after)) {
            const urlMatch = after.match(/^\]\(([^)]+)\)/);
            if (urlMatch) {
                selectionStart = before.length - 1;
                selectionEnd = selectionEnd + urlMatch[0].length;
                textarea.setSelectionRange(selectionStart, selectionEnd);
            }
        }

        let selectedText = fullText.substring(selectionStart, selectionEnd);

        const linkRegex = /^\[([^\]]+)\]\(([^)]+)\)$/;
        const match = selectedText && selectedText.match(linkRegex);

        const prefillText = match ? match[1] : selectedText;
        const prefillUrl  = match ? match[2] : '';

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">Link</div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <form method="post">
                <div class="fj:flex fj:flex-col fj:justify-center fj:gap-y-4.5 fj:mt-4">
                    <input type="url" placeholder="URL" class="link-input fj:me-input fj:w-full" value="${prefillUrl}" required>
                    <input type="text" placeholder="Link text" class="link-text-input fj:me-input fj:w-full" value="${prefillText}" required>
                    <button type="submit" class="submit-link fj:me-btn fj:me-btn-sm fj:self-end">Apply</button>
                </div>
            </form>`;

        const modalElement = modal(event, 'fj:max-w-sm', bodyHTML, 'Link');

        modalElement.querySelector(".modal-close-btn").addEventListener("click", () => modalElement.close());

        modalElement.querySelector(".submit-link").addEventListener("click", function(e) {
            e.preventDefault();
            const linkInput = modalElement.querySelector(".link-input");
            const linkTextInput = modalElement.querySelector(".link-text-input");

            if (!linkInput.validity.valid) {
                linkInput.reportValidity();
            } else if (!linkTextInput.validity.valid) {
                linkTextInput.reportValidity();
            } else {
                const link = linkInput.value;
                const linkText = linkTextInput.value || 'Link Text';
                editor.insertText(`[${linkText}](${link})`);
                modalElement.close();
            }
        });
    }
    
}

export default LinkTool;