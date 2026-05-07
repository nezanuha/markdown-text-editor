export function modal(event, size, bodyHTML) {
    const self = event.target;
    const mde = self.closest(".markdown-editor-wrapper");
    if(mde.querySelector(".markdown-modal")){
        mde.querySelector(".markdown-modal").remove(); 
    }

    const modalHTML = `
        <dialog class="markdown-modal fj:me-modal fj:me-modal-top fj:lg:me-modal-middle fj:me-modal-center" id="nezanuha_toggleModal">
            <div class="fj:me-modal-content ${size}">
                ${bodyHTML}
            </div>
        </dialog>
    `;

    if(!mde.querySelector(".markdown-modal")){
        mde.insertAdjacentHTML("beforeend", modalHTML);
    }
    
    const modal = mde.querySelector(".markdown-modal");
    modal.showModal();
    return modal;
}