// Shared on every page: local storage for bag + favourites, header counts, favourite buttons, mobile menu.
// The one-page demo build sets data-spa on <html>; there, pages are #hash routes instead of separate files.
export const spa = document.documentElement.hasAttribute('data-spa');
const up = !spa && location.pathname.includes('/product/') ? '../' : '';
export const paths = {
  img: `${up}img/`,
  page: (name) => (spa ? `#${name}` : `${up}${name}.html`),
  product: (slug) => (spa ? `#p-${slug}` : `${up}product/${slug}.html`),
};

const KEYS = { bag: 'kalakunj:bag', favs: 'kalakunj:favs' };
const memory = {};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return memory[key] ?? fallback; // storage blocked: keep working for this page view
  }
}
function write(key, value) {
  memory[key] = value;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
  document.dispatchEvent(new CustomEvent('kk:change', { detail: key }));
}

export const store = {
  bag: () => read(KEYS.bag, []).filter((l) => l && typeof l.code === 'string'),
  setBag: (lines) => write(KEYS.bag, lines),
  add(code, qty = 1, size = '') {
    const bag = store.bag();
    const line = bag.find((l) => l.code === code && (l.size || '') === size);
    if (line) line.qty = Math.min(99, line.qty + qty);
    else bag.push({ code, qty: Math.min(99, Math.max(1, qty)), size });
    store.setBag(bag);
  },
  favs: () => read(KEYS.favs, []).filter((c) => typeof c === 'string'),
  toggleFav(code) {
    const favs = store.favs();
    const i = favs.indexOf(code);
    if (i >= 0) favs.splice(i, 1); else favs.push(code);
    write(KEYS.favs, favs);
    return i < 0;
  },
};

function paint() {
  const bagCount = store.bag().reduce((n, l) => n + (l.qty || 0), 0);
  const favs = store.favs();
  for (const [sel, n] of [['[data-bag-count]', bagCount], ['[data-fav-count]', favs.length]]) {
    document.querySelectorAll(sel).forEach((el) => { el.textContent = n; el.hidden = n === 0; });
  }
  document.querySelectorAll('[data-fav]').forEach((btn) => {
    const on = favs.includes(btn.dataset.fav);
    btn.setAttribute('aria-pressed', String(on));
    const label = btn.querySelector('span');
    if (label) label.textContent = on ? 'Saved' : 'Favourite';
  });
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-fav]');
  if (btn) { e.preventDefault(); store.toggleFav(btn.dataset.fav); }
});
document.addEventListener('kk:change', paint);
window.addEventListener('storage', paint);     // another tab changed the bag
window.addEventListener('pageshow', paint);    // back/forward cache

// Mobile menu: close on Escape or outside click, return focus to the button.
const menu = document.querySelector('.menu');
if (menu) {
  const summary = menu.querySelector('summary');
  const sync = () => summary.setAttribute('aria-expanded', String(menu.open));
  menu.addEventListener('toggle', sync); sync();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); } });
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
}
paint();
