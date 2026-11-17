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
     * document at two URLs is usually two records. The path and the field's
     * own name are what tell them apart without the application saying so.
     */
    _defaultKey() {
        const path = (window.location?.pathname ?? '').replace(/\/+$/, '') || '/';
        const field = this.textarea.id || this.textarea.name
            || String([...document.querySelectorAll('textarea')].indexOf(this.textarea));
        return path + ':' + field;
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

        const bar = document.createElement('div');
        bar.className = 'autosave-bar fj:flex fj:flex-wrap fj:items-center fj:gap-2'
            + ' fj:px-2 fj:py-1 fj:text-sm fj:me-surface fj:me-surface-outline'
            + ' fj:border-base-soft fj:border-0 fj:border-b';
        bar.setAttribute('role', 'status');

        const label = document.createElement('span');
        label.textContent = this.editor.label('Unsaved draft');

        const when = document.createElement('span');
        when.className = 'fj:opacity-60 fj:text-xs';
        // The browser's own formatting, so the date reads the way the rest of
        // the operating system writes dates.
        when.textContent = new Date(saved.at).toLocaleString();

        const spacer = document.createElement('span');
        spacer.className = 'fj:flex-1';

        // The text is translated at the call site rather than inside the
        // helper. locale-extract reads the source for label calls whose
        // argument is written out in full, and a variable passed through a
        // helper is invisible to it: the string would be missing from the
        // template and so from every translation, falling back to English
        // in silence.
        const button = (text, onClick, extra = '') => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'fj:me-btn fj:me-btn-xs ' + extra;
            b.textContent = text;
            b.addEventListener('click', onClick);
            return b;
        };

        bar.append(
            label, when, spacer,
            button(this.editor.label('Restore'), () => this.restore(saved), 'fj:me-btn-primary'),
            button(this.editor.label('Discard'), () => this.clear(), 'fj:me-btn-ghost'),
        );

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
