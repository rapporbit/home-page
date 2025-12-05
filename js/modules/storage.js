export const KEYS = {
  cache: 'nav_config_cache',
  wallpaper: 'nav_wallpaper_url',
  iconWeight: 'nav_icon_weight',
  gist: {
    id: 'gist_id',
    file: 'gist_filename',
    token: 'gist_token',
    lastPull: 'gist_last_pull',
    lastPush: 'gist_last_push',
  },
};
export const getJson = (key, fallback = null) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
export const setJson = (key, val) => localStorage.setItem(key, JSON.stringify(val));
