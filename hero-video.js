(() => {
  const stage = document.querySelector('[data-hero-film]');
  if (!stage) return;
  const video = stage.querySelector('video');
  const toggle = stage.querySelector('[data-hero-film-toggle]');
  const label = toggle.querySelector('.hero-film-toggle-label');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const safari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android|Edg|OPR/.test(navigator.userAgent);
  let visible = true;
  let userPaused = false;
  let manualPlay = false;
  let ready = false;
  let sourceKey = '';
  let resizeTimer;
  const automaticAllowed = () => !reduced.matches && !connection?.saveData && !/^(slow-)?2g$/.test(connection?.effectiveType || '');
  const asset = name => new URL(`${stage.dataset.videoBase}-${name}`, location.hostname === 'frantisekdron.github.io' ? 'https://pozemekpitkovice.cz/' : document.baseURI).href;
  const mode = () => innerWidth <= 600 ? 'mobile' : innerWidth <= 1024 ? 'tablet' : 'desktop';

  function updateButton() {
    const playing = !video.paused && !video.ended;
    stage.classList.toggle('is-playing', playing);
    const text = playing ? 'Pozastavit úvodní video' : 'Přehrát úvodní video';
    toggle.setAttribute('aria-label', text);
    label.textContent = playing ? 'Pozastavit' : 'Přehrát';
  }
  function loadSources() {
    const key = mode();
    if (sourceKey === key) return;
    sourceKey = key;
    video.pause();
    video.replaceChildren();
    const formats = !safari && video.canPlayType('video/mp4; codecs="av01.0.05M.08"') ? ['av1', 'h264'] : ['h264'];
    formats.forEach(format => {
      const source = document.createElement('source');
      source.src = asset(`${key}.${format}.mp4`);
      source.type = format === 'av1' ? 'video/mp4; codecs="av01.0.05M.08"' : 'video/mp4';
      video.append(source);
    });
    video.muted = true;
    video.defaultMuted = true;
    video.load();
  }
  function reconcile() {
    if (!ready || userPaused || document.hidden || !visible || (!manualPlay && !automaticAllowed())) {
      video.pause();
      return;
    }
    loadSources();
    video.muted = true;
    video.play().catch(() => updateButton());
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    if (!video.paused) { userPaused = true; video.pause(); }
    else { userPaused = false; manualPlay = true; ready = true; reconcile(); }
  });
  video.addEventListener('playing', () => { stage.classList.add('has-frame'); updateButton(); });
  video.addEventListener('pause', updateButton);
  video.addEventListener('error', () => { stage.classList.remove('has-frame', 'is-playing'); updateButton(); });
  document.addEventListener('visibilitychange', reconcile);
  reduced.addEventListener?.('change', () => { manualPlay = false; reconcile(); });
  connection?.addEventListener?.('change', reconcile);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    reconcile();
  }, {threshold: 0.1}).observe(stage);
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(reconcile, 250); }
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);
  function schedule() {
    const start = () => { ready = true; reconcile(); };
    if ('requestIdleCallback' in window) requestIdleCallback(start, {timeout: 1800});
    else setTimeout(start, 350);
  }
  if (document.readyState === 'complete') schedule();
  else addEventListener('load', schedule, {once:true});
  updateButton();
})();
