const ICON_WEIGHT_TO_FAMILY = {
  regular: 'Phosphor',
  thin: 'Phosphor-Thin',
  light: 'Phosphor-Light',
  bold: 'Phosphor-Bold',
  fill: 'Phosphor-Fill',
  duotone: 'Phosphor-Duotone',
};
export const applyIconWeight = (weight) => {
  const el = document.documentElement;
  const valid = Object.keys(ICON_WEIGHT_TO_FAMILY);
  const w = valid.includes(weight) ? weight : 'regular';
  [...el.classList].forEach((cls) => {
    if (cls.startsWith('phw-')) el.classList.remove(cls);
  });
  el.classList.add('phw-' + w);
};
