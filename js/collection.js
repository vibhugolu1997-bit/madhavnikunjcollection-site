// Collection: search, filters, sort, favourites. The grid is already in the HTML; this only shows/hides/reorders it.
import { store, spa } from './core.js';

export function init({ signal } = {}) {
  const form = document.querySelector('[data-tools]');
  const grid = document.querySelector('[data-grid]');
  if (form && grid) {
    const items = [...grid.querySelectorAll('[data-item]')];
    const count = document.querySelector('[data-count]');
    const empty = document.querySelector('[data-empty]');
    const emptyText = document.querySelector('[data-empty-text]');
    form.hidden = false;

    const params = new URLSearchParams(location.search);
    if (params.get('favourites') === '1' || (spa && location.hash === '#favourites')) form.elements.favourites.checked = true;
    if (params.get('q')) form.elements.q.value = params.get('q');

    const sorters = {
      default: (a, b) => a.dataset.order - b.dataset.order,
      'name-asc': (a, b) => a.dataset.name.localeCompare(b.dataset.name),
      'name-desc': (a, b) => b.dataset.name.localeCompare(a.dataset.name),
      code: (a, b) => a.dataset.code.localeCompare(b.dataset.code, undefined, { numeric: true }),
      // Unpriced designs always go last when sorting by price.
      'price-asc': (a, b) => (a.dataset.price || Infinity) - (b.dataset.price || Infinity),
      'price-desc': (a, b) => (b.dataset.price || -Infinity) - (a.dataset.price || -Infinity),
    };

    function apply() {
      const words = form.elements.q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      const colours = [...form.querySelectorAll('[name=colour]:checked')].map((c) => c.value);
      const mukut = form.elements.mukut.checked;
      const favOnly = form.elements.favourites.checked;
      const favs = store.favs();
      let shown = 0;
      for (const li of items) {
        const ok = words.every((w) => li.dataset.text.includes(w))
          && (!colours.length || colours.some((c) => li.dataset.colours.split('|').includes(c)))
          && (!mukut || li.dataset.mukut === '1')
          && (!favOnly || favs.includes(li.dataset.code));
        li.hidden = !ok;
        if (ok) shown += 1;
      }
      [...items].sort(sorters[form.elements.sort.value] || sorters.default).forEach((li) => grid.append(li));
      count.textContent = shown === items.length ? `${shown} designs` : `Showing ${shown} of ${items.length} designs`;
      empty.hidden = shown > 0;
      grid.hidden = shown === 0;
      if (!shown) {
        emptyText.textContent = favOnly && !favs.length
          ? 'You have not saved any favourites yet. Tap the heart on a design to save it.'
          : 'Try a different word, or reset the filters to see every design.';
      }
    }

    form.addEventListener('input', apply);
    form.addEventListener('change', apply);
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('reset', () => setTimeout(apply));
    document.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => {
      if (b.type !== 'reset') { form.reset(); form.elements.q.focus(); }
      if (!spa) history.replaceState(null, '', location.pathname);
    }));
    document.addEventListener('kk:change', apply, { signal });
    apply();
  }
}
if (!spa) init();
