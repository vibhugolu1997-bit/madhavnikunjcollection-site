// Product page: thumbnails, quantity stepper, add to enquiry bag. The full-screen viewer is loaded only on request.
import { store, spa, paths } from './core.js';

export function init({ signal } = {}) {
  const root = document.querySelector('[data-product]');
  if (root) {
    const code = root.dataset.product;
    const gallery = root.querySelector('[data-gallery]');
    const photos = JSON.parse(gallery.querySelector('[data-photos]').textContent);
    const main = gallery.querySelector('[data-main]');
    const thumbs = [...gallery.querySelectorAll('[data-thumb]')];
    const imgBase = paths.img;
    let current = 0;

    function show(i) {
      current = i;
      const p = photos[i];
      const set = (ext) => p.widths.map((w) => `${imgBase}${p.base}-${w}.${ext} ${w}w`).join(', ');
      const img = main.querySelector('img');
      main.querySelector('source').srcset = set('avif');
      img.srcset = set('jpg');
      img.src = `${imgBase}${p.base}-800.jpg`;
      img.alt = p.alt;
      img.width = 800; img.height = Math.round((800 * p.h) / p.w);
      img.style.objectPosition = '';
      main.parentElement.style.aspectRatio = `${p.w}/${p.h}`;
      thumbs.forEach((t, n) => t.setAttribute('aria-current', String(n === i)));
    }
    thumbs.forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.thumb))));

    const opener = gallery.querySelector('[data-open]');
    opener.addEventListener('click', async () => {
      const { openLightbox } = await import('./lightbox.js');
      openLightbox({ photos, imgBase, start: current, trigger: opener, onChange: show });
    });

    const form = root.querySelector('[data-buy]');
    const qty = form.elements.qty;
    const clamp = () => { qty.value = Math.min(99, Math.max(1, parseInt(qty.value, 10) || 1)); };
    form.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => { qty.value = (parseInt(qty.value, 10) || 1) + Number(b.dataset.step); clamp(); }));
    qty.addEventListener('change', clamp);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clamp();
      store.add(code, Number(qty.value), form.elements.size.value.trim());
      const status = form.querySelector('[data-status]');
      status.innerHTML = '';
      status.append(`Added ${qty.value} to your enquiry bag. `, Object.assign(document.createElement('a'), { href: paths.page('bag'), textContent: 'View enquiry bag' }));
    });
  }
}
if (!spa) init();
