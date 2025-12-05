import { qs, setVar } from './dom.js';
import { KEYS } from './storage.js';

export const BITURL_API = 'https://bing.biturl.top/';
const RES = 'UHD';
const MKT = 'zh-CN';
let isLoading = false;

export const applyStoredWallpaper = () => {
  const stored = localStorage.getItem(KEYS.wallpaper);
  if (!stored) return;
  let url = stored;
  if (stored.startsWith('{')) {
    try {
      url = JSON.parse(stored)?.url || '';
    } catch {
      url = '';
    }
  }
  if (url) setVar(document.documentElement, '--wallpaper-url', `url("${url}")`);
};
export const setBingBackground = async () => {
  if (isLoading) return;
  isLoading = true;
  toggleButtonLoading(true);
  try {
    const prev = getStoredWallpaperUrl();
    const next = await fetchRandom(prev);
    if (!next) return;
    await preload(next);
    setVar(document.documentElement, '--wallpaper-url', `url("${next}")`);
    localStorage.setItem(KEYS.wallpaper, next);
  } catch {
    /* ignore */
  } finally {
    isLoading = false;
    toggleButtonLoading(false);
  }
};
function toggleButtonLoading(loading) {
  const btn = qs('#wallpaper-button');
  if (!btn) return;
  btn.toggleAttribute('disabled', loading);
  const icon = btn.querySelector('i');
  if (icon) icon.classList.toggle('animate-spin', loading);
}
function getStoredWallpaperUrl() {
  const v = localStorage.getItem(KEYS.wallpaper);
  if (!v) return '';
  if (v.startsWith('{')) {
    try {
      return JSON.parse(v)?.url || '';
    } catch {
      return '';
    }
  }
  return v;
}
const preload = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
async function fetchByIndex(index, reso = RES, mkt = MKT) {
  const url = `${BITURL_API}?resolution=${encodeURIComponent(reso)}&format=json&index=${index}&mkt=${encodeURIComponent(
    mkt
  )}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('fetch-failed');
  const data = await res.json();
  return data?.url || '';
}
async function fetchRandom(prev = '') {
  const idxs = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5);
  for (let i = 0; i < idxs.length && i < 6; i++) {
    try {
      const url = await fetchByIndex(idxs[i]);
      if (url && url !== prev) return url;
    } catch {}
  }
  try {
    return await fetchByIndex(0);
  } catch {
    return '';
  }
}
