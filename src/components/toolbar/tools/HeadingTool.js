import MakeTool from '../MakeTool.js';

class HeadingTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Heading');
        this.currentHeading = 1;  // Start with Heading 1
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 12h10" /><path d="M7 5v14" /><path d="M17 5v14" /><path d="M15 19h4" /><path d="M15 5h4" /><path d="M5 19h4" /><path d="M5 5h4" /></svg>
        `);
    }

    // Apply heading syntax (e.g., # sample text for h1, ## sample text for h2, etc.)
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        // Strip any existing heading symbols (i.e., # or ##) from the selected text
        const headingRegex = /^#+\s*/; // Regex to match any # followed by space
        let cleanText = selectedText.replace(headingRegex, '');  // Remove existing heading

        let newText = '';
        let offset = 0;

        // If there is a heading, continue from the current level
        if (selectedText) {
            const currentLevel = selectedText.match(/^#+/);
            if (currentLevel) {
                let headingCount = currentLevel[0].length;
                if (headingCount === 6) {
                    newText = cleanText;
                } else {
                    newText = `${'#'.repeat(headingCount + 1)} ${cleanText}`;
                }
            } else {
                newText = `# ${cleanText}`;
            }
        } else {
            const prefix = `${'#'.repeat(this.currentHeading)} `;
            newText = `${prefix}Heading`;
            offset = prefix.length;
        }

        this.editor.insertText(newText, offset);

        // Cycle heading levels after applying the heading
        if (this.currentHeading === 6) {
            this.currentHeading = 1;  // Reset to # for Heading 1 after reaching Heading 6
        } else {
            this.currentHeading++;  // Increment the heading level
        }
    }
}

export default HeadingTool;
