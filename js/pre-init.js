(() => {
  try {
    const wallpaper = localStorage.getItem('nav_wallpaper_url');
    if (wallpaper) {
      let url = wallpaper;
      if (wallpaper.startsWith('{')) {
        try {
          url = JSON.parse(wallpaper).url || '';
        } catch {
          url = '';
        }
      }
      if (url) document.documentElement.style.setProperty('--wallpaper-url', `url("${url}")`);
    }
    const weight = localStorage.getItem('nav_icon_weight');
    if (weight) document.documentElement.classList.add('phw-' + weight);
  } catch {
    /* ignore */
  }
})();
