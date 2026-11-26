// Console PNRD : mise en page, navigation par adresse (#/...) et droits
import { h, clear, toast, ask, dirty } from './dom.js';
import { icon } from './icons.js';
import { get, post, ApiError } from './api.js';
import { homeView, siteView, accountView } from './views-home.js';
import { loginView, applicationsView, messagesView } from './views-applications.js';
import { usersView, auditView } from './views-admin.js';
import { publishView } from './views-publish.js';
import { resourceView, settingsView, mediaView } from './views-content.js';
import { textView } from './views-text.js';

const app = document.getElementById('app');
let me = null;

const can = (perm) => !!me && (me.permissions.includes('*') || me.permissions.includes(perm));

// Cinq entrees au maximum : les memes en colonne (ordinateur) et en barre du bas (telephone)
const NAV = [
  { id: 'home', href: '#/', label: 'Accueil', icon: 'home' },
  { id: 'site', href: '#/site', label: 'Mon site', icon: 'site', perm: 'contenu.lire' },
  { id: 'applications', href: '#/applications', label: 'Adhésions', icon: 'users', perm: 'adhesions.lire' },
  { id: 'media', href: '#/media', label: 'Photos', icon: 'photo', perm: 'contenu.lire' },
  { id: 'publish', href: '#/publish', label: 'Publier', icon: 'publish', perm: 'contenu.lire' },
];

// [adresse, entree du menu a surligner, vue]
const ROUTES = [
  [/^$/, 'home', (_m, ctx) => homeView(ctx)],
  [/^site$/, 'site', (_m, ctx) => siteView(ctx)],
  [/^r\/(slides|programmes|events|agenda|members|partners|member-categories)(?:\/(new|\d+))?$/, 'site', (m) => resourceView(m[1], m[2])],
  [/^content(?:\/([\w-]+)\/([\w-]+))?$/, 'site', (m, ctx) => textView(m[1], m[2], ctx)],
  [/^settings(?:\/([\w-]+))?$/, 'site', (m, ctx) => settingsView(m[1], ctx)],
  [/^media$/, 'media', () => mediaView()],
  [/^publish$/, 'publish', (_m, ctx) => publishView(ctx)],
  [/^applications(?:\/(\d+))?$/, 'applications', (m, ctx) => applicationsView(m[1], ctx)],
  [/^messages$/, 'applications', (_m, ctx) => messagesView(ctx)],
  [/^account$/, 'account', (_m, ctx) => accountView(ctx)],
  [/^users$/, 'account', () => usersView()],
  [/^audit$/, 'account', () => auditView()],
];

const navLinks = (cls) => NAV.filter((n) => !n.perm || can(n.perm)).map((n) => h('a', { href: n.href, class: cls, 'data-nav': n.id },
  icon(n.icon), h('span', null, n.label), h('span', { class: 'dot', 'data-dot': n.id, hidden: true })));

const brand = () => h('a', { href: '#/', class: 'brand' }, h('img', { src: '/assets/logo/logo-pnrd.jpeg', alt: '', width: '40', height: '40' }),
  h('span', null, h('strong', null, 'PNRD'), h('small', null, 'Gestion du site')));

function layout() {
  const main = h('main', { id: 'main', tabindex: '-1' });
  const strip = h('div', { id: 'strip', class: 'strip', hidden: true },
    h('p', null, icon('clock'), h('span', null, 'Des changements ne sont pas encore sur le site.')),
    h('div', { class: 'strip-actions' },
      h('a', { class: 'btn btn--small', href: '/apercu/', target: '_blank', rel: 'noopener noreferrer' }, 'Voir l’aperçu'),
      can('publier') && h('a', { class: 'btn btn--small btn--gold', href: '#/publish' }, 'Publier')));
  const account = (cls) => h('a', { href: '#/account', class: cls, 'data-nav': 'account', title: me.full_name }, icon('user'), h('span', null, 'Mon compte'));
  clear(app).append(
    h('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); main.focus(); } }, 'Aller au contenu'),
    h('header', { class: 'topbar' }, brand(), account('topbar-account')),
    h('div', { class: 'shell' },
      h('aside', { class: 'sidebar' }, brand(),
        h('nav', { 'aria-label': 'Navigation principale' }, navLinks('nav-link')),
        h('div', { class: 'sidebar-foot' }, account('nav-link'))),
      h('div', { class: 'page' }, strip, main)),
    h('nav', { class: 'tabbar', 'aria-label': 'Navigation principale' }, navLinks('tab-link')));
  return main;
}

export async function logout() {
  try { await post('/auth/logout'); } catch { /* deja deconnecte */ }
  dirty.on = false;
  me = null;
  location.hash = '#/';
  show();
}

let current = '';
async function refreshStatus() {
  if (!me || !can('contenu.lire')) return;
  try {
    const st = await get('/publish/status');
    const pending = !st.upToDate;
    const strip = document.getElementById('strip');
    if (strip) strip.hidden = !pending || current === 'publish' || current === 'home';
    for (const d of document.querySelectorAll('[data-dot="publish"]')) { d.hidden = !pending; d.setAttribute('title', 'Changements à publier'); }
  } catch { /* l'indicateur n'est pas essentiel */ }
}

async function route() {
  const main = document.getElementById('main');
  if (!main) return;
  dirty.on = false;
  const hash = location.hash.replace(/^#\/?/, '');
  const found = ROUTES.map(([re, id, fn]) => [re.exec(hash), id, fn]).find(([m]) => m);
  current = found ? found[1] : '';
  for (const a of document.querySelectorAll('[data-nav]')) {
    const on = a.dataset.nav === current;
    a.classList.toggle('is-current', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  clear(main).append(h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Chargement…'));
  try {
    const node = found ? await found[2](found[0], { me, can, logout }) : h('p', null, 'Cette page n’existe pas.');
    if (location.hash.replace(/^#\/?/, '') !== hash) return;          // on a change de page entre-temps
    clear(main).append(node);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return;
    clear(main).append(h('div', { class: 'notice notice--error' }, e instanceof ApiError && e.status === 403 ? 'Votre compte ne permet pas d’ouvrir cette page.' : e.message),
      h('p', null, h('button', { type: 'button', class: 'btn', onclick: route }, 'Réessayer')));
  }
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
  refreshStatus();
}

async function show() {
  try { me = await get('/auth/me'); } catch { me = null; }
  if (!me) {
    clear(app).append(loginView(async () => { await show(); }));
    return;
  }
  layout();
  await route();
}

// Quitter un formulaire modifie : on demande d'abord
document.addEventListener('click', async (e) => {
  const link = e.target.closest?.('a[href^="#/"]');
  if (!link || !dirty.on) return;
  e.preventDefault();
  if (await ask({ title: 'Quitter sans enregistrer ?', text: 'Vos changements sur cette page seront perdus.', yes: 'Quitter la page', no: 'Rester ici', danger: true })) {
    dirty.on = false;
    location.hash = link.getAttribute('href');
  }
}, true);
window.addEventListener('beforeunload', (e) => { if (dirty.on) e.preventDefault(); });
window.addEventListener('unhandledrejection', (e) => {            // erreur d'un bouton : message clair plutot que rien
  if (e.reason instanceof ApiError && e.reason.status === 401) return;
  toast(e.reason?.message || 'Une erreur est survenue', 'error');
});
window.addEventListener('hashchange', () => { if (me) route(); });
window.addEventListener('content-changed', refreshStatus);
window.addEventListener('session-expired', () => { if (me) { me = null; dirty.on = false; toast('Vous avez été déconnecté. Reconnectez-vous.', 'error'); show(); } });
show();
