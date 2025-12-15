import { qs, setVar } from './dom.js';
import { KEYS } from './storage.js';

export const BITURL_API = 'https://bing.biturl.top/';
// 按你的要求：低清用 1080p（1920x1080），高清用 UHD
const RES_LO = '1920x1080';
const RES_HI = 'UHD';
const MKT = 'zh-CN';
const FADE_MS = 180;
let isLoading = false;

function makeBingResUrl(url, res) {
  if (!url) return '';
  return url.replace(/_(UHD|\d+x\d+)\.jpg(\?.*)?$/i, `_${res}.jpg$2`);
}

function fadeToHiWallpaper(hiUrl) {
  if (!hiUrl) return;
  setVar(document.documentElement, '--wallpaper-fade-url', `url("${hiUrl}")`);
  setVar(document.documentElement, '--wallpaper-fade-opacity', '0');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setVar(document.documentElement, '--wallpaper-fade-opacity', '1');
    });
  });

  window.setTimeout(() => {
    setVar(document.documentElement, '--wallpaper-url', `url("${hiUrl}")`);
    setVar(document.documentElement, '--wallpaper-fade-opacity', '0');
    window.setTimeout(() => setVar(document.documentElement, '--wallpaper-fade-url', 'none'), FADE_MS + 20);
  }, FADE_MS + 20);
}

export const applyStoredWallpaper = () => {
  const stored = localStorage.getItem(KEYS.wallpaper);
  if (!stored) return;
  let hiUrl = '';
  let loUrl = '';
  if (stored.startsWith('{')) {
    try {
      const parsed = JSON.parse(stored) || {};
      hiUrl = parsed.url || '';
      loUrl = parsed.previewUrl || parsed.loUrl || '';
    } catch {
      hiUrl = '';
      loUrl = '';
    }
  } else {
    hiUrl = stored;
  }

  hiUrl = makeBingResUrl(hiUrl, RES_HI);
  if (!loUrl) loUrl = makeBingResUrl(hiUrl, RES_LO);

  // 先上低清预览，再异步切换到高清
  if (loUrl) setVar(document.documentElement, '--wallpaper-url', `url("${loUrl}")`);
  if (hiUrl && hiUrl !== loUrl) {
    preload(hiUrl, 'auto')
      .then(() => fadeToHiWallpaper(hiUrl))
      .catch(() => {});
  }
};
export const setBingBackground = async () => {
  if (isLoading) return;
  isLoading = true;
  toggleButtonLoading(true);
  try {
    const prev = getStoredWallpaperUrl();
    const next = await fetchRandom(prev);
    if (!next) return;
    const hiUrl = makeBingResUrl(next, RES_HI);
    const loUrl = makeBingResUrl(next, RES_LO);

    if (loUrl) setVar(document.documentElement, '--wallpaper-url', `url("${loUrl}")`);
    await preload(hiUrl, 'auto');
    fadeToHiWallpaper(hiUrl);
    localStorage.setItem(KEYS.wallpaper, JSON.stringify({ url: hiUrl, previewUrl: loUrl, updatedAt: Date.now() }));
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
      return makeBingResUrl(JSON.parse(v)?.url || '', RES_HI);
    } catch {
      return '';
    }
  }
  return makeBingResUrl(v, RES_HI);
}
const preload = (url, priority = 'auto') =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    try {
      img.decoding = 'async';
      img.fetchPriority = priority;
      img.referrerPolicy = 'no-referrer';
    } catch {
      /* ignore */
    }
    img.src = url;
  });
async function fetchByIndex(index, reso = RES_HI, mkt = MKT) {
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
