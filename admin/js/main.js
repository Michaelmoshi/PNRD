// Console PNRD : barre latérale, barre du haut (recherche, créer, alertes, compte), navigation (#/...) et droits
import { h, clear, toast, ask, dirty } from './dom.js';
import { icon } from './icons.js';
import { get, post, ApiError } from './api.js';
import { homeView, accountView } from './views-home.js';
import { loginView, applicationsView, messagesView } from './views-applications.js';
import { usersView, auditView } from './views-admin.js';
import { publishView } from './views-publish.js';
import { resourceView, settingsView, mediaView } from './views-content.js';
import { textView } from './views-text.js';
import { createSearch } from './search.js';

const app = document.getElementById('app');
let me = null;

const can = (perm) => !!me && (me.permissions.includes('*') || me.permissions.includes(perm));
const ROLES = { admin: 'Administrateur', editeur: 'Éditeur', secretariat: 'Secrétariat' };

const NAV = [
  { id: 'home', href: '#/', label: 'Tableau de bord', icon: 'grid' },
  { group: 'Contenu' },
  { id: 'slides', href: '#/r/slides', label: 'Bandeau d’accueil', icon: 'slides', perm: 'contenu.lire' },
  { id: 'agenda', href: '#/r/agenda', label: 'Prochains événements', icon: 'calendar', perm: 'contenu.lire' },
  { id: 'events', href: '#/r/events', label: 'Événements passés', icon: 'video', perm: 'contenu.lire' },
  { id: 'content', href: '#/content', label: 'Textes des pages', icon: 'text', perm: 'contenu.lire' },
  { id: 'media', href: '#/media', label: 'Photos', icon: 'photo', perm: 'contenu.lire' },
  { group: 'Le parti' },
  { id: 'members', href: '#/r/members', label: 'Équipe', icon: 'users', perm: 'contenu.lire' },
  { id: 'programmes', href: '#/r/programmes', label: 'Programmes', icon: 'programme', perm: 'contenu.lire' },
  { id: 'partners', href: '#/r/partners', label: 'Partenaires', icon: 'partner', perm: 'contenu.lire' },
  { group: 'Relations' },
  { id: 'applications', href: '#/applications', label: 'Adhésions', icon: 'userPlus', perm: 'adhesions.lire', badge: true },
  { id: 'messages', href: '#/messages', label: 'Messages', icon: 'mail', perm: 'messages.lire', badge: true },
  { group: 'Site' },
  { id: 'publish', href: '#/publish', label: 'Publication', icon: 'publish', perm: 'contenu.lire', badge: true },
  { id: 'contact', href: '#/settings/contact', label: 'Coordonnées', icon: 'phone', perm: 'contenu.lire' },
  { id: 'chiffres', href: '#/settings/chiffres', label: 'Chiffres clés', icon: 'chart', perm: 'contenu.lire' },
  { id: 'google', href: '#/settings/google', label: 'Présence sur Google', icon: 'search', perm: 'contenu.lire' },
  { id: 'users', href: '#/users', label: 'Comptes', icon: 'user', perm: '*' },
  { id: 'audit', href: '#/audit', label: 'Historique', icon: 'clock', perm: '*' },
  { id: 'technique', href: '#/settings/technique', label: 'Réglages techniques', icon: 'shield', perm: '*' },
];

// Raccourcis de la barre du bas sur téléphone (le reste est dans « Menu »)
const TABS = ['home', 'agenda', 'applications', 'media'];
const TAB_LABEL = { home: 'Accueil', agenda: 'Agenda', applications: 'Adhésions', media: 'Photos' };

const CREATE = [
  { href: '#/r/agenda/new', label: 'Un événement à venir', icon: 'calendar', perm: 'contenu.ecrire' },
  { href: '#/r/events/new', label: 'Une vidéo d’événement', icon: 'video', perm: 'contenu.ecrire' },
  { href: '#/r/members/new', label: 'Une personne dans l’équipe', icon: 'userPlus', perm: 'contenu.ecrire' },
  { href: '#/r/programmes/new', label: 'Un programme', icon: 'programme', perm: 'contenu.ecrire' },
  { href: '#/r/partners/new', label: 'Un partenaire', icon: 'partner', perm: 'contenu.ecrire' },
  { href: '#/r/slides/new', label: 'Une grande photo', icon: 'slides', perm: 'contenu.ecrire' },
];

