// Home showroom: switch between featured designs, plus an optional pointer tilt.
import { spa } from './core.js';

export function init({ signal } = {}) {
  const room = document.querySelector('[data-showroom]');
  if (room) {
    const slides = room.querySelectorAll('[data-slide]');
    const captions = room.querySelectorAll('[data-caption]');
    const picks = room.querySelectorAll('[data-pick]');
    picks.forEach((pick) => {
      // Without JavaScript these are plain links to the product pages; with it they switch the showroom photo.
      pick.setAttribute('role', 'button');
      pick.addEventListener('click', (e) => {
        e.preventDefault();
        const i = pick.dataset.pick;
        slides.forEach((s) => { s.hidden = s.dataset.slide !== i; s.classList.toggle('is-switched', !s.hidden); });
        captions.forEach((c) => { c.hidden = c.dataset.caption !== i; });
        picks.forEach((p) => p.setAttribute('aria-current', String(p === pick)));
      });
      pick.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); pick.click(); } });
    });

    // Tilt only for mouse/trackpad users who have not asked for reduced motion.
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const stage = room.querySelector('[data-tilt]');
    let frame = 0;
    room.addEventListener('pointermove', (e) => {
      if (!fine.matches || calm.matches || e.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = room.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        stage.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
        stage.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      });
    });
    room.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      stage.style.removeProperty('--rx'); stage.style.removeProperty('--ry');
    });
  }
}
if (!spa) init();
