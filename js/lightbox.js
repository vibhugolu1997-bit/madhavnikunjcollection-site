// Full-screen photo viewer. Loaded on demand. Uses the native <dialog>, which traps focus and closes on Escape.
// It shows the supplied photographs one at a time. It is not a 360-degree view.
let dialog;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Photo viewer');
  dialog.innerHTML = `<div class="lightbox__in">
    <div class="lightbox__bar">
      <span data-lb-count aria-live="polite"></span>
      <span style="display:flex;gap:.5rem">
        <button type="button" class="lb-btn" data-lb-zoom aria-pressed="false">Zoom in</button>
        <button type="button" class="lb-btn" data-lb-close aria-label="Close photo viewer">✕</button>
      </span>
    </div>
    <div class="lightbox__stage" data-lb-stage tabindex="0" aria-label="Photograph. When zoomed, scroll or use arrow keys to move around."><img alt="" data-lb-img></div>
    <div class="lightbox__nav">
      <button type="button" class="lb-btn" data-lb-prev aria-label="Previous photo">‹ Previous</button>
      <button type="button" class="lb-btn" data-lb-next aria-label="Next photo">Next ›</button>
    </div>
  </div>`;
  document.body.append(dialog);
}

export function openLightbox({ photos, imgBase, start = 0, trigger, onChange }) {
  if (!dialog) build();
  const img = dialog.querySelector('[data-lb-img]');
  const stage = dialog.querySelector('[data-lb-stage]');
  const count = dialog.querySelector('[data-lb-count]');
  const zoomBtn = dialog.querySelector('[data-lb-zoom]');
  const prev = dialog.querySelector('[data-lb-prev]');
  const next = dialog.querySelector('[data-lb-next]');
  let i = start;
  const avif = document.createElement('canvas').toDataURL('image/avif').startsWith('data:image/avif') || CSS.supports?.('background-image', 'image-set(url("a.avif") type("image/avif"))');

  function setZoom(on) {
    stage.classList.toggle('is-zoomed', on);
    zoomBtn.setAttribute('aria-pressed', String(on));
    zoomBtn.textContent = on ? 'Zoom out' : 'Zoom in';
    if (on) requestAnimationFrame(() => { stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2; stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2; });
  }
  function show(n) {
    i = (n + photos.length) % photos.length;
    const p = photos[i];
    setZoom(false);
    img.width = p.w; img.height = p.h;
    img.alt = p.alt;
    // The large image is requested only here, when the visitor opens the viewer.
    img.src = `${imgBase}${p.base}-${p.zoom}.${avif ? 'avif' : 'jpg'}`;
    img.onerror = () => { img.onerror = null; img.src = `${imgBase}${p.base}-${p.zoom}.jpg`; };
    count.textContent = `Photo ${i + 1} of ${photos.length}`;
    const single = photos.length < 2;
    prev.hidden = next.hidden = single;
    onChange?.(i);
  }

  const ac = new AbortController();
  const opt = { signal: ac.signal };
  prev.addEventListener('click', () => show(i - 1), opt);
  next.addEventListener('click', () => show(i + 1), opt);
  zoomBtn.addEventListener('click', () => setZoom(!stage.classList.contains('is-zoomed')), opt);
  img.addEventListener('dblclick', () => setZoom(!stage.classList.contains('is-zoomed')), opt);
  dialog.querySelector('[data-lb-close]').addEventListener('click', () => dialog.close(), opt);
  dialog.addEventListener('keydown', (e) => {
    if (stage.classList.contains('is-zoomed')) return; // arrows pan the zoomed photo instead
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
  }, opt);

  // Swipe left/right (only when not zoomed).
  let x0 = null, y0 = 0;
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; }, opt);
  stage.addEventListener('pointerup', (e) => {
    if (x0 === null || stage.classList.contains('is-zoomed')) { x0 = null; return; }
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? i + 1 : i - 1);
  }, opt);
  stage.addEventListener('pointercancel', () => { x0 = null; }, opt);

  dialog.addEventListener('close', () => {
    ac.abort();
    document.documentElement.style.overflow = '';
    trigger?.focus(); // return focus to the button that opened the viewer
  }, { once: true });

  show(start);
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
  dialog.querySelector('[data-lb-close]').focus();
}