const ROUTES = [
  [/^$/, () => 'home', (_m, ctx) => homeView(ctx)],
  [/^r\/(slides|programmes|events|agenda|members|partners|member-categories)(?:\/(new|calendrier|\d+))?$/, (m) => (m[1] === 'member-categories' ? 'members' : m[1]), (m) => resourceView(m[1], m[2])],
  [/^content(?:\/([\w-]+)\/([\w-]+))?$/, () => 'content', (m, ctx) => textView(m[1], m[2], ctx)],
  [/^settings(?:\/([\w-]+))?$/, (m) => m[1] || 'contact', (m, ctx) => settingsView(m[1], ctx)],
  [/^media$/, () => 'media', () => mediaView()],
  [/^publish$/, () => 'publish', (_m, ctx) => publishView(ctx)],
  [/^applications(?:\/(\d+))?$/, () => 'applications', (m, ctx) => applicationsView(m[1], ctx)],
  [/^messages$/, () => 'messages', (_m, ctx) => messagesView(ctx)],
  [/^account$/, () => 'account', (_m, ctx) => accountView(ctx)],
  [/^users$/, () => 'users', () => usersView()],
  [/^audit$/, () => 'audit', () => auditView()],
];

// ------------------------------------------------------------ menus déroulants de la barre du haut
let openMenu = null;
function closeMenu(refocus) {
  if (!openMenu) return;
  openMenu.pop.hidden = true;
  openMenu.button.setAttribute('aria-expanded', 'false');
  if (refocus) openMenu.button.focus();
  openMenu = null;
}
function dropdown(button, pop) {
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'true');
  button.addEventListener('click', () => {
    const was = openMenu?.button === button;
    closeMenu();
    if (was) return;
    pop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    openMenu = { button, pop };
  });
  pop.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  return h('div', { class: 'dropdown' }, button, pop);
}

const brand = () => h('a', { href: '#/', class: 'brand' }, h('img', { src: '/assets/logo/logo-pnrd.jpeg', alt: '', width: '44', height: '44' }),
  h('span', null, h('strong', null, 'PNRD'), h('small', null, 'Console du site')));

const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('');

function navItem(item) {
  return h('a', { href: item.href, class: 'nav-link', 'data-nav': item.id, title: item.label }, icon(item.icon), h('span', { class: 'nav-label' }, item.label),
    item.badge && h('span', { class: 'nav-badge', 'data-badge': item.id, hidden: true }));
}

function sidebar() {
  const nav = h('nav', { 'aria-label': 'Navigation principale' });
  let pending = null;
  for (const item of NAV) {
    if (item.group) { pending = item.group; continue; }
    if (item.perm && !can(item.perm)) continue;
    if (pending) { nav.append(h('p', { class: 'nav-group' }, pending)); pending = null; }
    nav.append(navItem(item));
  }
  const collapse = h('button', { type: 'button', class: 'collapse', 'aria-pressed': String(localStorage.getItem('menu') === 'replie'), onclick: () => {
    const on = document.body.classList.toggle('is-collapsed');
    localStorage.setItem('menu', on ? 'replie' : '');
    collapse.setAttribute('aria-pressed', String(on));
  } }, icon('collapse'), h('span', { class: 'nav-label' }, 'Replier le menu'));
  return h('aside', { class: 'side', id: 'side' }, brand(),
    h('button', { type: 'button', class: 'side-close', 'aria-label': 'Fermer le menu', onclick: () => setDrawerMenu(false) }, icon('close')),
    nav, collapse);
}

function setDrawerMenu(open) {
  document.body.classList.toggle('menu-open', open);
  for (const b of document.querySelectorAll('[data-open-menu]')) b.setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('#side .nav-link')?.focus();
}

