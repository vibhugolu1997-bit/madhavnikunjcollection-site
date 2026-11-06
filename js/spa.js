// Router for the one-page demo build only (build/demo.mjs). The real site uses separate pre-rendered pages.
// Each page lives in a <template data-page="name">; the #hash decides which one is shown.
import './core.js';
import { init as hero } from './hero.js';
import { init as collection } from './collection.js';
import { init as product } from './product.js';
import { init as bag } from './bag.js';
import { init as finder } from './finder.js';

const main = document.getElementById('main');
const templates = new Map([...document.querySelectorAll('template[data-page]')].map((t) => [t.dataset.page, t]));
const alias = { favourites: 'collection', faqs: 'contact' };
const inits = { home: hero, collection, bag, 'find-my-poshak': finder };
let controller;
let first = true;

function route() {
  const hash = location.hash.slice(1) || 'home';
  let name = alias[hash] || hash;
  if (!templates.has(name)) name = 'not-found';
  const tpl = templates.get(name);

  controller?.abort();                     // drop listeners from the page being left
  controller = new AbortController();
  document.querySelector('dialog[open]')?.close();
  main.replaceChildren(tpl.content.cloneNode(true));
  document.title = tpl.dataset.title;

  const section = name.startsWith('p-') ? 'collection' : name;
  document.querySelectorAll('.nav a, .menu__panel a').forEach((a) => {
    if (a.getAttribute('href') === `#${section}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const menu = document.querySelector('.menu');
  if (menu) menu.open = false;

  (name.startsWith('p-') ? product : inits[name])?.({ signal: controller.signal });
  document.dispatchEvent(new CustomEvent('kk:change'));   // repaint favourite hearts and counts

  if (hash === 'faqs') document.getElementById('faqs')?.scrollIntoView();
  else window.scrollTo(0, 0);
  if (!first) main.focus({ preventScroll: true });
  first = false;
}

window.addEventListener('hashchange', route);
route();
