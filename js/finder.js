// "Find My Poshak": three steps — choose designs, add details, review the enquiry.
import { store, spa, paths } from './core.js';
import { buildMessage, wireSend, sizeFrom, wireSize } from './enquiry.js';

export function init({ signal } = {}) {
  const form = document.querySelector('[data-finder]');
  if (form) {
    const steps = [...form.querySelectorAll('[data-step]')];
    const dots = [...form.querySelectorAll('[data-dot]')];
    const message = form.querySelector('[data-message]');
    const status = form.querySelector('[data-status]');
    const error = form.querySelector('[data-error="0"]');
    const chosen = () => [...form.querySelectorAll('[name=design]:checked')].map((c) => c.value);
    const lines = () => chosen().map((code) => ({ code, qty: 1, size: sizeFrom(form) }));
    let at = 0;

    function go(n) {
      if (n > 0 && !chosen().length) {
        error.textContent = 'Please choose at least one design to continue.';
        form.querySelector('[name=design]').focus();
        return;
      }
      error.textContent = '';
      at = n;
      steps.forEach((s, i) => { s.hidden = i !== n; });
      dots.forEach((d, i) => { if (i === n) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
      if (n === 2) {
        message.textContent = buildMessage(lines(), { occasion: form.elements.occasion.value, notes: form.elements.notes.value }).text;
        status.textContent = '';
      }
      const heading = steps[n].querySelector('h2');
      heading.focus({ preventScroll: true });
      form.scrollIntoView({ block: 'start' });
    }

    form.hidden = false;
    wireSize(form);
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-next]')) go(at + 1);
      if (e.target.closest('[data-back]')) go(at - 1);
    });
    form.addEventListener('change', (e) => { if (e.target.name === 'design' && chosen().length) error.textContent = ''; });
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input[type=text]')) { e.preventDefault(); go(at + 1); } });
    form.querySelector('[data-to-bag]').addEventListener('click', () => {
      lines().forEach((l) => store.add(l.code, l.qty, l.size));
      status.innerHTML = '';
      status.append(`Added ${chosen().length} design${chosen().length > 1 ? 's' : ''} to your enquiry bag. `, Object.assign(document.createElement('a'), { href: paths.page('bag'), textContent: 'View enquiry bag' }));
    });
    wireSend(steps[2], () => message.textContent);
  }
}
if (!spa) init();
