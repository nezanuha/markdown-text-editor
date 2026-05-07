import MakeTool from '../MakeTool.js';

class CodeBlockTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Code Block');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 9l3 3l-3 3" /><path d="M13 15l3 0" /><rect x="3" y="4" width="18" height="16" rx="2" /></svg>
        `);
    }

    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        // Toggle off: full fenced block selected (``` ... ```)
        if (selectedText.startsWith('```') && selectedText.endsWith('```') && selectedText.length > 6) {
            const inner = selectedText.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
            this.editor.insertText(inner, 0, 0);
            return;
        }

        const inner = selectedText || 'code';
        const newText = `\`\`\`\n${inner}\n\`\`\``;
        // offset 4 = past "```\n"; trailing 4 = past "\n```" — selects the inner content
        this.editor.insertText(newText, 4, 4);
    }
}

export default CodeBlockTool;
