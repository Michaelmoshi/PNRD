// Console PNRD : mise en page, navigation par adresse (#/...) et droits
import { h, clear, toast } from './dom.js';
import { get, post, ApiError } from './api.js';
import { loginView, dashboardView } from './views-ops.js';
import { applicationsView, messagesView, usersView, auditView } from './views-ops2.js';
import { resourceView, contentView, settingsView, mediaView } from './views-content.js';

const app = document.getElementById('app');
let me = null;

const can = (perm) => !!me && (me.permissions.includes('*') || me.permissions.includes(perm));

const NAV = [
  { href: '#/', label: 'Tableau de bord' },
  { group: 'Contenu du site', perm: 'contenu.lire' },
  { href: '#/r/slides', label: 'Bandeau d’accueil', perm: 'contenu.lire' },
  { href: '#/r/programmes', label: 'Programmes', perm: 'contenu.lire' },
  { href: '#/r/events', label: 'Événements', perm: 'contenu.lire' },
  { href: '#/r/members', label: 'Équipe', perm: 'contenu.lire' },
  { href: '#/r/partners', label: 'Partenaires', perm: 'contenu.lire' },
  { href: '#/content', label: 'Textes des pages', perm: 'contenu.lire' },
  { href: '#/settings', label: 'Coordonnées et chiffres', perm: 'contenu.lire' },
  { href: '#/media', label: 'Images', perm: 'contenu.lire' },
  { group: 'Adhésions', perm: 'adhesions.lire' },
  { href: '#/applications', label: 'Demandes d’adhésion', perm: 'adhesions.lire' },
  { href: '#/messages', label: 'Messages reçus', perm: 'messages.lire' },
  { group: 'Administration', perm: '*' },
  { href: '#/users', label: 'Utilisateurs', perm: '*' },
  { href: '#/audit', label: 'Journal d’activité', perm: '*' },
];

const ROUTES = [
  [/^$/, () => dashboardView()],
  [/^r\/(slides|programmes|events|members|partners|member-categories)(?:\/(new|\d+))?$/, (m) => resourceView(m[1], m[2])],
  [/^content(?:\/([\w-]+)\/([\w-]+))?$/, (m) => contentView(m[1], m[2])],
  [/^settings$/, () => settingsView()],
  [/^media$/, () => mediaView()],
  [/^applications(?:\/(\d+))?$/, (m) => applicationsView(m[1])],
  [/^messages$/, () => messagesView()],
  [/^users$/, () => usersView()],
  [/^audit$/, () => auditView()],
];

function layout() {
  const nav = h('nav', { 'aria-label': 'Navigation principale', id: 'nav' });
  for (const item of NAV) {
    if (item.perm && !can(item.perm)) continue;
    nav.append(item.group ? h('p', { class: 'nav-group' }, item.group) : h('a', { href: item.href, class: 'nav-link' }, item.label));
  }
  const main = h('main', { id: 'main', tabindex: '-1' });
  clear(app).append(
    h('a', { class: 'skip', href: '#main' }, 'Aller au contenu'),
    h('header', { class: 'topbar' },
      h('button', { type: 'button', class: 'menu-btn', 'aria-controls': 'nav', 'aria-expanded': 'false', onclick: (e) => {
        const open = document.body.classList.toggle('nav-open');
        e.currentTarget.setAttribute('aria-expanded', String(open));
      } }, 'Menu'),
      h('strong', { class: 'brand' }, 'PNRD · Console')),
    h('div', { class: 'shell' },
      h('aside', { class: 'sidebar' },
        h('div', { class: 'sidebar-head' }, h('strong', null, 'PNRD'), h('span', null, 'Console d’administration')),
        nav,
        h('div', { class: 'sidebar-foot' },
          h('span', { class: 'who' }, me.full_name),
          h('a', { href: '/', class: 'link-site', target: '_blank', rel: 'noopener noreferrer' }, 'Voir le site'),
          h('button', { type: 'button', class: 'btn btn--ghost', onclick: logout }, 'Se déconnecter'))),
      main));
  return main;
}

async function logout() {
  try { await post('/auth/logout'); } catch { /* deja deconnecte */ }
  me = null;
  show();
}

async function route() {
  const main = document.getElementById('main');
  if (!main) return;
  document.body.classList.remove('nav-open');
  const hash = location.hash.replace(/^#\/?/, '');
  for (const a of document.querySelectorAll('.nav-link')) {
    const target = a.getAttribute('href').replace(/^#\/?/, '');
    a.classList.toggle('is-current', target === hash || (target && hash.startsWith(target.split('/').slice(0, 2).join('/'))));
    a.toggleAttribute('aria-current', a.classList.contains('is-current'));
  }
  const found = ROUTES.map(([re, fn]) => [re.exec(hash), fn]).find(([m]) => m);
  clear(main).append(h('p', { class: 'loading' }, 'Chargement…'));
  try {
    const node = found ? await found[1](found[0], { me, can }) : h('p', null, 'Page introuvable.');
    clear(main).append(node);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return;
    clear(main).append(h('div', { class: 'notice notice--error' }, e instanceof ApiError && e.status === 403 ? 'Vous n’avez pas accès à cette page.' : e.message));
  }
  main.focus({ preventScroll: true });
}

async function show() {
  try { me = await get('/auth/me'); } catch { me = null; }
  if (!me) {
    clear(app).append(loginView(async () => { toast('Connexion réussie'); await show(); }));
    return;
  }
  layout();
  await route();
}

window.addEventListener('unhandledrejection', (e) => {            // erreur d'un bouton : message clair plutot que rien
  if (e.reason instanceof ApiError && e.reason.status === 401) return;
  toast(e.reason?.message || 'Une erreur est survenue', 'error');
});
window.addEventListener('hashchange', () => { if (me) route(); });
window.addEventListener('session-expired', () => { if (me) { me = null; toast('Session expirée, reconnectez-vous', 'error'); show(); } });
show();
