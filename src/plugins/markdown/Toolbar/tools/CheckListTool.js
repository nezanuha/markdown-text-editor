import MakeTool from '../MakeTool.js';

class CheckListTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Check list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8.00008 6V9H5.00008V6H8.00008ZM3.00008 4V11H10.0001V4H3.00008ZM13.0001 4H21.0001V6H13.0001V4ZM13.0001 11H21.0001V13H13.0001V11ZM13.0001 18H21.0001V20H13.0001V18ZM10.7072 16.2071L9.29297 14.7929L6.00008 18.0858L4.20718 16.2929L2.79297 17.7071L6.00008 20.9142L10.7072 16.2071Z"></path></svg>
        `);
    }
    
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        const syntax = '- [x] ';
        let newText = '';
        if (selectedText.startsWith(syntax)) {
            // Remove the checklist syntax if it's already wrapped
            newText = selectedText.slice(syntax.length);
        } else {
            // Apply check list syntax
            newText = `${syntax}${selectedText || 'Check list'}`;
        }

        this.editor.insertText(newText);
    }
}


export default CheckListTool;