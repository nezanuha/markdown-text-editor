export default class IndentManager {
    constructor(textarea, renderCallback) {
        this.textarea = textarea;
        this.renderCallback = renderCallback;
        this.pairs = {
            '{': '}',
            '[': ']',
            '(': ')',
            '<': '>',
            '"': '"',
            "'": "'"
        };
        this.init();
    }

    init() {
        this.textarea.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Tab':
                    e.preventDefault();
                    e.shiftKey ? this.outdent() : this.indent();
                    this._triggerUpdate();
                    break;
                case 'Enter':
                    this.autoIndent(e);
                    break;
                case 'Backspace':
                    this.handleBackspace(e);
                    break;
                default:
                    if (this.pairs[e.key]) this.handlePairs(e);
            }
        });
    }

    handlePairs(e) {
        const { textarea } = this;
        const { selectionStart, selectionEnd, value } = textarea;
        const char = e.key;

        // 1. Overtyping Logic
        // If the cursor is right before the closing character and the user types it
        if (selectionStart === selectionEnd && value[selectionStart] === char) {
            const isClosingChar = Object.values(this.pairs).includes(char);
            if (isClosingChar) {
                e.preventDefault();
                const newPos = selectionStart + 1;
                textarea.setSelectionRange(newPos, newPos);
                return; // Just move the cursor, don't trigger an update
            }
        }

        const open = char;
        const close = this.pairs[open];
        if (!close) return; // Not a paired character

        // 2. Selection Wrapping
        if (selectionStart !== selectionEnd) {
            e.preventDefault();
            const selectedText = value.substring(selectionStart, selectionEnd);
            const newValue = value.substring(0, selectionStart) + open + selectedText + close + value.substring(selectionEnd);
            
            textarea.value = newValue;
            textarea.setSelectionRange(selectionStart + 1, selectionEnd + 1);
            this._triggerUpdate();
        } 
        
        // 3. Standard Pair Insertion
        else {
            e.preventDefault();
            const before = value.substring(0, selectionStart);
            const after = value.substring(selectionEnd);
            
            textarea.value = before + open + close + after;
            textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
            this._triggerUpdate();
        }
    }

    // Add this to your init() listener for 'keydown'
    handleBackspace(e) {
        const { textarea } = this;
        const { selectionStart, selectionEnd, value } = textarea;

        if (selectionStart === selectionEnd && selectionStart > 0) {
            const charBefore = value[selectionStart - 1];
            const charAfter = value[selectionStart];

            // If user deletes '(' when text is '()', delete the ')' too
            if (this.pairs[charBefore] === charAfter) {
                e.preventDefault();
                const before = value.substring(0, selectionStart - 1);
                const after = value.substring(selectionStart + 1);
                
                textarea.value = before + after;
                textarea.setSelectionRange(selectionStart - 1, selectionStart - 1);
                this._triggerUpdate();
            }
        }
    }

    autoIndent(e) {
        const { textarea } = this;
        const { selectionStart, value } = textarea;

        const lastNewline = value.lastIndexOf('\n', selectionStart - 1);
        const currentLine = value.substring(lastNewline + 1, selectionStart);
        const indent = (currentLine.match(/^[ \t]*/) || [''])[0];

        // EXTRA: If user hits Enter between { and }, add an extra indent level
        const charBefore = value[selectionStart - 1];
        const charAfter = value[selectionStart];
        
        if (charBefore === '{' && charAfter === '}') {
            e.preventDefault();
            const tab = '\t'; // or '    '
            const insertion = '\n' + indent + tab + '\n' + indent;
            
            textarea.value = value.substring(0, selectionStart) + insertion + value.substring(selectionStart);
            
            // Put cursor on the middle (indented) line
            const newPos = selectionStart + indent.length + tab.length + 1;
            textarea.setSelectionRange(newPos, newPos);
            this._triggerUpdate();
            return;
        }

        if (indent.length > 0) {
            e.preventDefault();
            const insertion = '\n' + indent;
            textarea.value = value.substring(0, selectionStart) + insertion + value.substring(textarea.selectionEnd);
            const newPos = selectionStart + insertion.length;
            textarea.setSelectionRange(newPos, newPos);
            this._triggerUpdate();
        }
    }

    _triggerUpdate() {
        if (typeof this.renderCallback === 'function') this.renderCallback();
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Inside IndentManager class
    indent() {
        const { textarea } = this;
        const { selectionStart, selectionEnd, value } = textarea;

        const startPos = value.lastIndexOf('\n', selectionStart - 1) + 1;
        let endPos = value.indexOf('\n', selectionEnd);
        if (endPos === -1) endPos = value.length;

        const targetText = value.substring(startPos, endPos);
        const lines = targetText.split('\n');
        const indentedText = lines.map(line => '\t' + line).join('\n');
        
        this._applyChange(
            value.substring(0, startPos) + indentedText + value.substring(endPos),
            selectionStart + 1,
            selectionEnd + lines.length
        );
        
        // Add this so external calls auto-update
        this._triggerUpdate(); 
    }

    outdent() {
        const { textarea } = this;
        const { selectionStart, selectionEnd, value } = textarea;

        // 1. Find the start and end of the affected lines
        const startPos = value.lastIndexOf('\n', selectionStart - 1) + 1;
        let endPos = value.indexOf('\n', selectionEnd);
        if (endPos === -1) endPos = value.length;

        const targetText = value.substring(startPos, endPos);
        const lines = targetText.split('\n');
        
        let removedFromFirst = 0;
        let totalRemoved = 0;

        // 2. Process each line
        const unindentedText = lines.map((line, index) => {
            if (line.startsWith('\t')) {
                if (index === 0) removedFromFirst = 1;
                totalRemoved++;
                return line.substring(1);
            } else if (line.startsWith('    ')) { // Optional: handle 4-space indent
                if (index === 0) removedFromFirst = 4;
                totalRemoved += 4;
                return line.substring(4);
            }
            return line;
        }).join('\n');

        // 3. Apply the change to the DOM
        this._applyChange(
            value.substring(0, startPos) + unindentedText + value.substring(endPos),
            Math.max(startPos, selectionStart - removedFromFirst),
            Math.max(startPos, selectionEnd - totalRemoved)
        );

        // 4. Trigger the undo stack and re-render
        this._triggerUpdate();
    }

    _applyChange(newValue, newStart, newEnd) {
        this.textarea.value = newValue;
        this.textarea.setSelectionRange(newStart, newEnd);
    }
}