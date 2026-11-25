class Tool {
    constructor(editor, title) {
        this.editor = editor;
        this.defaultText = `${title} text`; // Default text if nothing is selected
        this.button = this.createButton();
        this.title = title
    }

    /**
     * Shrinks the selection so it holds no leading or trailing whitespace.
     *
     * Double-clicking a word takes the space after it in Chrome and usually in
     * Edge, and triple-clicking a line takes the newline. Wrapping that raw
     * selection puts the closing marker on the wrong side of the space, giving
     * `**Lorem **ipsum`, which no parser reads as bold (#47).
     *
     * Call it first in applySyntax for any tool that wraps a selection inline.
     * Line based tools do not want it: a trailing newline is what tells them
     * which lines the selection covers.
     *
     * A selection that is nothing but whitespace is left alone, since trimming
     * it would leave an empty range and change what the tool does.
     */
    trimSelection() {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd, value } = textarea;
        if (selectionStart === selectionEnd) return;

        let start = selectionStart;
        let end = selectionEnd;
        while (start < end && /\s/.test(value[start])) start++;
        while (end > start && /\s/.test(value[end - 1])) end--;

        if (start === end) return;
        if (start !== selectionStart || end !== selectionEnd) {
            textarea.setSelectionRange(start, end);
        }
    }

    /**
     * Where a pair of markers sits relative to the selection, or null.
     *
     * `inside` means the selection holds the markers, so taking them off the
     * selected text is enough. `outside` means they sit just beyond it, which
     * is what you get by double-clicking the word in `**word**` or `$x^2$`, and
     * unwrapping has to widen the selection to swallow them first.
     *
     * `open` and `close` differ for block maths, whose markers are written on
     * their own lines.
     */
    fencedBy({ open, close = open }) {
        const { selectionStart, selectionEnd, value } = this.editor.usertextarea;
        const selected = value.slice(selectionStart, selectionEnd);

        if (selected.length > open.length + close.length
            && selected.startsWith(open) && selected.endsWith(close)) return 'inside';

        // A negative slice start counts from the end of the string, so guard
        // rather than let a selection near the start read from the far end.
        if (selectionStart >= open.length
            && value.slice(selectionStart - open.length, selectionStart) === open
            && value.slice(selectionEnd, selectionEnd + close.length) === close) return 'outside';

        return null;
    }

    /**
     * Toggles a pair of markers around the selection, handling all three cases
     * fencedBy distinguishes.
     *
     * Bold, italic, code and maths each worked this out separately, and maths
     * was written without the `outside` case: selecting the contents of `$x^2$`
     * and pressing the button wrapped it again, which turns inline maths into
     * display maths. Bold and italic keep their own versions, because they also
     * have to unpick `***bold italic***` into one marker or the other, and that
     * does not generalise.
     */
    toggleFence({ open, close = open, placeholder = '' }) {
        const textarea = this.editor.usertextarea;
        const { selectionStart, selectionEnd, value } = textarea;
        const selected = value.slice(selectionStart, selectionEnd);

        switch (this.fencedBy({ open, close })) {
            case 'inside':
                this.editor.insertText(selected.slice(open.length, -close.length));
                return;
            case 'outside':
                textarea.setSelectionRange(selectionStart - open.length,
                                           selectionEnd + close.length);
                this.editor.insertText(selected);
                return;
        }

        const body = selected || placeholder;
        this.editor.insertText(open + body + close, open.length, close.length);
    }

    // Create a button element (can be overridden in child classes)
    createButton(iconHtml) {
        const btn = document.createElement('button');
        const btnClass = this.title ? `${this.title.replace(/ /g, '-')}-btn`.toLowerCase() : '';
        btn.innerHTML = iconHtml;
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('aria-hidden', 'true');
        btn.type = 'button';
        // The class stays keyed on the English title so styling and tests are
        // unaffected by translation; only what the user sees is translated.
        btn.title = this.title ? this.editor.label(this.title) : this.title;
        btn.className = `markdown-btn ${btnClass} fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost`;
        btn.addEventListener('click', (event) => this.applySyntax(event));  // Default to 'both', can change in child

        if (btnClass == 'preview-btn') {
            // Stuck to the end of the bar as it scrolls, with a rule between
            // it and the tools it follows.
            //
            // Logical, not `-right-2` and `border-l`. The toolbar is a flex
            // row, so under dir="rtl" it lays out from the right and this
            // button is the leftmost thing in it -- pinned with `right` it
            // went to the far side of the scrollport and sat over undo, and
            // the rule was drawn down its outer edge instead of between. The
            // find panel had the same bug for the same reason.
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'fj:me-surface fj:me-surface-outline fj:border-base-soft fj:border-0 fj:border-s fj:sticky fj:-end-2 fj:px-1.5';
            btnWrapper.appendChild(btn);
            return btnWrapper;
        }


        return btn;
    }
}

export default Tool;
