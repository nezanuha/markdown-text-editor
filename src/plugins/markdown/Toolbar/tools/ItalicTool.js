import MakeTool from '../MakeTool.js';

class ItalicTool extends MakeTool {
    constructor(editor) {
        // Call the parent constructor with the markdown syntax for italic (*)
        super(editor, '*', 'Italic');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M15 20H7V18H9.92661L12.0425 6H9V4H17V6H14.0734L11.9575 18H15V20Z"></path></svg>
        `);
    }
}

export default ItalicTool;