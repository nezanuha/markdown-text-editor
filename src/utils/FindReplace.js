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
        this._scrollHandler = null;

        this._taHandler = this._onTextareaKeyDown.bind(this);
        editor.usertextarea.addEventListener('keydown', this._taHandler);
    }

    _onTextareaKeyDown(e) {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key === 'f') {
            e.preventDefault();
            this.open(false);
        } else if (ctrl && e.key === 'h') {
            e.preventDefault();
            this.open(true);
        }
    }

    open(withReplace = false) {
        if (!this._panel) this._buildPanel();
        this._panel.hidden = false;
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

        if (!this._scrollHandler) {
            this._scrollHandler = () => this._showMatchHighlight();
            this.editor.usertextarea.addEventListener('scroll', this._scrollHandler);
        }

        this._search();
    }

    close() {
        if (!this._panel) return;
        this._panel.hidden = true;
        this._clearMatchHighlight();

        if (this._scrollHandler) {
            this.editor.usertextarea.removeEventListener('scroll', this._scrollHandler);
            this._scrollHandler = null;
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
    }

    _buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'find-replace-panel fj:absolute fj:top-1 fj:right-1 fj:z-20 fj:me-surface fj:me-surface-outline fj:me-surface-rounded fj:p-1.5 fj:flex fj:flex-col fj:gap-1 fj:shadow-lg';
        panel.setAttribute('role', 'search');
        panel.setAttribute('aria-label', 'Find and replace');

        // ── Find row ────────────────────────────────────────────────
        const findRow = document.createElement('div');
        findRow.className = 'fj:flex fj:items-center fj:gap-1';

        this._findInput = document.createElement('input');
        this._findInput.type = 'text';
        this._findInput.placeholder = 'Find';
        this._findInput.className = 'fj:me-input fj:me-input-xs fj:w-36';
        this._findInput.setAttribute('aria-label', 'Find');
        this._findInput.addEventListener('input', () => this._search());
        this._findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.shiftKey ? this._prev() : this._next(); }
            if (e.key === 'Escape') { e.preventDefault(); this.close(); }
        });

        this._countEl = document.createElement('span');
        this._countEl.className = 'fj:text-xs fj:opacity-50 fj:whitespace-nowrap fj:min-w-[3.5rem] fj:text-center fj:select-none';
        this._countEl.setAttribute('aria-live', 'polite');

        const prevBtn = this._iconBtn(
            'Previous match',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`
        );
        prevBtn.addEventListener('click', () => this._prev());

        const nextBtn = this._iconBtn(
            'Next match',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`
        );
        nextBtn.addEventListener('click', () => this._next());

        this._caseSensitiveBtn = document.createElement('button');
        this._caseSensitiveBtn.type = 'button';
        this._caseSensitiveBtn.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost fj:text-xs fj:font-bold';
        this._caseSensitiveBtn.textContent = 'Aa';
        this._caseSensitiveBtn.setAttribute('aria-label', 'Match case');
        this._caseSensitiveBtn.setAttribute('aria-pressed', 'false');
        this._caseSensitiveBtn.title = 'Match case';
        this._caseSensitiveBtn.addEventListener('click', () => {
            this._caseSensitive = !this._caseSensitive;
            this._caseSensitiveBtn.setAttribute('aria-pressed', String(this._caseSensitive));
            this._caseSensitiveBtn.classList.toggle('fj:me-btn-active', this._caseSensitive);
            this._search();
        });

        const replaceToggle = document.createElement('button');
        replaceToggle.type = 'button';
        replaceToggle.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-ghost fj:text-xs fj:px-1.5';
        replaceToggle.textContent = 'Replace';
        replaceToggle.setAttribute('aria-label', 'Toggle replace row');
        replaceToggle.addEventListener('click', () => {
            this._replaceRow.hidden = !this._replaceRow.hidden;
            if (!this._replaceRow.hidden) this._replaceInput.focus();
        });

        const closeBtn = this._iconBtn(
            'Close',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
        );
        closeBtn.addEventListener('click', () => this.close());

        findRow.append(this._findInput, this._countEl, prevBtn, nextBtn, this._caseSensitiveBtn, replaceToggle, closeBtn);

        // ── Replace row ─────────────────────────────────────────────
        this._replaceRow = document.createElement('div');
        this._replaceRow.className = 'fj:flex fj:items-center fj:gap-1';
        this._replaceRow.hidden = true;

        this._replaceInput = document.createElement('input');
        this._replaceInput.type = 'text';
        this._replaceInput.placeholder = 'Replace';
        this._replaceInput.className = 'fj:me-input fj:me-input-xs fj:w-36';
        this._replaceInput.setAttribute('aria-label', 'Replace with');
        this._replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._replace();
            if (e.key === 'Escape') { e.preventDefault(); this.close(); }
        });

        const replaceBtn = document.createElement('button');
        replaceBtn.type = 'button';
        replaceBtn.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-ghost fj:text-xs fj:px-1.5';
        replaceBtn.textContent = 'Replace';
        replaceBtn.addEventListener('click', () => this._replace());

        const replaceAllBtn = document.createElement('button');
        replaceAllBtn.type = 'button';
        replaceAllBtn.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-ghost fj:text-xs fj:px-1.5';
        replaceAllBtn.textContent = 'All';
        replaceAllBtn.setAttribute('aria-label', 'Replace all');
        replaceAllBtn.addEventListener('click', () => this._replaceAll());

        this._replaceRow.append(this._replaceInput, replaceBtn, replaceAllBtn);

        panel.append(findRow, this._replaceRow);
        this.editor.markdownEditorDiv.appendChild(panel);
        this._panel = panel;
    }

    _iconBtn(label, svgHtml) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fj:me-btn fj:me-btn-xs fj:me-btn-square fj:me-btn-ghost';
        btn.setAttribute('aria-label', label);
        btn.innerHTML = svgHtml;
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('aria-hidden', 'true');
        return btn;
    }

    _search() {
        const query = this._findInput?.value ?? '';
        const value = this.editor.usertextarea.value;

        if (!query) {
            this._matches = [];
            this._currentIndex = -1;
            this._clearMatchHighlight();
            this._updateCount();
            return;
        }

        const searchValue = this._caseSensitive ? value : value.toLowerCase();
        const searchQuery = this._caseSensitive ? query : query.toLowerCase();
        this._matches = [];

        let pos = 0;
        while (pos <= searchValue.length - searchQuery.length) {
            const idx = searchValue.indexOf(searchQuery, pos);
            if (idx === -1) break;
            this._matches.push({ start: idx, end: idx + query.length });
            pos = idx + 1;
        }

        if (this._matches.length > 0) {
            this._currentIndex = Math.min(
                Math.max(this._currentIndex, 0),
                this._matches.length - 1
            );
        } else {
            this._currentIndex = -1;
        }

        this._selectCurrent();
        this._updateCount();
    }

    _next() {
        if (this._matches.length === 0) return;
        this._currentIndex = (this._currentIndex + 1) % this._matches.length;
        this._selectCurrent();
        this._updateCount();
    }

    _prev() {
        if (this._matches.length === 0) return;
        this._currentIndex = (this._currentIndex - 1 + this._matches.length) % this._matches.length;
        this._selectCurrent();
        this._updateCount();
    }

    _selectCurrent() {
        if (this._currentIndex === -1 || this._matches.length === 0) {
            this._clearMatchHighlight();
            return;
        }
        const { start } = this._matches[this._currentIndex];
        this._scrollToMatch(this.editor.usertextarea, start);
        this._showMatchHighlight();
    }

    _scrollToMatch(textarea, pos) {
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
        const linesBefore = textarea.value.substring(0, pos).split('\n').length - 1;
        const rowsVisible = Math.floor(textarea.clientHeight / lineHeight);
        textarea.scrollTop = Math.max(0, (linesBefore - Math.floor(rowsVisible / 2)) * lineHeight);
    }

    _showMatchHighlight() {
        this._clearMatchHighlight();
        if (this._currentIndex === -1 || !this._matches.length) return;

        const { start, end } = this._matches[this._currentIndex];
        const textarea = this.editor.usertextarea;
        const cs = window.getComputedStyle(textarea);
        const wrapper = textarea.parentElement;

        // Mirror div replicates textarea layout to measure exact character positions
        const mirror = document.createElement('div');
        Object.assign(mirror.style, {
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            top: '0', left: '0', right: '0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            font: cs.font,
            lineHeight: cs.lineHeight,
            paddingTop: cs.paddingTop,
            paddingRight: cs.paddingRight,
            paddingBottom: cs.paddingBottom,
            paddingLeft: cs.paddingLeft,
            boxSizing: 'border-box',
        });

        const marker = document.createElement('span');
        marker.textContent = textarea.value.substring(start, end) || '​';
        mirror.appendChild(document.createTextNode(textarea.value.substring(0, start)));
        mirror.appendChild(marker);
        mirror.appendChild(document.createTextNode(textarea.value.substring(end)));

        wrapper.appendChild(mirror);
        try {
            const wRect = wrapper.getBoundingClientRect();
            const mRect = marker.getBoundingClientRect();

            const hl = document.createElement('div');
            Object.assign(hl.style, {
                position: 'absolute',
                top: (mRect.top - wRect.top - textarea.scrollTop) + 'px',
                left: (mRect.left - wRect.left) + 'px',
                width: Math.max(mRect.width, 2) + 'px',
                height: mRect.height + 'px',
                background: 'color-mix(in oklch, var(--color-primary, oklch(0.6 0.2 250)), transparent 55%)',
                borderRadius: '2px',
                pointerEvents: 'none',
                zIndex: '2',
            });
            wrapper.appendChild(hl);
            this._highlightEl = hl;
        } finally {
            wrapper.removeChild(mirror);
        }
    }

    _clearMatchHighlight() {
        this._highlightEl?.remove();
        this._highlightEl = null;
    }

    _updateCount() {
        if (!this._countEl) return;
        if (this._matches.length === 0) {
            this._countEl.textContent = this._findInput?.value ? 'No results' : '';
        } else {
            this._countEl.textContent = `${this._currentIndex + 1} of ${this._matches.length}`;
        }
    }

    _replace() {
        if (this._currentIndex === -1) return;
        const { start, end } = this._matches[this._currentIndex];
        const textarea = this.editor.usertextarea;
        const replaceWith = this._replaceInput.value;

        textarea.value =
            textarea.value.substring(0, start) +
            replaceWith +
            textarea.value.substring(end);

        this.editor.render();
        if (this.editor.options.onChange) this.editor.options.onChange(textarea.value);

        this._search();
    }

    _replaceAll() {
        const query = this._findInput?.value;
        if (!query) return;
        const replaceWith = this._replaceInput.value;
        const textarea = this.editor.usertextarea;

        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = this._caseSensitive ? 'g' : 'gi';
        textarea.value = textarea.value.replace(new RegExp(escaped, flags), replaceWith);

        this.editor.render();
        if (this.editor.options.onChange) this.editor.options.onChange(textarea.value);

        this._currentIndex = 0;
        this._search();
    }

    destroy() {
        this.editor.usertextarea.removeEventListener('keydown', this._taHandler);
        if (this._scrollHandler) {
            this.editor.usertextarea.removeEventListener('scroll', this._scrollHandler);
        }
        this._clearMatchHighlight();
        this._panel?.remove();
    }
}
