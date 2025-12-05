import { KEYS } from './storage.js';

export const store = {
  categories: [],
  search: [],
};

export const setData = (categories, search, { persist = false } = {}) => {
  store.categories = categories || [];
  store.search = search || [];
  if (persist) persistStore();
};

export const getData = () => ({ categories: store.categories, search: store.search });

export const persistStore = () => {
  localStorage.setItem(KEYS.cache, JSON.stringify({ categories: store.categories, search: store.search }));
};

export const reorderCategories = (orderedIds, { persist = true } = {}) => {
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;
  const id2cat = new Map(store.categories.map((c) => [c.id, c]));
  const next = orderedIds.map((id) => id2cat.get(id)).filter(Boolean);
  if (!next.length) return;
  store.categories = next;
  if (persist) persistStore();
};

export const reorderItems = (catId, orderedIds, { persist = true } = {}) => {
  if (!catId || !Array.isArray(orderedIds) || !orderedIds.length) return;
  const cat = store.categories.find((c) => c.id === catId);
  if (!cat) return;
  const id2item = new Map((cat.items || []).map((it) => [it.id, it]));
  cat.items = orderedIds.map((id) => id2item.get(id)).filter(Boolean);
  if (persist) persistStore();
};
