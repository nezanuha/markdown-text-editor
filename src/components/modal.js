import { escapeHtml } from '../utils/escapeHtml.js';

export function modal(event, size, bodyHTML, label = '') {
    const self = event.target;
    const mde = self.closest(".markdown-editor-wrapper");
    if (mde.querySelector(".markdown-modal")) {
        mde.querySelector(".markdown-modal").remove();
    }

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

    if (!mde.querySelector(".markdown-modal")) {
        mde.insertAdjacentHTML("beforeend", modalHTML);
    }

    const modal = mde.querySelector(".markdown-modal");
    modal.addEventListener('close', () => modal.remove());
    modal.showModal();
    return modal;
}