// ==========================================
// Constants & State
// ==========================================
const DEFAULT_CONFIG_URL = "https://gist.githubusercontent.com/gist-user/example/raw/nav-config-v2.yml";
// Bing Biturl API (JSON -> static Bing image URL)
const BITURL_API = "https://bing.biturl.top/";
const BITURL_DEFAULT_RES = "UHD"; // 1366, 1920, 3840, UHD
const BITURL_DEFAULT_MKT = "zh-CN";
const CACHE_KEY = "nav_config_cache";
const LAST_SYNC_KEY = "nav_last_sync";
const CUSTOM_CONFIG_KEY = "nav_custom_config_url";
const WALLPAPER_KEY = "nav_wallpaper_url";
const ICON_WEIGHT_KEY = "nav_icon_weight"; // 'regular' | 'thin' | 'light' | 'bold' | 'fill' | 'duotone'

const ICON_WEIGHT_TO_FAMILY = {
    regular: 'Phosphor',
    thin: 'Phosphor-Thin',
    light: 'Phosphor-Light',
    bold: 'Phosphor-Bold',
    fill: 'Phosphor-Fill',
    duotone: 'Phosphor-Duotone'
};

let globalData = { categories: [], search: [] };
let isEditMode = false;
let searchEngines = [];
let currentEngineIndex = 0;
let sortables = [];
let isWallpaperLoading = false;


// ==========================================
// Core Init
// ==========================================
async function init() {
    // Bind top-level UI buttons (no inline handlers per MV3)
    const bind = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    };
    bind('btn-open-import', openImportModal);
    bind('btn-export-yaml', exportYaml);
    bind('btn-done-edit', () => toggleEditMode(false));
    bind('btn-close-import', closeImportModal);
    bind('btn-import-apply', importYaml);
    bind('btn-close-editor', closeModal);
    bind('btn-save-editor', saveModal);
    initTooltipDelegation();

    // Apply preferred icon weight (global override via body class)
    injectIconWeightStyles();
    const preferred = (localStorage.getItem(ICON_WEIGHT_KEY) || 'regular');
    applyIconWeight(preferred);
    applyStoredWallpaper();
    updateTime();
    setInterval(updateTime, 1000);

    // UI Adjustments
    const hints = document.querySelector('.mt-2.text-center.text-xs.font-mono');
    if (hints) hints.remove();

    const clock = document.getElementById('clock');
    if (clock) {
        clock.title = "Current time";
        clock.onclick = null;
    }

    // Removed top-right edit button; no binding needed

    const wallpaperButton = document.getElementById('wallpaper-button');
    if (wallpaperButton) wallpaperButton.addEventListener('click', () => setBingBackground(true));

    const cachedData = localStorage.getItem(CACHE_KEY);
    const hasCustomConfig = localStorage.getItem(CUSTOM_CONFIG_KEY);

    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            processConfigData(parsed, false);
            updateStatus(hasCustomConfig ? "Local Cache (Custom)" : "Local Cache (Default)");
        } catch (e) { forceSync(); }
    } else {
        if (hasCustomConfig) forceSync();
        else setTimeout(() => { processConfigData(fallbackData, true); updateStatus("Default Data"); }, 500);
    }
}

// ==========================================
// Tooltip For Truncated Names
// ==========================================
let tooltipEl = null;
let tooltipTarget = null;

function ensureTooltip() {
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'nav-tooltip';
        document.body.appendChild(tooltipEl);
    }
}

function positionTooltipAt(x, y) {
    if (!tooltipEl) return;
    const pad = 8, offsetX = 12, offsetY = 16;
    // pre-measure to get width/height
    tooltipEl.style.left = '-9999px';
    tooltipEl.style.top = '-9999px';
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    let left = x + offsetX;
    let top = y + offsetY;
    // If exceeds bottom, show above the cursor
    if (top + th + pad > wh) top = y - th - offsetY;
    // Clamp within viewport
    left = Math.max(pad, Math.min(left, ww - tw - pad));
    top = Math.max(pad, Math.min(top, wh - th - pad));
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
}

function showTooltip(text, anchor, evt) {
    ensureTooltip();
    tooltipEl.textContent = text;
    tooltipEl.classList.add('show');
    if (evt && typeof evt.clientX === 'number') {
        positionTooltipAt(evt.clientX, evt.clientY);
    } else {
        const rect = anchor.getBoundingClientRect();
        positionTooltipAt(rect.left + rect.width / 2, rect.top);
    }
}

function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('show');
}

function isTextTruncated(anchor) {
    const span = anchor.querySelector('.main-text') || anchor.querySelector('.truncate');
    if (!span) return false;
    const el = span;
    return el.scrollWidth > el.clientWidth + 1;
}

