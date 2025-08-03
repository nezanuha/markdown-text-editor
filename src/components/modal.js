export function modal(event, size, bodyHTML) {
    const self = event.target;
    const mde = self.closest(".markdown-editor-wrapper");
    if(mde.querySelector(".markdown-modal")){
        mde.querySelector(".markdown-modal").remove(); 
    }

    const modalHTML = `
        <dialog class="markdown-modal fj:modal fj:modal-y-top fj:lg:modal-y-center fj:modal-x-center" id="nezanuha_toggleModal">
            <div class="fj:modal-body ${size}">
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