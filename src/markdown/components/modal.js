export function modal(event) {
    const self = event.target;

    const modalHTML = `
        <dialog class="modal modal-top modal-x-center modal-y-start lg:modal-y-center " id="toggleModal">
            <div class="modal-body">
                <div class="max-w-xs">
                    <button type="button" class="btn btn-xs btn-secondary" onclick="toggleModal.close()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            </div>
        </dialog>
    `;

    const mde = self.closest(".markdown-editor-wrapper").querySelector(".editor-layout");

    if(!mde.querySelector(".modal")){
        mde.insertAdjacentHTML("beforeend", modalHTML);
    }
    
    const modal = mde.querySelector(".modal");
    modal.showModal();
}