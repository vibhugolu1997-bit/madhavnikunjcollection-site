// Invoice page: shows the last order placed from this device (kept in the browser, not on a server).
import { spa } from './core.js?v=c5450103';
import { money } from './enquiry.js?v=c5450103';

export function init() {
  const box = document.querySelector('[data-invoice]');
  if (!box) return;
  let order = null;
  try { order = JSON.parse(localStorage.getItem('kalakunj:lastOrder') || 'null'); } catch { /* ignore */ }
  if (!order?.id || !Array.isArray(order.items)) { document.querySelector('[data-invoice-empty]').hidden = false; return; }
  const set = (k, v) => { box.querySelector(`[data-inv="${k}"]`).textContent = v; };
  set('id', order.id);
  set('date', new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  set('pay', order.way === 'cod' ? 'Cash on delivery' : `Paid online · Razorpay ${order.paymentId}`);
  set('name', order.customer.name); set('address', order.customer.address); set('phone', order.customer.phone);
  set('email', order.customer.email || '');
  const td = (t, cls) => Object.assign(document.createElement('td'), { textContent: t, className: cls || '' });
  box.querySelector('[data-inv="rows"]').replaceChildren(...order.items.map((i) => {
    const tr = document.createElement('tr');
    tr.append(td(`${i.code} · ${i.name}`), td(i.size), td(String(i.qty)), td(money(i.unit), 'num'), td(money(i.amount), 'num'));
    return tr;
  }));
  const sub = order.subtotal ?? order.total;
  set('subtotal', money(sub));
  set('delivery', order.delivery == null ? 'To be confirmed' : order.delivery ? money(order.delivery) : 'Free');
  set('total', money(order.total));
  set('dueLabel', order.way === 'cod' ? 'To pay on delivery' : 'Paid');
  set('due', money(order.total));
  box.hidden = false;
  const actions = document.querySelector('[data-invoice-actions]'); actions.hidden = false;
  actions.querySelector('[data-print]').addEventListener('click', () => window.print());
  document.title = `Invoice ${order.id}`;
}
if (!spa) init();
