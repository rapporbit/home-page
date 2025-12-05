import { KEYS } from './js/modules/storage.js';
import { fetchGist, updateGist, getGistFileContent } from './js/modules/gist-api.js';
import { buildConfigObject } from './js/modules/importExport.js';
import { getSettings, saveSettings } from './js/modules/settings.js';

function $(id) { return document.getElementById(id); }
function setStatus(msg, ok = true) {
  const s = $('opt-status');
  if (s) {
    s.textContent = msg;
    s.style.color = ok ? '' : '#fca5a5';
  }
}
function setTimes() {
  const t = $('opt-times');
  if (!t) return;
  const lp = localStorage.getItem(KEYS.gist.lastPull);
  const lps = localStorage.getItem(KEYS.gist.lastPush);
  t.textContent = `Last Pull: ${lp ? new Date(parseInt(lp)).toLocaleString() : '-'} | Last Push: ${lps ? new Date(parseInt(lps)).toLocaleString() : '-'}`;
}

function loadForm() {
  const { gistId, gistFile, gistToken } = getSettings();
  $('opt-gist-id').value = gistId || '';
  $('opt-gist-file').value = gistFile || '';
  $('opt-gist-token').value = gistToken || '';
  setTimes();
}

function saveForm() {
  const id = $('opt-gist-id').value.trim();
  const file = $('opt-gist-file').value.trim();
  const token = $('opt-gist-token').value.trim();
  if (!id || !file) { setStatus('Please fill Gist ID and Filename', false); return; }
  saveSettings({ gistId: id, gistFile: file, gistToken: token });
  setStatus('Saved');
}

async function testConnection() {
  const { gistId: id, gistFile: file, gistToken: token } = getSettings();
  if (!id || !file) { return setStatus('Configure Gist ID and Filename first', false); }
  try {
    const data = await fetchGist(id, token);
    const f = data.files && data.files[file];
    if (!f) return setStatus('Gist reachable, but file not found', false);
    setStatus('OK');
  } catch (e) { setStatus('Connection error: ' + (e.message || e), false); }
}

async function gistPull() {
  const { gistId: id, gistFile: file, gistToken: token } = getSettings();
  if (!id || !file) return setStatus('Configure Gist ID and Filename first', false);
  if (!confirm(`Pull will overwrite local data with ${id}/${file}. Continue?`)) return;
  try {
    const data = await fetchGist(id, token);
    const f = data.files && data.files[file];
    if (!f) return setStatus('File not found in gist', false);

    const text = await getGistFileContent(f);
    const parsed = jsyaml.load(text);
    if (!parsed || typeof parsed !== 'object') return setStatus('YAML parse failed', false);
    localStorage.setItem(KEYS.cache, JSON.stringify(parsed));
    localStorage.setItem(KEYS.gist.lastPull, String(Date.now()));
    setTimes();
    setStatus('Pulled. Reopen New Tab to see changes.');
  } catch (e) { setStatus('Pull error: ' + (e.message || e), false); }
}

async function gistPush() {
  const { gistId: id, gistFile: file, gistToken: token } = getSettings();
  if (!id || !file) return setStatus('Configure Gist ID and Filename first', false);
  if (!token) return setStatus('Set token first for push', false);
  if (!confirm(`Push will overwrite remote ${id}/${file} with local data. Continue?`)) return;
  try {
    const cached = localStorage.getItem(KEYS.cache);
    let obj = null;
    if (cached) { try { obj = JSON.parse(cached); } catch {} }
    if (!obj) { return setStatus('No local data to push', false); }

    const exportObj = buildConfigObject(obj);
    const yamlStr = jsyaml.dump(exportObj);

    const files = { [file]: { content: yamlStr } };
    await updateGist(id, token, files);

    localStorage.setItem(KEYS.gist.lastPush, String(Date.now()));
    setTimes();
    setStatus('Pushed');
  } catch (e) { setStatus('Push error: ' + (e.message || e), false); }
}

function init() {
  loadForm();
  $('btn-save').addEventListener('click', saveForm);
  $('btn-test').addEventListener('click', testConnection);
  $('btn-pull').addEventListener('click', gistPull);
  $('btn-push').addEventListener('click', gistPush);
  $('btn-clear-token').addEventListener('click', () => { saveSettings({ gistToken: '' }); $('opt-gist-token').value = ''; setStatus('Token cleared'); });
  $('btn-toggle-token').addEventListener('click', (e) => { const inp = $('opt-gist-token'); const showing = inp.type === 'text'; inp.type = showing ? 'password' : 'text'; e.target.textContent = showing ? 'Show' : 'Hide'; });
  $('btn-copy-id').addEventListener('click', async () => { const v = $('opt-gist-id').value; try { await navigator.clipboard.writeText(v); setStatus('Copied Gist ID'); } catch { setStatus('Copy failed', false); } });
  $('btn-copy-file').addEventListener('click', async () => { const v = $('opt-gist-file').value; try { await navigator.clipboard.writeText(v); setStatus('Copied Filename'); } catch { setStatus('Copy failed', false); } });
}

document.addEventListener('DOMContentLoaded', init);
