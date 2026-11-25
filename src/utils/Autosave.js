import { lineDiff } from './lineDiff.js';
import { modal } from '../components/modal.js';
import { escapeHtml } from './escapeHtml.js';

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
 * How long ago, in words, localised by the browser rather than by this
 * library: `Intl.RelativeTimeFormat` knows every language the editor ships and
 * several it does not, and getting "2 hours ago" wrong in fifty-six locales is
 * a plural-rules problem nobody should take on by hand.
 *
 * The exact timestamp is still in the dialog. A strip is a notice, and a
 * notice wants "2 hours ago"; the second it happened matters only once you are
 * deciding, and by then you have opened the thing that says it.
 */
function ago(when) {
    const seconds = Math.round((when - Date.now()) / 1000);
    const units = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];

    try {
        // narrow: "5h ago" rather than "5 hours ago". A strip is read in
        // passing, and the age only has to be close enough to judge whether
        // the draft is worth opening. Every locale has its own short form --
        // "hace 5 h", "5時間前", "vor 5 Std." -- so this costs nothing in the
        // languages that cannot abbreviate the way English does.
        const format = new Intl.RelativeTimeFormat(undefined, {
            numeric: 'auto',
            style: 'narrow',
        });
        for (const [unit, size] of units) {
            if (Math.abs(seconds) >= size || unit === 'second') {
                return format.format(Math.round(seconds / size), unit);
            }
        }
    } catch {
        // Nothing here is worth failing an editor over.
    }
    return new Date(when).toLocaleString();
}

/**
 * The way out of a strip without answering it.
 *
 * On the offer this means "not now": the draft stays stored and is offered
 * again on the next load, which is what a reminder about unsaved work should
 * do. Discarding is the other thing, and it is behind the dialog where it can
 * say what it is deleting.
 *
 * `Close` is already a key, from the dialogs.
 */
function closeButton(label, onClose) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-ghost fj:me-btn-circle';
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    button.addEventListener('click', onClose);
    return button;
}

/**
 * What the document looked like when the draft was taken, small enough to
 * store beside it.
 *
 * The seed is only ever compared, never read back, so storing a copy of it
 * stored the document twice.
 *
 * That is what made a large paste vanish. localStorage holds about 5MB per
 * origin, shared with everything else the application keeps there, and in
 * UTF-16 a million characters is two of those megabytes. Editing a long
 * document wrote the new text and the old text on every save, so the ceiling
 * arrived at half the length anyone would guess, the write threw, and the
 * throw was swallowed.
 *
 * Length and a 32-bit hash. Two different documents collide only if they
 * match on both, which for telling "has the page changed underneath this
 * draft" is far past enough.
 */
