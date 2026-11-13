// Builds the readable enquiry message and handles copy / WhatsApp hand-off.
export const data = JSON.parse(document.getElementById('kk-data')?.textContent || '{"products":[]}');
export const byCode = new Map(data.products.map((p) => [p.code, p]));
export const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.currency || 'INR', maximumFractionDigits: 0 }).format(n);

// Size field helpers. A dropdown lists the size numbers; "custom" means a customisation request
// (size `customFrom` or above) with an optional text box for the size number or idol height.
export const CUSTOM_PREFIX = 'Customisation request';
export function sizeFrom(scope) {
  const field = scope.querySelector('input[type=radio][name=size]:checked') || scope.querySelector('select[name=size], input[type=text][name=size]');
  if (!field) return '';
  if (field.value !== 'custom') return field.value.trim();
  const extra = scope.querySelector('[name=sizeCustom]')?.value.trim();
  return `${CUSTOM_PREFIX} (size ${data.customFrom} or above)${extra ? `: ${extra}` : ''}`;
}
export function wireSize(scope) {
  const fields = [...scope.querySelectorAll('select[name=size], input[type=radio][name=size]')];
  const box = scope.querySelector('[data-size-custom]');
  if (!fields.length || !box) return;
  const value = () => (fields[0].type === 'radio' ? fields.find((f) => f.checked)?.value : fields[0].value) || '';
  const sync = () => { box.hidden = value() !== 'custom'; };
  fields.forEach((f) => f.addEventListener('change', () => { sync(); if (!box.hidden) box.querySelector('input')?.focus(); }));
  sync();
}

// Price of one piece for the chosen size. Designs priced by size have no price until a standard size is chosen.
export const priceFor = (p, size) => (p.prices ? (p.prices[size] ?? null) : p.price);

export function buildMessage(lines, { occasion = '', notes = '' } = {}) {
  const out = [`Namaste ${data.brand},`, '', 'I would like to enquire about:', ''];
  let subtotal = 0, unpriced = 0;
  lines.forEach((l, i) => {
    const p = byCode.get(l.code);
    if (!p) return;
    out.push(`${i + 1}. ${p.code} - ${p.name}`);
    out.push(`   Quantity: ${l.qty}`);
    out.push(`   Preferred size: ${l.size?.trim() || 'to be confirmed'}`);
    const price = priceFor(p, l.size?.trim());
    if (price != null) { out.push(`   Listed price: ${money(price)} each`); subtotal += price * l.qty; } else { out.push(p.prices ? '   Price: depends on size, to be confirmed' : '   Price: on enquiry'); unpriced += 1; }
    out.push('');
  });
  if (subtotal > 0) out.push(`Subtotal of listed prices: ${money(subtotal)}${unpriced ? ` (excludes ${unpriced} design${unpriced > 1 ? 's' : ''} priced on enquiry)` : ''}`, '');
  if (occasion.trim()) out.push(`Occasion: ${occasion.trim()}`);
  if (notes.trim()) out.push(`Notes: ${notes.trim()}`);
  if (occasion.trim() || notes.trim()) out.push('');
  out.push('Please confirm price, fit, availability and delivery charges.', 'Thank you.');
  return { text: out.join('\n'), subtotal, unpriced };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / non-secure contexts.
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Wires a "Copy enquiry" button and (only when a real number is configured) the WhatsApp link.
export function wireSend(scope, getText) {
  const status = scope.querySelector('[data-status]');
  scope.querySelector('[data-copy]')?.addEventListener('click', async () => {
    const ok = await copyText(getText());
    status.textContent = ok
      ? 'Enquiry copied. Paste it into your message to ' + data.brand + '. It has not been sent yet.'
      : 'Could not copy automatically. Press and hold the message above to select and copy it.';
    if (!ok) {
      const pre = scope.querySelector('[data-message]');
      const range = document.createRange(); range.selectNodeContents(pre);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); pre.focus();
    }
  });
  const wa = scope.querySelector('[data-wa]');
  if (wa && data.whatsapp) {
    const update = () => { wa.href = `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(getText())}`; };
    wa.addEventListener('pointerdown', update); wa.addEventListener('focus', update); wa.addEventListener('click', update);
    update();
  }
}
