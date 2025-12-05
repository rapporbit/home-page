export const showConfirm = (title, message, confirmLabel = 'Confirm', danger = false, returnToSettings = false) =>
  new Promise((resolve) => {
    const old = document.getElementById('confirm-modal');
    if (old) old.remove();
    const html = `
    <div id="confirm-modal" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-0">
      <div class="modal-glass rounded-2xl p-6 w-full max-w-md transform scale-95 transition-transform duration-300 shadow-2xl text-white">
        <h3 class="text-xl font-bold mb-3 flex items-center gap-2"><i class="ph ${danger ? 'ph-warning text-red-400' : 'ph-question'}"></i> <span>${title}</span></h3>
        <div class="text-sm text-white/80 whitespace-pre-line">${message}</div>
        <div class="mt-6 flex justify-end gap-3">
          <button id="confirm-cancel" class="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">Cancel</button>
          <button id="confirm-ok" class="px-5 py-2 text-sm rounded-lg font-medium ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white transition-colors">${confirmLabel}</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById('confirm-modal');
    const box = el.firstElementChild;
    const cleanup = (val) => {
      el.classList.add('opacity-0');
      box.classList.add('scale-95');
      setTimeout(() => {
        el.remove();
        resolve(val);
        if (returnToSettings) {
          const settingsModal = document.getElementById('gist-modal');
          if (settingsModal) {
            settingsModal.classList.remove('hidden');
            requestAnimationFrame(() => {
              settingsModal.classList.remove('opacity-0');
              settingsModal.firstElementChild.classList.remove('scale-95');
              settingsModal.firstElementChild.classList.add('scale-100');
            });
          }
        }
      }, 180);
    };
    requestAnimationFrame(() => {
      el.classList.remove('opacity-0');
      box.classList.remove('scale-95');
      box.classList.add('scale-100');
    });
    el.addEventListener('click', (e) => { if (e.target === el) cleanup(false); });
    document.getElementById('confirm-cancel').addEventListener('click', () => cleanup(false));
    document.getElementById('confirm-ok').addEventListener('click', () => cleanup(true));
    const onKey = (e) => { if (e.key === 'Escape') cleanup(false); if (e.key === 'Enter') cleanup(true); };
    document.addEventListener('keydown', onKey, { once: true });
  });
