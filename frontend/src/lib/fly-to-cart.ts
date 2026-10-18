export function flyToCart(source: Element | null) {
  const target = document.querySelector('[data-cart-target]');
  if (!source || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const from = source.getBoundingClientRect(),
    to = target.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) return;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.setAttribute('aria-hidden', 'true');
  clone.classList.add('flying-product');
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    zIndex: '9999',
    pointerEvents: 'none',
    objectFit: 'contain',
    transformOrigin: 'center',
  });
  document.body.append(clone);
  const x = to.left + to.width / 2 - from.left - from.width / 2,
    y = to.top + to.height / 2 - from.top - from.height / 2;
  const points = Array.from({ length: 21 }, (_, index) => {
    const t = index / 20,
      arc = -Math.sin(t * Math.PI) * Math.min(180, Math.abs(x) * 0.25 + 60);
    return {
      transform: `translate3d(${x * t}px,${y * t + arc}px,0) scale(${1 - 0.92 * t}) rotate(${12 * Math.sin(t * Math.PI)}deg)`,
      opacity: 1 - 0.75 * t,
      offset: t,
    };
  });
  const animation = clone.animate(points, { duration: 1050, easing: 'cubic-bezier(.3,.08,.25,1)' });
  animation.finished
    .then(() => {
      target.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.13)' }, { transform: 'scale(1)' }],
        { duration: 280 },
      );
    })
    .catch(() => {})
    .finally(() => clone.remove());
}
