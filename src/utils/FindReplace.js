import { overlayHost, clearScrollbar, setPressed, measureOffsets } from './overlay.js';

// Past this many matches the marks cost more than they are worth: a thousand
// elements over text nobody can take in at once. Only the current one is drawn
// beyond it, so finding still works on a document full of the word "the".
const HIGHLIGHT_LIMIT = 400;

// What each control answers to. The name is the translated one; the key is
// never translated, because a keyboard's Alt+C is Alt+C in every language.
// VS Code's bindings, so anyone who has used an editor already knows them.
const SHORTCUTS = {
    caseSensitive: 'Alt+C',
    wholeWord: 'Alt+W',
    regex: 'Alt+R',
    inSelection: 'Alt+L',
    preserveCase: 'Alt+P',
    next: 'Enter',
    prev: 'Shift+Enter',
    replaceAll: 'Control+Alt+Enter',
    close: 'Escape',
    toggleReplace: 'Control+H',
};

export default class FindReplace {
    constructor(editor) {
        this.editor = editor;
        this._matches = [];
        this._currentIndex = -1;
        this._caseSensitive = false;
        this._panel = null;
        this._findInput = null;
        this._replaceInput = null;
        this._countEl = null;
        this._replaceRow = null;
        this._caseSensitiveBtn = null;
        this._highlightEl = null;
        this._wholeWord = false;
        this._useRegex = false;
        this._badPattern = false;
        this._matchTop = null;
        this._matchHeight = 0;
        this._scrollHandler = null;
        this._editTimer = null;
        this._stale = false;
        this._lastValue = null;

        this._taHandler = this._onTextareaKeyDown.bind(this);
        editor.usertextarea.addEventListener('keydown', this._taHandler);
    }

