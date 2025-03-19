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
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);
    
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
            modal(event);
            const url = prompt("Enter the URL:", "https://");
            if (url) {
                let newText = '';
                if (selectedText) {
                    newText = `[${selectedText}](${url})`; // Insert the link with selected text
                } else {
                    newText = `[Link text](${url})`; // Insert a placeholder text if nothing is selected
                }
    
                this.editor.insertText(newText); // Insert the constructed link markdown
            }
        }
    }
    
}

export default LinkTool;