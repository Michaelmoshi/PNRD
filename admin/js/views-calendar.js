// Calendrier mensuel des événements à venir
import { h, clear, pageHead } from './dom.js';
import { icon } from './icons.js';
import { get } from './api.js';
import { agendaTabs } from './views-content.js';

// Date choisie dans le calendrier, reprise par le formulaire d'ajout
let waiting = null;
export const prefill = {
  set: (v) => { waiting = v; },
  take: () => { const v = waiting || {}; waiting = null; return v; },
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let month = null;                                           // mois affiché, conservé pendant la session

export async function calendarView() {
  const rows = await get('/agenda');
  const today = new Date();
  month = month || new Date(today.getFullYear(), today.getMonth(), 1);
  const holder = h('div', { class: 'card calendar' });
  const move = (delta) => { month = new Date(month.getFullYear(), month.getMonth() + delta, 1); draw(); };

  const draw = () => {
    const title = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const prefix = iso(month).slice(0, 7);
    const n = rows.filter((r) => r.starts_at.startsWith(prefix)).length;
    const start = new Date(month);
    start.setDate(1 - ((month.getDay() + 6) % 7));           // la semaine commence le lundi
    const weeks = Math.ceil((((month.getDay() + 6) % 7) + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    clear(holder).append(
      h('header', { class: 'calendar-head' }, h('div', null, h('h2', null, title[0].toUpperCase() + title.slice(1)), h('p', null, `${n} événement${n > 1 ? 's' : ''}`)),
        h('div', { class: 'calendar-nav' },
          h('button', { type: 'button', class: 'btn btn--small', onclick: () => { month = new Date(today.getFullYear(), today.getMonth(), 1); draw(); } }, 'Aujourd’hui'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mois précédent', onclick: () => move(-1) }, icon('left')),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mois suivant', onclick: () => move(1) }, icon('right')))),
      h('div', { class: 'calendar-week', 'aria-hidden': 'true' }, ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => h('span', null, d))),
      h('ol', { class: 'calendar-grid' }, days.map((d) => {
        const key = iso(d);
        const events = rows.filter((r) => r.starts_at.startsWith(key));
        const long = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        return h('li', { class: `day${d.getMonth() !== month.getMonth() ? ' is-out' : ''}${key === iso(today) ? ' is-today' : ''}` },
          h('a', { class: 'day-number', href: '#/r/agenda/new', 'aria-label': `Annoncer un événement le ${long}`, title: 'Annoncer un événement ce jour', onclick: () => prefill.set({ starts_at: `${key}T10:00` }) }, d.getDate()),
          events.map((e) => h('a', { class: `day-event${e.published ? '' : ' is-hidden'}`, href: `#/r/agenda/${e.id}`, title: e.title }, h('b', null, e.starts_at.slice(11, 16)), ' ', h('span', null, e.title))));
      })));
  };
  draw();
  return h('div', null,
    pageHead('Prochains événements', 'Cliquez sur le numéro d’un jour pour y annoncer un événement.', h('a', { class: 'btn btn--accent', href: '#/r/agenda/new' }, icon('plus'), 'Annoncer un événement'), ['#/', 'Tableau de bord']),
    agendaTabs('calendrier'), holder);
}
