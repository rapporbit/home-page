(() => {
  // 按你的要求：低清用 1080p（1920x1080），高清用 UHD
  const RES_LO = '1920x1080';
  const RES_HI = 'UHD';
  const FADE_MS = 180;

  function makeBingResUrl(url, res) {
    if (!url) return '';
    // https://www.bing.com/th?id=..._UHD.jpg  ->  ..._1920x1080.jpg
    return url.replace(/_(UHD|\d+x\d+)\.jpg(\?.*)?$/i, `_${res}.jpg$2`);
  }

  function ensureLink(rel, href, extraAttrs = {}) {
    if (!href) return;
    let absHref = href;
    try {
      absHref = new URL(href, location.href).href;
    } catch {
      /* ignore */
    }
    const existing = document.head?.querySelectorAll(`link[rel="${rel}"]`) || [];
    for (const node of existing) {
      if (node?.href === absHref) return;
    }
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    for (const [k, v] of Object.entries(extraAttrs)) {
      if (v == null) continue;
      link.setAttribute(k, String(v));
    }
    document.head?.appendChild(link);
  }

  function preloadImage(url, priority = 'auto') {
    if (!url) return Promise.reject(new Error('empty-url'));
    try {
      const origin = new URL(url, location.href).origin;
      ensureLink('preconnect', origin, { crossorigin: 'anonymous' });
      ensureLink('dns-prefetch', origin);
      ensureLink('preload', url, { as: 'image', fetchpriority: priority });
    } catch {
      /* ignore */
    }
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.fetchPriority = priority;
        img.onload = () => resolve(url);
        img.onerror = reject;
        img.src = url;
      } catch (e) {
        reject(e);
      }
    });
  }

  function setRootVar(name, value) {
    try {
      document.documentElement.style.setProperty(name, value);
    } catch {
      /* ignore */
    }
  }

  function fadeToHiWallpaper(hiUrl) {
    if (!hiUrl) return;
    // 通过淡入层把高清铺上去，再把主背景切换到高清，然后清掉淡入层
    setRootVar('--wallpaper-fade-url', `url("${hiUrl}")`);
    setRootVar('--wallpaper-fade-opacity', '0');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRootVar('--wallpaper-fade-opacity', '1');
      });
    });

    window.setTimeout(() => {
      setRootVar('--wallpaper-url', `url("${hiUrl}")`);
      setRootVar('--wallpaper-fade-opacity', '0');
      window.setTimeout(() => setRootVar('--wallpaper-fade-url', 'none'), FADE_MS + 20);
    }, FADE_MS + 20);
  }

  try {
    const wallpaper = localStorage.getItem('nav_wallpaper_url');
    if (wallpaper) {
      let hiUrl = '';
      let loUrl = '';
      if (wallpaper.startsWith('{')) {
        try {
          const parsed = JSON.parse(wallpaper) || {};
          hiUrl = parsed.url || '';
          loUrl = parsed.previewUrl || parsed.loUrl || '';
        } catch {
          hiUrl = '';
          loUrl = '';
        }
      } else {
        hiUrl = wallpaper;
      }

      hiUrl = makeBingResUrl(hiUrl, RES_HI);
      if (!loUrl) loUrl = makeBingResUrl(hiUrl, RES_LO);

      if (loUrl) {
        document.documentElement.style.setProperty('--wallpaper-url', `url("${loUrl}")`);
        preloadImage(loUrl, 'high').catch(() => {});
      }
      if (hiUrl && hiUrl !== loUrl) {
        preloadImage(hiUrl, 'auto')
          .then(() => {
            fadeToHiWallpaper(hiUrl);
          })
          .catch(() => {});
      }

      // 升级存储格式：统一保存 { url, previewUrl }，后续打开直接走低清→高清
      if (hiUrl) {
        try {
          localStorage.setItem(
            'nav_wallpaper_url',
            JSON.stringify({ url: hiUrl, previewUrl: loUrl || '', updatedAt: Date.now() })
          );
        } catch {
          /* ignore */
        }
      }
    }
    const weight = localStorage.getItem('nav_icon_weight');
    if (weight) document.documentElement.classList.add('phw-' + weight);
  } catch {
    /* ignore */
  }
})();
