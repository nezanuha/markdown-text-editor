import MakeTool from '../MakeTool.js';

class CheckListTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Check list');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3.5 5.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 11.5l1.5 1.5l2.5 -2.5" /><path d="M3.5 17.5l1.5 1.5l2.5 -2.5" /><path d="M11 6l9 0" /><path d="M11 12l9 0" /><path d="M11 18l9 0" /></svg>
        `);
    }
    
    applySyntax() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd } = textarea;
        const value = textarea.value;
        const selectedText = value.substring(selectionStart, selectionEnd);

        const syntax = '- [x] ';
        const syntaxUnchecked = '- [ ] ';
        let newText = '';
        let offset = 0;

        if (selectedText.startsWith(syntax) || selectedText.startsWith(syntaxUnchecked)) {
            newText = selectedText.slice(syntax.length);
        } else {
            const before = value.substring(selectionStart - syntax.length, selectionStart);
            if (before === syntax || before === syntaxUnchecked) {
                textarea.setSelectionRange(selectionStart - syntax.length, selectionEnd);
                this.editor.insertText(selectedText, 0, 0);
                return;
            }
            newText = `${syntax}${selectedText || 'Check list'}`;
            offset = syntax.length;
        }

        this.editor.insertText(newText, offset);
    }
}


export default CheckListTool;