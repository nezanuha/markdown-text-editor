import { flattenVariables } from './variables.js';
import { overlayHost, measureOffsets } from './overlay.js';

/**
 * Completes a variable as you type `{{`.
 *
 * The toolbar already has a dropdown for inserting one, which is the right
 * answer the first time and the wrong one every time after: a person writing
 * a template knows the name they want and should not have to leave the
 * keyboard, open a menu and find it in a list to get it.
 *
 * Typing `{{` opens a list of the variables whose name or value matches what
 * follows, under the caret. Arrow keys move, Enter or Tab inserts, Escape
 * closes, and typing anything that stops matching closes it too. Nothing is
 * inserted unless a key says so, so `{{` typed in the middle of a sentence
 * for its own sake costs a dismissed menu and nothing else.
 *
 * Opt out with `variableComplete: false`.
 */

// Up to the caret: two braces, one optional space, then the characters a
// variable name is made of.
//
// The space is there because both spellings are in use and neither is wrong:
// Handlebars and Mustache write `{{today}}`, while Django, Jinja and Liquid
// write `{{ today }}` and print it that way throughout their documentation.
// Somebody used to the second types the space out of habit, and without this
// the menu closed on them mid-word.
//
// One space, not any amount: two spaces is prose that happens to follow a
// brace, and a menu that stays open through a sentence is worse than one
// that closes early.
const TRIGGER = /\{\{ ?([\w.-]*)$/;

const MAX_ITEMS = 8;

export default class VariableComplete {
    constructor(editor) {
        this.editor = editor;
        this.textarea = editor.usertextarea;
        this.entries = flattenVariables(editor.variables ?? []);

        this.menu = null;
        this.items = [];
        this.active = -1;
        this.from = -1;

        this._onInput = () => this._refresh();
        this._onKeyDown = (e) => this._key(e);
        this._onBlur = () => this.close();
        this._onScroll = () => this.close();

        this.textarea.addEventListener('input', this._onInput);
        // Capture, so the menu answers Enter and the arrows before the list
        // continuation and indent handlers see them.
        this.textarea.addEventListener('keydown', this._onKeyDown, true);
        this.textarea.addEventListener('blur', this._onBlur);
        this.textarea.addEventListener('scroll', this._onScroll);
    }

    destroy() {
        this.close();
        this.textarea.removeEventListener('input', this._onInput);
        this.textarea.removeEventListener('keydown', this._onKeyDown, true);
        this.textarea.removeEventListener('blur', this._onBlur);
        this.textarea.removeEventListener('scroll', this._onScroll);
    }

    get open() {
        return this.menu !== null;
    }

    /** The `{{...}}` being typed at the caret, if there is one. */
    _query() {
        const { selectionStart, selectionEnd } = this.textarea;
        if (selectionStart !== selectionEnd) return null;
        const match = TRIGGER.exec(this.textarea.value.slice(0, selectionStart));
        if (!match) return null;
        return { text: match[1], from: selectionStart - match[0].length };
    }

    _matches(text) {
        const needle = text.toLowerCase();
        return this.entries
            .filter(e => !needle
                || e.label.toLowerCase().includes(needle)
                || e.value.toLowerCase().includes(needle))
            .slice(0, MAX_ITEMS);
    }

    _refresh() {
        if (!this.entries.length) return;
        const query = this._query();
        if (!query) return this.close();

        const matches = this._matches(query.text);
        if (!matches.length) return this.close();

        this.from = query.from;
        this._draw(matches);
    }

    _draw(matches) {
        if (!this.menu) {
            this.menu = document.createElement('ul');
            this.menu.className = 'variable-complete fj:me-menu fj:me-surface'
                + ' fj:me-surface-outline fj:me-surface-rounded fj:shadow-lg'
                + ' fj:absolute fj:z-30 fj:p-1 fj:max-w-72'
                // Eight entries is taller than a short editor, so the list
                // scrolls rather than hanging out of the bottom of one.
                // Only downwards: a placeholder longer than the menu is wide
                // put a horizontal scrollbar across the bottom of it.
                //
                // flex-nowrap matters more than it looks. The menu class lays
                // its children out as a flex column, and a flex column with a
                // height it cannot fit wraps into a second column rather than
                // scrolling: the fifth variable appeared beside the first one,
                // half outside the box.
                + ' fj:flex-nowrap fj:max-h-48 fj:overflow-y-auto fj:overflow-x-hidden';
            this.menu.setAttribute('role', 'listbox');
            this.menu.setAttribute('aria-label', this.editor.label('Variables'));
            // The caret stays in the textarea, so the menu must never take
            // focus: a click on an item would otherwise blur the text first
            // and close the menu before the click landed.
            this.menu.addEventListener('mousedown', (e) => e.preventDefault());
            overlayHost(this.editor).appendChild(this.menu);
        }

        this.menu.textContent = '';
        this.items = matches.map((entry, i) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'presentation');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', String(i === 0));
            btn.className = 'fj:me-menu-item fj:w-full fj:text-start'
                + ' fj:flex fj:items-center fj:whitespace-nowrap';
            btn.tabIndex = -1;

            const name = document.createElement('span');
            name.textContent = entry.label;
            const value = document.createElement('span');
            // The label is what someone reads; the placeholder is there to
            // confirm the choice, so it is the half that gives way.
            value.className = 'fj:opacity-60 fj:text-xs fj:ms-2 fj:min-w-0 fj:truncate';
            value.textContent = entry.value;
            btn.append(name, value);

            btn.addEventListener('click', () => this._accept(entry));
            li.appendChild(btn);
            this.menu.appendChild(li);
            return { btn, entry };
        });

        this.active = 0;
        this._mark();
        this._place();
    }

    _mark() {
        this.items.forEach((item, i) => {
            const on = i === this.active;
            item.btn.setAttribute('aria-selected', String(on));
            // frutjam's menu item highlights on hover and focus-within, and
            // this has neither: the caret stays in the textarea so that
            // typing keeps working, and the pointer is not involved. So the
            // keyboard selection paints itself.
            item.btn.classList.toggle('fj:bg-base-soft', on);
            if (on) item.btn.scrollIntoView?.({ block: 'nearest' });
        });
        // The textarea keeps focus, so the caret stays where it is typing.
        // This is what tells a screen reader which option is current.
        const current = this.items[this.active]?.btn;
        if (current && !current.id) current.id = 'vc-' + Math.random().toString(36).slice(2, 8);
        if (current) this.textarea.setAttribute('aria-activedescendant', current.id);
    }

    /**
     * Under the caret, and above it when there is no room below -- measured
     * with the same mirror the find highlights use, since a textarea will not
     * say where its caret is.
     */
    _place() {
        const caret = this.textarea.selectionStart;
        const [box] = measureOffsets(this.textarea, [[caret, caret]]);
        if (!box) return;

        const host = overlayHost(this.editor);
        const lineHeight = box.height || 20;
        const below = box.top + lineHeight - this.textarea.scrollTop;
        const menuHeight = this.menu.offsetHeight || 0;
        const room = host.clientHeight - below;

        this.menu.style.insetInlineStart = Math.max(0, box.left) + 'px';
        this.menu.style.top = (menuHeight && room < menuHeight
            ? Math.max(0, below - lineHeight - menuHeight)
            : below) + 'px';
    }

    close() {
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
        this.items = [];
        this.active = -1;
        this.from = -1;
        this.textarea.removeAttribute('aria-activedescendant');
    }

    _key(e) {
        if (!this.open) return;

        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
                e.preventDefault();
                e.stopPropagation();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                this.active = (this.active + step + this.items.length) % this.items.length;
                this._mark();
                return;
            }
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                e.stopPropagation();
                this._accept(this.items[this.active]?.entry);
                return;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                this.close();
                return;
            default:
        }
    }

    _accept(entry) {
        if (!entry) return this.close();

        const { value } = this.textarea;
        const caret = this.textarea.selectionStart;
        const before = value.slice(0, this.from);
        // Anything already typed after the caret that belongs to this
        // placeholder -- the closing braces someone's editor auto-inserted,
        // most often -- is replaced rather than left behind as `}}}}`.
        const after = value.slice(caret).replace(/^\}{1,2}/, '');

        this.close();
        this.textarea.value = before + entry.value + after;
        const at = before.length + entry.value.length;
        this.textarea.focus();
        this.textarea.setSelectionRange(at, at);
        this.editor.render();
        this.editor.notifyChange();
    }
}
