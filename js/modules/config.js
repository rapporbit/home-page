import { initSearchEngines, defaultEngines } from './search.js';
import { setData } from './store.js';
import { renderGrid } from './render.js';

export function processConfigData(data, shouldSort = true) {
  let categories = [];
  let engines = [];
  if (Array.isArray(data)) {
    categories = data;
    engines = defaultEngines;
  } else if (typeof data === 'object' && data) {
    categories = data.categories || data.groups || [];
    engines = data.search || data.searchEngines || defaultEngines;
  }
  if (shouldSort) {
    categories.sort((a, b) => (a.order || 999) - (b.order || 999));
    categories.forEach((cat) => {
      if (cat.items && Array.isArray(cat.items)) {
        cat.items.sort((a, b) => (a.order || 999) - (b.order || 999));
      }
    });
  }
  ensureStableIds(categories);
  setData(categories, engines, { persist: shouldSort });
  initSearchEngines(engines);
  renderGrid();
}
export function ensureStableIds(categories = []) {
  categories.forEach((cat) => {
    if (!cat.id) cat.id = generateId('cat');
    (cat.items || []).forEach((it) => {
      if (!it.id) it.id = generateId('item');
    });
  });
}
function generateId(prefix = 'id') {
  try {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    const hex = Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${prefix}_${hex}`;
  } catch {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
export const fallbackData = {
  search: defaultEngines,
  categories: [
    {
      category: 'Sample',
      color: 'from-blue-600/20 to-indigo-600/20',
      items: [{ name: 'Google', url: 'https://google.com', icon: 'ph-google-logo' }],
    },
  ],
};