function initTooltipDelegation() {
    document.addEventListener('mouseover', (e) => {
        const a = e.target.closest('a[data-tooltip]');
        if (!a) return;
        tooltipTarget = a;
        const text = a.getAttribute('data-tooltip') || '';
        if (!text) return;
        // Only show when truncated
        if (!isTextTruncated(a)) return;
        showTooltip(text, a, e);
    }, true);

    document.addEventListener('mousemove', (e) => {
        if (!tooltipEl || !tooltipEl.classList.contains('show')) return;
        if (tooltipTarget) positionTooltipAt(e.clientX, e.clientY);
    }, true);

    document.addEventListener('mouseout', (e) => {
        if (!tooltipTarget) return;
        const a = e.target.closest('a[data-tooltip]');
        if (!a || a !== tooltipTarget) return;
        const to = e.relatedTarget;
        if (to && (to === a || a.contains(to))) return; // still inside anchor
        hideTooltip();
        tooltipTarget = null;
    }, true);

    document.addEventListener('focusin', (e) => {
        const a = e.target.closest('a[data-tooltip]');
        if (!a) return;
        tooltipTarget = a;
        const text = a.getAttribute('data-tooltip') || '';
        if (!text) return;
        if (!isTextTruncated(a)) return;
        showTooltip(text, a, e);
    }, true);

    document.addEventListener('focusout', (e) => {
        if (tooltipTarget) { hideTooltip(); tooltipTarget = null; }
    }, true);
}

// ==========================================
// Data Processing & Rendering
// ==========================================
function processConfigData(data, shouldSort = true) {
    let categories = [];
    let engines = [];

    if (Array.isArray(data)) {
        categories = data;
        engines = defaultEngines;
    } else if (typeof data === 'object') {
        categories = data.categories || data.groups || [];
        engines = data.search || data.searchEngines || defaultEngines;
    }

    if (shouldSort) {
        categories.sort((a, b) => (a.order || 999) - (b.order || 999));
        categories.forEach(cat => {
            if (cat.items && Array.isArray(cat.items)) {
                cat.items.sort((a, b) => (a.order || 999) - (b.order || 999));
            }
        });
    }

    globalData = { categories, search: engines };
    initSearchEngines(engines);
    renderGrid();
}

function renderGrid() {
    const container = document.getElementById('grid-container');
    container.innerHTML = '';

    sortables.forEach(s => s.destroy());
    sortables = [];

    globalData.categories.forEach((group, index) => {
        if (!isEditMode && group.hidden) return;

        const card = document.createElement('div');
        card.setAttribute('data-id', index);

        const colSpan = group.colSpan || 1;
        const rowSpan = group.rowSpan || 1;

        card.className = `glass-panel rounded-2xl p-5 flex flex-col bg-gradient-to-br ${group.color || 'from-white/10 to-white/5'} transition-all duration-200 animate-fade-in-up relative group/card
            col-span-1 md:col-span-${colSpan} row-span-${rowSpan}`;

        card.style.height = rowSpan > 1 ? '100%' : 'auto';

        if (isEditMode) {
            card.classList.add('border-dashed', 'border-white/30');
            if (group.hidden) card.classList.add('is-hidden-element');
        }

        const header = document.createElement('div');
        header.className = "flex justify-between items-center mb-4 border-b border-white/10 pb-2";
        const titleText = document.createElement('h3');
        titleText.className = `text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2 ${isEditMode ? 'drag-handle cursor-grab active:cursor-grabbing' : ''}`;
        titleText.innerHTML = `<span class="w-2 h-2 rounded-full bg-white/50"></span> ${group.category}`;
        header.appendChild(titleText);

        if (isEditMode) {
            const controls = document.createElement('div');
            controls.className = "flex gap-2";
            controls.innerHTML = `
                <button class="text-white/50 hover:text-white transition-colors" data-action="toggle-cat" data-index="${index}"><i class="ph ${group.hidden ? 'ph-eye-slash text-red-400' : 'ph-eye'}"></i></button>
                <button class="text-white/50 hover:text-white transition-colors" data-action="edit-cat" data-index="${index}"><i class="ph ph-pencil-simple"></i></button>
                <button class="text-white/50 hover:text-red-400 transition-colors" data-action="delete-cat" data-index="${index}"><i class="ph ph-trash"></i></button>
            `;
            controls.addEventListener('click', (ev) => {
                const btn = ev.target.closest('button[data-action]');
                if (!btn) return;
                const idx = parseInt(btn.getAttribute('data-index'));
                const act = btn.getAttribute('data-action');
                if (act === 'toggle-cat') toggleCategoryVisibility(idx);
                else if (act === 'edit-cat') openModal('category', null, null, idx);
                else if (act === 'delete-cat') deleteCategory(idx);
            });
            header.appendChild(controls);
        }
        card.appendChild(header);

        const internalCols = colSpan * 2;
        const grid = document.createElement('div');
        grid.className = `item-container grid grid-cols-2 md:grid-cols-${internalCols} gap-3 min-h-[40px] flex-1 content-start`;
        grid.setAttribute('data-group-index', index);

        (group.items || []).forEach((item, itemIndex) => {
            if (!isEditMode && item.hidden) return;
            grid.appendChild(createItemElement(item, itemIndex, index));
        });

        if (isEditMode) {
            const addBtn = document.createElement('button');
            addBtn.className = "flex items-center justify-center gap-2 p-2 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-white hover:bg-white/10 transition-all h-full min-h-[44px]";
            addBtn.innerHTML = `<i class="ph ph-plus"></i> <span class="text-xs">Add</span>`;
            addBtn.onclick = () => openModal('item', null, index, null);
            grid.appendChild(addBtn);

            const resizeHandle = document.createElement('div');
            resizeHandle.className = "resize-handle";
            resizeHandle.title = "Drag to resize (Desktop only)";
            resizeHandle.addEventListener('mousedown', (e) => initResizeHandler(e, index));
            card.appendChild(resizeHandle);
        }

        card.appendChild(grid);
        container.appendChild(card);
    });

    if (isEditMode) {
        const addCatCard = document.createElement('div');
        addCatCard.className = "glass-panel rounded-2xl p-5 flex flex-col items-center justify-center min-h-[12rem] border-2 border-dashed border-white/20 text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer";
        addCatCard.onclick = () => openModal('category', null, null, null);
        addCatCard.innerHTML = `<i class="ph ph-plus-circle text-4xl mb-2"></i><span class="font-bold">New Category</span>`;
        container.appendChild(addCatCard);

        initSortable();
        document.body.classList.add('edit-mode');
        document.getElementById('edit-bar').classList.remove('-translate-y-full');
    } else {
        document.body.classList.remove('edit-mode');
        document.getElementById('edit-bar').classList.add('-translate-y-full');
    }

    updateFolderScrollAreaHeight();
}

