import { escapeHtml } from '../utils/escapeHtml.js';

export function modal(event, size, bodyHTML, label = '') {
    // `modal` is public, so the event may be anything a custom tool was
    // holding. Without this the failure is "Cannot read properties of null",
    // which says nothing about what to pass instead.
    const mde = event?.target?.closest?.('.markdown-editor-wrapper');
    if (!mde) {
        throw new Error('[MarkdownEditor] modal() needs the click event your tool was '
            + 'given, so it can find the editor the dialog belongs to.');
    }

    mde.querySelector('.markdown-modal')?.remove();

    // `modal` is public, so a custom tool may well pass something that came
    // from the document or from its own fields. `bodyHTML` is markup by
    // contract and the caller owns it; the label is plain text and is not.
    const ariaAttr = label ? `aria-label="${escapeHtml(label)}"` : '';
    const modalHTML = `
        <dialog class="markdown-modal fj:me-modal fj:me-modal-top fj:lg:me-modal-middle fj:me-modal-center" ${ariaAttr}>
            <div class="fj:me-modal-content ${size}">
                ${bodyHTML}
            </div>
        </dialog>
    `;

    mde.insertAdjacentHTML('beforeend', modalHTML);

    const modal = mde.querySelector('.markdown-modal');
    modal.addEventListener('close', () => modal.remove());
    modal.showModal();
    return modal;
}