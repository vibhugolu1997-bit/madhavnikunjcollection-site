// Enquiry bag page: edit quantities and sizes, remove designs, build the enquiry message.
import { store, spa, paths } from './core.js';
import { byCode, buildMessage, money, wireSend, data, CUSTOM_PREFIX } from './enquiry.js';

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
      select.append(el('option', { value: '', textContent: 'To be confirmed' }), ...p.sizes.map((s) => el('option', { value: s, textContent: `Size ${s}` })));
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
            el('p', { className: 'card__price', textContent: p.price != null ? `${money(p.price)} each` : 'Price on enquiry' }),
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
      wrap.hidden = !has; emptyBox.hidden = has;
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
  }
}
if (!spa) init();
