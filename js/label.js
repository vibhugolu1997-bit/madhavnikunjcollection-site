// Courier label page (for the shop): reads the order from the link (#...), draws a Code 128 barcode of the order ID and lays out a printable label + bill.
import { spa } from './core.js?v=c5450103';
import { money } from './enquiry.js?v=c5450103';

// Code 128 bar/space widths for values 0-106 (103-105 are the start codes, 106 is stop).
const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
export function code128(text) {
  const vals = [...text].map((ch) => ch.charCodeAt(0) - 32);
  if (vals.some((v) => v < 0 || v > 94)) return null;          // set B covers printable ASCII only
  const check = vals.reduce((sum, v, i) => sum + v * (i + 1), 104) % 103;
  return [104, ...vals, check, 106].map((v) => C128[v]).join('');
}
function drawBarcode(svg, text) {
  const widths = code128(text);
  if (!widths) return;
  const quiet = 10; let x = quiet; const bars = [];
  [...widths].forEach((w, i) => { const n = Number(w); if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${n}" height="60"/>`); x += n; });
  svg.setAttribute('viewBox', `0 0 ${x + quiet} 60`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `<rect width="${x + quiet}" height="60" fill="#fff"/><g fill="#000">${bars.join('')}</g>`;
}

export function init() {
  const box = document.querySelector('[data-label]');
  if (!box) return;
  let o = null;
  try {
    const b64 = location.hash.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))));
  } catch { /* not an order link */ }
  if (!o?.i || !Array.isArray(o.it)) { document.querySelector('[data-label-empty]').hidden = false; return; }
  const set = (k, v) => { box.querySelector(`[data-l="${k}"]`).textContent = v; };
  const cod = o.w === 'cod';
  const date = new Date(o.d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  set('pay', cod ? `COD · Collect ${money(o.t)}` : 'PREPAID');
  box.querySelector('[data-l="pay"]').classList.toggle('label__pay--cod', cod);
  set('name', o.n); set('address', o.a); set('phone', o.ph); set('id', o.i);
  drawBarcode(box.querySelector('[data-l="barcode"]'), o.i);
  set('id2', o.i); set('date', date); set('pay2', cod ? 'Cash on delivery' : `Paid online (Razorpay ${o.p})`);
  set('to2', `${o.n} · ${o.ph} · ${o.a}`);
  const td = (t, cls) => Object.assign(document.createElement('td'), { textContent: t, className: cls || '' });
  box.querySelector('[data-l="rows"]').replaceChildren(...o.it.map(([code, name, size, qty, amount]) => { const tr = document.createElement('tr'); tr.append(td(`${code} · ${name}`), td(size), td(String(qty)), td(money(amount), 'num')); return tr; }));
  set('subtotal', money(o.s ?? o.t)); set('delivery', o.sh == null ? '-' : o.sh ? money(o.sh) : 'Free');
  set('totalLabel', cod ? 'Total to collect' : 'Total paid'); set('total', money(o.t));
  set('notes', o.nt ? `Customer note: ${o.nt}` : '');
  box.hidden = false;
  box.querySelector('[data-print]').addEventListener('click', () => window.print());
  document.title = `Label ${o.i}`;
}
if (!spa) init();
