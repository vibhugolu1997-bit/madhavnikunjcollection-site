// Enquiry bag page: edit quantities and sizes, remove designs, build the enquiry message.
import { store, spa, paths } from './core.js?v=2880e229';
import { byCode, buildMessage, money, priceFor, wireSend, data, CUSTOM_PREFIX } from './enquiry.js?v=2880e229';

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

    // Delivery charge for an order subtotal (0 when free, null when no charge is configured).
    const shipFor = (sub) => { const d = data.checkout?.delivery; return d ? (d.freeFrom && sub >= d.freeFrom ? 0 : d.charge) : null; };
    const row = (k, v) => [el('dt', { textContent: k }), el('dd', { textContent: v })];
    function renderSummary() {
      const bag = lines();
      const has = bag.length > 0;
      const paid = !wrap.querySelector('[data-checkout-done]')?.hidden && wrap.querySelector('[data-checkout-done]');
      wrap.hidden = !has && !paid; emptyBox.hidden = has || Boolean(paid);
      if (!has) return;
      const { text, subtotal, unpriced } = buildMessage(bag, { notes: notes.value });
      const pieces = bag.reduce((n, l) => n + l.qty, 0);
      const ship = data.checkout?.delivery && subtotal > 0 && !unpriced ? shipFor(subtotal) : null;
      summary.replaceChildren(
        ...row('Designs', String(bag.length)),
        ...row('Total pieces', String(pieces)),
        ...(subtotal > 0 ? row('Subtotal (confirmed prices)', money(subtotal)) : row('Subtotal', 'Not available yet')),
        ...(unpriced ? row('Priced on enquiry', `${unpriced} design${unpriced > 1 ? 's' : ''}`) : []),
        ...(ship != null ? [...row('Delivery', ship ? money(ship) : 'Free'), ...row('Total', money(subtotal + ship))] : row('Delivery charges', 'To be confirmed')));
      note.textContent = subtotal > 0
        ? (unpriced ? 'The subtotal covers only designs with a confirmed price. ' : '') + (ship != null ? (data.checkout.delivery.freeFrom && ship ? `Add ${money(data.checkout.delivery.freeFrom - subtotal)} more for free delivery.` : '') : `Delivery charges are confirmed by ${data.brand}.`)
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
        const sub = bag.reduce((n, l) => n + (priceFor(byCode.get(l.code), l.size?.trim()) || 0) * l.qty, 0);
        const ship = shipFor(sub);
        return { bag, bad, sub, ship, sum: sub + (ship || 0) }; // sum = what the customer pays
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
      // Keep what has been typed, so nothing is lost if the page reloads or the phone switches apps.
      form.addEventListener('input', () => { try { localStorage.setItem(SAVE, JSON.stringify(Object.fromEntries(fields.map((k) => [k, val(k)])))); } catch { /* ignore */ } });
      // Enter / "Next" on the phone keyboard moves to the next field instead of submitting a half-filled form.
      form.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'radio') return;
        e.preventDefault();
        const order = fields.map((k) => form.elements[k]).filter(Boolean);
        const next = order[order.indexOf(e.target) + 1];
        if (next) next.focus(); else e.target.blur();
      });
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
        ...(shipFor(sum) === null ? [`Total: ${money(sum)} (delivery charges to be confirmed)`] : (() => { const sub = bag.reduce((n, l) => n + priceFor(byCode.get(l.code), l.size) * l.qty, 0); const sh = shipFor(sub); return [`Subtotal: ${money(sub)}`, `Delivery: ${sh ? money(sh) : 'Free'}`, `Total: ${money(sub + sh)}`]; })()), ...extra, '',
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
      // Order ID made in the browser: MN + date + 4 letters/digits, e.g. MN261118-7K3Q.
      const newOrderId = () => {
        const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
        const abc = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        const rnd = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => abc[b % abc.length]).join('');
        return `MN${String(d.getFullYear()).slice(2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${rnd}`;
      };
      const makeOrder = (bag, sum, how, paymentId = '', id = newOrderId()) => ({
        id, date: new Date().toISOString(), way: how, paymentId, total: sum,
        subtotal: bag.reduce((n, l) => n + priceFor(byCode.get(l.code), l.size) * l.qty, 0), delivery: shipFor(bag.reduce((n, l) => n + priceFor(byCode.get(l.code), l.size) * l.qty, 0)),
        items: bag.map((l) => { const p = byCode.get(l.code); const unit = priceFor(p, l.size); return { code: p.code, name: p.name, size: l.size, qty: l.qty, unit, amount: unit * l.qty }; }),
        customer: { name: val('name'), phone: phone(), email: val('email'), address: addressLine() }, notes: notes.value.trim(),
      });
      const saveOrder = (order) => { try { localStorage.setItem('kalakunj:lastOrder', JSON.stringify(order)); } catch { /* ignore */ } };
      // Confirmation email with the invoice inside it. Sent from this browser through EmailJS; only when it is set up.
      const sendMail = async (order) => {
        const m = data.checkout.mail;
        if (!m) return 'off';
        const to = order.customer.email || m.shop; // no customer email: the copy goes to the shop only
        if (!to) return 'off';
        try {
          const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service_id: m.s, template_id: m.t, user_id: m.k, template_params: {
              to_email: to, customer_email: order.customer.email || 'not given', customer_name: order.customer.name,
              order_id: order.id, order_date: new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
              orders: [...order.items.map((i) => ({ name: `${i.code} ${i.name}`, size: i.size, qty: i.qty, amount: money(i.amount) })), ...(order.delivery != null ? [{ name: 'Delivery', size: '', qty: '', amount: order.delivery ? money(order.delivery) : 'Free' }] : [])], total: money(order.total),
              payment: order.way === 'cod' ? `Cash on delivery: ${money(order.total)} to pay on delivery` : `Paid online (Razorpay ${order.paymentId})`,
              customer_phone: order.customer.phone, customer_address: order.customer.address, customer_notes: order.notes || '-',
              logo_url: `${data.checkout.site}/img/logo-mark-240.png`, site_url: data.checkout.site, brand: data.brand, whatsapp: `+${data.whatsapp}`,
            } }),
          });
          return res.ok ? 'sent' : 'failed';
        } catch { return 'failed'; }
      };
      const showDone = (order, body, text, waLabel) => {
        const mailLine = el('p', { className: 'hint', textContent: '' });
        done.replaceChildren(
          el('p', { className: 'checkout__jsk hi', lang: 'hi', textContent: '॥ जय श्री कृष्ण ॥' }),
          el('h3', { textContent: order.way === 'cod' && !data.checkout.mail ? 'Jai Shri Krishna! Send your order on WhatsApp to place it.' : 'Jai Shri Krishna! Your order is placed.' }),
          el('p', {}, 'Order ID: ', el('strong', { textContent: order.id })),
          el('p', { textContent: body }), mailLine,
          el('div', { className: 'btn-row' },
            el('a', { className: 'btn btn--wa', href: waUrl(text), target: '_blank', rel: 'noopener', textContent: waLabel }),
            el('a', { className: 'btn btn--ghost', href: paths.page('invoice'), textContent: 'View invoice' })));
        done.hidden = false; form.hidden = true; done.focus(); done.scrollIntoView({ block: 'center' });
        sendMail(order).then((r) => {
          if (r === 'sent') mailLine.textContent = order.customer.email ? `A confirmation email with your invoice has been sent to ${order.customer.email}.` : `Your order has been emailed to ${data.brand}.`;
          else if (r === 'failed') mailLine.textContent = 'The confirmation email could not be sent. Your invoice is available with the button above.';
        });
      };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { bag, bad, sum } = state();
        if (!bag.length || bad.length || !validate()) return;
        remember();
        out.dataset.kind = '';
        if (way() === 'cod') {
          // No server here: the order exists only once the customer sends this message.
          const order = makeOrder(bag, sum, 'cod');
          saveOrder(order);
          const text = orderText(bag, sum, `I would like to place this CASH ON DELIVERY order (Order ID ${order.id}):`);
          window.open(waUrl(text), '_blank', 'noopener');
          showDone(order, `${money(sum)} to pay in cash on delivery. WhatsApp has opened with your order: press send there so ${data.brand} receives it${data.checkout.mail ? ' on WhatsApp as well' : ''}.`, text, 'Open WhatsApp again');
          store.setBag([]);
          return;
        }
        go.disabled = true; out.textContent = 'Opening secure payment…';
        try { await loadRazorpay(); } catch { go.disabled = false; return fail('The payment window could not be loaded. Check your connection, or choose cash on delivery / WhatsApp.'); }
        const items = itemLines(bag).join(' | ');
        const noteParts = {}; // Razorpay notes: each value up to 256 characters
        for (let i = 0, n = 1; i < items.length && n <= 6; i += 250, n += 1) noteParts[`items_${n}`] = items.slice(i, i + 250);
        const oid = newOrderId();
        const rzp = new window.Razorpay({
          key: data.checkout.key,
          amount: Math.round(sum * 100),
          currency: data.currency || 'INR',
          name: data.brand,
          description: `${bag.reduce((n, l) => n + l.qty, 0)} piece(s): ${bag.map((l) => `${l.code} size ${l.size}`).join(', ')}`.slice(0, 250),
          prefill: { name: val('name'), contact: `+91${phone()}`, ...(val('email') ? { email: val('email') } : {}) },
          notes: { order_id: oid, ...noteParts, customer: val('name').slice(0, 250), mobile: phone(), address: addressLine().slice(0, 250), ...(notes.value.trim() ? { customer_note: notes.value.trim().slice(0, 250) } : {}) },
          theme: { color: '#1f4a3c' },
          modal: { ondismiss: () => { go.disabled = false; out.textContent = 'Payment was not completed. Nothing has been charged by this page.'; } },
          handler: (res) => {
            const order = makeOrder(bag, sum, 'online', res.razorpay_payment_id, oid);
            saveOrder(order);
            const text = orderText(bag, sum, `I have paid online for this order (Order ID ${order.id}):`, [`Razorpay payment ID: ${res.razorpay_payment_id}`]);
            showDone(order, `Payment of ${money(sum)} received (Razorpay ID ${res.razorpay_payment_id}). Your order and address have gone to ${data.brand} with the payment. Send the details on WhatsApp too, so delivery can be confirmed quickly.`, text, 'Send order details on WhatsApp');
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
