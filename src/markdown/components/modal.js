export function modal(event, size, bodyHTML) {
    const self = event.target;
    const mde = self.closest(".markdown-editor-wrapper");
    if(mde.querySelector(".markdown-modal")){
        mde.querySelector(".markdown-modal").remove(); 
    }

    const modalHTML = `
        <dialog class="modal modal-y-top lg:modal-y-center modal-x-center markdown-modal" id="nezanuha_toggleModal">
            <div class="modal-body ${size}">
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