function updateFolderScrollAreaHeight() {
    const gridContainer = document.getElementById('grid-container');
    if (!gridContainer) return;

    requestAnimationFrame(() => {
        const target = document.getElementById('grid-container');
        if (!target) return;

        const viewportHeight = window.innerHeight;
        const rect = target.getBoundingClientRect();
        // Extra bottom space so footer sits higher than the viewport bottom
        let reserveSpace = 32 + 24; // base 32 + extra 24px

        const footer = document.querySelector('footer');
        if (footer) {
            const footerStyles = getComputedStyle(footer);
            reserveSpace += footer.offsetHeight
                + parseFloat(footerStyles.paddingTop || '0')
                + parseFloat(footerStyles.paddingBottom || '0');
        }

        const availableHeight = viewportHeight - rect.top - reserveSpace;
        if (availableHeight > 0) target.style.maxHeight = `${availableHeight}px`;
        else target.style.maxHeight = '';
    });
}

function createItemElement(item, index, parentIndex) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-id', index);
    wrapper.className = "relative group";
    if (isEditMode && item.hidden) wrapper.classList.add('is-hidden-element');

        if (isEditMode) {
            const controls = document.createElement('div');
            controls.className = "absolute -top-2 -right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity scale-90";
            const hiddenBadge = item.hidden ? `<span class="p-1.5 bg-gray-600 rounded-full text-white shadow-lg"><i class="ph ph-eye-slash text-xs"></i></span>` : '';
            controls.innerHTML = `
            ${hiddenBadge}
            <button class="p-1.5 bg-blue-600 rounded-full text-white shadow-lg hover:bg-blue-500" data-action="edit-item" data-parent="${parentIndex}" data-index="${index}"><i class="ph ph-pencil-simple text-xs"></i></button>
            <button class="p-1.5 bg-red-600 rounded-full text-white shadow-lg hover:bg-red-500" data-action="delete-item" data-parent="${parentIndex}" data-index="${index}"><i class="ph ph-trash text-xs"></i></button>
        `;
            controls.addEventListener('click', (ev) => {
                const btn = ev.target.closest('button[data-action]');
                if (!btn) return;
                const p = parseInt(btn.getAttribute('data-parent'));
                const i = parseInt(btn.getAttribute('data-index'));
                const act = btn.getAttribute('data-action');
                if (act === 'edit-item') openModal('item', null, p, i);
                else if (act === 'delete-item') deleteItem(p, i);
            });
            wrapper.appendChild(controls);
        }

    if (item.url_private) {
        const containerClass = isEditMode ? "nav-item opacity-80 cursor-grab" : "nav-item";
        // Keep same overall height as normal items by using p-2 on container and a compact toggle button
        wrapper.innerHTML += `
            <div class="${containerClass} w-full block flex items-center gap-3 p-2 rounded-xl text-white/90 text-sm font-medium hover:text-white bg-white/5 hover:bg-white/20 overflow-hidden">
                <button class="toggle-btn shrink-0 rounded inline-flex items-center justify-center p-0 leading-none hover:bg-white/10 transition-colors" title="Switch: Public / Private">
                    <i class="ph ${item.icon || 'ph-link'} text-lg opacity-70 main-icon transition-colors"></i>
                </button>
                <a href="${isEditMode ? 'javascript:void(0)' : item.url}" ${!isEditMode ? 'target="_blank"' : ''} data-tooltip="${item.name}" class="flex-1 min-w-0 flex items-center">
                    <span class="truncate w-full block main-text transition-colors">${item.name}</span>
                </a>
            </div>`;
        if (!isEditMode) bindPrivateToggle(wrapper, item);
    } else {
        wrapper.innerHTML += `
            <a href="${isEditMode ? 'javascript:void(0)' : item.url}" ${!isEditMode ? 'target="_blank"' : ''} data-tooltip="${item.name}" class="nav-item flex items-center gap-3 p-2 rounded-xl text-white/90 text-sm font-medium hover:text-white w-full block bg-white/5 hover:bg-white/20 ${isEditMode ? 'cursor-grab opacity-80' : ''}">
                <i class="ph ${item.icon || 'ph-link'} text-lg opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all"></i>
                <span class="truncate">${item.name}</span>
            </a>`;
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
        e.preventDefault(); e.stopPropagation();
        isPrivate = !isPrivate;

        icon.style.transform = "rotate(360deg)";
        setTimeout(() => icon.style.transform = "rotate(0deg)", 300);

        if (isPrivate) {
            link.href = item.url_private;
            btn.title = "Current: Private (Click to switch Public)";
            icon.classList.remove('text-white', 'opacity-70');
            icon.classList.add('text-emerald-400', 'opacity-100');
            text.classList.add('text-emerald-400');
        } else {
            link.href = item.url;
            btn.title = "Current: Public (Click to switch Private)";
            icon.classList.add('opacity-70');
            icon.classList.remove('text-emerald-400', 'opacity-100');
            text.classList.remove('text-emerald-400');
        }
    };
}

