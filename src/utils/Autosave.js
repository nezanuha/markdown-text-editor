/**
 * Keeps a copy of what is being written, and offers it back after a crash.
 *
 * The textarea is the only source of truth this editor has, and that is the
 * point of it: the form submits what you typed because it is the same
 * element. A saved draft is a second copy of the same text, and two copies
 * disagree sooner or later.
 *
 * So this never restores on its own. It offers.
 *
 *     Monday     you type a draft                  stored
 *     Monday     you submit, the server saves it
 *     Tuesday    someone else edits the document   the server is now newer
 *     Wednesday  you open the page                 the textarea has their text
 *
 * An editor that restored automatically would put Monday's draft over
 * Tuesday's work and say nothing. A strip above the toolbar, with the time
 * the draft was taken, lets the person decide which one is theirs.
 *
 * Off unless asked for. It writes what someone is typing to a disk this
 * library does not own, on machines that are sometimes shared, which is a
 * decision for the application rather than a default.
 */

const PREFIX = 'mte:draft:';
const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Storage is allowed to refuse. Private browsing modes throw on access
 * rather than returning null, and a full quota throws on write. Nothing here
 * is important enough to interrupt someone's typing over.
 */
const storage = {
    get(key) {
        try {
            const raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },
    set(key, value) {
        try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch { return false; }
    },
    remove(key) {
        try { window.localStorage.removeItem(key); } catch { /* nothing to do */ }
    },
};

export default class Autosave {
    constructor(editor, options = {}) {
        this.editor = editor;
        this.textarea = editor.usertextarea;

        // What the page put in the textarea. A draft identical to this is not
        // unsaved work, it is the same text twice, and offering to restore it
        // would put a strip on screen every single load.
        this.seed = this.textarea.value;

        this.key = PREFIX + (options.key ?? this._defaultKey());
        this.maxAge = Number.isFinite(options.maxAge) ? options.maxAge : WEEK;
        this.delay = Number.isFinite(options.debounce) ? options.debounce : 1000;

        this.bar = null;
        this._timer = null;

        this._onInput = () => this._schedule();
        this.textarea.addEventListener('input', this._onInput);

        // Submitting is the application saving the text for real, so the
        // local copy has done its job.
        this.form = this.textarea.form;
        if (this.form) {
            this._onSubmit = () => this.clear();
            this.form.addEventListener('submit', this._onSubmit);
        }

        this._offer();
    }

    destroy() {
        clearTimeout(this._timer);
        this.textarea.removeEventListener('input', this._onInput);
        if (this.form && this._onSubmit) this.form.removeEventListener('submit', this._onSubmit);
        this._hide();
    }

    /**
     * Two documents being edited on one page are two drafts, and the same
     * document at two addresses is usually two records. The address and the
     * field's own name tell them apart without the application saying so.
     *
     * The whole address, not just the path. Plenty of applications put the
     * record in the query string or behind a hash, and on the path alone
     * `/edit?id=7` and `/edit?id=9` are one key -- so opening the second
     * would offer the first one's draft against it. A key that is too
     * specific loses an offer; a key that is too general offers the wrong
     * draft, and only one of those can destroy anything.
     *
     * The cost is that a URL carrying anything incidental, a campaign
     * parameter say, reads as a different document. Pass `key` where that
     * happens; the application knows what identifies its record and this
     * does not.
     */
    _defaultKey() {
        const at = window.location ?? {};
        const path = (at.pathname ?? '').replace(/\/+$/, '') || '/';
        const address = path + (at.search ?? '') + (at.hash ?? '');

        if (this.textarea.id || this.textarea.name) {
            return address + ':' + (this.textarea.id || this.textarea.name);
        }

        // Falling back to position. It works until a textarea is added or
        // removed above this one, at which point two drafts change places.
        const index = [...document.querySelectorAll('textarea')].indexOf(this.textarea);
        console.warn('[MarkdownEditor] autosave has no id or name to key the draft on, '
            + "so it is using this field's position on the page. Adding an id, or "
            + 'passing autosave: { key }, keeps the draft attached to the right field.');
        return address + ':' + index;
    }

    _schedule() {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this.save(), this.delay);
    }

    save() {
        const text = this.textarea.value;
        // Back to where it started means there is nothing unsaved to keep.
        if (text === this.seed) return this.clear();
        storage.set(this.key, { text, seed: this.seed, at: Date.now() });
    }

    clear() {
        clearTimeout(this._timer);
        storage.remove(this.key);
        this._hide();
    }

    /** The stored draft, if there is one worth offering. */
    read() {
        const saved = storage.get(this.key);
        if (!saved || typeof saved.text !== 'string') return null;
        if (!Number.isFinite(saved.at) || Date.now() - saved.at > this.maxAge) {
            storage.remove(this.key);
            return null;
        }
        // Already on screen, so there is nothing to offer.
        if (saved.text === this.textarea.value) return null;
        return saved;
    }

    _offer() {
        const saved = this.read();
        if (!saved) return;

        // Whether the page has moved on underneath this draft.
        //
        // The seed is the text the textarea held when the draft was taken.
        // If the textarea starts with something else today, somebody saved
        // in between, and this draft was written against a version that no
        // longer exists: restoring it drops whatever they added. The editor
        // cannot tell which text is wanted, but it can say that the choice
        // costs something, which is the difference between an informed
        // decision and a surprised one.
        //
        // Drafts written before this field existed have no seed. Unknown is
        // not the same as changed, so they are left alone.
        const stale = typeof saved.seed === 'string' && saved.seed !== this.seed;

        // frutjam's alert, rather than a row of utilities that imitates one:
        // it is the component for exactly this, and it takes the theme's
        // colours with it. Two changes to its defaults. It sizes to its
        // content, and this spans the editor, so w-full. It has a radius,
        // and this sits flush against the top corners of the editor, so
        // rounded-none and a rule along the bottom instead.
        const bar = document.createElement('div');
        bar.className = 'autosave-bar fj:me-alert fj:me-alert-soft'
            + (stale ? ' fj:me-alert-warning' : ' fj:me-alert-info')
            + ' fj:me-alert-sm fj:w-full fj:rounded-none'
            // The alert lays its children out in a row, which on a phone
            // leaves the message about seventy pixels wide while the two
            // buttons keep their full width. Stacked below 40rem, in a row
            // above it.
            + ' fj:me-alert-vertical fj:sm:me-alert-horizontal'
            + ' fj:border-base-soft fj:border-0 fj:border-b';
        bar.setAttribute('role', 'status');

        const label = document.createElement('span');
        label.textContent = this.editor.label('Unsaved draft');

        // Second child, which is the one the alert's grid lets grow, so the
        // buttons are pushed to the end without a spacer element.
        const when = document.createElement('span');
        when.className = 'fj:text-xs';

        const taken = document.createElement('span');
        taken.className = 'fj:opacity-70';
        // The browser's own formatting, so the date reads the way the rest of
        // the operating system writes dates.
        taken.textContent = new Date(saved.at).toLocaleString();
        when.append(taken);

        if (stale) {
            const note = document.createElement('span');
            note.className = 'fj:ms-2';
            note.textContent = this.editor.label('The document has changed since then');
            when.append(note);
        }


        // The text is translated at the call site rather than inside the
        // helper. locale-extract reads the source for label calls whose
        // argument is written out in full, and a variable passed through a
        // helper is invisible to it: the string would be missing from the
        // template and so from every translation, falling back to English
        // in silence.
        const button = (text, onClick, variant) => {
            const b = document.createElement('button');
            b.type = 'button';
            // The buttons borrow the colour they are standing on rather than
            // carrying one of their own. A button painted from the base
            // palette is a grey rectangle on an amber strip, visibly from
            // somewhere else, and it would need saying twice: once for the
            // informational strip and again for the warning one.
            //
            // The component as it comes. Pointing its colour variables at
            // the alert did make the two match, but it meant this file
            // knowing which variables frutjam paints a button from, which is
            // frutjam's detail to change and would go wrong quietly here if
            // it ever did.
            b.className = 'fj:me-btn fj:me-btn-xs ' + variant;
            b.textContent = text;
            b.addEventListener('click', onClick);
            return b;
        };

        // The two buttons travel as one child. The alert puts a 1rem gutter
        // between its children, which is right between the message and the
        // choice and far too much between the two halves of that choice.
        const actions = document.createElement('div');
        actions.className = 'fj:flex fj:items-center fj:gap-1';
        // Restore takes the strip's own colour, so the two belong together.
        // A button left on the base palette lands on a tinted alert as a
        // grey block from another room; this is the same hue, filled, which
        // reads as part of the notice rather than something dropped on it.
        //
        // Both class names are written out in full on purpose. Tailwind
        // finds classes by reading the source, so a name assembled at
        // runtime -- 'fj:me-btn-' + state -- is never emitted, and the
        // button silently loses its colour instead of failing.
        const accent = stale ? 'fj:me-btn-warning' : 'fj:me-btn-info';

        // Discard stays a ghost. It is the other answer, not the lesser one,
        // and two filled buttons would be the editor insisting that one of
        // them is right when it cannot know.
        actions.append(
            button(this.editor.label('Restore'), () => this.restore(saved), accent),
            button(this.editor.label('Discard'), () => this.clear(), 'fj:me-btn-ghost'),
        );

        bar.append(label, when, actions);

        this.bar = bar;
        const container = this.editor.editorContainer;
        container.insertBefore(bar, container.firstChild);
    }

    restore(saved) {
        this.textarea.value = saved.text;
        this.textarea.focus();
        const end = saved.text.length;
        this.textarea.setSelectionRange(end, end);
        this.editor.render();
        this.editor.notifyChange();
        // The draft is on screen now, so keeping it stored would offer it
        // again on the next load against text that already holds it.
        this.clear();
    }

    _hide() {
        this.bar?.remove();
        this.bar = null;
    }
}
