import MakeTool from '../MakeTool.js';

class HeadingTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Heading');
        this.currentHeading = 1;  // Start with Heading 1
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17 11V4H19V21H17V13H7V21H5V4H7V11H17Z"></path></svg>
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

        // If there is a heading, continue from the current level
        if (selectedText) {
            const currentLevel = selectedText.match(/^#+/);  // Match the number of # symbols at the start
            if (currentLevel) {
                let headingCount = currentLevel[0].length;
                if (headingCount === 6) {
                    newText = cleanText;  // Just plain text
                } else {
                    newText = `${'#'.repeat(headingCount + 1)} ${cleanText}`;
                }
            } else {
                // If no # symbol, start from # (Heading 1)
                newText = `# ${cleanText}`;
            }
        } else {
            // If no text is selected, use default "Heading"
            newText = `${'#'.repeat(this.currentHeading)} Heading`;
        }

        // Insert the new heading text and replace any selected text
        this.editor.insertText(newText, true);

        // Cycle heading levels after applying the heading
        if (this.currentHeading === 6) {
            this.currentHeading = 1;  // Reset to # for Heading 1 after reaching Heading 6
        } else {
            this.currentHeading++;  // Increment the heading level
        }
    }
}

export default HeadingTool;