    _onTextareaKeyDown(e) {
        // While find is open its shortcuts belong to the whole editor, not
        // just to the panel. Clicking into the text to look at a match and
        // then pressing Alt+W is the ordinary way to use this, and a handler
        // bound to the panel alone never sees that key.
        if (this._panel && !this._panel.hidden && this._keyShortcut(e)) return;

        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key === 'f') {
            e.preventDefault();
            this.open(false);
        } else if (ctrl && e.key === 'h') {
            e.preventDefault();
            this.open(true);
        }
    }

    /**
     * Re-reads the document after it has been edited behind the panel.
     *
     * On a pause rather than on each keystroke. The scan itself is cheap,
     * measuring 0.6ms over 260k characters with twelve thousand matches, so
     * this is not about saving that. It is about what a pathological pattern
     * can do with it: a regular expression that backtracks for seconds now
     * gets one chance per pause instead of one per character typed. Not a
     * guard — there is no way to interrupt a running regular expression —
     * but it stops a bad pattern turning every keystroke into a freeze.
     *
     * Without scrolling: the reader is typing, and moving the view to a match
     * elsewhere would take the caret off the screen. The marks still move to
     * where the text now is, and the count still follows.
     */
    _onDocumentEdit() {
        if (!this._panel || this._panel.hidden) return;
        this._moveScope();
        this._stale = true;
        clearTimeout(this._editTimer);
        this._editTimer = setTimeout(() => this._flushEdit(), 150);
    }

    /**
     * Keeps a "find in selection" range over the same text as it is edited.
     *
     * The range is a pair of offsets, so typing anywhere before it slides the
     * text out from under it. Selecting a paragraph, turning the switch on,
     * then adding a line above used to leave the range pointing at whatever
     * had moved into those offsets: Replace all then quietly did nothing,
     * which is the worst way for it to fail.
     *
     * An `input` event does not say what changed, so this works it out by
     * diffing: the common prefix and suffix bracket the edit, and what is
     * left over is what was removed and added. Then the range moves if the
     * edit was before it, stays if the edit was after it, and grows or
     * shrinks if the edit was inside it.
     */
    _moveScope() {
        const now = this.editor.usertextarea.value;
        const was = this._lastValue ?? now;
        this._lastValue = now;
        if (!this._scope || was === now) return;

        let head = 0;
        const shortest = Math.min(was.length, now.length);
        while (head < shortest && was[head] === now[head]) head++;

        let tail = 0;
        const rest = Math.min(was.length - head, now.length - head);
        while (tail < rest && was[was.length - 1 - tail] === now[now.length - 1 - tail]) tail++;

        const removed = was.length - head - tail;
        const delta = (now.length - head - tail) - removed;
        const { start, end } = this._scope;

        if (head + removed <= start) {
            this._scope.start = start + delta;
            this._scope.end = end + delta;
        } else if (head < end) {
            // the edit lands inside the range, so only its far end moves
            this._scope.end = Math.max(start, end + delta);
        }

        // an edit can also shorten the document under the range
        this._scope.start = Math.max(0, Math.min(this._scope.start, now.length));
        this._scope.end = Math.max(this._scope.start, Math.min(this._scope.end, now.length));
    }

    /**
     * Brings the matches up to date with the text, now, if an edit is waiting.
     *
     * Replacing calls this first, so what gets rewritten is never decided by
     * whether a timer has fired yet. The offsets are either current or they
     * are made current before anything is touched: it is the difference
     * between replacing the right text and replacing whatever has moved into
     * its place.
     */
    _flushEdit() {
        clearTimeout(this._editTimer);
        if (!this._stale) return;
        this._stale = false;
        this._search({ scroll: false });
    }

    open(withReplace = false) {
        this._lastValue = this.editor.usertextarea.value;
        if (!this._panel) this._buildPanel();
        this._panel.hidden = false;
        this._clearScrollbar();
        this._watchGutter();
        if (withReplace) {
            this._replaceRow.hidden = false;
        }
        this._findInput.focus();
        this._findInput.select();

        const sel = this.editor.usertextarea.value.substring(
            this.editor.usertextarea.selectionStart,
            this.editor.usertextarea.selectionEnd
        );
        if (sel && !sel.includes('\n')) {
            this._findInput.value = sel;
        }

        if (!this._inputHandler) {
            // The matches are offsets into the text, so an edit made in the
            // document rather than in the panel moves every one of them. Left
            // unwatched, Replace then rewrites whatever now sits at the old
            // offset: searching "cat", typing ten characters at the start and
            // pressing Replace used to eat those ten characters and leave
            // every "cat" alone.
            this._inputHandler = () => this._onDocumentEdit();
            this.editor.usertextarea.addEventListener('input', this._inputHandler);
        }

        if (!this._scrollHandler) {
            // Only slides the layer: the marks are measured once per search
            // and held in content coordinates, so a scroll costs a transform
            // rather than laying the whole document out again.
            this._scrollHandler = () => this._slideHighlights();
            this.editor.usertextarea.addEventListener('scroll', this._scrollHandler);
        }

        this._search();
    }

    close() {
        if (!this._panel) return;
        clearTimeout(this._badTimer);
        clearTimeout(this._editTimer);
        this._stale = false;
        this._panel.hidden = true;
        this._clearMatchHighlight();

        if (this._scrollHandler) {
            this.editor.usertextarea.removeEventListener('scroll', this._scrollHandler);
            this._scrollHandler = null;
        }

        if (this._inputHandler) {
            this.editor.usertextarea.removeEventListener('input', this._inputHandler);
            this._inputHandler = null;
        }

        if (this._gutterObserver) {
            this._gutterObserver.disconnect();
            this._gutterObserver = null;
        }

        const textarea = this.editor.usertextarea;
        if (this._currentIndex !== -1 && this._matches.length) {
            const { start, end } = this._matches[this._currentIndex];
            textarea.focus();
            textarea.setSelectionRange(start, end);
        } else {
            textarea.focus();
        }

        this._matches = [];
        this._currentIndex = -1;
        this._scope = null;
        this._setPressed(this._inSelectionBtn, false);
    }

    _buildPanel() {
        // One box with a rule across it, rather than two bordered boxes inside
        // a third. The inputs have no frame of their own: the panel is the
        // frame, the rule separates finding from replacing, and the vertical
        // rules group the controls. It also ends the business of nesting one
        // radius inside another, since there is one border left to get right.
        const panel = document.createElement('div');
        // Laid out as an editor's find widget is: one chevron down the left
        // spanning both rows, each row a box with its own switches inside it,
        // and the actions for that row outside on the right.
        //
        // 24rem, which is what the panel came to in 1.9.4 when it sized
        // itself to its contents. A figure rather than a fraction, so the
        // panel is the same size whatever editor it is embedded in.
        panel.className = `
            find-replace-panel fj:@container
            fj:absolute fj:top-1 fj:left-auto fj:z-20
            fj:w-96 fj:max-w-[calc(100%_-_0.5rem)]
            fj:me-surface fj:me-surface-outline fj:me-surface-rounded fj:shadow-lg
            fj:flex fj:flex-col fj:gap-1 fj:p-1
        `;
        const replaceRowId = `find-replace-row-${Math.random().toString(36).slice(2, 7)}`;
        panel.setAttribute('role', 'search');
        panel.setAttribute('aria-label', this.editor.label('Find and replace'));

        const line = () => {
            const el = document.createElement('div');
            el.className = 'find-replace-row fj:flex fj:flex-wrap fj:justify-end fj:items-center fj:gap-1 fj:pointer-coarse:gap-0.5';
            return el;
        };

        // A box with its switches inside it, the way an editor's find widget
        // draws one: the component's own input, worn by the wrapper so the
        // buttons sit within the frame, and a bare field inside it.
        const field = (input, ...inside) => {
            const box = document.createElement('div');
            box.className = 'find-replace-field fj:me-input fj:me-input-xs'
                + ' fj:flex fj:items-center fj:gap-0.5 fj:flex-1 fj:min-w-24 fj:ps-2 fj:pe-0.5';
            input.className = 'fj:flex-1 fj:min-w-0 fj:bg-transparent fj:border-0 fj:p-0'
                + ' fj:outline-none fj:[font:inherit] fj:text-inherit';
            box.append(input, ...inside);
            return box;
        };

        // frutjam's divider rather than a bordered span, so the rule is the
        // same weight and colour as every other rule in the editor. Its own
        // margin is 1rem, which is a gap and a half in a bar this size.
        const divider = () => {
            const d = document.createElement('span');
            d.className = 'fj:me-divider fj:me-divider-vertical fj:mx-0';
            d.setAttribute('aria-hidden', 'true');
            return d;
        };

        // -- Find line -----------------------------------------------
        const findLine = line();

        this._findInput = document.createElement('input');
        this._findInput.type = 'text';
        this._findInput.placeholder = this.editor.label('Find');
        this._findInput.setAttribute('aria-label', this.editor.label('Find'));
        this._findInput.addEventListener('input', () => this._search());
        // Enter only: Escape reaches _onPanelKeyDown by bubbling, and closing
        // here as well ran the whole of close() twice on one keypress.
        this._findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.shiftKey ? this._prev() : this._next(); }
        });

        // "3/12", inside the box against its right edge, before the switches.
        // It stays on screen with nothing typed, so the line does not shift
        // the moment you type, and the slash form needs no translating.
        this._countEl = document.createElement('span');
        this._countEl.className = 'find-replace-count fj:text-xs fj:opacity-50 fj:whitespace-nowrap fj:select-none fj:tabular-nums fj:text-end fj:px-1';
        // Not the live region itself: it changes on every keystroke, and a
        // screen reader would interrupt itself on each one. _announce speaks
        // for it, once the typing stops.
        this._countEl.setAttribute('aria-hidden', 'true');

        const prevBtn = this._iconBtn(
            'Previous match',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`
        );
        this._prevBtn = prevBtn;
        this._shortcut(prevBtn, SHORTCUTS.prev);
        prevBtn.addEventListener('click', () => this._prev());

        const nextBtn = this._iconBtn(
            'Next match',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`
        );
        this._nextBtn = nextBtn;
        this._shortcut(nextBtn, SHORTCUTS.next);
        nextBtn.addEventListener('click', () => this._next());

        // Match case, whole word and regular expression, built the same way
        // so the three read as one set.
        //
        // Pressed takes the ghost off and puts me-btn-active on. Ghost writes
        // a literal transparent background, while active works by swapping
        // --color-btn, which the base button paints with: the two together
        // cancel out and the switch looks the same on as off.
        const toggle = (text, label, key, shortcut) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost';
            btn.textContent = text;
            btn.setAttribute('aria-label', this.editor.label(label));
            btn.setAttribute('aria-pressed', 'false');
            this._shortcut(btn, shortcut);
            btn.addEventListener('click', () => {
                this[key] = !this[key];
                this._setPressed(btn, this[key]);
                this._search();
            });
            return btn;
        };

        this._caseSensitiveBtn = toggle('Aa', 'Match case', '_caseSensitive', SHORTCUTS.caseSensitive);
        this._wholeWordBtn = toggle('ab', 'Whole word', '_wholeWord', SHORTCUTS.wholeWord);
        this._regexBtn = toggle('.*', 'Regular expression', '_useRegex', SHORTCUTS.regex);

        // Replaces "Cat" with "Dog" and "CAT" with "DOG", rather than making
        // everything lower case because that is how the replacement was typed.
        this._preserveCaseBtn = toggle('AB', 'Preserve case', '_preserveCase', SHORTCUTS.preserveCase);

        // Search only what is selected. The range is taken when the switch
        // goes on, because a selection does not survive clicking into the
        // find box, and it moves with the text as replacements change length.
        this._inSelectionBtn = this._iconBtn(
            'Find in selection',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 21h1"/><path d="M14 3h1"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 14v1"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M3 9v1"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M7 12h10"/><path d="M7 16h6"/><path d="M7 8h8"/><path d="M9 21h1"/><path d="M9 3h1"/></svg>`
        );
        this._shortcut(this._inSelectionBtn, SHORTCUTS.inSelection);
        this._inSelectionBtn.setAttribute('aria-pressed', 'false');
        this._inSelectionBtn.addEventListener('click', () => this._toggleScope());

        // A chevron rather than the word "Replace", which took about seventy
        // pixels of a panel that has to fit on a phone. It also stops the line
        // holding two things both labelled Replace. Round, not square: square
        // gave it the same outline as the close button's hover, so the one
        // control that opens something read as another icon in the run.
        const replaceToggle = this._iconBtn(
            'Toggle replace row',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`
        );
        this._replaceToggle = replaceToggle;
        replaceToggle.classList.add('fj:transition-transform', 'fj:shrink-0', 'fj:me-auto');
        replaceToggle.setAttribute('aria-expanded', 'false');
        replaceToggle.setAttribute('aria-controls', replaceRowId);
        this._shortcut(replaceToggle, SHORTCUTS.toggleReplace);
        replaceToggle.addEventListener('click', () => {
            this._replaceRow.hidden = !this._replaceRow.hidden;
            const open = !this._replaceRow.hidden;
            replaceToggle.setAttribute('aria-expanded', String(open));
            panel.classList.toggle('is-expanded', open);
            // points down when the row is open, right when it is closed
            replaceToggle.classList.toggle('fj:rotate-90', open);
            if (open) this._replaceInput.focus();
        });

        const closeBtn = this._iconBtn(
            'Close',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
        );
        this._shortcut(closeBtn, SHORTCUTS.close);
        closeBtn.addEventListener('click', () => this.close());

        // The controls travel as one group. On a narrow editor the group wraps
        // onto a line of its own and fills it, which leaves the box the whole
        // width above instead of squeezing it to five characters and folding
        // the icons one at a time. Flex wrapping does that by itself, so there
        // is no width to measure and no breakpoint to choose.
        const findControls = document.createElement('div');
        findControls.className = 'find-replace-controls fj:flex fj:flex-wrap fj:justify-end fj:items-center fj:gap-1 fj:pointer-coarse:gap-0.5';

        // Match case, whole word and regular expression sit inside the box,
        // against its right edge, where every editor keeps them. Under 26rem
        // of panel there is no room for them beside a box worth typing in, so
        // they wait behind the chevron that already discloses the replace row.
        //
        // The panel's own width decides that, not the viewport's and not the
        // pointer's: a narrow editor on a desktop has the same problem as a
        // phone, and the panel is the thing that has to hold them.
        const options = document.createElement('div');
        options.className = 'find-replace-options fj:flex fj:items-center fj:gap-0.5'
            + ' fj:@max-[22rem]:hidden fj:@max-[22rem]:[.is-expanded_&]:flex';
        options.append(this._caseSensitiveBtn, this._wholeWordBtn, this._regexBtn);

        // The buttons live on a row of their own under the box, grouped by
        // what they do: the disclosure, then moving between matches, then
        // leaving. The box above them gets the whole width.
        findControls.append(
            replaceToggle, divider(),
            this._inSelectionBtn, prevBtn, nextBtn, divider(),
            closeBtn,
        );
        findControls.classList.add('fj:w-full');

        findLine.append(field(this._findInput, this._countEl, options));

        const controlLine = line();
        controlLine.classList.add('is-controls');
        controlLine.append(findControls);

        // -- Replace line --------------------------------------------
        this._replaceRow = line();
        this._replaceRow.id = replaceRowId;
        this._replaceRow.classList.add('is-replace');
        this._replaceRow.hidden = true;

        this._replaceInput = document.createElement('input');
        this._replaceInput.type = 'text';
        this._replaceInput.placeholder = this.editor.label('Replace');
        this._replaceInput.setAttribute('aria-label', this.editor.label('Replace with'));
        this._replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._replace();
        });

        // Lucide's own replace and replace-all, the same family as the rest of
        // the editor's icons, at stroke 2 rather than 2.5: they carry more
        // detail than a chevron and thicken into a blob at this size. The word
        // stays on the tooltip and on the screen reader name.
        const replaceBtn = this._iconBtn(
            'Replace',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4a2 2 0 0 1 2-2"/><path d="M16 10a2 2 0 0 1-2-2"/><path d="M20 2a2 2 0 0 1 2 2"/><path d="M22 8a2 2 0 0 1-2 2"/><path d="m3 7 3 3 3-3"/><path d="M6 10V5a3 3 0 0 1 3-3h1"/><rect x="2" y="14" width="8" height="8" rx="2"/></svg>`
        );
        this._replaceBtn = replaceBtn;
        this._shortcut(replaceBtn, 'Enter');
        replaceBtn.addEventListener('click', () => this._replace());

        const replaceAllBtn = this._iconBtn(
            'Replace all',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2"/><path d="M14 4a2 2 0 0 1 2-2"/><path d="M16 10a2 2 0 0 1-2-2"/><path d="M20 14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2"/><path d="M20 2a2 2 0 0 1 2 2"/><path d="M22 8a2 2 0 0 1-2 2"/><path d="m3 7 3 3 3-3"/><path d="M6 10V5a3 3 0 0 1 3-3h1"/><rect x="2" y="14" width="8" height="8" rx="2"/></svg>`
        );
        this._replaceAllBtn = replaceAllBtn;
        this._shortcut(replaceAllBtn, SHORTCUTS.replaceAll);
        replaceAllBtn.addEventListener('click', () => this._replaceAll());

        const replaceControls = document.createElement('div');
        replaceControls.className = 'find-replace-controls fj:flex fj:flex-wrap fj:justify-end fj:items-center fj:gap-1 fj:pointer-coarse:gap-0.5';
        replaceControls.append(replaceBtn, replaceAllBtn);

        const replaceOptions = document.createElement('div');
        replaceOptions.className = 'find-replace-options fj:flex fj:items-center fj:gap-0.5'
            + ' fj:@max-[22rem]:hidden fj:@max-[22rem]:[.is-expanded_&]:flex';
        replaceOptions.append(this._preserveCaseBtn);

        this._replaceRow.append(field(this._replaceInput, replaceOptions), replaceControls);

        // What a screen reader hears. Off screen, last in the panel so the
        // rows stay first, and never updated faster than someone can listen.
        this._liveEl = document.createElement('span');
        this._liveEl.className = 'fj:sr-only';
        this._liveEl.setAttribute('aria-live', 'polite');

        // One handler for the whole panel, so a shortcut works from a button
        // as well as from a box. Escape especially: without this, anyone who
        // tabbed to a switch had no way out.
        panel.addEventListener('keydown', (e) => this._onPanelKeyDown(e));

        panel.append(findLine, controlLine, this._replaceRow, this._liveEl);
        overlayHost(this.editor).appendChild(panel);
        this._panel = panel;
    }

    _clearScrollbar() {
        clearScrollbar(this.editor.usertextarea, this._panel);
    }

    /**
     * Keeps that offset right when the editor changes size.
     *
     * The layout is all container queries and needs nothing here, but the
     * scrollbar's width is not something CSS can report: it is fifteen pixels
     * where scrollbars take up space and zero where they overlay. Measured
     * once at open, it went stale the moment a window was resized or a phone
     * was emulated, and the panel hung out of the editor by the difference.
     * Watched only while the panel is on screen.
     */
    _watchGutter() {
        if (this._gutterObserver || typeof ResizeObserver === 'undefined') return;
        this._gutterObserver = new ResizeObserver(() => this._clearScrollbar());
        this._gutterObserver.observe(this.editor.usertextarea);
    }

    /** @see setPressed, which the table bar's align switches share. */
    _setPressed(btn, on) {
        setPressed(btn, on);
    }

    /**
     * Puts a shortcut on a control, three ways.
     *
     * The tooltip shows it, aria-keyshortcuts tells assistive software about
     * it, and the name stays the plain translated one so a screen reader says
     * "Match case", not "Match case Alt C".
     */
    _shortcut(btn, keys) {
        const name = btn.getAttribute('aria-label') ?? '';
        btn.title = keys ? `${name} (${keys.replace('Control', 'Ctrl')})` : name;
        if (keys) btn.setAttribute('aria-keyshortcuts', keys);
    }

    /**
     * The shortcuts, read the same way wherever the focus is.
     *
     * Matched on e.code rather than e.key, because the letter is not reliable
     * with Alt held down: macOS composes Option+W into a different character
     * altogether, and a non-Latin layout reports its own letter. The code is
     * the key the finger is on.
     *
     * Returns whether the press was answered, so each caller can leave the
     * rest of the keyboard alone.
     */
    _keyShortcut(e) {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            const pick = {
                KeyC: this._caseSensitiveBtn,
                KeyW: this._wholeWordBtn,
                KeyR: this._regexBtn,
                KeyL: this._inSelectionBtn,
                KeyP: this._preserveCaseBtn,
            }[e.code];
            if (pick) {
                e.preventDefault();
                // On a narrow panel the switches are folded behind the
                // chevron, and a press would change one out of sight. Unfold
                // first, so the switch lighting up is something you can see.
                this._revealSwitch(pick);
                pick.click();
                return true;
            }
        }

        if (e.code === 'Enter' && e.ctrlKey && e.altKey) {
            e.preventDefault();
            this._replaceAll();
            return true;
        }

        if (e.key === 'F3') {
            e.preventDefault();
            e.shiftKey ? this._prev() : this._next();
            return true;
        }

        return false;
    }

    /**
     * Unfolds the options when a shortcut lands on a switch the panel's width
     * has hidden. Focus is left where it was: the press came from the text or
     * from the box, and moving the caret would be a worse surprise than the
     * switch appearing.
     */
    _revealSwitch(btn) {
        if (!this._panel || btn.offsetParent !== null) return;
        if (btn === this._preserveCaseBtn) this._replaceRow.hidden = false;
        this._panel.classList.add('is-expanded');
        if (!this._replaceRow.hidden) {
            this._replaceToggle.setAttribute('aria-expanded', 'true');
            this._replaceToggle.classList.add('fj:rotate-90');
        }
    }

    /**
     * Escape has to work from a button as well as from the box, or anyone who
     * tabbed to a switch is stuck.
     */
    _onPanelKeyDown(e) {
        if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
        this._keyShortcut(e);
    }

    _iconBtn(label, svgHtml) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost';
        // Translated here rather than at each call site, so a new icon button
        // cannot be added with an untranslated screen reader name
        btn.setAttribute('aria-label', this.editor.label(label));
        btn.innerHTML = svgHtml;
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('aria-hidden', 'true');
        return btn;
    }

    /**
     * The pattern the current query, and the current toggles, describe.
     *
     * Search and replace all both go through this, so they cannot disagree
     * about what a query means. Returns null if the reader is part way through
     * typing a regular expression that does not parse yet, which is most of
     * the time while they type one.
     */
    _pattern(query) {
        let source = this._useRegex
            ? query
            : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // \b only works next to a word character, so "whole word" around
        // punctuation would match nothing at all. Leave those alone.
        if (this._wholeWord) {
            if (/^\w/.test(query)) source = '\\b' + source;
            if (/\w$/.test(query)) source = source + '\\b';
        }

        try {
            return new RegExp(source, this._caseSensitive ? 'g' : 'gi');
        } catch {
            return null;
        }
    }

    _search({ scroll = true } = {}) {
        const query = this._findInput?.value ?? '';
        const value = this.editor.usertextarea.value;

        if (!query) {
            this._matches = [];
            this._currentIndex = -1;
            this._badPattern = false;
            this._clearMatchHighlight();
            this._updateCount();
            return;
        }

        const re = this._pattern(query);
        this._badPattern = re === null;
        this._matches = [];

        if (re) {
            for (const m of value.matchAll(re)) {
                // A pattern like `\b` or `x*` can match nothing at all, and
                // matchAll would spin on it. Skip the empty ones.
                if (m[0].length === 0) continue;
                this._matches.push({ start: m.index, end: m.index + m[0].length });
            }
        }

        // Only what is selected, when that switch is on.
        if (this._scope) {
            const { start, end } = this._scope;
            this._matches = this._matches.filter(m => m.start >= start && m.end <= end);
        }

        if (this._matches.length > 0) {
            this._currentIndex = Math.min(
                Math.max(this._currentIndex, 0),
                this._matches.length - 1
            );
        } else {
            this._currentIndex = -1;
        }

        this._selectCurrent({ defer: true, scroll });
        this._updateCount();
    }

    /**
     * Turns "only what is selected" on or off.
     *
     * The range has to be remembered rather than read when searching: by the
     * time anyone types in the find box the selection in the document is
     * gone. With nothing selected there is nothing to scope to, so the switch
     * refuses to go on.
     */
    _toggleScope() {
        const textarea = this.editor.usertextarea;
        if (this._scope) {
            this._scope = null;
        } else {
            const { selectionStart, selectionEnd } = textarea;
            if (selectionStart === selectionEnd) return;
            this._scope = { start: selectionStart, end: selectionEnd };
        }

        this._setPressed(this._inSelectionBtn, this._scope !== null);
        this._search();
    }

    /**
     * Moves to the next match in either direction, wrapping at both ends.
     *
     * Flushes a pending edit first: the index means nothing if the offsets it
     * indexes are out of date.
     */
    _step(delta) {
        this._flushEdit();
        const total = this._matches.length;
        if (total === 0) return;
        this._currentIndex = (this._currentIndex + delta + total) % total;
        this._selectCurrent();
        this._updateCount();
    }

    _next() { this._step(1); }

    _prev() { this._step(-1); }

    /**
     * Marks the matches and brings the current one into view.
     *
     * Counting is a scan of the string and costs almost nothing. Marking
     * means laying the document out again to find where the text sits, which
     * on half a megabyte is around 40ms, and doing that on every keystroke is
     * what made typing a query feel heavy. So typing defers it to the next
     * pause while the count updates straight away, and pressing next, prev or
     * replace paints at once, because those are single deliberate acts.
     */
    _selectCurrent({ defer = false, scroll = true } = {}) {
        clearTimeout(this._paintTimer);

        if (this._currentIndex === -1 || this._matches.length === 0) {
            this._clearMatchHighlight();
            return;
        }

        const paint = () => {
            // Measure first, then scroll: the marks work out where the match
            // really is, and the scroll reuses that rather than guessing.
            this._showMatchHighlight();
            if (scroll) this._scrollMatchIntoView();
        };

        if (defer) this._paintTimer = setTimeout(paint, 120);
        else paint();
    }

    /**
     * Brings the current match into view, by the smallest amount that works.
     *
     * The old version worked the position out from `line-height`, which
     * computes to `normal` unless a page sets one, so parseInt gave NaN and a
     * hardcoded 20 stood in for the real height. It also counted '\n' while
     * scrollTop is in pixels, so a wrapped paragraph counted as one line
     * instead of several and the guess fell hundreds of pixels short. Searching
     * a long document scrolled you somewhere that did not hold the match.
     *
     * _showMatchHighlight already measures the true offset with a mirror, so
     * this reads that instead of measuring again. Setting scrollTop fires the
     * scroll handler, which repaints the highlight at the new offset.
     */
    _scrollMatchIntoView() {
        const textarea = this.editor.usertextarea;
        // A real match has height. Zero means the mirror could not be measured,
        // because the editor is hidden or detached, and acting on that would
        // scroll the reader to the top for no reason.
        if (this._matchTop === null || this._matchHeight <= 0) return;

        const view = textarea.clientHeight;
        const from = textarea.scrollTop;
        // Leave a line of context rather than putting the match flush against
        // the edge it came in from.
        const margin = this._matchHeight;
        let to = from;

        if (this._matchTop - margin < from) to = this._matchTop - margin;
        else if (this._matchTop + this._matchHeight + margin > from + view) {
            to = this._matchTop + this._matchHeight + margin - view;
        }
        if (to === from) return;

        textarea.scrollTop = Math.max(0, to);

        // Move the marks with it. The scroll event does this too, but that
        // arrives a frame later and they would sit in the wrong place until
        // it does.
        this._slideHighlights();
    }

    /**
     * Draws every match, with the current one picked out.
     *
     * Every editor worth the name shows you where all the matches are, not
     * just the one you are standing on. They are measured in a single pass,
     * which is why they are all drawn at once rather than one at a time, and
     * they are held in content coordinates so scrolling only has to move the
     * layer.
     */
    _showMatchHighlight() {
        this._clearMatchHighlight();
        if (this._currentIndex === -1 || !this._matches.length) return;

        const textarea = this.editor.usertextarea;

        // Past this the marks cost more than they are worth: a thousand of
        // them is a thousand elements over text nobody can read at once.
        // The current match is still drawn, so navigation keeps working.
        const all = this._matches.length <= HIGHLIGHT_LIMIT;
        const ranges = all
            ? this._matches.map(m => [m.start, m.end])
            : [[this._matches[this._currentIndex].start, this._matches[this._currentIndex].end]];

        const boxes = measureOffsets(textarea, ranges);
        const here = all ? this._currentIndex : 0;

        const layer = document.createElement('div');
        layer.className = 'find-replace-marks fj:absolute fj:top-0 fj:left-0 fj:pointer-events-none fj:z-2';

        boxes.forEach((box, i) => {
            const mark = document.createElement('div');
            // The one you are on is solid, the rest are a wash. Everything
            // here is a class except the rectangle itself, which comes from
            // measuring the text and cannot be known ahead of time.
            mark.className = 'find-replace-mark fj:absolute fj:rounded-xs '
                + (i === here ? 'is-current fj:bg-primary/55' : 'fj:bg-primary/20');
            mark.style.top = box.top + 'px';
            mark.style.left = box.left + 'px';
            mark.style.width = Math.max(box.width, 2) + 'px';
            mark.style.height = box.height + 'px';
            layer.appendChild(mark);
        });

        // _scrollMatchIntoView reads these rather than measuring again
        this._matchTop = boxes[here].top;
        this._matchHeight = boxes[here].height;

        textarea.parentElement.appendChild(layer);
        this._highlightEl = layer;
        this._slideHighlights();
    }

    /** Moves the whole layer with the text, which costs nothing. */
    _slideHighlights() {
        if (!this._highlightEl) return;
        this._highlightEl.style.transform =
            `translateY(${-this.editor.usertextarea.scrollTop}px)`;
    }

    _clearMatchHighlight() {
        this._highlightEl?.remove();
        this._highlightEl = null;
        this._matchTop = null;
    }

    /**
     * Greys out what cannot be done.
     *
     * With nothing found, the arrows and both replace buttons do nothing at
     * all. Leaving them lit means a reader tabs to four controls that answer
     * with silence; disabled, they are skipped and announced as unavailable.
     */
    _updateAvailability() {
        const none = this._matches.length === 0;
        for (const btn of [this._prevBtn, this._nextBtn, this._replaceBtn, this._replaceAllBtn]) {
            if (btn) btn.disabled = none;
        }
    }

    _updateCount() {
        this._updateAvailability();
        if (!this._countEl) return;
        clearTimeout(this._badTimer);

        const total = this._matches.length;
        const at = total ? this._currentIndex + 1 : 0;
        this._countEl.textContent = `${at}/${total}`;

        // A regular expression is invalid for most of the time it is being
        // typed: ( then (\w then (\w+ are all broken, six of the nine
        // keystrokes in (\w+)@(\w+). Saying so at each one is noise, so the
        // count holds and the message waits for a pause in the typing.
        //
        // It is worth saying at all because 0/0 cannot tell you the difference
        // between a pattern that matches nothing and one that does not compile.
        if (this._badPattern) {
            this._badTimer = setTimeout(() => {
                if (this._badPattern) {
                    this._countEl.textContent = this.editor.label('Bad pattern');
                    this._announce(this.editor.label('Bad pattern'));
                }
            }, 500);
            return;
        }

        this._announce(total
            ? this.editor.label('{n} matches').replace('{n}', String(total))
            : this.editor.label('No matches'));
    }

    /**
     * Says something to a screen reader, once the typing stops.
     *
     * The count changes on every keystroke. Announcing each one means the
     * reader hears "one of four, one of forty, one of four hundred" and never
     * the word they typed, so this waits for a pause the way the bad pattern
     * message does.
     */
    _announce(message) {
        clearTimeout(this._liveTimer);
        this._liveTimer = setTimeout(() => {
            if (this._liveEl) this._liveEl.textContent = message;
        }, 600);
    }

    /**
     * Gives a replacement the case of the text it replaces.
     *
     * THE becomes DOG, The becomes Dog, and anything else is left as it was
     * typed. The same three rules every editor uses, because they cover what
     * people mean by "preserve case" without guessing at the rest.
     */
    _withCase(found, replacement) {
        if (!this._preserveCase || !found) return replacement;
        if (found === found.toUpperCase() && found !== found.toLowerCase()) {
            return replacement.toUpperCase();
        }
        if (found[0] === found[0].toUpperCase() && found.slice(1) === found.slice(1).toLowerCase()) {
            return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
    }

    /**
     * The same pattern, set to match once rather than globally.
     *
     * Replacing uses it to let the engine expand $1 against a single match.
     * Built once per replace rather than once per match: replacing four
     * thousand of them compiled eight thousand regular expressions, which was
     * most of the time that took.
     */
    _oncePattern() {
        const re = this._pattern(this._findInput?.value ?? '');
        return re ? new RegExp(re.source, re.flags.replace('g', '')) : null;
    }

    /**
     * What one match should become.
     *
     * With a regular expression the engine does the $1 work, by running the
     * same pattern against the matched text alone. Preserve case then decides
     * whether the answer is shouted, capitalised or left as typed.
     *
     * `once` is that non-global pattern, passed in by the caller so a replace
     * all does not rebuild it for every match.
     */
    _replacementFor(found, once) {
        const replaceWith = this._replaceInput.value;
        if (!this._useRegex || !once) return this._withCase(found, replaceWith);
        return this._withCase(found, found.replace(once, replaceWith));
    }

    _replace() {
        this._flushEdit();
        if (this._currentIndex === -1) return;
        const { start, end } = this._matches[this._currentIndex];
        const textarea = this.editor.usertextarea;
        const text = this._replacementFor(textarea.value.slice(start, end), this._oncePattern());

        textarea.value =
            textarea.value.substring(0, start) +
            text +
            textarea.value.substring(end);

        // The selection this is scoped to grows or shrinks with the text
        this._growScope(text.length - (end - start));
        this._lastValue = textarea.value;

        this.editor.render();
        this.editor.notifyChange();

        this._search();
    }

    /** Keeps a "find in selection" range over the same text after an edit. */
    _growScope(delta) {
        if (this._scope && delta) this._scope.end += delta;
    }

    _replaceAll() {
        this._flushEdit();
        const query = this._findInput?.value;
        if (!query) return;
        const textarea = this.editor.usertextarea;

        const re = this._pattern(query);
        if (!re) return;
        const replaced = this._matches.length;
        if (!replaced) return;

        // Only the selected part of the document when that switch is on, so
        // the text on either side is left exactly as it was.
        const from = this._scope ? this._scope.start : 0;
        const to = this._scope ? this._scope.end : textarea.value.length;
        const before = textarea.value.slice(0, from);
        const within = textarea.value.slice(from, to);
        const after = textarea.value.slice(to);

        // A function rather than a pattern string: it is the only way to give
        // each match its own case, and it handles $1 through _replacementFor.
        const once = this._oncePattern();
        const rewritten = within.replace(re, found => this._replacementFor(found, once));
        textarea.value = before + rewritten + after;
        this._growScope(rewritten.length - within.length);
        this._lastValue = textarea.value;

        this.editor.render();
        this.editor.notifyChange();

        this._currentIndex = 0;
        this._search();

        // _search has just announced the new count, which after replacing
        // everything is zero. What the reader wants to know is what happened.
        this._announce(this.editor.label('{n} replaced').replace('{n}', String(replaced)));
    }

    destroy() {
        clearTimeout(this._paintTimer);
        clearTimeout(this._badTimer);
        clearTimeout(this._liveTimer);
        clearTimeout(this._editTimer);
        this._gutterObserver?.disconnect();
        this.editor.usertextarea.removeEventListener('keydown', this._taHandler);
        if (this._scrollHandler) {
            this.editor.usertextarea.removeEventListener('scroll', this._scrollHandler);
        }
        if (this._inputHandler) {
            this.editor.usertextarea.removeEventListener('input', this._inputHandler);
        }
        this._clearMatchHighlight();
        this._panel?.remove();
    }
}
