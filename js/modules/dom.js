export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const on = (el, type, handler, opts) => el?.addEventListener(type, handler, opts);
export const off = (el, type, handler, opts) => el?.removeEventListener(type, handler, opts);
export const addClass = (el, cls) => el?.classList.add(cls);
export const removeClass = (el, cls) => el?.classList.remove(cls);
export const toggleClass = (el, cls, force) => el?.classList.toggle(cls, force);
export const setVar = (el, name, value) => el?.style.setProperty(name, value);
