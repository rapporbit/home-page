import { qs } from './dom.js';

export const updateStatus = (text, withTime = false) => {
  const el = qs('#data-source');
  if (!el) return;
  if (withTime) {
    const t = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    el.textContent = `${text} (${t})`;
  } else {
    el.textContent = text;
  }
};

export const updateTime = () => {
  const now = new Date();
  const clock = qs('#clock');
  const date = qs('#date');
  if (clock) {
    clock.textContent = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (date) {
    date.textContent = now.toLocaleDateString('zh-CN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
};
export const startClock = () => {
  updateTime();
  return setInterval(updateTime, 1000);
};

export const showToast = (msg, type = 'info', options = {}) => {
  const container = qs('#toast-container');
  if (!container) return { dismiss: () => {} };
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon =
    type === 'success'
      ? 'ph-check-circle'
      : type === 'error'
      ? 'ph-warning'
      : type === 'loading'
      ? 'ph-spinner animate-spin'
      : 'ph-info';
  toast.innerHTML = `<i class="ph ${icon} text-lg"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  const duration = typeof options.duration === 'number' ? options.duration : 3000;
  let timer = null;
  if (duration > 0) timer = setTimeout(() => fadeOutToast(toast), duration);
  return {
    dismiss: () => {
      if (!toast.isConnected) return;
      if (timer) clearTimeout(timer);
      fadeOutToast(toast);
    },
  };
};
const fadeOutToast = (toast) => {
  toast.style.opacity = '0';
  setTimeout(() => {
    if (toast && toast.parentElement) toast.remove();
  }, 300);
};
