// Accueil (que voulez-vous faire ?), « Mon site » et « Mon compte »
import { h, pageHead, fmtDate } from './dom.js';
import { icon } from './icons.js';
import { get } from './api.js';
import { statusBadge } from './views-applications.js';

const tile = (href, name, title, text, extra) => h('a', { class: 'tile', href },
  h('span', { class: 'tile-icon' }, icon(name)),
  h('span', { class: 'tile-body' }, h('strong', null, title), h('span', null, text)),
  extra != null && h('span', { class: 'tile-count' }, extra));

export async function homeView({ me, can }) {
  const d = await get('/dashboard');
  const first = me.full_name.split(' ')[0];
  const root = h('div', { class: 'home' }, pageHead(`Bonjour ${first}`, 'Que voulez-vous faire aujourd’hui ?'));

  if (d.publication) {
    const p = d.publication;
    root.append(h('section', { class: `hero-status${p.upToDate ? ' is-ok' : ''}` },
      h('span', { class: 'hero-icon' }, icon(p.upToDate ? 'check' : 'clock')),
      h('div', null,
        h('h2', null, p.upToDate ? 'Votre site est à jour' : p.published ? 'Des changements attendent d’être publiés' : 'Le site n’a pas encore été publié'),
        h('p', null, p.upToDate ? `Dernière publication : ${fmtDate(p.live.created_at)}.` : 'Regardez l’aperçu, puis publiez pour mettre le site à jour.')),
      h('div', { class: 'hero-actions' },
        !p.upToDate && h('a', { class: 'btn', href: '/apercu/', target: '_blank', rel: 'noopener noreferrer' }, icon('eye'), 'Aperçu'),
        !p.upToDate && can('publier') && h('a', { class: 'btn btn--primary', href: '#/publish' }, icon('publish'), 'Publier'),
        p.upToDate && h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Voir le site'))));
  }

  if (d.applications) {
    const fresh = d.applications.recue || 0;
    const waiting = d.messagesToHandle || 0;
    root.append(h('section', null, h('h2', null, 'Personnes qui vous écrivent'),
      h('div', { class: 'tiles' },
        tile('#/applications', 'users', 'Demandes d’adhésion', fresh ? `${fresh} nouvelle${fresh > 1 ? 's' : ''} à examiner` : 'Aucune nouvelle demande', fresh || null),
        d.messagesToHandle !== undefined && tile('#/messages', 'mail', 'Messages', waiting ? `${waiting} à traiter` : 'Aucun message en attente', waiting || null)),
      d.recentApplications.length > 0 && h('ul', { class: 'rows' }, d.recentApplications.slice(0, 3).map((r) => h('li', null,
        h('a', { class: 'row', href: `#/applications/${r.id}` }, h('span', { class: 'row-body' }, h('strong', null, `${r.prenom} ${r.nom}`), h('span', null, fmtDate(r.created_at))), statusBadge(r.status), icon('right')))))));
  }

  if (can('contenu.ecrire')) {
    root.append(h('section', null, h('h2', null, 'Mettre le site à jour'),
      h('div', { class: 'tiles' },
        tile('#/r/agenda/new', 'calendar', 'Annoncer un événement', 'Une date à venir, affichée sur l’accueil'),
        tile('#/r/events/new', 'video', 'Partager une vidéo', 'Un événement passé, avec son résumé'),
        tile('#/r/members/new', 'userPlus', 'Ajouter une personne', 'Un nouveau membre de l’équipe'),
        tile('#/content', 'pencil', 'Corriger un texte', 'Les textes de toutes les pages'),
        tile('#/r/slides', 'photo', 'Changer les grandes photos', 'Le bandeau en haut de l’accueil'),
        tile('#/settings/contact', 'phone', 'Changer nos coordonnées', 'Téléphone, e-mail, réseaux sociaux'))));
  }
  return root;
}

export async function siteView({ can }) {
  const d = await get('/dashboard');
  const c = d.content || {};
  const group = (title, ...tiles) => h('section', null, h('h2', null, title), h('div', { class: 'tiles' }, tiles));
  return h('div', null, pageHead('Mon site', 'Choisissez la partie du site à modifier.'),
    group('La page d’accueil',
      tile('#/r/slides', 'photo', 'Grandes photos', 'Le bandeau qui défile en haut'),
      tile('#/r/agenda', 'calendar', 'Prochains événements', 'Les rendez-vous annoncés'),
      tile('#/r/events', 'video', 'Événements passés', 'Les vidéos à revoir', c.events),
      tile('#/r/partners', 'partner', 'Partenaires', 'Les logos qui défilent', c.partners),
      tile('#/settings/chiffres', 'chart', 'Chiffres clés', 'Provinces, membres, partenaires')),
    group('Le parti',
      tile('#/r/members', 'users', 'Équipe', 'Les personnes et leurs rôles', c.members),
      tile('#/r/programmes', 'programme', 'Programmes', 'Les projets et réalisations', c.programmes)),
    group('Textes et informations',
      tile('#/content', 'text', 'Textes des pages', 'Titres, paragraphes, photos des pages'),
      tile('#/settings/contact', 'phone', 'Coordonnées', 'Adresse, téléphone, réseaux sociaux'),
      tile('#/settings/google', 'search', 'Présence sur Google', 'Titres et descriptions des pages'),
      can('*') && tile('#/settings/technique', 'shield', 'Réglages techniques', 'Réservé à l’administrateur')));
}

const ROLES = { admin: 'Administrateur', editeur: 'Éditeur du contenu', secretariat: 'Secrétariat des adhésions' };

export async function accountView({ me, can, logout }) {
  return h('div', null, pageHead(me.full_name, `${ROLES[me.role] || me.role} · ${me.email}`),
    h('div', { class: 'tiles' },
      h('a', { class: 'tile', href: '/', target: '_blank', rel: 'noopener noreferrer' }, h('span', { class: 'tile-icon' }, icon('external')), h('span', { class: 'tile-body' }, h('strong', null, 'Voir le site'), h('span', null, 'Ouvre le site publié dans un nouvel onglet'))),
      can('*') && tile('#/users', 'userPlus', 'Comptes', 'Qui peut se connecter, et avec quels droits'),
      can('*') && tile('#/audit', 'clock', 'Historique des actions', 'Qui a fait quoi, et quand')),
    h('p', { class: 'account-logout' }, h('button', { type: 'button', class: 'btn', onclick: logout }, icon('logout'), 'Se déconnecter')));
}
