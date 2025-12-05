export const updateFolderScrollAreaHeight = () => {
  const target = document.getElementById('grid-container');
  if (!target) return;
  requestAnimationFrame(() => {
    const viewportHeight = window.innerHeight;
    const rect = target.getBoundingClientRect();
    let reserveSpace = 32 + 24;
    const footer = document.querySelector('footer');
    if (footer) {
      const footerStyles = getComputedStyle(footer);
      reserveSpace +=
        footer.offsetHeight +
        parseFloat(footerStyles.paddingTop || '0') +
        parseFloat(footerStyles.paddingBottom || '0');
    }
    const available = viewportHeight - rect.top - reserveSpace;
    target.style.maxHeight = available > 0 ? `${available}px` : '';
  });
};
