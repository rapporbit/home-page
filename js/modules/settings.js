import { KEYS } from './storage.js';
import { applyIconWeight } from './icons.js';

const DEFAULTS = {
  gistId: '',
  gistFile: '',
  gistToken: '',
  iconWeight: 'regular',
};

const loadSettings = () => ({
  gistId: localStorage.getItem(KEYS.gist.id) || DEFAULTS.gistId,
  gistFile: localStorage.getItem(KEYS.gist.file) || DEFAULTS.gistFile,
  gistToken: localStorage.getItem(KEYS.gist.token) || DEFAULTS.gistToken,
  iconWeight: localStorage.getItem(KEYS.iconWeight) || DEFAULTS.iconWeight,
});

let currentSettings = loadSettings();
applyIconWeight(currentSettings.iconWeight);

export const getSettings = () => ({ ...currentSettings });

export const saveSettings = (partial = {}) => {
  currentSettings = { ...currentSettings, ...partial };
  const { gistId, gistFile, gistToken, iconWeight } = currentSettings;
  localStorage.setItem(KEYS.gist.id, gistId || '');
  localStorage.setItem(KEYS.gist.file, gistFile || '');
  if (gistToken) localStorage.setItem(KEYS.gist.token, gistToken);
  else localStorage.removeItem(KEYS.gist.token);
  localStorage.setItem(KEYS.iconWeight, iconWeight || DEFAULTS.iconWeight);
  applyIconWeight(iconWeight || DEFAULTS.iconWeight);
  return getSettings();
};
