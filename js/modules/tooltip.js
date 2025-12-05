let tooltipEl = null;
let tooltipTarget = null;
let tooltipRaf = 0,
  tooltipNextX = 0,
  tooltipNextY = 0;

const ensureTooltip = () => {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'nav-tooltip';
    document.body.appendChild(tooltipEl);
  }
};
const positionTooltipAt = (x, y) => {
  if (!tooltipEl) return;
  const pad = 8,
    offsetX = 12,
    offsetY = 16;
  tooltipEl.style.left = '-9999px';
  tooltipEl.style.top = '-9999px';
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;
  let left = x + offsetX;
  let top = y + offsetY;
  if (top + th + pad > wh) top = y - th - offsetY;
  left = Math.max(pad, Math.min(left, ww - tw - pad));
  top = Math.max(pad, Math.min(top, wh - th - pad));
  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
};
const showTooltip = (text, anchor, evt) => {
  ensureTooltip();
  tooltipEl.textContent = text;
  tooltipEl.classList.add('show');
  if (evt && typeof evt.clientX === 'number') positionTooltipAt(evt.clientX, evt.clientY);
  else {
    const rect = anchor.getBoundingClientRect();
    positionTooltipAt(rect.left + rect.width / 2, rect.top);
  }
};
const hideTooltip = () => {
  if (!tooltipEl) return;
  tooltipEl.classList.remove('show');
};
const isTextTruncated = (anchor) => {
  const span = anchor.querySelector('.main-text') || anchor.querySelector('.truncate');
  if (!span) return false;
  return span.scrollWidth > span.clientWidth + 1;
};
export const initTooltipDelegation = () => {
  document.addEventListener(
    'mouseover',
    (e) => {
      const a = e.target.closest('a[data-tooltip]');
      if (!a) return;
      tooltipTarget = a;
      const text = a.getAttribute('data-tooltip') || '';
      if (!text || !isTextTruncated(a)) return;
      showTooltip(text, a, e);
    },
    { capture: false, passive: true }
  );
  document.addEventListener(
    'mousemove',
    (e) => {
      if (!tooltipEl || !tooltipEl.classList.contains('show')) return;
      tooltipNextX = e.clientX;
      tooltipNextY = e.clientY;
      if (!tooltipRaf) {
        tooltipRaf = requestAnimationFrame(() => {
          positionTooltipAt(tooltipNextX, tooltipNextY);
          tooltipRaf = 0;
        });
      }
    },
    { capture: false, passive: true }
  );
  document.addEventListener(
    'mouseout',
    (e) => {
      if (!tooltipTarget) return;
      const a = e.target.closest('a[data-tooltip]');
      if (!a || a !== tooltipTarget) return;
      const to = e.relatedTarget;
      if (to && (to === a || a.contains(to))) return;
      hideTooltip();
      tooltipTarget = null;
    },
    { capture: false, passive: true }
  );
  document.addEventListener(
    'focusin',
    (e) => {
      const a = e.target.closest('a[data-tooltip]');
      if (!a) return;
      tooltipTarget = a;
      const text = a.getAttribute('data-tooltip') || '';
      if (!text || !isTextTruncated(a)) return;
      showTooltip(text, a, e);
    },
    { capture: false }
  );
  document.addEventListener('focusout', () => {
    if (tooltipTarget) {
      hideTooltip();
      tooltipTarget = null;
    }
  });
};
