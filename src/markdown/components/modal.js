export function modal(event, size, bodyHTML) {
    const self = event.target;
    const mde = self.closest(".markdown-editor-wrapper");
    if(mde.querySelector(".modal")){
        mde.querySelector(".modal").remove(); 
    }

    const modalHTML = `
        <dialog class="modal modal-y-top lg:modal-y-center modal-x-center" id="toggleModal">
            <div class="modal-body ${size}">
                ${bodyHTML}
            </div>
        </dialog>
    `;

    if(!mde.querySelector(".modal")){
        mde.insertAdjacentHTML("beforeend", modalHTML);
    }
    
    const modal = mde.querySelector(".modal");
    modal.showModal();
    return modal;
}