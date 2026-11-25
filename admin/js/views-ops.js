// Connexion et tableau de bord
import { h, fmtDate } from './dom.js';
import { get, post } from './api.js';

export const STATUS = { recue: 'Reçue', en_etude: 'En étude', acceptee: 'Acceptée', declinee: 'Déclinée' };
export const ACTIONS = { creer: 'Création', modifier: 'Modification', supprimer: 'Suppression', connexion: 'Connexion', deconnexion: 'Déconnexion',
  connexion_echec: 'Connexion refusée', consulter: 'Consultation', noter: 'Note ajoutée', envoyer: 'Envoi' };
export const statusBadge = (s) => h('span', { class: `badge badge--${s}` }, STATUS[s] || s);

export function loginView(onSuccess) {
  const error = h('p', { class: 'form-error', role: 'alert' });
  const email = h('input', { id: 'l-email', type: 'email', required: true, autocomplete: 'username', autofocus: true });
  const password = h('input', { id: 'l-pass', type: 'password', required: true, autocomplete: 'current-password' });
  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Se connecter');
  const form = h('form', { class: 'login-card', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    try {
      await post('/auth/login', { email: email.value.trim(), password: password.value });
      await onSuccess();
    } catch (err) {
      error.textContent = err.message;
      password.value = '';
      password.focus();
    } finally { submit.disabled = false; }
  } },
    h('h1', null, 'Console PNRD'),
    h('p', { class: 'muted' }, 'Connectez-vous pour gérer le site.'),
    h('label', { for: 'l-email' }, 'Adresse e-mail'), email,
    h('label', { for: 'l-pass' }, 'Mot de passe'), password,
    error, submit);
  return h('main', { class: 'login' }, form);
}

function stat(label, value, href) {
  return h('a', { class: 'stat-card', href }, h('strong', null, value ?? 0), h('span', null, label));
}

export async function dashboardView() {
  const d = await get('/dashboard');
  const root = h('div', null, h('h1', null, `Bonjour ${d.user.full_name.split(' ')[0]}`),
    h('p', { class: 'muted' }, 'Voici l’état du site et des demandes.'));

  if (d.publication) {
    const p = d.publication;
    root.append(h('a', { class: `publish-banner${p.upToDate ? ' is-ok' : ''}`, href: '#/publish' },
      !p.published ? 'Le site n’a pas encore été publié depuis la console. Publier le site →'
        : p.upToDate ? 'Le site en ligne est à jour.' : 'Des modifications ne sont pas encore en ligne. Aperçu et publication →'));
  }
  if (d.applications) {
    const a = d.applications;
    root.append(h('section', null, h('h2', null, 'Demandes d’adhésion'),
      h('div', { class: 'stat-grid' },
        stat('Nouvelles', a.recue, '#/applications'), stat('En étude', a.en_etude, '#/applications'),
        stat('Acceptées', a.acceptee, '#/applications'), stat('Déclinées', a.declinee, '#/applications'),
        d.messagesToHandle !== undefined && stat('Messages à traiter', d.messagesToHandle, '#/messages')),
      d.recentApplications.length
        ? h('table', { class: 'table' }, h('thead', null, h('tr', null, ['Candidat', 'Étape', 'Reçue le'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', null, d.recentApplications.map((r) => h('tr', null,
            h('td', null, h('a', { href: `#/applications/${r.id}` }, `${r.prenom} ${r.nom}`)), h('td', null, statusBadge(r.status)), h('td', null, fmtDate(r.created_at))))))
        : h('p', { class: 'muted' }, 'Aucune demande pour le moment.')));
  }
  if (d.content) {
    const c = d.content;
    root.append(h('section', null, h('h2', null, 'Contenu du site'),
      h('div', { class: 'stat-grid' }, stat('Programmes', c.programmes, '#/r/programmes'), stat('Événements', c.events, '#/r/events'),
        stat('Membres', c.members, '#/r/members'), stat('Partenaires', c.partners, '#/r/partners'), stat('Images', c.media, '#/media'))));
  }
  if (d.recentActivity) {
    root.append(h('section', null, h('h2', null, 'Activité récente'),
      h('ul', { class: 'activity' }, d.recentActivity.map((r) => h('li', null, h('strong', null, r.user_name || 'Visiteur'), ` : ${ACTIONS[r.action] || r.action} (${r.entity})`, h('time', null, fmtDate(r.created_at))))),
      h('p', null, h('a', { href: '#/audit' }, 'Voir tout le journal'))));
  }
  return root;
}
