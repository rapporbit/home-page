import { getData } from './store.js';
import { processConfigData } from './config.js';
import { showToast } from './status.js';

let returnToSettings = false;

export const openImportModal = (fromSettings = false) => {
  returnToSettings = fromSettings;
  const m = document.getElementById('import-modal');
  if (!m) return;
  m.classList.remove('hidden');
  requestAnimationFrame(() => {
    m.classList.remove('opacity-0');
    m.firstElementChild.classList.remove('scale-95');
    m.firstElementChild.classList.add('scale-100');
  });
};
export const closeImportModal = () => {
  const m = document.getElementById('import-modal');
  if (!m) return;
  m.classList.add('opacity-0');
  m.firstElementChild.classList.add('scale-95');
  m.firstElementChild.classList.remove('scale-100');
  setTimeout(() => {
    m.classList.add('hidden');
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
      returnToSettings = false;
    }
  }, 300);
};
export const importYaml = () => {
  const ta = document.getElementById('import-area');
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) return showToast('Paste YAML first', 'error');
  try {
    const parsed = jsyaml.load(text);
    processConfigData(parsed, true);
    showToast('Configuration imported successfully!', 'success');
    closeImportModal();
  } catch (e) {
    console.error(e);
    showToast('Import failed: ' + (e.message || e), 'error');
  }
};
export const buildConfigObject = (data) => {
  const { categories, search } = data;
  return {
    search: search || [],
    categories: (categories || []).map((c, i) => {
      const catObj = {
        category: c.category,
        color: c.color,
        order: i + 1,
        colSpan: c.colSpan || 1,
        rowSpan: c.rowSpan || 1,
      };
      if (c.hidden) catObj.hidden = true;
      catObj.items = (c.items || []).map((item, j) => {
        const o = { name: item.name, url: item.url, icon: item.icon, order: j + 1 };
        if (item.url_private) o.url_private = item.url_private;
        if (item.hidden) o.hidden = true;
        return o;
      });
      return catObj;
    }),
  };
};

export const exportYaml = () => {
  const data = getData();
  const out = buildConfigObject(data);
  return jsyaml.dump(out);
};
