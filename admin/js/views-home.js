// Tableau de bord et « Mon compte »
import { h, pageHead, fmtDate } from './dom.js';
import { icon } from './icons.js';
import { get } from './api.js';
import { statusBadge } from './views-applications.js';
import { ACTIONS, ENTITIES } from './labels.js';

const card = (title, subtitle, link, ...body) => h('section', { class: 'card widget' },
  h('header', { class: 'widget-head' }, h('div', null, h('h2', null, title), subtitle && h('p', null, subtitle)), link && h('a', { href: link[0] }, link[1])),
  ...body);
const none = (text) => h('p', { class: 'widget-empty' }, text);

const shortcut = (href, name, title, text) => h('a', { class: 'tile', href },
  h('span', { class: 'tile-icon' }, icon(name)), h('span', { class: 'tile-body' }, h('strong', null, title), h('span', null, text)));

const alertCell = (href, name, tone, n, text) => h('a', { class: 'alert', href },
  h('span', { class: `alert-icon alert-icon--${tone}` }, icon(name)), h('span', null, h('strong', { class: typeof n === 'string' ? 'is-text' : false }, n), h('small', null, text)));

// Histogramme des demandes par mois (SVG : les hauteurs sont des attributs, pas du style)
function chart(rows) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  const W = 600, H = 190, left = 30, bottom = 24, top = 18;
  const max = Math.max(4, ...rows.map((r) => r.n));
  const step = Math.ceil(max / 4), scale = step * 4;
  const y = (v) => top + (H - top - bottom) * (1 - v / scale);
  const label = (m) => new Date(`${m}-15`).toLocaleDateString('fr-FR', { month: 'short' });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Demandes d’adhésion par mois : ${rows.map((r) => `${label(r.month)} ${r.n}`).join(', ')}` });
  for (let i = 0; i <= 4; i += 1) {
    svg.append(el('line', { x1: left, x2: W, y1: y(i * step), y2: y(i * step), class: 'chart-grid' }), el('text', { x: 0, y: y(i * step) + 4 }, i * step));
  }
  const slot = (W - left) / rows.length;
  rows.forEach((r, i) => {
    const x = left + slot * i + slot / 2;
    if (r.n) {
      const bar = el('rect', { x: x - 18, width: 36, y: y(r.n), height: y(0) - y(r.n), rx: 4, class: 'chart-bar' });
      bar.append(el('title', {}, `${label(r.month)} : ${r.n}`));
      svg.append(bar, el('text', { x, y: y(r.n) - 5, 'text-anchor': 'middle', class: 'chart-value' }, r.n));
    }
    svg.append(el('text', { x, y: H - 6, 'text-anchor': 'middle' }, label(r.month)));
  });
  return svg;
}

const ago = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
  return days <= 0 ? 'aujourd’hui' : days === 1 ? 'hier' : `il y a ${days} j`;
};
const inDays = (iso) => {
  const d = Math.ceil((new Date(iso.replace(' ', 'T')) - Date.now()) / 864e5);
  return d <= 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} j`;
};

