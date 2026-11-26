// Recherche de la barre du haut : retrouve un contenu ou une page de la console (Ctrl + K)
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { get } from './api.js';
import { PAGES, BLOCKS } from './labels.js';

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let index = null;
window.addEventListener('content-changed', () => { index = null; });

async function build(can) {
  const items = [
    ['Coordonnées : téléphone, e-mail, réseaux', 'Réglages', '#/settings/contact', 'phone'],
    ['Chiffres clés de l’accueil', 'Réglages', '#/settings/chiffres', 'chart'],
    ['Publier le site', 'Publication', '#/publish', 'publish'],
    ['Photos', 'Contenu', '#/media', 'photo'],
  ];
  if (can('contenu.lire')) {
    const [prog, agenda, events, members, partners, blocks] = await Promise.all(['/programmes', '/agenda', '/events', '/members', '/partners', '/content'].map(get));
    prog.forEach((r) => items.push([r.title, 'Programme', `#/r/programmes/${r.id}`, 'programme']));
    agenda.forEach((r) => items.push([r.title, 'Événement à venir', `#/r/agenda/${r.id}`, 'calendar']));
    events.forEach((r) => items.push([r.title, 'Événement passé', `#/r/events/${r.id}`, 'video']));
    members.forEach((r) => items.push([r.full_name, `Équipe · ${r.function}`, `#/r/members/${r.id}`, 'user']));
    partners.forEach((r) => items.push([r.name, 'Partenaire', `#/r/partners/${r.id}`, 'partner']));
    blocks.forEach((b) => items.push([BLOCKS[b.key] || b.key, `Texte · ${PAGES[b.page] || b.page}${b.title ? ` · ${b.title}` : ''}`, `#/content/${b.page}/${b.key}`, 'text']));
  }
  if (can('adhesions.lire')) (await get('/applications')).forEach((r) => items.push([`${r.prenom} ${r.nom}`, 'Demande d’adhésion', `#/applications/${r.id}`, 'userPlus']));
  return items.map(([title, kind, href, ic]) => ({ title, kind, href, ic, key: plain(`${title} ${kind}`) }));
}

export function createSearch({ can }) {
  index = null;
  const input = h('input', { type: 'search', placeholder: 'Rechercher…', 'aria-label': 'Rechercher dans la console', autocomplete: 'off' });
  const results = h('div', { class: 'results', hidden: true, role: 'listbox', 'aria-label': 'Résultats' });
  const hide = () => { results.hidden = true; };
  const update = async () => {
    const q = plain(input.value.trim());
    if (!q) return hide();
    index = index || build(can);
    const words = q.split(/\s+/);
    const found = (await index).filter((i) => words.every((w) => i.key.includes(w))).slice(0, 8);
    if (plain(input.value.trim()) !== q) return;
    clear(results).append(...(found.length ? found.map((i) => h('a', { href: i.href, role: 'option', onclick: () => { input.value = ''; hide(); } },
      icon(i.ic), h('span', null, h('strong', null, i.title), h('small', null, i.kind)))) : [h('p', { class: 'menu-empty' }, 'Aucun résultat.')]));
    results.hidden = false;
  };
  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; hide(); input.blur(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); results.querySelector('a')?.focus(); }
    if (e.key === 'Enter') { e.preventDefault(); results.querySelector('a')?.click(); }
  });
  const box = h('div', { class: 'search-global', role: 'search' }, icon('search'), input, h('kbd', { 'aria-hidden': 'true' }, 'Ctrl K'), results);
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) hide(); });
  results.addEventListener('keydown', (e) => {
    const links = [...results.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); links[Math.min(i + 1, links.length - 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : links[i - 1]).focus(); }
  });
  return box;
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    const input = document.querySelector('.search-global input');
    if (input) { e.preventDefault(); input.focus(); }
  }
});
