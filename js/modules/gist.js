import { exportYaml, openImportModal } from './importExport.js';
import { processConfigData } from './config.js';
import { showToast, updateStatus } from './status.js';
import { KEYS } from './storage.js';
import { showConfirm } from './confirm.js';
import { fetchGist, updateGist, getGistFileContent } from './gist-api.js';
import { getSettings, saveSettings } from './settings.js';

export const bindGistSettingsUI = () => {
  const open = document.getElementById('open-gist-settings');
  const modal = document.getElementById('gist-modal');
  if (!open || !modal) return;

  const idInp = document.getElementById('gist-id-input');
  const fileInp = document.getElementById('gist-file-input');
  const tokenInp = document.getElementById('gist-token-input');
  const statusEl = document.getElementById('gist-status');
  const timesEl = document.getElementById('gist-times');
  const saveBtn = document.getElementById('gist-save-btn');
  const cancelBtn = document.getElementById('gist-cancel-btn');
  const testBtn = document.getElementById('gist-test-btn');
  const pullBtn = document.getElementById('gist-pull-btn');
  const pushBtn = document.getElementById('gist-push-btn');
  const copyIdBtn = document.getElementById('gist-copy-id');
  const copyFileBtn = document.getElementById('gist-copy-file');
  const toggleTokenBtn = document.getElementById('gist-toggle-token');
  const clearTokenBtn = document.getElementById('gist-clear-token');
  const importBtn = document.getElementById('gist-open-import-btn');
  const copyConfigBtn = document.getElementById('gist-copy-config-btn');
  const weightSel = document.getElementById('weight-select');
  const resetAllBtn = document.getElementById('reset-all-btn');

  const populateFields = () => {
    const settings = getSettings();
    if (idInp) idInp.value = settings.gistId || '';
    if (fileInp) fileInp.value = settings.gistFile || '';
    if (tokenInp) tokenInp.value = settings.gistToken || '';
    if (weightSel) weightSel.value = settings.iconWeight || 'regular';
  };
  populateFields();

  const setStatus = (msg, ok = true) => {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = ok ? '' : '#fca5a5';
    }
  };
  const setTimes = () => {
    if (!timesEl) return;
    const lp = localStorage.getItem(KEYS.gist.lastPull);
    const lps = localStorage.getItem(KEYS.gist.lastPush);
    timesEl.textContent = `Last Pull: ${lp ? new Date(parseInt(lp)).toLocaleString() : '-'} | Last Push: ${
      lps ? new Date(parseInt(lps)).toLocaleString() : '-'
    }`;
  };
  setTimes();

  const openModal = () => {
    populateFields();
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      modal.classList.remove('opacity-0');
      modal.firstElementChild.classList.remove('scale-95');
      modal.firstElementChild.classList.add('scale-100');
    });
  };
  // Export openModal so importExport.js can use it if needed,
  // but currently importExport handles reopening manually.
  // We just need to ensure this function is available if we refactor later.

  const closeModal = () => {
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    modal.firstElementChild.classList.remove('scale-100');
    setTimeout(() => modal.classList.add('hidden'), 300);
  };

  open.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  saveBtn?.addEventListener('click', () => {
    const id = idInp.value.trim();
    const file = fileInp.value.trim();
    const token = tokenInp.value.trim();
    const weight = weightSel?.value || 'regular';
    if (!id || !file) {
      setStatus('Please input gist id and filename', false);
      return;
    }
    const weights = ['regular', 'thin', 'light', 'bold', 'fill', 'duotone'];
    if (!weights.includes(weight)) {
      setStatus('Invalid icon weight', false);
      return;
    }
    saveSettings({ gistId: id, gistFile: file, gistToken: token, iconWeight: weight });
    showToast('Gist settings saved', 'success');
    closeModal();
  });

  testBtn?.addEventListener('click', async () => {
    const { gistId: id, gistFile: file, gistToken: token } = getSettings();
    if (!id || !file) return setStatus('Configure Gist ID and Filename first', false);
    try {
      const data = await fetchGist(id, token);
      const f = data.files && data.files[file];
      if (!f) return setStatus('Gist reachable, but file not found', false);
      setStatus('OK');
    } catch (e) {
      setStatus('Connection error: ' + (e.message || e), false);
    }
  });

  pullBtn?.addEventListener('click', async () => { await gistPull(); setTimes(); });
  pushBtn?.addEventListener('click', async () => { await gistPush(); setTimes(); });

  copyIdBtn?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(idInp.value); setStatus('Copied Gist ID'); }
    catch { setStatus('Copy failed', false); }
  });
  copyFileBtn?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(fileInp.value); setStatus('Copied Filename'); }
    catch { setStatus('Copy failed', false); }
  });
  toggleTokenBtn?.addEventListener('click', (e) => {
    const showing = tokenInp.type === 'text';
    tokenInp.type = showing ? 'password' : 'text';
    e.target.textContent = showing ? 'Show' : 'Hide';
  });
  clearTokenBtn?.addEventListener('click', () => {
    saveSettings({ gistToken: '' });
    tokenInp.value = '';
    setStatus('Token cleared');
  });
  importBtn?.addEventListener('click', () => {
    closeModal();
    openImportModal(true); // Pass true to indicate return to settings
  });
  copyConfigBtn?.addEventListener('click', async () => {
    try { const txt = exportYaml(); await navigator.clipboard.writeText(txt); setStatus('Config copied'); }
    catch { setStatus('Copy failed', false); }
  });
  resetAllBtn?.addEventListener('click', async () => {
    const ok = await showConfirm('Reset Configuration', 'Reset local configuration to defaults?', 'Reset', true);
    if (!ok) return;
    localStorage.removeItem(KEYS.cache);
    showToast('Reset done. Reloading...', 'success');
    setTimeout(() => location.reload(), 400);
  });
};

