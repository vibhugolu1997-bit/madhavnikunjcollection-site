// Enquiry bag page: edit quantities and sizes, remove designs, build the enquiry message.
import { store, spa, paths } from './core.js';
import { byCode, buildMessage, money, priceFor, wireSend, data, CUSTOM_PREFIX } from './enquiry.js';

export function init({ signal } = {}) {
  const wrap = document.querySelector('[data-bag]');
  if (wrap) {
    const list = wrap.querySelector('[data-bag-list]');
    const emptyBox = document.querySelector('[data-bag-empty]');
    const summary = wrap.querySelector('[data-summary]');
    const note = wrap.querySelector('[data-summary-note]');
    const message = wrap.querySelector('[data-message]');
    const notes = wrap.querySelector('#bag-notes');
    const status = wrap.querySelector('[data-status]');
    const lines = () => store.bag().filter((l) => byCode.has(l.code));
    const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

    function sizeField(line, i, p) {
      const id = `size-${i}`;
      const field = el('div', { className: 'field' }, el('label', { htmlFor: id, textContent: 'Preferred size' }));
      if (!p.sizes.length) {
        const input = el('input', { id, type: 'text', maxLength: 60, placeholder: 'e.g. size 4', autocomplete: 'off', value: line.size || '' });
        input.addEventListener('change', () => update(i, { size: input.value.trim() }));
        field.append(input);
        return field;
      }
      const isCustom = (line.size || '').startsWith(CUSTOM_PREFIX);
      const select = el('select', { id });
      select.append(el('option', { value: '', textContent: 'To be confirmed' }), ...p.sizes.map((s) => el('option', { value: s, textContent: p.prices?.[s] != null ? `Size ${s} — ${money(p.prices[s])}` : `Size ${s}` })));
      if (data.customFrom) select.append(el('option', { value: 'custom', textContent: `Size ${data.customFrom}+ (customisation)` }));
      if (line.size && !isCustom && !p.sizes.includes(line.size)) select.append(el('option', { value: line.size, textContent: line.size }));
      select.value = isCustom ? 'custom' : line.size || '';
      const custom = el('input', { id: `${id}-custom`, type: 'text', maxLength: 60, placeholder: 'e.g. size 8, or height 12 inches', autocomplete: 'off', value: isCustom ? line.size.split(': ').slice(1).join(': ') : '' });
      const box = el('div', { className: 'field field--sub', hidden: !isCustom }, el('label', { htmlFor: custom.id, textContent: 'Your size number or idol height' }), custom);
      const save = () => update(i, { size: select.value === 'custom' ? `${CUSTOM_PREFIX} (size ${data.customFrom} or above)${custom.value.trim() ? `: ${custom.value.trim()}` : ''}` : select.value });
      select.addEventListener('change', () => { box.hidden = select.value !== 'custom'; save(); if (!box.hidden) custom.focus(); });
      custom.addEventListener('change', save);
      field.append(select, box);
      return field;
    }

    function update(i, patch) {
      const bag = lines();
      Object.assign(bag[i], patch);
      store.setBag(bag);
    }

    function renderList() {
      const bag = lines();
      list.replaceChildren(...bag.map((line, i) => {
        const p = byCode.get(line.code);
        const img = el('img', { src: `${paths.img}${p.thumb}-160.jpg`, width: 84, height: 84, alt: '', loading: 'lazy' });
        img.style.objectPosition = p.focus;
        const qty = el('input', { type: 'number', min: 1, max: 99, value: line.qty, inputMode: 'numeric' });
        qty.setAttribute('aria-label', `Quantity for ${p.name}`);
        const setQty = (v) => update(i, { qty: Math.min(99, Math.max(1, parseInt(v, 10) || 1)) });
        qty.addEventListener('change', () => setQty(qty.value));
        const minus = el('button', { type: 'button', textContent: '−' }); minus.setAttribute('aria-label', `Decrease quantity for ${p.name}`);
        const plus = el('button', { type: 'button', textContent: '+' }); plus.setAttribute('aria-label', `Increase quantity for ${p.name}`);
        minus.addEventListener('click', () => setQty(line.qty - 1));
        plus.addEventListener('click', () => setQty(line.qty + 1));
        const remove = el('button', { type: 'button', className: 'link-btn', textContent: 'Remove' });
        remove.setAttribute('aria-label', `Remove ${p.name} from enquiry bag`);
        remove.addEventListener('click', () => {
          const next = lines(); next.splice(i, 1); store.setBag(next);
          status.textContent = `${p.name} removed from your enquiry bag.`;
          (list.querySelector('a, button, input') || document.querySelector('[data-bag-empty] a'))?.focus();
        });
        return el('li', { className: 'bag-item' },
          img,
          el('div', {},
            el('span', { className: 'card__code', textContent: p.code }),
            el('h3', { className: 'card__name' }, el('a', { href: paths.product(p.slug), textContent: p.name })),
            el('p', { className: 'card__price', textContent: priceFor(p, line.size?.trim()) != null ? `${money(priceFor(p, line.size?.trim()))} each` : p.prices ? `From ${money(p.price)}, by size` : 'Price on enquiry' }),
            el('div', { className: 'bag-item__controls' },
              el('div', { className: 'field' }, el('span', { className: 'label', textContent: 'Quantity' }), el('span', { className: 'qty' }, minus, qty, plus)),
              sizeField(line, i, p),
              remove)));
      }));
    }

    const row = (k, v) => [el('dt', { textContent: k }), el('dd', { textContent: v })];
    function renderSummary() {
      const bag = lines();
      const has = bag.length > 0;
      const paid = !wrap.querySelector('[data-checkout-done]')?.hidden && wrap.querySelector('[data-checkout-done]');
      wrap.hidden = !has && !paid; emptyBox.hidden = has || Boolean(paid);
      if (!has) return;
      const { text, subtotal, unpriced } = buildMessage(bag, { notes: notes.value });
      const pieces = bag.reduce((n, l) => n + l.qty, 0);
      summary.replaceChildren(
        ...row('Designs', String(bag.length)),
        ...row('Total pieces', String(pieces)),
        ...(subtotal > 0 ? row('Subtotal (confirmed prices)', money(subtotal)) : row('Subtotal', 'Not available yet')),
        ...(unpriced ? row('Priced on enquiry', `${unpriced} design${unpriced > 1 ? 's' : ''}`) : []),
        ...row('Delivery charges', 'To be confirmed'));
      note.textContent = subtotal > 0
        ? (unpriced ? 'The subtotal covers only designs with a confirmed price. ' : '') + `Delivery charges are confirmed by ${data.brand}.`
        : `None of these designs has a confirmed price yet, so no subtotal is shown. ${data.brand} confirms prices and delivery charges when you enquire.`;
      message.textContent = text;
    }

    let lastShape = '';
    function render() {
      // Rebuild the list only when designs are added/removed, so typing in a field never loses focus.
      const bag = lines();
      const shape = bag.map((l) => l.code).join(',');
      if (shape !== lastShape) { renderList(); lastShape = shape; } else {
        list.querySelectorAll('.qty input').forEach((input, i) => { input.value = bag[i].qty; });
      }
      renderSummary();
    }

    notes.addEventListener('input', renderSummary);
    // Two taps instead of a browser confirm() box, which some embedded viewers block.
    const clear = wrap.querySelector('[data-clear]');
    let armed = 0;
    clear.addEventListener('click', () => {
      if (armed) { clearTimeout(armed); armed = 0; clear.textContent = 'Empty the bag'; store.setBag([]); document.querySelector('[data-bag-empty] a')?.focus(); return; }
      clear.textContent = 'Tap again to remove all designs';
      armed = setTimeout(() => { armed = 0; clear.textContent = 'Empty the bag'; }, 5000);
    });
    document.addEventListener('kk:change', render, { signal });
    window.addEventListener('storage', render, { signal });
    render();
    wireSend(wrap, () => message.textContent); // after render, so the WhatsApp link starts with the full message

    // ---- Checkout: Razorpay popup (public key only) or cash on delivery through WhatsApp.
    const form = wrap.querySelector('[data-checkout]');
    if (form) {
      const out = form.querySelector('[data-checkout-status]');
      const total = form.querySelector('[data-checkout-total]');
      const go = form.querySelector('[data-checkout-go]');
      const done = wrap.querySelector('[data-checkout-done]');
      const SAVE = 'kalakunj:checkout';
      const fields = ['name', 'phone', 'address', 'city', 'pin', 'state', 'email'];
      try { const saved = JSON.parse(localStorage.getItem(SAVE) || '{}'); fields.forEach((k) => { if (form.elements[k] && saved[k]) form.elements[k].value = saved[k]; }); } catch { /* storage blocked */ }
      const val = (k) => (form.elements[k]?.value || '').trim();
      const way = () => form.querySelector('input[name=way]:checked')?.value || '';
      // Every line must have a standard size with a listed price before it can be ordered here.
      const state = () => {
        const bag = lines();
        const bad = bag.filter((l) => { const p = byCode.get(l.code); return priceFor(p, l.size?.trim()) == null; });
        const sum = bag.reduce((n, l) => n + (priceFor(byCode.get(l.code), l.size?.trim()) || 0) * l.qty, 0);
        return { bag, bad, sum };
      };
      const sync = () => {
        const { bag, bad, sum } = state();
        total.textContent = bad.length || !bag.length ? '—' : money(sum);
        go.disabled = Boolean(bad.length) || !bag.length;
        go.textContent = way() === 'cod' ? 'Place order on WhatsApp' : 'Pay now';
        if (bad.length) out.textContent = `Choose a size with a listed price for: ${bad.map((l) => byCode.get(l.code).name).join(', ')}. Designs priced on enquiry cannot be ordered here; remove them or send an enquiry below.`;
        else if (out.dataset.kind !== 'error') out.textContent = '';
      };
      document.addEventListener('kk:change', sync, { signal });
      form.addEventListener('change', () => { out.dataset.kind = ''; sync(); });
      sync();
      if (location.hash === '#checkout') form.scrollIntoView({ block: 'start' });

      const fail = (msg, field) => { out.dataset.kind = 'error'; out.textContent = msg; if (field) form.elements[field]?.focus(); return false; };
      const validate = () => {
        if (val('name').length < 2) return fail('Please enter your full name.', 'name');
        if (!/^[6-9]\d{9}$/.test(val('phone').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))) return fail('Please enter a 10-digit mobile number.', 'phone');
        if (val('address').length < 8) return fail('Please enter your full address.', 'address');
        if (val('city').length < 2) return fail('Please enter your city.', 'city');
        if (!/^\d{6}$/.test(val('pin'))) return fail('Please enter a 6-digit PIN code.', 'pin');
        if (val('state').length < 2) return fail('Please enter your state.', 'state');
        if (val('email') && !/^\S+@\S+\.\S+$/.test(val('email'))) return fail('Please check the email address, or leave it empty.', 'email');
        return true;
      };
      const phone = () => val('phone').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
      const addressLine = () => `${val('address').replace(/\s+/g, ' ')}, ${val('city')}, ${val('state')} - ${val('pin')}`;
      const itemLines = (bag) => bag.map((l) => { const p = byCode.get(l.code); return `${l.qty} x ${p.code} ${p.name}, size ${l.size}, ${money(priceFor(p, l.size) * l.qty)}`; });
      const orderText = (bag, sum, heading, extra = []) => [
        `Namaste ${data.brand},`, '', heading, '', ...itemLines(bag).map((t, i) => `${i + 1}. ${t}`), '',
        `Total: ${money(sum)} (delivery charges to be confirmed)`, ...extra, '',
        `Name: ${val('name')}`, `Mobile: ${phone()}`, `Address: ${addressLine()}`,
        ...(notes.value.trim() ? [`Notes: ${notes.value.trim()}`] : []),
      ].join('\n');
      const waUrl = (text) => `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(text)}`;
      const remember = () => { try { localStorage.setItem(SAVE, JSON.stringify(Object.fromEntries(fields.map((k) => [k, val(k)])))); } catch { /* ignore */ } };
      const loadRazorpay = () => new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve();
        const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve(); s.onerror = () => reject(new Error('load')); document.head.append(s);
      });
      const showDone = (title, body, text) => {
        done.replaceChildren(el('h3', { textContent: title }), el('p', { textContent: body }),
          el('a', { className: 'btn btn--wa', href: waUrl(text), target: '_blank', rel: 'noopener', textContent: 'Send order details on WhatsApp' }));
        done.hidden = false; form.hidden = true; done.focus(); done.scrollIntoView({ block: 'center' });
      };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { bag, bad, sum } = state();
        if (!bag.length || bad.length || !validate()) return;
        remember();
        out.dataset.kind = '';
        if (way() === 'cod') {
          // No server here: the order exists only once the customer sends this message.
          window.open(waUrl(orderText(bag, sum, 'I would like to place this CASH ON DELIVERY order:')), '_blank', 'noopener');
          out.textContent = 'WhatsApp has opened with your order. It is placed only when you press send there.';
          return;
        }
        go.disabled = true; out.textContent = 'Opening secure payment…';
        try { await loadRazorpay(); } catch { go.disabled = false; return fail('The payment window could not be loaded. Check your connection, or choose cash on delivery / WhatsApp.'); }
        const items = itemLines(bag).join(' | ');
        const noteParts = {}; // Razorpay notes: each value up to 256 characters
        for (let i = 0, n = 1; i < items.length && n <= 6; i += 250, n += 1) noteParts[`items_${n}`] = items.slice(i, i + 250);
        const rzp = new window.Razorpay({
          key: data.checkout.key,
          amount: Math.round(sum * 100),
          currency: data.currency || 'INR',
          name: data.brand,
          description: `${bag.reduce((n, l) => n + l.qty, 0)} piece(s): ${bag.map((l) => `${l.code} size ${l.size}`).join(', ')}`.slice(0, 250),
          prefill: { name: val('name'), contact: `+91${phone()}`, ...(val('email') ? { email: val('email') } : {}) },
          notes: { ...noteParts, customer: val('name').slice(0, 250), mobile: phone(), address: addressLine().slice(0, 250), ...(notes.value.trim() ? { customer_note: notes.value.trim().slice(0, 250) } : {}) },
          theme: { color: '#1f4a3c' },
          modal: { ondismiss: () => { go.disabled = false; out.textContent = 'Payment was not completed. Nothing has been charged by this page.'; } },
          handler: (res) => {
            const text = orderText(bag, sum, 'I have paid online for this order:', [`Razorpay payment ID: ${res.razorpay_payment_id}`]);
            showDone('Payment received. Thank you!', `Payment ID ${res.razorpay_payment_id} for ${money(sum)}. Your order and address have gone to ${data.brand} with the payment. Send the details on WhatsApp too, so delivery can be confirmed quickly.`, text);
            store.setBag([]);
          },
        });
        rzp.on('payment.failed', (r) => { go.disabled = false; fail(`Payment failed${r?.error?.description ? `: ${r.error.description}` : ''}. You can try again.`); });
        rzp.open();
      });
    }
  }
}
if (!spa) init();
