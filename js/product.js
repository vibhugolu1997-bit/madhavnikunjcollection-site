// Product page: thumbnails, quantity stepper, add to enquiry bag. The full-screen viewer is loaded only on request.
import { store, spa, paths } from './core.js';
import { sizeFrom, wireSize, byCode, money, data, copyText } from './enquiry.js';

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
    wireSize(form);
    // Designs priced by size: show the price of the chosen size.
    const priceOut = root.querySelector('[data-price-out]');
    const prices = byCode.get(code)?.prices;
    const status = form.querySelector('[data-status]');
    const product = byCode.get(code);
    const sizeNow = () => form.querySelector('input[type=radio][name=size]:checked')?.value || '';
    if (priceOut && prices) {
      const barPrice = root.querySelector('[data-bar-price]');
      const syncPrice = () => { const s = sizeNow(); priceOut.textContent = prices[s] != null ? money(prices[s]) : s === 'custom' ? 'Price on request' : priceOut.dataset.default; if (barPrice) { barPrice.hidden = prices[s] == null; barPrice.textContent = prices[s] != null ? `Size ${s} · ${money(prices[s])}` : ''; } };
      form.addEventListener('change', syncPrice); syncPrice();
    }
    form.querySelectorAll('input[type=radio][name=size]').forEach((r) => r.addEventListener('change', () => { status.textContent = ''; }));
    // Buy now: opens the Razorpay payment form that covers the chosen size.
    root.querySelector('[data-buy-now]')?.addEventListener('click', () => {
      const s = sizeNow();
      if (!s) { status.textContent = 'Please choose a size first.'; form.querySelector('.pills')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (s === 'custom') { status.textContent = `Size ${data.customFrom} and above is made to order. Please use Order on WhatsApp or the enquiry bag.`; return; }
      const forms = [...root.querySelectorAll('[data-pay] form')];
      const target = forms.find((f) => f.dataset.paySizes.split(',').includes(s)) || (forms.length === 1 ? forms[0] : null);
      const button = target?.querySelector('.PaymentButton') || target?.querySelector('a, button');
      if (!button) { status.textContent = 'Online payment could not be opened just now. Please use Order on WhatsApp.'; return; }
      status.textContent = `In the payment form, set the quantity next to Size ${s}.`;
      button.click();
    });
    // Share: the phone's share sheet where it exists, otherwise copy the link.
    root.querySelector('[data-share]')?.addEventListener('click', async () => {
      const out = root.querySelector('[data-share-status]');
      const url = location.href.split('#')[0];
      if (navigator.share) { try { await navigator.share({ title: document.title, url }); } catch { /* closed by the visitor */ } return; }
      out.textContent = (await copyText(url)) ? 'Link copied.' : url;
    });
    // Order on WhatsApp: the message carries the chosen size and quantity.
    const waLink = root.querySelector('[data-wa-order]');
    waLink?.addEventListener('click', () => {
      clamp();
      const size = sizeFrom(form);
      const lines = [`Namaste ${data.brand},`, '', `I would like to order ${code} - ${product?.name || ''}`, `Size: ${size || 'to be confirmed'}`, `Quantity: ${qty.value}`];
      waLink.href = `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clamp();
      store.add(code, Number(qty.value), sizeFrom(form));
      status.innerHTML = '';
      status.append(`Added ${qty.value} to your enquiry bag. `, Object.assign(document.createElement('a'), { href: paths.page('bag'), textContent: 'View enquiry bag' }));
    });
  }
}
if (!spa) init();
