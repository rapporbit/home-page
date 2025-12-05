import { startClock, updateStatus } from './modules/status.js';
import { applyStoredWallpaper, setBingBackground } from './modules/wallpaper.js';
import { initTooltipDelegation } from './modules/tooltip.js';
import { processConfigData, fallbackData } from './modules/config.js';
import { KEYS } from './modules/storage.js';
import { injectIconWeightStyles, applyIconWeight } from './modules/icons.js';
import { toggleEditMode, refreshEditBindings, closeEditor, saveEditor } from './modules/edit.js';
import { openImportModal, closeImportModal, importYaml } from './modules/importExport.js';
import { updateFolderScrollAreaHeight } from './modules/layout.js';
import { bindGistSettingsUI } from './modules/gist.js';

document.addEventListener('DOMContentLoaded', () => {
  // 基础 UI & 行为
  initTooltipDelegation();
  startClock();

  injectIconWeightStyles();
  applyIconWeight(localStorage.getItem(KEYS.iconWeight) || 'regular');

  applyStoredWallpaper();
  document.getElementById('wallpaper-button')?.addEventListener('click', () => setBingBackground(true));

  // Footer edit toggle
  document.getElementById('footer-edit-toggle')?.addEventListener('click', () => toggleEditMode());

  // 编辑栏按钮
  document.getElementById('btn-done-edit')?.addEventListener('click', () => toggleEditMode(false));

  // Import Modal
  document.getElementById('gist-open-import-btn')?.addEventListener('click', () => openImportModal());
  document.getElementById('btn-close-import')?.addEventListener('click', () => closeImportModal());
  document.getElementById('btn-import-apply')?.addEventListener('click', () => importYaml());

  // Editor Modal
  document.getElementById('btn-close-editor')?.addEventListener('click', () => closeEditor());
  document.getElementById('btn-save-editor')?.addEventListener('click', () => saveEditor());

  // 点击页面空白退出编辑态（保留原有避让规则）
  document.addEventListener(
    'click',
    (e) => {
      if (!document.body.classList.contains('edit-mode')) return;
      const inModal = e.target.closest('#gist-modal, #import-modal, #editor-modal, #help-modal, #confirm-modal');
      if (inModal) return;
      const onFooterEdit = e.target.closest('#footer-edit-toggle');
      if (onFooterEdit) return;
      const inGrid = e.target.closest('#grid-container');
      if (!inGrid) toggleEditMode(false);
    },
    false
  );

  // 数据加载
  const cached = localStorage.getItem(KEYS.cache);
  if (cached) {
    try {
      processConfigData(JSON.parse(cached), false);
      updateStatus('Local Data');
    } catch {
      processConfigData(fallbackData, true);
      updateStatus('Default Data');
    }
  } else {
    processConfigData(fallbackData, true);
    updateStatus('Default Data');
  }

  // 布局高度
  updateFolderScrollAreaHeight();
  let rAF = 0;
  window.addEventListener(
    'resize',
    () => {
      if (!rAF) {
        rAF = requestAnimationFrame(() => {
          rAF = 0;
          updateFolderScrollAreaHeight();
        });
      }
    },
    { passive: true }
  );

  // Gist 设置（Test / Pull / Push / Copy 等）
  bindGistSettingsUI();

  // 初次渲染后的拖拽绑定（编辑状态时生效）
  refreshEditBindings();
});
