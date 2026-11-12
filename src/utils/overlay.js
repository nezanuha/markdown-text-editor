/**
 * The two things every overlay in this editor needs: somewhere to hang, and a
 * right edge that clears the textarea's scrollbar.
 *
 * The find panel and the table bar both float over the text, and both were
 * growing their own copy of this.
 */

/**
 * Where a floating overlay belongs.
 *
 * The textarea's own wrapper, not the editor layout: with a preview open the
 * layout is both panes, and an overlay measured against that stretches across
 * the preview as well. The wrapper is already positioned and holds nothing but
 * the textarea.
 */
export function overlayHost(editor) {
    return editor.markdownEditorDiv.querySelector('.textarea-wrapper')
        ?? editor.markdownEditorDiv;
}

/**
 * Keeps an overlay clear of the textarea's scrollbar.
 *
 * An overlay is pinned to the right of the editor, but the textarea reserves a
 * scrollbar gutter inside that, so the overlay's right corner sat under it and
 * looked clipped. The gutter is whatever the platform makes it, nothing to
 * hardcode: it is zero where scrollbars overlay the content and about fifteen
 * pixels where they take up space.
 */
export function clearScrollbar(textarea, el) {
    const gutter = textarea.offsetWidth - textarea.clientWidth;
    el.style.right = (gutter + 4) + 'px';
}

/**
 * Turns a switch on or off, for the eye and for a screen reader both.
 *
 * The ghost class has to come off for active to show: ghost sets a literal
 * transparent background, while active swaps --color-btn, which the base
 * button paints with, so the two together cancel out. Kept in one place
 * rather than at each switch, which is how one of them came to disagree.
 */
export function setPressed(btn, on) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('fj:me-btn-ghost', !on);
    btn.classList.toggle('fj:me-btn-active', on);
}

/**
 * Where stretches of the textarea's text sit, in pixels.
 *
 * A textarea will not tell you where any of its text is, so this lays the same
 * text out again in a hidden div with the same font, padding and wrapping, and
 * measures that. Every range is marked in one mirror, so the cost is a single
 * layout however many are asked for: the find panel asks for every match at
 * once and the table bar for a handful of column edges.
 *
 * The returned top is the offset within the content, before scrolling, so a
 * caller that follows the scroll can subtract scrollTop without measuring
 * again. The cost is the length of the document, not of the ranges, since
 * everything before a range has to be laid out to know where it lands. Fine on
 * a click. Not something to run on every keystroke.
 *
 * Ranges must be given in order and must not overlap.
 */
export function measureOffsets(textarea, ranges) {
    const cs = window.getComputedStyle(textarea);
    const wrapper = textarea.parentElement;
    const value = textarea.value;

    const mirror = document.createElement('div');
    Object.assign(mirror.style, {
        position: 'absolute',
        visibility: 'hidden',
        pointerEvents: 'none',
        top: '0', left: '0',
        width: textarea.clientWidth + 'px',
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

    const markers = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
        mirror.appendChild(document.createTextNode(value.substring(cursor, start)));
        const marker = document.createElement('span');
        marker.textContent = value.substring(start, end) || '​';
        mirror.appendChild(marker);
        markers.push(marker);
        cursor = end;
    }
    mirror.appendChild(document.createTextNode(value.substring(cursor)));

    wrapper.appendChild(mirror);
    try {
        const wRect = wrapper.getBoundingClientRect();
        return markers.map(m => {
            const r = m.getBoundingClientRect();
            return {
                top: r.top - wRect.top,
                left: r.left - wRect.left,
                width: r.width,
                height: r.height,
            };
        });
    } finally {
        wrapper.removeChild(mirror);
    }
}
