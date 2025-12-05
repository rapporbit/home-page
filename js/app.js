// ==========================================
// Constants & State
// ==========================================
// Bing Biturl API (JSON -> static Bing image URL)
const BITURL_API = "https://bing.biturl.top/";
const BITURL_DEFAULT_RES = "UHD"; // 1366, 1920, 3840, UHD
const BITURL_DEFAULT_MKT = "zh-CN";
// Keys centralized
const KEYS = {
    cache: 'nav_config_cache',
    wallpaper: 'nav_wallpaper_url',
    iconWeight: 'nav_icon_weight',
    gist: {
        id: 'gist_id',
        file: 'gist_filename',
        token: 'gist_token',
        lastPull: 'gist_last_pull',
        lastPush: 'gist_last_push'
    }
};

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
    // Import/Copy now live in Gist Settings UI
    bind('btn-done-edit', () => toggleEditMode(false));
    bind('btn-close-import', closeImportModal);
    bind('btn-import-apply', importYaml);
    bind('btn-close-editor', closeModal);
    bind('btn-save-editor', saveModal);
    initTooltipDelegation();
    bindGistSettingsUI();

    // In edit mode, clicking outside the folder grid exits edit mode
    // Use bubbling phase so element-specific handlers run first;
    // avoids re-entering edit mode when clicking the footer Edit button.
    document.addEventListener('click', (e) => {
        if (!isEditMode) return;
        // Ignore clicks inside any modal overlays/contents
        const inModal = e.target.closest('#gist-modal, #import-modal, #editor-modal, #help-modal, #confirm-modal');
        if (inModal) return;
        // Ignore footer Edit button itself to avoid instant toggle-off
        const onFooterEdit = e.target.closest('#footer-edit-toggle');
        if (onFooterEdit) return;
        // Only keep edit mode when clicking inside the grid area
        const inGrid = e.target.closest('#grid-container');
        if (!inGrid) toggleEditMode(false);
    }, false);

    // Apply preferred icon weight (global override via body class)
    injectIconWeightStyles();
    const preferred = (localStorage.getItem(KEYS.iconWeight) || 'regular');
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
    const footerEdit = document.getElementById('footer-edit-toggle');
    if (footerEdit) footerEdit.addEventListener('click', () => toggleEditMode());

    const cachedData = localStorage.getItem(KEYS.cache);
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            processConfigData(parsed, false);
            updateStatus("Local Data");
        } catch (e) {
            processConfigData(fallbackData, true);
            updateStatus("Default Data");
        }
    } else {
        processConfigData(fallbackData, true);
        updateStatus("Default Data");
    }
    // Sync removed; initialization completes here
}

// ==========================================
// Tooltip For Truncated Names
// ==========================================
let tooltipEl = null;
let tooltipTarget = null;
let tooltipRaf = 0, tooltipNextX = 0, tooltipNextY = 0;
// Track whether to return to Settings after closing Import modal
let shouldReturnToSettings = false;
let importClosingByApply = false;

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
        tooltipNextX = e.clientX; tooltipNextY = e.clientY;
        if (!tooltipRaf) {
            tooltipRaf = requestAnimationFrame(() => {
                positionTooltipAt(tooltipNextX, tooltipNextY);
                tooltipRaf = 0;
            });
        }
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

    // Ensure every category and item has a stable id (for future overlay diff)
    ensureStableIds(categories);

    globalData = { categories, search: engines };
    initSearchEngines(engines);
    renderGrid();
}

