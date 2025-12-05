import { getData, reorderCategories, reorderItems, persistStore } from './store.js';
import { showConfirm } from './confirm.js';
import { renderGrid } from './render.js';
import { showToast } from './status.js';
import { updateFolderScrollAreaHeight } from './layout.js';

// Access Sortable from the global scope safely even inside ESM.
// In some setups, referencing bare `Sortable` in modules may throw if not hoisted.
const getSortable = () =>
  (typeof window !== 'undefined' && window.Sortable)
  || (typeof globalThis !== 'undefined' && globalThis.Sortable)
  || null;

let sortables = [];
const destroySortables = () => {
  try {
    sortables.forEach((s) => s.destroy());
  } catch {}
  sortables = [];
};
const isEditMode = () => document.body.classList.contains('edit-mode');
const commitAndRefresh = () => {
  persistStore();
  renderGrid();
  updateFolderScrollAreaHeight();
  refreshEditBindings();
};

export const toggleEditMode = (force) => {
  const on = force !== undefined ? force : !isEditMode();
  document.body.classList.toggle('edit-mode', on);
  renderGrid();
  updateFolderScrollAreaHeight();
  refreshEditBindings();
};
export const refreshEditBindings = () => {
  destroySortables();
  if (!isEditMode()) return;
  const gridContainer = document.getElementById('grid-container');
  if (!gridContainer) return;
  const SortableCtor = getSortable();
  if (!SortableCtor) {
    // If Sortable hasn't been loaded yet, skip gracefully.
    // This keeps edit mode usable and avoids runtime errors.
    return;
  }

  // Category Sortable
  sortables.push(
    new SortableCtor(gridContainer, {
      handle: '.drag-handle',
      draggable: '[data-cat-id]',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: () => {
        const idOrder = Array.from(gridContainer.children)
          .map((el) => el.getAttribute('data-cat-id'))
          .filter(Boolean);
        reorderCategories(idOrder);
      },
    })
  );

  // Item Sortables
  gridContainer.querySelectorAll('.item-container').forEach((container) => {
    sortables.push(
      new SortableCtor(container, {
        // Target bookmark wrappers; using a simple selector keeps compatibility wide
        draggable: 'div[data-item-id]',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: () => {
          const catId = container.getAttribute('data-cat-id');
          if (!catId) return;
          const idOrder = Array.from(container.querySelectorAll('div[data-item-id]'))
            .map((el) => el.getAttribute('data-item-id'))
            .filter(Boolean);
          reorderItems(catId, idOrder);
        },
      })
    );
  });
};

// Delegated actions

document.addEventListener(
  'click',
  async (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (!action) return;
    ev.preventDefault();
    ev.stopPropagation();
    const catId = btn.getAttribute('data-cat-id');
    const itemId = btn.getAttribute('data-item-id');

    const data = getData();

    switch (action) {
      case 'toggle-cat': {
        const cat = data.categories.find((c) => c.id === catId);
        if (!cat) return;
        cat.hidden = !cat.hidden;
        commitAndRefresh();
        break;
      }
      case 'edit-cat':
        openEditor('category', { catId });
        break;
      case 'delete-cat': {
        const ok = await showConfirm(
          'Delete Category',
          'This will delete the entire category and all bookmarks in it. Continue?',
          'Delete',
          true
        );
        if (!ok) return;
        const idx = data.categories.findIndex((c) => c.id === catId);
        if (idx >= 0) data.categories.splice(idx, 1);
        commitAndRefresh();
        break;
      }
      case 'add-cat':
        openEditor('category', {});
        break;
      case 'add-item':
        openEditor('item', { catId });
        break;
      case 'edit-item':
        if (isEditMode()) openEditor('item', { catId, itemId });
        break;
      case 'delete-item': {
        const ok = await showConfirm('Delete Bookmark', 'Are you sure?', 'Delete', true);
        if (!ok) return;
        const cat = data.categories.find((c) => c.id === catId);
        if (!cat) return;
        const idx = (cat.items || []).findIndex((it) => it.id === itemId);
        if (idx >= 0) cat.items.splice(idx, 1);
        commitAndRefresh();
        break;
      }
    }
  },
  true
);

// Resize handler

