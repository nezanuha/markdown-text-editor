export function modal(event, size, bodyHTML, label = '') {
    const self = event.target;
    const mde = self.closest(".markdown-editor-wrapper");
    if (mde.querySelector(".markdown-modal")) {
        mde.querySelector(".markdown-modal").remove();
    }

    const ariaAttr = label ? `aria-label="${label}"` : '';
    const modalHTML = `
        <dialog class="markdown-modal fj:me-modal fj:me-modal-top fj:lg:me-modal-middle fj:me-modal-center" id="nezanuha_toggleModal" ${ariaAttr}>
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