// ==========================================
// RESIZE LOGIC
// ==========================================
function initResizeHandler(e, catIndex) {
    e.preventDefault();
    e.stopPropagation();

    if (window.innerWidth < 768) {
        showToast("Resize is desktop only", "warning");
        return;
    }

    const card = e.target.parentElement;
    const startX = e.clientX;
    const startY = e.clientY;

    const currentCat = globalData.categories[catIndex];
    let startColSpan = currentCat.colSpan || 1;
    let startRowSpan = currentCat.rowSpan || 1;

    function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const threshold = 80;

        let newColSpan = startColSpan;
        let newRowSpan = startRowSpan;

        if (deltaX > threshold) newColSpan = startColSpan + 1;
        else if (deltaX < -threshold) newColSpan = startColSpan - 1;

        if (deltaY > threshold) newRowSpan = startRowSpan + 1;
        else if (deltaY < -threshold) newRowSpan = startRowSpan - 1;

        newColSpan = Math.max(1, Math.min(newColSpan, 4));
        newRowSpan = Math.max(1, Math.min(newRowSpan, 2));

        if (newColSpan !== currentCat.colSpan || newRowSpan !== currentCat.rowSpan) {
            currentCat.colSpan = newColSpan;
            currentCat.rowSpan = newRowSpan;

            card.className = card.className.replace(/md:col-span-\d/g, '').replace(/row-span-\d/g, '');
            card.classList.add(`md:col-span-${newColSpan}`);
            card.classList.add(`row-span-${newRowSpan}`);
            card.style.height = newRowSpan > 1 ? '100%' : 'auto';

            const gridEl = card.querySelector('.item-container');
            if (gridEl) {
                gridEl.className = gridEl.className.replace(/md:grid-cols-\d+/g, '');
                gridEl.classList.add(`md:grid-cols-${newColSpan * 2}`);
            }
        }
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveToLocal(globalData);
        renderGrid();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ==========================================
// Edit Mode, Modal & Import Logic
// ==========================================
function toggleEditMode(forceState) {
    isEditMode = forceState !== undefined ? forceState : !isEditMode;
    renderGrid();
    if (isEditMode) showToast("Edit Mode: Drag handle to resize", "info");
}

function toggleCategoryVisibility(idx) {
    const cat = globalData.categories[idx];
    cat.hidden = !cat.hidden;
    saveToLocal(globalData);
    renderGrid();
    showToast(cat.hidden ? "Category Hidden" : "Category Visible", "info");
}

function initSortable() {
    const gridContainer = document.getElementById('grid-container');
    sortables.push(new Sortable(gridContainer, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: () => {
            const newOrder = [];
            Array.from(gridContainer.children).forEach(el => {
                if (el.hasAttribute('data-id')) newOrder.push(globalData.categories[el.getAttribute('data-id')]);
            });
            globalData.categories = newOrder;
            saveToLocal(globalData);
            renderGrid();
        }
    }));
    document.querySelectorAll('.item-container').forEach(container => {
        sortables.push(new Sortable(container, {
            group: 'shared-items',
            animation: 150,
            ghostClass: 'sortable-ghost',
            draggable: '.group',
            onEnd: (evt) => {
                if (evt.from === evt.to && evt.oldIndex === evt.newIndex) return;
                const fromIdx = parseInt(evt.from.getAttribute('data-group-index'));
                const toIdx = parseInt(evt.to.getAttribute('data-group-index'));
                const item = globalData.categories[fromIdx].items.splice(evt.oldIndex, 1)[0];
                if (!globalData.categories[toIdx].items) globalData.categories[toIdx].items = [];
                globalData.categories[toIdx].items.splice(evt.newIndex, 0, item);
                saveToLocal(globalData);
                renderGrid();
            }
        }));
    });
}