export async function homeView({ me, can }) {
  const d = await get('/dashboard');
  const fresh = d.applications?.recue || 0;
  const waiting = d.messagesToHandle || 0;
  const pending = !!d.publication && !d.publication.upToDate;
  const alerts = [
    fresh > 0 && alertCell('#/applications', 'userPlus', 'accent', fresh, `demande${fresh > 1 ? 's' : ''} d’adhésion à examiner`),
    waiting > 0 && alertCell('#/messages', 'mail', 'blue', waiting, `message${waiting > 1 ? 's' : ''} à traiter`),
    pending && alertCell('#/publish', 'publish', 'accent', 'Publier le site', d.publication.published ? 'Des changements attendent' : 'Le site n’a pas encore été publié'),
    d.photosWithoutText > 0 && alertCell('#/media', 'photo', 'warn', d.photosWithoutText, `photo${d.photosWithoutText > 1 ? 's' : ''} sans description`),
  ].filter(Boolean);
  const total = fresh + waiting + (pending ? 1 : 0);
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const root = h('div', { class: 'home' }, pageHead(`Bonjour ${me.full_name.split(' ')[0]}`,
    `${total ? `${total} élément${total > 1 ? 's' : ''} attend${total > 1 ? 'ent' : ''} une action.` : 'Tout est à jour.'} ${today[0].toUpperCase()}${today.slice(1)}.`,
    h('div', { class: 'head-actions' },
      d.publication && h('a', { class: 'btn', href: pending ? '/apercu/' : '/', target: '_blank', rel: 'noopener noreferrer' }, icon(pending ? 'eye' : 'external'), pending ? 'Voir l’aperçu' : 'Voir le site'),
      can('publier') && pending ? h('a', { class: 'btn btn--accent', href: '#/publish' }, icon('publish'), 'Publier le site')
        : can('contenu.ecrire') && h('a', { class: 'btn btn--accent', href: '#/r/agenda/new' }, icon('plus'), 'Annoncer un événement'))));

  if (alerts.length) root.append(h('div', { class: 'card alerts' }, alerts));

  if (can('contenu.ecrire')) {
    root.append(h('div', { class: 'tiles' },
      shortcut('#/r/agenda/new', 'calendar', 'Annoncer un événement', 'Une date à venir'),
      shortcut('#/r/events/new', 'video', 'Partager une vidéo', 'Un événement passé'),
      shortcut('#/r/members/new', 'userPlus', 'Ajouter une personne', 'Un membre de l’équipe'),
      shortcut('#/content', 'pencil', 'Corriger un texte', 'Toutes les pages'),
      shortcut('#/r/slides', 'photo', 'Changer les grandes photos', 'Le haut de l’accueil'),
      shortcut('#/settings/contact', 'phone', 'Changer nos coordonnées', 'Téléphone et réseaux')));
  }

  const c = d.content;
  const metric = (href, label, n) => h('a', { class: 'metric', href }, h('span', null, label), h('strong', null, n));
  const main = c && card('Votre site', 'Ce qui est présenté au public', null,
    h('div', { class: 'metrics' }, metric('#/r/members', 'Membres', c.members), metric('#/r/programmes', 'Programmes', c.programmes), metric('#/r/events', 'Événements passés', c.events), metric('#/r/partners', 'Partenaires', c.partners)),
    d.applicationsByMonth && h('div', { class: 'chart-box' }, h('p', { class: 'chart-title' }, h('span', { class: 'chart-dot', 'aria-hidden': 'true' }), 'Demandes d’adhésion reçues, 6 derniers mois'), chart(d.applicationsByMonth)));

  const agenda = c && card('Agenda', 'Prochains événements annoncés', ['#/r/agenda/calendrier', 'Calendrier'],
    d.upcoming.length ? h('ul', { class: 'agenda-list' }, d.upcoming.map((e) => {
      const when = new Date(e.starts_at.replace(' ', 'T'));
      return h('li', null, h('a', { href: `#/r/agenda/${e.id}` },
        h('span', { class: 'date-box', 'aria-hidden': 'true' }, h('small', null, when.toLocaleDateString('fr-FR', { month: 'short' })), h('strong', null, when.getDate())),
        h('span', { class: 'agenda-body' }, h('strong', null, e.title), h('small', null, fmtDate(when))), h('span', { class: 'pill' }, inDays(e.starts_at))));
    })) : none('Aucun événement à venir.'));

  if (main || agenda) root.append(h('div', { class: 'columns columns--wide' }, main, agenda));

  const inbox = d.recentApplications && card('Boîte de réception', 'Dernières demandes d’adhésion', ['#/applications', 'Ouvrir'],
    d.recentApplications.length ? h('ul', { class: 'feed' }, d.recentApplications.map((r) => h('li', null, h('a', { href: `#/applications/${r.id}` },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, `${r.prenom[0] || ''}${r.nom[0] || ''}`.toUpperCase()),
      h('span', { class: 'agenda-body' }, h('strong', null, `${r.prenom} ${r.nom}`), h('small', null, ago(r.created_at))), statusBadge(r.status))))) : none('Aucune demande pour le moment.'));

  const publication = d.publication && card('Publication', 'État du site public', ['#/publish', 'Historique'],
    h('div', { class: 'widget-body' },
      h('p', null, h('span', { class: `pill pill--${pending ? 'warn' : 'ok'}` }, pending ? 'Changements en attente' : 'Site à jour')),
      h('p', { class: 'muted' }, d.publication.live ? `Dernière publication : ${fmtDate(d.publication.live.created_at)}.` : 'Le site n’a pas encore été publié depuis la console.'),
      pending && can('publier') && h('a', { class: 'btn btn--primary', href: '#/publish' }, 'Vérifier et publier')));

  const activity = d.recentActivity && card('Activité de l’équipe', 'Dernières actions', ['#/audit', 'Tout voir'],
    h('ol', { class: 'timeline' }, d.recentActivity.slice(0, 6).map((r) => h('li', null,
      h('span', null, h('strong', null, r.user_name || 'Un visiteur'), ` ${ACTIONS[r.action] || r.action} ${ENTITIES[r.entity] ?? r.entity}`), h('time', null, ago(r.created_at))))));

  const bottom = [inbox, publication, activity].filter(Boolean);
  if (bottom.length) root.append(h('div', { class: 'columns' }, bottom));
  return root;
}

const ROLES = { admin: 'Administrateur', editeur: 'Éditeur du contenu', secretariat: 'Secrétariat des adhésions' };

export async function accountView({ me, logout }) {
  return h('div', null, pageHead(me.full_name, `${ROLES[me.role] || me.role} · ${me.email}`),
    h('div', { class: 'card widget-body' },
      h('p', null, 'Pour changer votre mot de passe, demandez à l’administrateur.'),
      h('div', { class: 'head-actions' },
        h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Voir le site'),
        h('button', { type: 'button', class: 'btn btn--danger', onclick: logout }, icon('logout'), 'Se déconnecter'))));
}