async function gistPull() {
  const { gistId: id, gistFile: file, gistToken: token } = getSettings();
  if (!id || !file) return showToast('Gist not configured', 'error');

  // Close settings modal before showing confirm
  const settingsModal = document.getElementById('gist-modal');
  if (settingsModal) settingsModal.classList.add('hidden');

  const ok = await showConfirm('Pull From Gist', `This will overwrite your local configuration with\n${id}/${file}. Continue?`, 'Pull', false, true);
  if (!ok) return showToast('Canceled', 'info');
  try {
    const data = await fetchGist(id, token);
    const f = data.files && data.files[file];
    if (!f) throw new Error('File not found in gist');

    const text = await getGistFileContent(f);
    const parsed = jsyaml.load(text);
    processConfigData(parsed, true);
    localStorage.setItem(KEYS.gist.lastPull, String(Date.now()));
    updateStatus('Gist Pulled', true);
    showToast('Pulled from Gist', 'success');
  } catch (e) {
    console.error(e);
    showToast('Gist pull failed: ' + (e.message || e), 'error');
  }
}
async function gistPush(message = 'Update from page') {
  const { gistId: id, gistFile: file, gistToken: token } = getSettings();
  if (!id || !file) return showToast('Gist not configured', 'error');
  if (!token) return showToast('Set token first (gist scope)', 'error');

  // Close settings modal before showing confirm
  const settingsModal = document.getElementById('gist-modal');
  if (settingsModal) settingsModal.classList.add('hidden');

  const ok = await showConfirm('Push To Gist', `This will overwrite the remote Gist file\n${id}/${file} with your current local configuration. Continue?`, 'Push', true, true);
  if (!ok) return showToast('Canceled', 'info');
  try {
    const content = exportYaml();
    const files = { [file]: { content } };
    await updateGist(id, token, files);

    localStorage.setItem(KEYS.gist.lastPush, String(Date.now()));
    updateStatus('Gist Pushed', true);
    showToast('Pushed to Gist', 'success');
  } catch (e) {
    console.error(e);
    showToast('Gist push failed: ' + (e.message || e), 'error');
  }
}