function fingerprint(text) {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = (((hash << 5) + hash) ^ text.charCodeAt(i)) | 0;
    }
    return text.length + ':' + (hash >>> 0).toString(36);
}

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

    /**
     * Called by the editor whenever the document changes, however it changed.
     * Debounced, so a long paste or a held key writes once at the end of it
     * rather than on every character.
     */
    schedule() {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this.save(), this.delay);
    }

    save() {
        const text = this.textarea.value;
        // Back to where it started means there is nothing unsaved to keep.
        if (text === this.seed) return this.clear();

        // A document that was refused at this length will be refused again, so
        // stop asking. The cost is not the refusal, it is what comes before
        // it: JSON.stringify over the whole document, which is about 6ms at
        // five million characters, once per pause in the typing, for the rest
        // of the session. The ceiling only moves when the text gets shorter --
        // deleting half a document makes it worth another try -- so the length
        // is the right thing to remember, the way the editor's own height does
        // it with `_pinnedAt`.
        if (this._refusedAt !== undefined && text.length >= this._refusedAt) return;

        const kept = storage.set(this.key, {
            text,
            seedHash: fingerprint(this.seed),
            at: Date.now(),
        });

        if (kept) {
            this._refusedAt = undefined;
            return;
        }

        this._refusedAt = text.length;

        // Storage is allowed to refuse, and a refusal used to be swallowed:
        // the draft silently stopped being kept and the only way to find out
        // was to lose something and reload. Once per editor, because the next
        // keystroke would say it again.
        if (!this._warnedAboutStorage) {
            this._warnedAboutStorage = true;
            console.error('[MarkdownEditor] autosave could not write the draft, so it is '
                + 'not being kept. localStorage holds about 5MB per origin and this '
                + 'document is ' + text.length.toLocaleString() + ' characters; private '
                + 'browsing modes refuse it outright.');
        }
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
        // Three shapes to read. `seedHash` is what is written now; `seed` is
        // the full copy written before that, kept working so a draft does not
        // go stale-looking across an upgrade; and a draft from before either
        // field has neither. Unknown is not the same as changed, so the last
        // of those is left alone rather than called stale.
        const stale = typeof saved.seedHash === 'string'
            ? saved.seedHash !== fingerprint(this.seed)
            : (typeof saved.seed === 'string' && saved.seed !== this.seed);

        // frutjam's alert, rather than a row of utilities that imitates one:
        // it is the component for exactly this, and it takes the theme's
        // colours with it. Two changes to its defaults. It sizes to its
        // content, and this spans the editor, so w-full. It has a radius,
        // and this sits flush against the top corners of the editor, so
        // rounded-none and a rule along the bottom instead.
        const bar = document.createElement('div');
        // One colour, in every state. There were four at one point and then
        // two, and what settled it is that the words were carrying the
        // meaning the whole time: "The document has changed since then" says
        // what the amber was saying, to everyone, including the readers a
        // colour never reaches.
        //
        // No colour variant at all. It is furniture, and it gets its
        // visibility from appearing unasked at the top of the editor rather
        // than from being painted.
        // The component as it comes, plus the three things this position
        // asks for: full width, square where it meets the editor's corners,
        // and a row at every width.
        //
        // The row used to stack below 40rem, back when the strip carried
        // three buttons and a row left the message about seventy pixels
        // wide. With one button there is room, and the wrapping that is
        // left belongs inside the message rather than between the message
        // and the way to answer it.
        bar.className = 'autosave-bar fj:me-alert fj:me-alert-sm'
            + ' fj:w-full fj:rounded-none fj:me-alert-horizontal';
        bar.setAttribute('role', 'status');

        // One line: "Unsaved draft  5h ago". It fits on a phone now that the
        // age is abbreviated, so there is nothing to stack. What can still be
        // too long is the staleness note, and flex-wrap drops that onto a
        // second line by itself rather than breaking the pair above it.
        //
        // min-w-0, or that note refuses to wrap at all and pushes the button
        // off the end of a narrow screen.
        const message = document.createElement('div');
        message.className = 'fj:min-w-0 fj:flex fj:flex-wrap'
            + ' fj:items-baseline fj:gap-x-2';

        const label = document.createElement('span');
        label.textContent = this.editor.label('Unsaved draft');

        const when = document.createElement('span');
        when.className = 'fj:text-xs';

        const taken = document.createElement('span');
        taken.className = 'fj:opacity-70';
        taken.textContent = ago(saved.at);
        // The exact time, for anyone who wants it, without spending the strip
        // on fourteen characters of precision nobody reads.
        taken.title = new Date(saved.at).toLocaleString();
        when.append(taken);

        // A sibling of the pair above rather than a child of the age, so
        // flex-wrap can put it on its own line without taking the age with it.
        const note = stale ? document.createElement('span') : null;
        if (note) {
            note.className = 'fj:text-xs fj:basis-full fj:sm:basis-auto';
            note.textContent = this.editor.label('The document has changed since then');
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
        // justify-self-end, because the alert's own grid is what decides
        // where this lands. Horizontal, with two children, it sets
        // `grid-template-columns: auto minmax(auto,1fr)` and `justify-items:
        // start` -- so this column already spans the rest of the bar, and its
        // content was sitting at the near edge of it, against the message,
        // rather than at the end of the strip.
        const actions = document.createElement('div');
        actions.className = 'fj:flex fj:items-center fj:gap-1 fj:justify-self-end';
        // The strip has no variant, so neither has the button standing on
        // it. It used to take the alert's hue, back when the alert had one
        // and changed it with the state; matching nothing is now the way to
        // match the strip.

        // Discard stays a ghost. It is the other answer, not the lesser one,
        // and two filled buttons would be the editor insisting that one of
        // them is right when it cannot know.
        // One button, and it opens the dialog. Restore and Discard were here
        // too, which put both irreversible answers one unconsidered click
        // away in a strip that appears while you are reading something else.
        // Restoring overwrites the document; discarding deletes the only copy
        // of the draft. Neither is a thing to do without looking, and looking
        // is what the dialog is.
        //
        // The strip costs nothing to ignore, so the quick path is to leave it
        // alone, not to answer it fast.
        actions.append(
            button(this.editor.label('Review'),
                (event) => this._openComparison(event, saved), 'fj:me-btn-neutral'),
            closeButton(this.editor.label('Close'), () => this._hide()),
        );

        message.append(label, when);
        if (note) message.append(note);
        bar.append(message, actions);

        this.bar = bar;
        this.editor.notices.append(bar);
    }

    /**
     * The comparison, in a dialog.
     *
     * Not a pane beside the editor, which is what this was first. Side by side
     * only helps if the lines correspond, and half the width reflows prose
     * differently on each side, so the arrangement destroys the alignment that
     * was the reason for it. It also changed the editor's mode to answer a
     * question, left a live textarea next to a decision, and showed one pane at
     * a time on a phone, which is not a comparison.
     *
     * A dialog instead, because this is a decision with two outcomes rather
     * than a way of editing. Restore and Discard belong next to the evidence,
     * the editor behind it does not move, and `modal` already has the native
     * `<dialog>`, the focus trap, Escape and the theme.
     */
    _openComparison(event, saved) {
        const draftSize = escapeHtml(this.editor.label('Draft {n} chars')
            .replace('{n}', saved.text.length.toLocaleString()));
        const pageSize = escapeHtml(this.editor.label('Current {n} chars')
            .replace('{n}', this.textarea.value.length.toLocaleString()));

        const body = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div>
                    <div class="fj:font-medium">${escapeHtml(this.editor.label('Review'))}</div>
                    <div class="fj:text-xs fj:opacity-70">${escapeHtml(this.editor.label('Unsaved draft'))} &middot; ${escapeHtml(new Date(saved.at).toLocaleString())}</div>
                </div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="${escapeHtml(this.editor.label('Close'))}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="fj:mt-3 fj:flex fj:gap-2">
                <span class="fj:me-badge fj:me-badge-soft fj:me-badge-success fj:me-badge-sm">${draftSize}</span>
                <span class="fj:me-badge fj:me-badge-soft fj:me-badge-sm">${pageSize}</span>
            </div>
            <div class="autosave-diff fj:me-surface fj:me-surface-outline fj:me-surface-rounded fj:mt-2 fj:p-2 fj:text-xs fj:font-mono fj:whitespace-pre-wrap fj:break-words fj:max-h-80 fj:overflow-y-auto"></div>
            <div class="fj:mt-4 fj:flex fj:justify-end fj:gap-2">
                <button type="button" class="compare-discard fj:me-btn fj:me-btn-sm fj:me-btn-ghost">${escapeHtml(this.editor.label('Discard'))}</button>
                <button type="button" class="compare-restore fj:me-btn fj:me-btn-sm fj:me-btn-primary">${escapeHtml(this.editor.label('Restore'))}</button>
            </div>`;

        const dialog = modal(event, 'fj:max-w-3xl', body, this.editor.label('Review'));
        this._fillDiff(dialog.querySelector('.autosave-diff'), saved.text);

        dialog.querySelector('.modal-close-btn')
            .addEventListener('click', () => dialog.close());
        dialog.querySelector('.compare-restore').addEventListener('click', () => {
            dialog.close();
            this.restore(saved);
        });
        dialog.querySelector('.compare-discard').addEventListener('click', () => {
            dialog.close();
            this.discard(saved);
        });

        return dialog;
    }

    /**
     * A unified diff: what the draft takes out, what it puts in, and a few
     * lines either side to say where in the document it happened.
     *
     * Unified rather than two columns, for the reason the dialog is not a
     * pane: a column of wrapped prose does not line up with the column beside
     * it. Read top to bottom there is no alignment to break, which also means
     * it works at any width and on a phone.
     */
    _fillDiff(host, draft) {
        const CONTEXT = 3;
        const page = this.textarea.value;
        const { head, tail, removed, added } = lineDiff(page, draft);
        const pageLines = page.split('\n');

        // textContent, never innerHTML: these lines are the document, and the
        // document is what this editor must never let style itself into
        // elements.
        const row = (prefix, line, tone) => {
            const el = document.createElement('div');
            el.className = tone;
            el.textContent = prefix + (line === '' ? '\u00a0' : line);
            host.append(el);
        };
        const skipped = (n) => {
            if (n <= 0) return;
            const el = document.createElement('div');
            el.className = 'fj:opacity-40 fj:select-none';
            el.textContent = '...';
            host.append(el);
        };

        skipped(head - CONTEXT);
        for (const line of pageLines.slice(Math.max(0, head - CONTEXT), head)) {
            row('  ', line, 'fj:opacity-60');
        }

        for (const line of removed) row('- ', line, 'fj:text-error');
        for (const line of added) row('+ ', line, 'fj:text-success');

        const after = pageLines.length - tail;
        for (const line of pageLines.slice(after, after + CONTEXT)) {
            row('  ', line, 'fj:opacity-60');
        }
        skipped(tail - CONTEXT);
    }

    /**
     * Says what just happened, and offers the way back.
     *
     * Restoring and discarding are both irreversible from the strip's point of
     * view -- one overwrites the document, the other deletes the only copy of
     * the draft -- so both leave this behind. Restoring is undoable through
     * the editor's own history; discarding is not, because no text changed, so
     * what it undoes is the deletion.
     *
     * It goes when it is used or when the next keystroke arrives, since by
     * then the answer has been given.
     */
    _showUndoable(message, onUndo) {
        const bar = document.createElement('div');
        // The offer's own classes: the same strip in the same place saying
        // a different thing.
        bar.className = 'autosave-bar fj:me-alert fj:me-alert-sm'
            + ' fj:w-full fj:rounded-none fj:me-alert-horizontal';
        bar.setAttribute('role', 'status');

        const label = document.createElement('span');
        label.className = 'fj:grow fj:min-w-0';
        label.textContent = message;

        const undo = document.createElement('button');
        undo.type = 'button';
        // The same button Review is. Both strips are the same strip in the
        // same place, and the one thing on each that is not a close is the
        // one thing to press.
        undo.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-neutral';
        // Already a key, from the toolbar button that does the same thing.
        undo.textContent = this.editor.label('Undo');
        undo.addEventListener('click', () => {
            this._hide();
            onUndo();
            this._offer();

            // Undoing a restore changes the document, which schedules a save
            // like any other change. A debounce later that save would find the
            // text back at what the page loaded with -- because that is what
            // undoing it means -- and `save` reads that as nothing unsaved
            // being left, so it would clear the draft and take this strip with
            // it, about a second after putting both back.
            //
            // Rightly, for anyone who typed their way back to the original.
            // Here nothing has changed since the draft was written, so there
            // is nothing to write.
            clearTimeout(this._timer);
        });

        const actions = document.createElement('div');
        actions.className = 'fj:flex fj:items-center fj:gap-1 fj:justify-self-end';
        actions.append(undo, closeButton(this.editor.label('Close'), () => this._hide()));

        bar.append(label, actions);
        this.bar = bar;

        this.editor.notices.append(bar);

        // Held on the instance and taken off in _hide, because it used to be
        // neither: the listener outlived the strip it was added for, and the
        // first keystroke after an undo removed the strip that had just come
        // back in its place.
        this._dismiss = () => this._hide();
        this.textarea.addEventListener('input', this._dismiss);
    }

    restore(saved) {
        this.textarea.value = saved.text;
        this.textarea.focus();
        const end = saved.text.length;
        this.textarea.setSelectionRange(end, end);
        this.editor.render();
        this.editor.notifyChange();
        // Ctrl+Z puts the page's text back. Assigning `value` raises no input
        // event, so without this the undo manager never saw the replacement
        // and the text that was on screen was gone for good -- in a feature
        // whose whole purpose is not losing anybody's writing.
        this.editor.undoRedoManager?.record();
        // The draft is on screen now, so keeping it stored would offer it
        // again on the next load against text that already holds it.
        this.clear();
        this._showUndoable(this.editor.label('Draft restored'), () => {
            this.editor.undoRedoManager?.undo();
            // Restoring deleted it, since it was on screen. Undoing says that
            // was not wanted, so leaving it deleted would mean one accidental
            // click had destroyed a draft nothing kept.
            storage.set(this.key, saved);
        });
    }

    /**
     * Discarding, from the dialog, with the way back.
     *
     * Not the same as `clear`, which is housekeeping: the form was submitted,
     * the draft matched the page, the draft was too old. Nobody chose those,
     * so nobody needs offering them back.
     */
    discard(saved) {
        this.clear();
        this._showUndoable(this.editor.label('Draft discarded'),
            () => storage.set(this.key, saved));
    }

    _hide() {
        // Before the strip goes, or this outlives it and takes the next one
        // with it.
        if (this._dismiss) {
            this.textarea.removeEventListener('input', this._dismiss);
            this._dismiss = null;
        }
        this.bar?.remove();
        this.bar = null;
        // The dialog belongs to the wrapper and closes with it, and `modal`
        // takes it out of the document on close, so there is nothing of it
        // left to tidy here.
    }
}