function topbar() {
  const menuBtn = h('button', { type: 'button', class: 'top-icon menu-btn', 'aria-label': 'Ouvrir le menu', 'data-open-menu': true, 'aria-expanded': 'false', onclick: () => setDrawerMenu(true) }, icon('menu'));
  const creates = CREATE.filter((c) => can(c.perm));
  const create = creates.length > 0 && dropdown(
    h('button', { type: 'button', class: 'btn btn--accent btn--create' }, icon('plus'), h('span', null, 'Créer')),
    h('div', { class: 'menu', hidden: true }, h('p', { class: 'menu-title' }, 'Ajouter…'), creates.map((c) => h('a', { href: c.href }, icon(c.icon), c.label))));
  const bell = dropdown(
    h('button', { type: 'button', class: 'top-icon', id: 'bell', 'aria-label': 'Notifications' }, icon('bell'), h('span', { class: 'bell-count', hidden: true })),
    h('div', { class: 'menu menu--wide', id: 'bell-menu', hidden: true }, h('p', { class: 'menu-empty' }, 'Rien à signaler.')));
  const account = dropdown(
    h('button', { type: 'button', class: 'account', id: 'account-btn' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(me.full_name)),
      h('span', { class: 'account-text' }, h('strong', null, me.full_name), h('small', null, ROLES[me.role] || me.role)), icon('down')),
    h('div', { class: 'menu', hidden: true }, h('a', { href: '#/account' }, icon('user'), 'Mon compte'),
      h('a', { href: '/', target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Voir le site'),
      h('button', { type: 'button', onclick: logout }, icon('logout'), 'Se déconnecter')));
  return h('header', { class: 'topbar' }, menuBtn, createSearch({ can }), h('div', { class: 'top-actions' }, create, bell, account));
}

function layout() {
  const main = h('main', { id: 'main', tabindex: '-1' });
  const strip = h('div', { id: 'strip', class: 'strip', hidden: true },
    h('p', null, icon('clock'), h('span', null, 'Des changements ne sont pas encore sur le site.')),
    h('div', { class: 'strip-actions' },
      h('a', { class: 'btn btn--small btn--quiet', href: '/apercu/', target: '_blank', rel: 'noopener noreferrer' }, 'Voir l’aperçu'),
      can('publier') && h('a', { class: 'btn btn--small btn--accent', href: '#/publish' }, 'Publier')));
  const tabs = h('nav', { class: 'tabbar', 'aria-label': 'Raccourcis' },
    NAV.filter((n) => TABS.includes(n.id) && (!n.perm || can(n.perm))).map((n) => h('a', { href: n.href, class: 'tab-link', 'data-nav': n.id },
      icon(n.icon), h('span', null, TAB_LABEL[n.id]), n.badge && h('span', { class: 'nav-badge', 'data-badge': n.id, hidden: true }))),
    h('button', { type: 'button', class: 'tab-link', 'data-open-menu': true, 'aria-expanded': 'false', onclick: () => setDrawerMenu(true) }, icon('menu'), h('span', null, 'Menu')));
  document.body.classList.toggle('is-collapsed', localStorage.getItem('menu') === 'replie');
  clear(app).append(
    h('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); main.focus(); } }, 'Aller au contenu'),
    h('div', { class: 'shell' }, sidebar(), h('div', { class: 'scrim', onclick: () => setDrawerMenu(false) }), h('div', { class: 'page' }, topbar(), strip, main)),
    tabs);
}

export async function logout() {
  try { await post('/auth/logout'); } catch { /* deja deconnecte */ }
  dirty.on = false;
  me = null;
  location.hash = '#/';
  show();
}

// Pastilles du menu, cloche et bandeau « à publier »
let current = '';
async function refreshStatus() {
  if (!me) return;
  let d;
  try { d = await get('/dashboard'); } catch { return; }          // ces indicateurs ne sont pas essentiels
  const fresh = d.applications?.recue || 0;
  const waiting = d.messagesToHandle || 0;
  const pending = !!d.publication && !d.publication.upToDate;
  const strip = document.getElementById('strip');
  if (strip) strip.hidden = !pending || current === 'publish' || current === 'home';
  for (const [id, n] of [['applications', fresh], ['messages', waiting], ['publish', pending ? '!' : 0]]) {
    for (const b of document.querySelectorAll(`[data-badge="${id}"]`)) { b.hidden = !n; b.textContent = n || ''; }
  }
  const alerts = [
    fresh && ['#/applications', 'userPlus', `${fresh} demande${fresh > 1 ? 's' : ''} d’adhésion à examiner`],
    waiting && ['#/messages', 'mail', `${waiting} message${waiting > 1 ? 's' : ''} à traiter`],
    pending && ['#/publish', 'publish', 'Des changements attendent d’être publiés'],
  ].filter(Boolean);
  const count = document.querySelector('.bell-count');
  if (!count) return;
  count.hidden = !alerts.length;
  count.textContent = fresh + waiting + (pending ? 1 : 0);
  clear(document.getElementById('bell-menu')).append(h('p', { class: 'menu-title' }, 'Notifications'),
    ...(alerts.length ? alerts.map(([href, ic, text]) => h('a', { href }, icon(ic), text)) : [h('p', { class: 'menu-empty' }, 'Rien à signaler.')]));
}

async function route() {
  const main = document.getElementById('main');
  if (!main) return;
  dirty.on = false;
  closeMenu();
  setDrawerMenu(false);
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
  const found = ROUTES.map(([re, id, fn]) => [re.exec(hash), id, fn]).find(([m]) => m);
  current = found ? found[1](found[0]) : '';
  for (const a of document.querySelectorAll('[data-nav]')) {
    const on = a.dataset.nav === current;
    a.classList.toggle('is-current', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const loading = setTimeout(() => clear(main).append(h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Chargement…')), 150);
  try {
    const node = found ? await found[2](found[0], { me, can, logout }) : h('p', null, 'Cette page n’existe pas.');
    if (location.hash.replace(/^#\/?/, '').split('?')[0] !== hash) return;          // on a change de page entre-temps
    setBackground(false);
    clear(main).append(node);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return;
    setBackground(false);
    clear(main).append(h('div', { class: 'notice notice--error' }, e instanceof ApiError && e.status === 403 ? 'Votre compte ne permet pas d’ouvrir cette page.' : e.message),
      h('p', null, h('button', { type: 'button', class: 'btn', onclick: route }, 'Réessayer')));
  } finally { clearTimeout(loading); }
  const panel = main.querySelector('.panel');
  setBackground(!!panel);
  if (panel) (panel.querySelector('input:not([type=checkbox]), textarea, select') || panel).focus({ preventScroll: true });
  else { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  refreshStatus();
}

// Panneau latéral ouvert : le reste de la console n'est plus actif
function setBackground(blocked) {
  document.body.classList.toggle('has-panel', blocked);
  for (const el of document.querySelectorAll('.side, .topbar, .strip, .tabbar')) el.toggleAttribute('inert', blocked);
}

async function show() {
  try { me = await get('/auth/me'); } catch { me = null; }
  if (!me) {
    document.body.className = '';
    clear(app).append(loginView(async () => { await show(); }));
    return;
  }
  layout();
  await route();
}

// Quitter un formulaire modifie : on demande d'abord
document.addEventListener('click', async (e) => {
  if (openMenu && !e.target.closest('.dropdown')) closeMenu();
  const link = e.target.closest?.('a[href^="#/"]');
  if (!link || !dirty.on) return;
  e.preventDefault();
  if (await ask({ title: 'Quitter sans enregistrer ?', text: 'Vos changements sur cette page seront perdus.', yes: 'Quitter la page', no: 'Rester ici', danger: true })) {
    dirty.on = false;
    location.hash = link.getAttribute('href');
  }
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (openMenu) return closeMenu(true);
  if (document.body.classList.contains('menu-open')) return setDrawerMenu(false);
  document.querySelector('.panel-close')?.click();
});
window.addEventListener('beforeunload', (e) => { if (dirty.on) e.preventDefault(); });
window.addEventListener('unhandledrejection', (e) => {            // erreur d'un bouton : message clair plutot que rien
  if (e.reason instanceof ApiError && e.reason.status === 401) return;
  toast(e.reason?.message || 'Une erreur est survenue', 'error');
});
window.addEventListener('hashchange', () => { if (me) route(); });
window.addEventListener('content-changed', refreshStatus);
window.addEventListener('session-expired', () => { if (me) { me = null; dirty.on = false; toast('Vous avez été déconnecté. Reconnectez-vous.', 'error'); show(); } });
show();