// ---------------- ID utilities (Step 1 of new sync)
function generateId(prefix = 'id') {
    // Prefer crypto if available
    try {
        const buf = new Uint8Array(8);
        crypto.getRandomValues(buf);
        const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${prefix}_${hex}`;
    } catch {
        return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
    }
}

function ensureStableIds(categories) {
    (categories || []).forEach((cat) => {
        if (!cat.id) cat.id = generateId('cat');
        if (Array.isArray(cat.items)) {
            cat.items.forEach((it) => { if (!it.id) it.id = generateId('item'); });
        }
    });
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
        const editBar = document.getElementById('edit-bar');
        if (editBar) editBar.classList.add('hidden');
    } else {
        document.body.classList.remove('edit-mode');
        const editBar = document.getElementById('edit-bar');
        if (editBar) editBar.classList.add('hidden');
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
    wrapper.className = 'relative group';
    if (isEditMode && item.hidden) wrapper.classList.add('is-hidden-element');

    // Edit controls (show only delete button, glass style) and click-to-edit
    if (isEditMode) {
        const controls = document.createElement('div');
        // Slightly tighter position and smaller hit area
        controls.className = 'absolute -top-1 -right-1 z-20';
        controls.innerHTML = `
            <button class="delete-chip text-white/80 hover:text-white" data-action="delete-item" data-parent="${parentIndex}" data-index="${index}">
                <i class="ph ph-trash"></i>
            </button>
        `;
        controls.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const btn = ev.target.closest('button[data-action]');
            if (!btn) return;
            const p = parseInt(btn.getAttribute('data-parent'));
            const i = parseInt(btn.getAttribute('data-index'));
            deleteItem(p, i);
        });
        wrapper.appendChild(controls);
        // Click anywhere on the bookmark to edit
        wrapper.addEventListener('click', () => openModal('item', null, parentIndex, index));
    }

    const sanitizeIcon = (ic) => (/^ph-[a-z0-9-]+$/i.test(ic || '') ? ic : 'ph-link');

    if (item.url_private) {
        if (isEditMode) {
            const container = document.createElement('div');
            container.className = 'nav-item w-full block flex items-center gap-3 p-2 rounded-xl text-white/90 text-sm font-medium hover:text-white bg-white/5 hover:bg-white/20 cursor-pointer';
            const icon = document.createElement('i');
            icon.className = `ph ${sanitizeIcon(item.icon)} text-lg opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all`;
            const span = document.createElement('span');
            span.className = 'truncate';
            span.textContent = item.name || '';
            container.appendChild(icon);
            container.appendChild(span);
            wrapper.appendChild(container);
        } else {
            const container = document.createElement('div');
            container.className = 'nav-item w-full block flex items-center gap-3 p-0 rounded-xl text-white/90 text-sm font-medium hover:text-white bg-white/5 hover:bg-white/20 overflow-hidden';
            const toggle = document.createElement('button');
            toggle.className = 'toggle-btn shrink-0 p-3 hover:bg-white/10 transition-colors';
            toggle.title = 'Switch: Public / Private';
            const icon = document.createElement('i');
            icon.className = `ph ${sanitizeIcon(item.icon)} text-lg opacity-70 main-icon transition-colors`;
            toggle.appendChild(icon);
            const link = document.createElement('a');
            link.className = 'flex-1 p-2 pl-0 min-w-0 block h-full flex items-center';
            link.target = '_blank'; link.href = item.url;
            link.setAttribute('data-tooltip', item.name || '');
            const span = document.createElement('span');
            span.className = 'truncate w-full block main-text transition-colors';
            span.textContent = item.name || '';
            link.appendChild(span);
            container.appendChild(toggle);
            container.appendChild(link);
            wrapper.appendChild(container);
            bindPrivateToggle(wrapper, item);
        }
    } else {
        const link = document.createElement('a');
        link.className = 'nav-item flex items-center gap-3 p-2 rounded-xl text-white/90 text-sm font-medium hover:text-white w-full block bg-white/5 hover:bg-white/20' + (isEditMode ? ' cursor-pointer opacity-80' : '');
        if (!isEditMode) { link.target = '_blank'; link.href = item.url; } else { link.href = 'javascript:void(0)'; }
        link.setAttribute('data-tooltip', item.name || '');
        const icon = document.createElement('i');
        icon.className = `ph ${sanitizeIcon(item.icon)} text-lg opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all`;
        const span = document.createElement('span');
        span.className = 'truncate';
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
        e.preventDefault(); e.stopPropagation();
        isPrivate = !isPrivate;
        // Animate icon spin
        icon.classList.remove('spin-once');
        // force reflow to restart animation
        void icon.offsetWidth;
        icon.classList.add('spin-once');

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
    setTimeout(() => {
        importModal.classList.add('hidden');
        // If import was opened from Settings, always return to Settings (whether canceled or applied)
        if (shouldReturnToSettings) {
            openSettingsModal();
        }
        // Reset flags
        shouldReturnToSettings = false;
        importClosingByApply = false;
    }, 300);
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
        // Mark as applied to avoid returning to Settings automatically
        importClosingByApply = true;
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

        const oldId = selfIdx !== null ? (globalData.categories[selfIdx].id) : null;

        const newCat = {
            category: name,
            color: color,
            hidden: oldHidden,
            colSpan: oldColSpan,
            rowSpan: oldRowSpan,
            items: selfIdx !== null ? globalData.categories[selfIdx].items : [],
            id: oldId || generateId('cat')
        };

        if (selfIdx !== null) globalData.categories[selfIdx] = { ...globalData.categories[selfIdx], ...newCat };
        else globalData.categories.push(newCat);
    } else {
        const url = document.getElementById('inp-url').value;
        const urlPrivate = document.getElementById('inp-private').value;
        const icon = document.getElementById('inp-icon').value;
        const hidden = document.getElementById('inp-hidden').checked;

        const prev = (selfIdx !== null && globalData.categories[parentIdx] && globalData.categories[parentIdx].items)
            ? globalData.categories[parentIdx].items[selfIdx]
            : null;
        const newItem = { name, url, icon, hidden, id: (prev && prev.id) || generateId('item') };
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

async function deleteItem(parentIdx, itemIdx) {
    const ok = await showConfirm('Delete Bookmark', 'Are you sure you want to delete this bookmark?', 'Delete', true);
    if (!ok) return;
    globalData.categories[parentIdx].items.splice(itemIdx, 1);
    saveToLocal(globalData);
    renderGrid();
}
async function deleteCategory(idx) {
    const ok = await showConfirm('Delete Category', 'This will delete the entire category and all bookmarks in it. Continue?', 'Delete', true);
    if (!ok) return;
    globalData.categories.splice(idx, 1);
    saveToLocal(globalData);
    renderGrid();
}

function exportYaml() {
    try {
        const yamlStr = buildExportYaml();
        navigator.clipboard.writeText(yamlStr).then(() => showToast("YAML config copied!", "success"));
    } catch (e) { console.error(e); showToast("Export failed", "error"); }
}

function buildExportYaml() {
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
    catObj.items = (c.items || []).map((item, j) => {
        const cleanItem = { name: item.name, url: item.url, icon: item.icon, order: j + 1 };
        if (item.url_private) cleanItem.url_private = item.url_private;
        if (item.hidden) cleanItem.hidden = true;
        return cleanItem;
    });
            return catObj;
        })
    };
    return jsyaml.dump(exportObj);
}

function getGistConfig() {
    return {
        id: localStorage.getItem(KEYS.gist.id) || '',
        file: localStorage.getItem(KEYS.gist.file) || '',
        token: localStorage.getItem(KEYS.gist.token) || ''
    };
}

async function gistPull() {
    const { id, file, token } = getGistConfig();
    if (!id || !file) { showToast('Gist not configured. Use >gist set <id> <filename>', 'error'); return; }
    // Confirm before overwriting local data
    const ok = await showConfirm(
        'Pull From Gist',
        `This will overwrite your local configuration with \n${id}/${file}. Continue?`,
        'Pull'
    );
    if (!ok) { showToast('Canceled', 'info'); return; }
    try {
        const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, {
            headers: {
                'Accept': 'application/vnd.github+json',
                ...(token ? { 'Authorization': `token ${token}` } : {})
            }
        });
        if (!res.ok) {
            let msg = 'Gist fetch failed';
            try { const j = await res.json(); if (j && j.message) msg += `: ${j.message}`; } catch {}
            throw new Error(`${msg} (HTTP ${res.status})`);
        }
        const data = await res.json();
        const f = data.files && data.files[file];
        if (!f) throw new Error('File not found in gist');
        let text = '';
        if (f.truncated && f.raw_url) {
            const raw = await fetch(f.raw_url);
            if (!raw.ok) throw new Error(`Raw fetch failed (HTTP ${raw.status})`);
            text = await raw.text();
        } else {
            text = f.content || '';
        }
        const parsed = jsyaml.load(text);
        processConfigData(parsed, true);
        saveToLocal(globalData);
        localStorage.setItem(KEYS.gist.lastPull, String(Date.now()));
        updateStatus('Gist Pulled', true);
        showToast('Pulled from Gist', 'success');
    } catch (e) {
        console.error(e);
        showToast('Gist pull failed: ' + (e.message || e), 'error');
    }
}

async function gistPush(message = 'Update from extension') {
    const { id, file, token } = getGistConfig();
    if (!id || !file) { showToast('Gist not configured. Use >gist set <id> <filename>', 'error'); return; }
    if (!token) { showToast('Set token first: >gist token <PAT>', 'error'); return; }
    // Confirm before overwriting remote data
    const ok = await showConfirm(
        'Push To Gist',
        `This will overwrite the remote Gist file \n${id}/${file} with your current local configuration. Continue?`,
        'Push',
        true
    );
    if (!ok) { showToast('Canceled', 'info'); return; }
    try {
        const content = buildExportYaml();
        const body = { files: { [file]: { content } }, description: undefined }; // keep description unchanged
        const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'Authorization': `token ${token}`
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            let msg = 'Gist push failed';
            try { const j = await res.json(); if (j && j.message) msg += `: ${j.message}`; } catch {}
            throw new Error(`${msg} (HTTP ${res.status})`);
        }
        localStorage.setItem(KEYS.gist.lastPush, String(Date.now()));
        updateStatus('Gist Pushed', true);
        showToast('Pushed to Gist', 'success');
    } catch (e) {
        console.error(e);
        showToast('Gist push failed: ' + (e.message || e), 'error');
    }
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
                    
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>reset</code> &nbsp; Reset navigation data (keep Gist settings)</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>help</code> &nbsp; Show this message</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>weight [thin|light|regular|bold|fill|duotone]</code> &nbsp; Icon weight</p>
                    <div class="pt-4 border-t border-white/10"></div>
                    <p class="opacity-80">Gist Sync (simple):</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>gist set &lt;id&gt; &lt;filename&gt;</code> &nbsp; Set target gist id and filename</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>gist token &lt;PAT&gt;</code> &nbsp; Set GitHub token (gist scope)</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>gist pull</code> &nbsp; Pull from Gist (overwrite local)</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>gist push</code> &nbsp; Push current config to Gist (overwrite remote)</p>
                    <p><code class="bg-white/20 px-2 py-1 rounded font-mono">>gist status</code> &nbsp; Show target/token/last pull/push</p>
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
// Confirm Modal (Promise-based)
// ==========================================
function showConfirm(title, message, confirmLabel = 'Confirm', danger = false) {
    return new Promise((resolve) => {
        // Remove any existing confirm modal
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
        const cleanup = (val) => { el.classList.add('opacity-0'); box.classList.add('scale-95'); setTimeout(() => { el.remove(); resolve(val); }, 180); };
        requestAnimationFrame(() => { el.classList.remove('opacity-0'); box.classList.remove('scale-95'); box.classList.add('scale-100'); });
        el.addEventListener('click', (e) => { if (e.target === el) cleanup(false); });
        document.getElementById('confirm-cancel').addEventListener('click', () => cleanup(false));
        document.getElementById('confirm-ok').addEventListener('click', () => cleanup(true));
        const onKey = (e) => { if (e.key === 'Escape') cleanup(false); if (e.key === 'Enter') cleanup(true); };
        document.addEventListener('keydown', onKey, { once: true });
    });
}

// ==========================================
// Gist Settings UI
// ==========================================
function bindGistSettingsUI() {
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

    const setStatus = (msg, ok = true) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = ok ? '' : '#fca5a5'; } };
    const setTimes = () => {
        if (!timesEl) return;
        const lp = localStorage.getItem(KEYS.gist.lastPull);
        const lps = localStorage.getItem(KEYS.gist.lastPush);
        timesEl.textContent = `Last Pull: ${lp? new Date(parseInt(lp)).toLocaleString(): '-'} | Last Push: ${lps? new Date(parseInt(lps)).toLocaleString(): '-'}`;
    };

    const openModal = () => {
        const { id, file, token } = getGistConfig();
        idInp.value = id || '';
        fileInp.value = file || '';
        tokenInp.value = token || '';
        if (weightSel) weightSel.value = (localStorage.getItem(KEYS.iconWeight) || 'regular');
        setTimes();
        setStatus('');
        modal.classList.remove('hidden');
        requestAnimationFrame(() => { modal.classList.remove('opacity-0'); modal.firstElementChild.classList.remove('scale-95'); modal.firstElementChild.classList.add('scale-100'); });
    };
    const closeModal = () => {
        modal.classList.add('opacity-0');
        modal.firstElementChild.classList.add('scale-95');
        modal.firstElementChild.classList.remove('scale-100');
        setTimeout(() => modal.classList.add('hidden'), 200);
    };

    open.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    saveBtn.addEventListener('click', () => {
        const id = idInp.value.trim();
        const file = fileInp.value.trim();
        const token = tokenInp.value.trim();
        if (!id || !file) { setStatus('Please input gist id and filename', false); return; }
        localStorage.setItem(KEYS.gist.id, id);
        localStorage.setItem(KEYS.gist.file, file);
        if (token) localStorage.setItem(KEYS.gist.token, token);
        showToast('Gist settings saved', 'success');
        closeModal();
    });

    testBtn.addEventListener('click', async () => {
        const { id, file, token } = getGistConfig();
        if (!id || !file) return setStatus('Configure Gist ID and Filename first', false);
        try {
            const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, { headers: { 'Accept':'application/vnd.github+json', ...(token? { 'Authorization': `token ${token}` }: {}) } });
            if (!res.ok) { let msg=''; try{ const j=await res.json(); msg=j&&j.message? j.message: ''; }catch{}; return setStatus(`Connection failed: ${res.status} ${msg}`, false); }
            const data = await res.json();
            const f = data.files && data.files[file];
            if (!f) return setStatus('Gist reachable, but file not found', false);
            setStatus('OK');
        } catch(e) { setStatus('Connection error: '+(e.message||e), false); }
    });

    pullBtn.addEventListener('click', async () => {
        await gistPull();
        setTimes();
    });
    pushBtn.addEventListener('click', async () => {
        await gistPush();
        setTimes();
    });

    copyIdBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(idInp.value); setStatus('Copied Gist ID'); } catch { setStatus('Copy failed', false); }
    });
    copyFileBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(fileInp.value); setStatus('Copied Filename'); } catch { setStatus('Copy failed', false); }
    });
    if (importBtn) importBtn.addEventListener('click', () => { shouldReturnToSettings = true; importClosingByApply = false; closeModal(); openImportModal(); });
    if (copyConfigBtn) copyConfigBtn.addEventListener('click', async () => { try { exportYaml(); setStatus('Config copied'); } catch { setStatus('Copy failed', false); } });
    toggleTokenBtn.addEventListener('click', (e) => {
        const showing = tokenInp.type === 'text';
        tokenInp.type = showing ? 'password' : 'text';
        e.target.textContent = showing ? 'Show' : 'Hide';
    });
    clearTokenBtn.addEventListener('click', () => { localStorage.removeItem(KEYS.gist.token); tokenInp.value=''; setStatus('Token cleared'); });
    if (weightSel) weightSel.addEventListener('change', () => { setIconWeight(weightSel.value); setStatus('Icon weight: '+weightSel.value); });
    if (resetAllBtn) resetAllBtn.addEventListener('click', async () => {
        const ok = await showConfirm('Reset Navigation Data', 'This will clear your local navigation layout and items (but keep Gist settings, token, wallpaper, and preferences). Continue?', 'Reset', true);
        if (ok) {
            try { localStorage.removeItem(KEYS.cache); } catch {}
            showToast('Navigation data cleared. Reloading...', 'info');
            setTimeout(() => location.reload(), 300);
        }
    });
}

// Open Settings modal programmatically (used after canceling Import)
function openSettingsModal() {
    const modal = document.getElementById('gist-modal');
    if (!modal) return;
    const idInp = document.getElementById('gist-id-input');
    const fileInp = document.getElementById('gist-file-input');
    const tokenInp = document.getElementById('gist-token-input');
    const weightSel = document.getElementById('weight-select');
    const statusEl = document.getElementById('gist-status');
    const timesEl = document.getElementById('gist-times');
    const { id, file, token } = getGistConfig();
    if (idInp) idInp.value = id || '';
    if (fileInp) fileInp.value = file || '';
    if (tokenInp) tokenInp.value = token || '';
    if (weightSel) weightSel.value = (localStorage.getItem(KEYS.iconWeight) || 'regular');
    if (statusEl) statusEl.textContent = '';
    if (timesEl) {
        const lp = localStorage.getItem(KEYS.gist.lastPull);
        const lps = localStorage.getItem(KEYS.gist.lastPush);
        timesEl.textContent = `Last Pull: ${lp? new Date(parseInt(lp)).toLocaleString(): '-'} | Last Push: ${lps? new Date(parseInt(lps)).toLocaleString(): '-'}`;
    }
    modal.classList.remove('hidden');
    requestAnimationFrame(() => { modal.classList.remove('opacity-0'); modal.firstElementChild.classList.remove('scale-95'); modal.firstElementChild.classList.add('scale-100'); });
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
    localStorage.setItem(KEYS.iconWeight, weight);
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

// Legacy URL sync removed

function saveToLocal(data) { localStorage.setItem(KEYS.cache, JSON.stringify(data)); }

// (Sync removed) — local save only

function safeSig(obj) {
    try { return JSON.stringify(obj).length + ':' + Object.keys(obj||{}).length; } catch { return ''; }
}
function applyStoredWallpaper() {
    const stored = localStorage.getItem(KEYS.wallpaper);
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
        try { localStorage.setItem(KEYS.wallpaper, nextUrl); } catch {}
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
    const stored = localStorage.getItem(KEYS.wallpaper);
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
function updateStatus(text, withTime = false) {
    const el = document.getElementById('data-source');
    if (!el) return;
    if (withTime) {
        const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.textContent = `${text} (${t})`;
    } else {
        el.textContent = text;
    }
}
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
        btn.className = `p-2 hover:bg-white/20 rounded-lg transition-colors text-white/80 flex items-center justify-center ${index === 0 ? 'engine-active' : ''}`;
        btn.onclick = () => switchEngine(index);
        // Make right-side engine icons larger while keeping the input height unchanged
        btn.innerHTML = engine.icon?.startsWith('ph-')
            ? `<i class="ph ${engine.icon} text-xl leading-none"></i>`
            : `<span class="font-bold text-lg leading-none">${engine.icon || 'S'}</span>`;
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
    if (e.key !== 'Enter') return;
    const val = e.target.value.trim();
    if (!val) return;

    const run = (fn) => { try { fn(); } finally { e.target.value = ''; } };
    const cmds = [
        { test: v => v === '>edit', run: () => toggleEditMode(true) },
        { test: v => v === '>reset', run: () => {
            (async () => {
                const ok = await showConfirm('Reset Navigation Data', 'This will clear your local navigation layout and items only (keeps Gist settings, token, wallpaper and preferences). Continue?', 'Reset', true);
                if (ok) { try { localStorage.removeItem(KEYS.cache); } catch {} location.reload(); }
            })();
        } },
        { test: v => v === '>help', run: () => showHelp() },
        { test: v => v.startsWith('>gist token '), run: () => {
            const token = val.substring('>gist token '.length).trim();
            if (!token) return showToast('Usage: >gist token <token>', 'error');
            localStorage.setItem(KEYS.gist.token, token);
            showToast('Gist token set', 'success');
        } },
        { test: v => v.startsWith('>gist set '), run: () => {
            const rest = val.substring('>gist set '.length).trim();
            const parts = rest.split(/\s+/);
            if (parts.length < 2) return showToast('Usage: >gist set <id> <filename>', 'error');
            localStorage.setItem(KEYS.gist.id, parts[0]);
            localStorage.setItem(KEYS.gist.file, parts.slice(1).join(' '));
            showToast('Gist target set', 'success');
        } },
        { test: v => v === '>gist pull', run: () => gistPull() },
        { test: v => v === '>gist push', run: () => gistPush() },
        { test: v => v === '>gist status', run: () => {
            const { id, file, token } = getGistConfig();
            const lastPull = localStorage.getItem(KEYS.gist.lastPull);
            const lastPush = localStorage.getItem(KEYS.gist.lastPush);
            showToast(`Gist: ${id||'-'}/${file||'-'} | token: ${token? 'set': 'none'} | pull: ${lastPull? new Date(parseInt(lastPull)).toLocaleString(): '-' } | push: ${lastPush? new Date(parseInt(lastPush)).toLocaleString(): '-'}`, 'info', { duration: 5000 });
        } },
        { test: v => v === '>weight', run: () => {
            const current = localStorage.getItem(KEYS.iconWeight) || 'regular';
            showToast('Current weight: ' + current + ' (thin|light|regular|bold|fill|duotone)', 'info');
        } },
        { test: v => v.startsWith('>weight '), run: () => {
            const w = val.split(/\s+/)[1];
            setIconWeight(w);
        } },
    ];

    for (const c of cmds) {
        if (c.test(val)) { return run(c.run); }
    }

    window.open(searchEngines[currentEngineIndex].url + encodeURIComponent(val), '_blank');
    e.target.value = '';
});
const fallbackData = { search: defaultEngines, categories: [{ category: "Sample", color: "from-blue-600/20 to-indigo-600/20", items: [{ name: "Google", url: "https://google.com", icon: "ph-google-logo" }] }] };

window.addEventListener('resize', updateFolderScrollAreaHeight);
document.addEventListener('DOMContentLoaded', init);
