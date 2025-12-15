import { qs } from './dom.js';
export const defaultEngines = [{ name: 'Google', url: 'https://www.google.com/search?q=', icon: 'ph-google-logo' }];
let engines = defaultEngines;
let engineIndex = 0;

export const initSearchEngines = (list = defaultEngines) => {
  engines = Array.isArray(list) && list.length ? list : defaultEngines;
  const container = qs('#engine-container');
  if (!container) return;
  container.innerHTML = '';
  engines.forEach((engine, index) => {
    const btn = document.createElement('button');
    btn.className = `p-2 hover:bg-white/20 rounded-lg transition-colors text-white/80 flex items-center justify-center ${
      index === 0 ? 'engine-active' : ''
    }`;
    btn.addEventListener('click', () => switchEngine(index));
    btn.innerHTML = engine.icon?.startsWith('ph-')
      ? `<i class="ph ${engine.icon} text-xl leading-none"></i>`
      : `<span class="font-bold text-lg leading-none">${engine.icon || 'S'}</span>`;
    container.appendChild(btn);
  });
  switchEngine(0);
  bindInput();
};
function bindInput() {
  const input = qs('#search-input');
  const icon = qs('#search-icon');
  if (icon && input) {
    icon.addEventListener('click', () => input.focus());
  }
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const val = e.target.value.trim();
    if (!val) return;
    const url = engines[engineIndex].url + encodeURIComponent(val);
    // Ctrl/⌘+Enter opens in a new tab; otherwise navigate in current tab.
    if (e.ctrlKey || e.metaKey) {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (w) w.opener = null;
    } else {
      window.location.assign(url);
    }
    e.target.value = '';
  });
}
export function switchEngine(index) {
  engineIndex = index;
  const input = qs('#search-input');
  if (input) input.placeholder = `Search with ${engines[index].name}...`;
  const container = qs('#engine-container');
  if (container) Array.from(container.children).forEach((btn, i) => btn.classList.toggle('engine-active', i === index));
  input?.focus();
}