// --- Import Logic ---
const importModal = document.getElementById('import-modal');

function openImportModal() {
    importModal.classList.remove('hidden');
    requestAnimationFrame(() => {
        importModal.classList.remove('opacity-0');
        importModal.firstElementChild.classList.remove('scale-95');
        importModal.firstElementChild.classList.add('scale-100');
    });
    document.getElementById('import-area').value = '';
    document.getElementById('import-area').focus();
}

function closeImportModal() {
    importModal.classList.add('opacity-0');
    importModal.firstElementChild.classList.add('scale-95');
    importModal.firstElementChild.classList.remove('scale-100');
    setTimeout(() => importModal.classList.add('hidden'), 300);
}

function importYaml() {
    const yamlStr = document.getElementById('import-area').value.trim();
    if (!yamlStr) return showToast("Please paste YAML content", "warning");

    try {
        const data = jsyaml.load(yamlStr);

        // Basic Validation
        if (!data || typeof data !== 'object') throw new Error("Invalid YAML format");

        // Structure Check (Compatible with both new object & old array format)
        let categories = [];
        if (Array.isArray(data)) {
            categories = data;
        } else if (data.categories && Array.isArray(data.categories)) {
            categories = data.categories;
        } else {
            throw new Error("YAML must contain 'categories' list");
        }

        // Apply
        processConfigData(data, true);
        saveToLocal(globalData);
        closeImportModal();
        showToast("Configuration imported successfully!", "success");

    } catch (e) {
        console.error(e);
        showToast("Import failed: " + e.message, "error");
    }
}

// --- Edit Modal Logic ---
const modal = document.getElementById('editor-modal');
const modalTitle = document.getElementById('modal-title').querySelector('span');

