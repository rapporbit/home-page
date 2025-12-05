import { getData } from './store.js';

const isEditMode = () => document.body.classList.contains('edit-mode');
const sanitizeIcon = (ic) => (/^ph-[a-z0-9-]+$/i.test(ic || '') ? ic : 'ph-link');

export function renderGrid() {
  const { categories } = getData();
  const container = document.getElementById('grid-container');
  if (!container) return;
  container.innerHTML = '';
  categories.forEach((group) => {
    if (!isEditMode() && group.hidden) return;
    const card = buildCategoryCard(group);
    container.appendChild(card);
  });
  if (isEditMode()) {
    const addCatCard = document.createElement('div');
    addCatCard.className =
      'glass-panel rounded-2xl p-5 flex flex-col items-center justify-center min-h-[12rem] border-2 border-dashed border-white/20 text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer';
    addCatCard.setAttribute('data-action', 'add-cat');
    addCatCard.innerHTML = `<i class="ph ph-plus-circle text-4xl mb-2"></i><span class="font-bold">New Category</span>`;
    container.appendChild(addCatCard);
    document.body.classList.add('edit-mode');
    const editBar = document.getElementById('edit-bar');
    if (editBar) editBar.classList.add('hidden');
  } else {
    document.body.classList.remove('edit-mode');
    const editBar = document.getElementById('edit-bar');
    if (editBar) editBar.classList.add('hidden');
  }
}
function buildCategoryCard(group) {
  const card = document.createElement('div');
  card.className = `glass-panel rounded-2xl p-5 flex flex-col bg-gradient-to-br ${
    group.color || 'from-white/10 to-white/5'
  } transition-all duration-200 relative group/card cv-auto`;
  card.dataset.catId = group.id;

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4 border-b border-white/10 pb-2';

  const titleText = document.createElement('h3');
  titleText.className = `text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2 ${
    isEditMode() ? 'drag-handle cursor-grab active:cursor-grabbing' : ''
  }`;
  titleText.innerHTML = `<span class="w-2 h-2 rounded-full bg-white/50"></span> ${group.category}`;
  header.appendChild(titleText);

  if (isEditMode()) {
    const controls = document.createElement('div');
    controls.className = 'flex gap-2';
    controls.innerHTML = `
      <button class="text-white/50 hover:text-white transition-colors" data-action="toggle-cat" data-cat-id="${group.id}"><i class="ph ${
        group.hidden ? 'ph-eye-slash text-red-400' : 'ph-eye'
      }"></i></button>
      <button class="text-white/50 hover:text-white transition-colors" data-action="edit-cat" data-cat-id="${group.id}"><i class="ph ph-pencil-simple"></i></button>
      <button class="text-white/50 hover:text-red-400 transition-colors" data-action="delete-cat" data-cat-id="${group.id}"><i class="ph ph-trash"></i></button>
    `;
    header.appendChild(controls);
  }
  card.appendChild(header);

  const grid = document.createElement('div');
  const colSpan = Math.max(1, Math.min(group.colSpan || 1, 4));
  const rowSpan = Math.max(1, Math.min(group.rowSpan || 1, 2));
  grid.className = `item-container grid grid-cols-2 md:grid-cols-${colSpan * 2} gap-3 min-h-[40px] flex-1 content-start`;
  grid.dataset.catId = group.id;

  (group.items || []).forEach((item) => {
    if (!isEditMode() && item.hidden) return;
    grid.appendChild(createItemElement(group, item));
  });

  if (isEditMode()) {
    const addBtn = document.createElement('button');
    addBtn.className =
      'flex items-center justify-center gap-2 p-2 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-white hover:bg-white/10 transition-all h-full min-h-[44px]';
    addBtn.setAttribute('data-action', 'add-item');
    addBtn.setAttribute('data-cat-id', group.id);
    addBtn.innerHTML = `<i class="ph ph-plus"></i> <span class="text-xs">Add</span>`;
    grid.appendChild(addBtn);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.title = 'Drag to resize (Desktop only)';
    resizeHandle.setAttribute('data-cat-id', group.id);
    resizeHandle.setAttribute('data-action', 'resize-cat');
    card.appendChild(resizeHandle);
  }

  card.appendChild(grid);
  card.classList.add(`col-span-1`, `md:col-span-${colSpan}`, `row-span-${rowSpan}`);
  card.style.height = rowSpan > 1 ? '100%' : 'auto';

  return card;
}
function createItemElement(group, item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'relative group';
  wrapper.dataset.itemId = item.id;
  wrapper.dataset.catId = group.id;

  if (isEditMode() && item.hidden) wrapper.classList.add('is-hidden-element');

  if (isEditMode()) {
    const controls = document.createElement('div');
    controls.className = 'absolute -top-1 -right-1 z-20';
    controls.innerHTML = `
      <button class="delete-chip text-white/80 hover:text-white"
        data-action="delete-item" data-cat-id="${group.id}" data-item-id="${item.id}">
        <i class="ph ph-trash"></i>
      </button>`;
    wrapper.appendChild(controls);
    wrapper.setAttribute('data-action', 'edit-item');
  }

  if (item.url_private && !isEditMode()) {
    const container = document.createElement('div');
    container.className =
      'nav-item w-full block flex items-center gap-3 p-0 rounded-xl text-white/90 text-sm font-medium hover:text-white bg-white/5 hover:bg-white/20 overflow-hidden';
    const toggle = document.createElement('button');
    // Use the same vertical padding as normal items (p-2) so the row height matches
    // other bookmarks. Previously p-3 made these items slightly taller.
    toggle.className = 'toggle-btn shrink-0 p-2 hover:bg-white/10 transition-colors';
    toggle.title = 'Switch: Public / Private';
    const icon = document.createElement('i');
    icon.className = `ph ${sanitizeIcon(item.icon)} text-lg opacity-70 main-icon transition-colors`;
    toggle.appendChild(icon);
    const link = document.createElement('a');
    link.className = 'flex-1 p-2 pl-0 min-w-0 block h-full flex items-center';
    link.target = '_blank';
    link.href = item.url;
    link.setAttribute('data-tooltip', item.name || '');
    const span = document.createElement('span');
    span.className = 'truncate w-full block main-text transition-colors';
    span.textContent = item.name || '';
    link.appendChild(span);
    container.appendChild(toggle);
    container.appendChild(link);
    wrapper.appendChild(container);
    bindPrivateToggle(wrapper, item);
  } else {
    const link = document.createElement('a');
    link.className =
      'nav-item flex items-center gap-3 p-2 rounded-xl text-white/90 text-sm font-medium hover:text-white w-full block bg-white/5 hover:bg-white/20' +
      (isEditMode() ? ' cursor-pointer opacity-80' : '');
    if (!isEditMode()) {
      link.target = '_blank';
      link.href = item.url;
    } else {
      link.href = 'javascript:void(0)';
    }
    link.setAttribute('data-tooltip', item.name || '');
    const icon = document.createElement('i');
    icon.className = `ph ${sanitizeIcon(item.icon)} text-lg opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all`;
    const span = document.createElement('span');
    span.className = 'truncate main-text';
    span.textContent = item.name || '';
    link.appendChild(icon);
    link.appendChild(span);
    wrapper.appendChild(link);
  }
  return wrapper;
}
function bindPrivateToggle(wrapper, item) {
  const btn = wrapper.querySelector('.toggle-btn');
  const link = wrapper.querySelector('a');
  const icon = wrapper.querySelector('.main-icon');
  const text = wrapper.querySelector('.main-text');
  let isPrivate = false;
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isPrivate = !isPrivate;
    icon.classList.remove('spin-once');
    void icon.offsetWidth;
    icon.classList.add('spin-once');
    if (isPrivate) {
      link.href = item.url_private;
      btn.title = 'Current: Private (Click to switch Public)';
      icon.classList.remove('text-white', 'opacity-70');
      icon.classList.add('text-emerald-400', 'opacity-100');
      text.classList.add('text-emerald-400');
    } else {
      link.href = item.url;
      btn.title = 'Current: Public (Click to switch Private)';
      icon.classList.add('opacity-70');
      icon.classList.remove('text-emerald-400', 'opacity-100');
      text.classList.remove('text-emerald-400');
    }
  };
}
