(() => {
  const root = document.querySelector('[data-hero-property]');
  if (!root) return;
  const land = root.querySelector('[data-hero-land]');
  const images = [...land.querySelectorAll('img')];
  const buttons = [...root.querySelectorAll('[data-hero-view]')];
  const caption = root.querySelector('[data-hero-caption]');
  const views = {
    real: { src: 'assets/aerial-podzim-retus.webp', caption: 'Skutečná fotografie · vyznačená vnější hranice nabízeného celku.', alt: 'Skutečný pozemek v Pitkovicích s orientační vnější hranicí nabízeného celku' },
    one: { src: 'assets/B-01-0095.webp', caption: 'Ilustrace jednoho domu s velkou zahradou. Rozsah nabízeného celku zůstává vyznačený.', alt: 'Ilustrace jednoho domu na pozemku s orientačním zákresem' },
    three: { src: 'assets/E-02-0095.webp', caption: 'Ilustrace tří domů pro představu o využití prostoru. Jejich realizovatelnost vyžaduje ověření.', alt: 'Ilustrace tří domů na pozemku s orientačním zákresem' }
  };
  let current = 'real';
  buttons.forEach(button => button.addEventListener('click', () => {
    current = button.dataset.heroView;
    const view = views[current];
    images.forEach(image => setResponsive(image, view.src));
    land.querySelector('.hero-boundaries g').setAttribute('mask', `url(#hero-lines-${current})`);
    images[0].alt = view.alt;
    caption.textContent = view.caption;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  const preview = root.querySelector('[data-hero-preview]');
  preview.addEventListener('click', () => {
    root.querySelector('[data-hero-view="one"]').click();
    land.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  const dialog = document.getElementById('hero-dialog');
  const enlarge = root.querySelector('[data-hero-enlarge]');
  enlarge.addEventListener('click', () => {
    const clone = land.cloneNode(true);
    clone.removeAttribute('data-hero-land');
    clone.querySelectorAll('img').forEach(image => { image.sizes = 'min(95vw, 111vh, 1200px)'; });
    clone.querySelector('.hero-defs').remove();
    clone.querySelector('[data-hero-enlarge]').remove();
    dialog.querySelector('[data-hero-dialog-content]').replaceChildren(clone);
    dialog.querySelector('[data-hero-dialog-title]').textContent = views[current].alt;
    dialog.showModal();
  });
  dialog.addEventListener('close', () => enlarge.focus());
})();