function openModal(type, data, parentIdx, selfIdx) {
    document.getElementById('edit-type').value = type;
    document.getElementById('edit-parent-idx').value = parentIdx !== null ? parentIdx : '';
    document.getElementById('edit-self-idx').value = selfIdx !== null ? selfIdx : '';

    if (type === 'category') {
        modalTitle.innerText = selfIdx !== null ? "Edit Category" : "New Category";
        document.querySelectorAll('.edit-field-item').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.edit-field-category').forEach(el => el.classList.remove('hidden'));

        const cat = selfIdx !== null ? globalData.categories[selfIdx] : {};
        document.getElementById('inp-name').value = cat.category || '';
        document.getElementById('inp-icon').value = '';
        document.getElementById('inp-color').value = cat.color || 'from-white/10 to-white/5';
    } else {
        modalTitle.innerText = selfIdx !== null ? "Edit Item" : "New Item";
        document.querySelectorAll('.edit-field-item').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.edit-field-category').forEach(el => el.classList.add('hidden'));

        const item = selfIdx !== null ? globalData.categories[parentIdx].items[selfIdx] : {};
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
}

function closeModal() {
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    modal.firstElementChild.classList.remove('scale-100');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function saveModal() {
    const type = document.getElementById('edit-type').value;
    const parentIdx = parseInt(document.getElementById('edit-parent-idx').value);
    const selfIdx = document.getElementById('edit-self-idx').value !== '' ? parseInt(document.getElementById('edit-self-idx').value) : null;
    const name = document.getElementById('inp-name').value;

    if (!name) return showToast("Name is required", "error");

    if (type === 'category') {
        const color = document.getElementById('inp-color').value;
        const oldHidden = selfIdx !== null ? (globalData.categories[selfIdx].hidden || false) : false;
        const oldColSpan = selfIdx !== null ? (globalData.categories[selfIdx].colSpan || 1) : 1;
        const oldRowSpan = selfIdx !== null ? (globalData.categories[selfIdx].rowSpan || 1) : 1;

        const newCat = {
            category: name,
            color: color,
            hidden: oldHidden,
            colSpan: oldColSpan,
            rowSpan: oldRowSpan,
            items: selfIdx !== null ? globalData.categories[selfIdx].items : []
        };

        if (selfIdx !== null) globalData.categories[selfIdx] = { ...globalData.categories[selfIdx], ...newCat };
        else globalData.categories.push(newCat);
    } else {
        const url = document.getElementById('inp-url').value;
        const urlPrivate = document.getElementById('inp-private').value;
        const icon = document.getElementById('inp-icon').value;
        const hidden = document.getElementById('inp-hidden').checked;

        const newItem = { name, url, icon, hidden };
        if (urlPrivate) newItem.url_private = urlPrivate;

        if (!globalData.categories[parentIdx].items) globalData.categories[parentIdx].items = [];
        if (selfIdx !== null) globalData.categories[parentIdx].items[selfIdx] = newItem;
        else globalData.categories[parentIdx].items.push(newItem);
    }
    saveToLocal(globalData);
    renderGrid();
    closeModal();
    showToast("Saved successfully", "success");
}

function deleteItem(parentIdx, itemIdx) {
    if (!confirm("Delete this item?")) return;
    globalData.categories[parentIdx].items.splice(itemIdx, 1);
    saveToLocal(globalData);
    renderGrid();
}
function deleteCategory(idx) {
    if (!confirm("Delete this entire category?")) return;
    globalData.categories.splice(idx, 1);
    saveToLocal(globalData);
    renderGrid();
}

function exportYaml() {
    try {
        const exportObj = {
            search: globalData.search,
            categories: globalData.categories.map((c, i) => {
                const catObj = {
                    category: c.category,
                    color: c.color,
                    order: i + 1,
                    colSpan: c.colSpan || 1,
                    rowSpan: c.rowSpan || 1
                };
                if (c.hidden) catObj.hidden = true;
                catObj.items = (c.items || []).map(item => {
                    const cleanItem = { name: item.name, url: item.url, icon: item.icon };
                    if (item.url_private) cleanItem.url_private = item.url_private;
                    if (item.hidden) cleanItem.hidden = true;
                    return cleanItem;
                });
                return catObj;
            })
        };
        const yamlStr = jsyaml.dump(exportObj);
        navigator.clipboard.writeText(yamlStr).then(() => showToast("YAML config copied!", "success"));
    } catch (e) { console.error(e); showToast("Export failed", "error"); }
}

// ==========================================
// HELP & UTILS
// ==========================================
function showHelp() {
    if (document.getElementById('help-modal')) {
        document.getElementById('help-modal').remove();
        return;
    }

    const helpHtml = `
        <div id="help-modal" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-0">
            <div class="modal-glass rounded-2xl p-8 w-full max-w-lg transform scale-95 transition-transform duration-300 shadow-2xl text-white">
                <h3 class="text-2xl font-bold mb-4 flex items-center gap-2">
                    <i class="ph ph-info"></i> <span>Commands & Help</span>
                </h3>
                <div class="space-y-4 text-sm text-white/80">
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>edit</code> &nbsp; Enter UI Edit Mode (Drag & Resize)</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>sync</code> &nbsp; Force sync config from URL</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>config [url]</code> &nbsp; Set remote config URL</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>reset</code> &nbsp; Reset to default</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>help</code> &nbsp; Show this message</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>weight [thin|light|regular|bold|fill|duotone]</code> &nbsp; Icon weight</p>
                    <div class="pt-4 border-t border-white/10 text-xs opacity-60">
                        Tips: Click the clock to open this menu.<br>
                        In Edit Mode, use the eye icon to hide/show items.
                    </div>
                </div>
                <div class="mt-8 flex justify-end">
                    <button id="help-close-btn" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all">Got it</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', helpHtml);

    requestAnimationFrame(() => {
        const el = document.getElementById('help-modal');
        if (el) {
            el.classList.remove('opacity-0');
            el.firstElementChild.classList.remove('scale-95');
            el.firstElementChild.classList.add('scale-100');
            // Close handlers without inline JS
            el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
            const inner = el.firstElementChild;
            if (inner) inner.addEventListener('click', (e) => e.stopPropagation());
            const closeBtn = document.getElementById('help-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => el.remove());
        }
    });
}

// ==========================================
// Icon Weight: global override via body class + injected CSS
// ==========================================
function injectIconWeightStyles() {
    if (document.getElementById('icon-weight-style')) return;
    const css = `
    .phw-regular .ph { font-family: "Phosphor" !important; }
    .phw-thin .ph { font-family: "Phosphor-Thin" !important; }
    .phw-light .ph { font-family: "Phosphor-Light" !important; }
    .phw-bold .ph { font-family: "Phosphor-Bold" !important; }
    .phw-fill .ph { font-family: "Phosphor-Fill" !important; }
    .phw-duotone .ph { font-family: "Phosphor-Duotone" !important; }
    `;
    const style = document.createElement('style');
    style.id = 'icon-weight-style';
    style.textContent = css;
    document.head.appendChild(style);
}

function applyIconWeight(weight) {
    const body = document.body;
    const valid = Object.keys(ICON_WEIGHT_TO_FAMILY);
    const w = valid.includes(weight) ? weight : 'regular';
    // Remove previous
    body.classList.forEach(cls => { if (cls.startsWith('phw-')) body.classList.remove(cls); });
    body.classList.add('phw-' + w);
}

function setIconWeight(weight) {
    const valid = Object.keys(ICON_WEIGHT_TO_FAMILY);
    if (!valid.includes(weight)) { showToast('Invalid weight', 'error'); return; }
    localStorage.setItem(ICON_WEIGHT_KEY, weight);
    applyIconWeight(weight);
    showToast('Icon weight: ' + weight, 'success');
}

// Global action delegation to ensure edit/delete always work (even if elements re-render)
document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const act = btn.getAttribute('data-action');
    if (!act) return;
    // Only handle our known actions; ignore others
    if (!['edit-item','delete-item','edit-cat','delete-cat','toggle-cat'].includes(act)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const idx = btn.getAttribute('data-index');
    const p = btn.getAttribute('data-parent');
    const i = btn.getAttribute('data-index');
    switch (act) {
        case 'toggle-cat':
            if (idx !== null) toggleCategoryVisibility(parseInt(idx));
            break;
        case 'edit-cat':
            if (idx !== null) openModal('category', null, null, parseInt(idx));
            break;
        case 'delete-cat':
            if (idx !== null) deleteCategory(parseInt(idx));
            break;
        case 'edit-item':
            if (p !== null && i !== null) openModal('item', null, parseInt(p), parseInt(i));
            break;
        case 'delete-item':
            if (p !== null && i !== null) deleteItem(parseInt(p), parseInt(i));
            break;
    }
}, true);

async function forceSync() {
    const searchIcon = document.getElementById('search-icon');
    searchIcon.classList.add('animate-spin');
    const loadingToast = showToast("Syncing...", "loading", { duration: 0 });
    try {
        const targetUrl = localStorage.getItem(CUSTOM_CONFIG_KEY) || DEFAULT_CONFIG_URL;
        if (targetUrl.includes('gist-user/example')) {
            setTimeout(() => { processConfigData(fallbackData, true); saveToLocal(globalData); searchIcon.classList.remove('animate-spin'); }, 500);
            return;
        }
        const res = await fetch(`${targetUrl}?t=${Date.now()}`);
        if (!res.ok) throw new Error("Fetch failed");
        const txt = await res.text();
        const data = jsyaml.load(txt);
        processConfigData(data, true);
        saveToLocal(globalData);
        showToast("Sync completed", "success");
    } catch (e) { showToast(e.message, "error"); }
    finally {
        if (loadingToast && typeof loadingToast.dismiss === 'function') loadingToast.dismiss();
        searchIcon.classList.remove('animate-spin');
    }
}

function saveToLocal(data) { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
function applyStoredWallpaper() {
    const stored = localStorage.getItem(WALLPAPER_KEY);
    if (!stored) return; // Never fetch on refresh; only apply if we have one
    let url = stored;
    if (stored.startsWith('{')) {
        try { const meta = JSON.parse(stored); url = meta?.url || ''; } catch { url = ''; }
    }
    if (typeof url === 'string' && url) {
        document.body.style.backgroundImage = `url('${url}')`;
    }
}
async function setBingBackground(manual = false) {
    if (isWallpaperLoading) return;
    isWallpaperLoading = true;
    toggleWallpaperButtonLoading(true);

    try {
        const prev = getStoredWallpaperUrl();
        const nextUrl = await fetchBiturlRandomUrl(prev);
        if (!nextUrl) throw new Error('no-image');
        // Preload to avoid black flicker; only swap when fully loaded
        await preloadImage(nextUrl);
        document.body.style.backgroundImage = `url('${nextUrl}')`;
        try { localStorage.setItem(WALLPAPER_KEY, nextUrl); } catch {}
    } catch (e) {
        // suppress wallpaper change prompts
    } finally {
        isWallpaperLoading = false;
        toggleWallpaperButtonLoading(false);
    }
}
function toggleWallpaperButtonLoading(isLoading) {
    const btn = document.getElementById('wallpaper-button');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (isLoading) {
        btn.setAttribute('disabled', 'disabled');
        if (icon) icon.classList.add('animate-spin');
    } else {
        btn.removeAttribute('disabled');
        if (icon) icon.classList.remove('animate-spin');
    }
}
// Helpers for wallpaper loading (Biturl JSON API)
function getStoredWallpaperUrl() {
    const stored = localStorage.getItem(WALLPAPER_KEY);
    if (!stored) return '';
    if (stored.startsWith('{')) {
        try { const o = JSON.parse(stored); return o?.url || ''; } catch { return ''; }
    }
    return stored;
}

function preloadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
    });
}

async function fetchBiturlUrlByIndex(index, resolution = BITURL_DEFAULT_RES, mkt = BITURL_DEFAULT_MKT) {
    const url = `${BITURL_API}?resolution=${encodeURIComponent(resolution)}&format=json&index=${index}&mkt=${encodeURIComponent(mkt)}&_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch-failed');
    const data = await res.json();
    return data?.url || '';
}

async function fetchBiturlRandomUrl(prevUrl = '') {
    const indexes = [0,1,2,3,4,5,6,7].sort(() => Math.random() - 0.5);
    for (let i = 0; i < indexes.length && i < 6; i++) {
        try {
            const url = await fetchBiturlUrlByIndex(indexes[i]);
            if (url && url !== prevUrl) return url;
        } catch { /* try next */ }
    }
    try { return await fetchBiturlUrlByIndex(0); } catch { return ''; }
}
function updateStatus(text) { document.getElementById('data-source').textContent = text; }
function updateTime() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    document.getElementById('date').textContent = now.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function showToast(msg, type = 'info', options = {}) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-warning' : type === 'loading' ? 'ph-spinner animate-spin' : 'ph-info';
    toast.innerHTML = `<i class="ph ${icon} text-lg"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    const duration = typeof options.duration === 'number' ? options.duration : 3000;
    let hideTimer = null;
    if (duration > 0) {
        hideTimer = setTimeout(() => fadeOutToast(toast), duration);
    }

    return {
        element: toast,
        dismiss: () => {
            if (!toast.isConnected) return;
            if (hideTimer) clearTimeout(hideTimer);
            fadeOutToast(toast);
        }
    };
}

function fadeOutToast(toast) {
    toast.style.opacity = '0';
    setTimeout(() => { if (toast && toast.parentElement) toast.remove(); }, 300);
}

const defaultEngines = [{ name: 'Google', url: 'https://www.google.com/search?q=', icon: 'ph-google-logo' }];
function initSearchEngines(engines) {
    searchEngines = engines;
    const container = document.getElementById('engine-container');
    container.innerHTML = '';
    if (searchEngines.length === 0) searchEngines = defaultEngines;
    searchEngines.forEach((engine, index) => {
        const btn = document.createElement('button');
        btn.className = `p-2 hover:bg-white/20 rounded-lg transition-colors text-white/80 ${index === 0 ? 'engine-active' : ''}`;
        btn.onclick = () => switchEngine(index);
        // Make right-side engine icons larger while keeping the input height unchanged
        btn.innerHTML = engine.icon?.startsWith('ph-')
            ? `<i class="ph ${engine.icon} text-xl"></i>`
            : `<span class="font-bold text-lg">${engine.icon || 'S'}</span>`;
        container.appendChild(btn);
    });
    switchEngine(0);
}
function switchEngine(index) {
    currentEngineIndex = index;
    const input = document.getElementById('search-input');
    input.placeholder = `Search with ${searchEngines[index].name}...`;
    Array.from(document.getElementById('engine-container').children).forEach((btn, i) => {
        i === index ? btn.classList.add('engine-active') : btn.classList.remove('engine-active');
    });
    input.focus();
}

document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (!val) return;
        if (val === '>edit') { toggleEditMode(true); e.target.value = ''; return; }
        if (val.startsWith('>config ')) { localStorage.setItem(CUSTOM_CONFIG_KEY, val.substring(8)); forceSync(); e.target.value = ''; return; }
        if (val === '>sync') { forceSync(); e.target.value = ''; return; }
        if (val === '>reset') { if (confirm("Reset?")) { localStorage.clear(); location.reload(); } e.target.value = ''; return; }
        if (val === '>help') { showHelp(); e.target.value = ''; return; }
        if (val === '>weight') {
            const current = localStorage.getItem(ICON_WEIGHT_KEY) || 'regular';
            showToast('Current weight: ' + current + ' (thin|light|regular|bold|fill|duotone)', 'info');
            e.target.value = '';
            return;
        }
        if (val.startsWith('>weight ')) {
            const w = val.split(/\s+/)[1];
            setIconWeight(w);
            e.target.value = '';
            return;
        }

        window.open(searchEngines[currentEngineIndex].url + encodeURIComponent(val), '_blank');
        e.target.value = '';
    }
});
const fallbackData = { search: defaultEngines, categories: [{ category: "Sample", color: "from-blue-600/20 to-indigo-600/20", items: [{ name: "Google", url: "https://google.com", icon: "ph-google-logo" }] }] };

window.addEventListener('resize', updateFolderScrollAreaHeight);
document.addEventListener('DOMContentLoaded', init);