document.addEventListener('mousedown', (e) => {
  const handle = e.target.closest('.resize-handle[data-cat-id]');
  if (!handle) return;
  e.preventDefault();
  e.stopPropagation();
  if (window.innerWidth < 768) {
    showToast('Resize is desktop only', 'error');
    return;
  }
  const catId = handle.getAttribute('data-cat-id');
  const card = document.querySelector(`[data-cat-id="${catId}"]`);
  const startX = e.clientX;
  const startY = e.clientY;
  const data = getData();
  const cat = data.categories.find((c) => c.id === catId);
  if (!cat) return;
  let startCol = cat.colSpan || 1;
  let startRow = cat.rowSpan || 1;

  const onMove = (moveEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    const threshold = 80;
    let newCol = startCol;
    let newRow = startRow;
    if (deltaX > threshold) newCol = startCol + 1;
    else if (deltaX < -threshold) newCol = startCol - 1;
    if (deltaY > threshold) newRow = startRow + 1;
    else if (deltaY < -threshold) newRow = startRow - 1;
    newCol = Math.max(1, Math.min(newCol, 4));
    newRow = Math.max(1, Math.min(newRow, 2));
    if (!card) return;
    if (newCol !== cat.colSpan || newRow !== cat.rowSpan) {
      cat.colSpan = newCol;
      cat.rowSpan = newRow;
      card.className = card.className.replace(/md:col-span-\d/g, '').replace(/row-span-\d/g, '');
      card.classList.add(`md:col-span-${newCol}`, `row-span-${newRow}`);
      card.style.height = newRow > 1 ? '100%' : 'auto';
      const gridEl = card.querySelector('.item-container');
      if (gridEl) {
        gridEl.className = gridEl.className.replace(/md:grid-cols-\d+/g, '');
        gridEl.classList.add(`md:grid-cols-${newCol * 2}`);
      }
    }
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    persistStore();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

export const openEditor = (type, ids) => {
  const modal = document.getElementById('editor-modal');
  const modalTitle = document.getElementById('modal-title')?.querySelector('span');
  if (!modal || !modalTitle) return;
  const typeInput = document.getElementById('edit-type');
  const parentInput = document.getElementById('edit-parent-idx'); // reuse for catId
  const selfInput = document.getElementById('edit-self-idx'); // reuse for itemId

  typeInput.value = type;
  parentInput.value = ids.catId || '';
  selfInput.value = ids.itemId || '';

  const itemFields = document.querySelectorAll('.edit-field-item');
  const catFields = document.querySelectorAll('.edit-field-category');

  if (type === 'category') {
    modalTitle.innerText = ids.catId ? 'Edit Category' : 'New Category';
    itemFields.forEach((el) => el.classList.add('hidden'));
    catFields.forEach((el) => el.classList.remove('hidden'));
    // Hide icon input for categories
    const iconInput = document.getElementById('inp-icon');
    if (iconInput) iconInput.closest('div').parentElement.classList.add('hidden');

    const data = getData();
    const cat = data.categories.find((c) => c.id === ids.catId) || {};
    document.getElementById('inp-name').value = cat.category || '';
    document.getElementById('inp-icon').value = '';
    document.getElementById('inp-color').value = cat.color || 'from-white/10 to-white/5';
  } else {
    modalTitle.innerText = ids.itemId ? 'Edit Item' : 'New Item';
    itemFields.forEach((el) => el.classList.remove('hidden'));
    catFields.forEach((el) => el.classList.add('hidden'));
    // Show icon input for items
    const iconInput = document.getElementById('inp-icon');
    if (iconInput) iconInput.closest('div').parentElement.classList.remove('hidden');

    const data = getData();
    const cat = data.categories.find((c) => c.id === ids.catId);
    const item = (cat?.items || []).find((it) => it.id === ids.itemId) || {};
    document.getElementById('inp-name').value = item.name || '';
    document.getElementById('inp-url').value = item.url || '';
    document.getElementById('inp-private').value = item.url_private || '';
    document.getElementById('inp-icon').value = item.icon || '';
    document.getElementById('inp-hidden').checked = item.hidden || false;
  }
  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    modal.firstElementChild.classList.remove('scale-95');
    modal.firstElementChild.classList.add('scale-100');
  });
};
export const closeEditor = () => {
  const modal = document.getElementById('editor-modal');
  if (!modal) return;
  modal.classList.add('opacity-0');
  modal.firstElementChild.classList.add('scale-95');
  modal.firstElementChild.classList.remove('scale-100');
  setTimeout(() => modal.classList.add('hidden'), 300);
};
export const saveEditor = () => {
  const type = document.getElementById('edit-type').value;
  const catId = document.getElementById('edit-parent-idx').value || '';
  const itemId = document.getElementById('edit-self-idx').value || '';
  const name = document.getElementById('inp-name').value.trim();
  if (!name) return showToast('Name is required', 'error');

  const data = getData();
  if (type === 'category') {
    const color = document.getElementById('inp-color').value;
    let cat = data.categories.find((c) => c.id === catId);
    if (cat) {
      cat.category = name;
      cat.color = color;
    } else {
      data.categories.push({
        id: cryptoRandomId('cat'),
        category: name,
        color,
        hidden: false,
        colSpan: 1,
        rowSpan: 1,
        items: [],
      });
    }
  } else {
    const url = document.getElementById('inp-url').value;
    const urlPrivate = document.getElementById('inp-private').value;
    const icon = document.getElementById('inp-icon').value;
    const hidden = document.getElementById('inp-hidden').checked;

    const cat = data.categories.find((c) => c.id === catId);
    if (!cat) return showToast('Category not found', 'error');
    if (!cat.items) cat.items = [];
    let item = cat.items.find((it) => it.id === itemId);
    if (item) {
      item.name = name;
      item.url = url;
      item.icon = icon;
      item.hidden = hidden;
      if (urlPrivate) item.url_private = urlPrivate;
      else delete item.url_private;
    } else {
      const newItem = { id: cryptoRandomId('item'), name, url, icon, hidden };
      if (urlPrivate) newItem.url_private = urlPrivate;
      cat.items.push(newItem);
    }
  }
  commitAndRefresh();
  closeEditor();
  showToast('Saved successfully', 'success');
};
const cryptoRandomId = (prefix) => {
  try {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    return `${prefix}_${Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
  } catch {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
};
