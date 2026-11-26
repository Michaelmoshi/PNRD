// Connexion, demandes d'adhésion et messages
import { h, clear, toast, field, back, pageHead, empty, fmtDate, dirty } from './dom.js';
import { icon } from './icons.js';
import { get, post, patch } from './api.js';

export const STATUS = { recue: 'Nouvelle', en_etude: 'En étude', acceptee: 'Acceptée', declinee: 'Refusée' };
export const statusBadge = (s) => h('span', { class: `badge badge--${s}` }, STATUS[s] || s);

// ------------------------------------------------------------ connexion
export function loginView(onSuccess) {
  const error = h('p', { class: 'form-error', role: 'alert' });
  const email = h('input', { type: 'email', required: true, id: 'l-email', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none' });
  const password = h('input', { type: 'password', required: true, id: 'l-pass', autocomplete: 'current-password' });
  const reveal = h('button', { type: 'button', class: 'reveal', 'aria-pressed': 'false', 'aria-label': 'Afficher le mot de passe', onclick: () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    reveal.setAttribute('aria-pressed', String(show));
    reveal.replaceChildren(icon(show ? 'eyeOff' : 'eye'));
  } }, icon('eye'));
  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--large btn--block' }, 'Se connecter');
  const form = h('form', { class: 'login-form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    error.textContent = '';
    if (!email.value.trim() || !password.value) { error.textContent = 'Saisissez votre adresse e-mail et votre mot de passe.'; return; }
    submit.disabled = true;
    submit.textContent = 'Connexion…';
    try {
      await post('/auth/login', { email: email.value.trim(), password: password.value });
      await onSuccess();
    } catch (err) {
      error.textContent = err.message;
      password.value = '';
      password.focus();
      submit.disabled = false;
      submit.textContent = 'Se connecter';
    }
  } },
    h('h2', null, 'Connexion'),
    h('div', { class: 'field' }, h('label', { for: 'l-email' }, 'Adresse e-mail'), email),
    h('div', { class: 'field' }, h('label', { for: 'l-pass' }, 'Mot de passe'), h('div', { class: 'with-button' }, password, reveal)),
    error, submit,
    h('p', { class: 'help' }, 'Mot de passe oublié ? Demandez à l’administrateur de vous en donner un nouveau.'));
  return h('main', { class: 'login' }, h('div', { class: 'login-box' },
    h('div', { class: 'login-side' },
      h('img', { src: '/assets/logo/logo-pnrd.jpeg', alt: 'Logo du PNRD', width: '88', height: '88' }),
      h('h1', null, 'Le site du PNRD, à jour en quelques gestes.'),
      h('p', null, 'Événements, photos, équipe et demandes d’adhésion au même endroit.')),
    form));
}

// ------------------------------------------------------------ onglets Demandes / Messages
const sections = (can, current) => can('messages.lire') && h('nav', { class: 'segmented', 'aria-label': 'Boîte de réception' },
  h('a', { href: '#/applications', 'aria-current': current === 'applications' ? 'page' : false }, 'Demandes d’adhésion'),
  h('a', { href: '#/messages', 'aria-current': current === 'messages' ? 'page' : false }, 'Messages'));

// ------------------------------------------------------------ demandes
export async function applicationsView(id, { can }) {
  return id ? applicationDetail(id, can) : applicationList(can);
}

async function applicationList(can) {
  const all = await get('/applications');
  const holder = h('div');
  const draw = (status) => {
    const rows = status ? all.filter((r) => r.status === status) : all;
    clear(holder).append(rows.length
      ? h('ul', { class: 'rows' }, rows.map((r) => h('li', null, h('a', { class: 'row', href: `#/applications/${r.id}` },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, `${r.prenom[0] || ''}${r.nom[0] || ''}`.toUpperCase()),
        h('span', { class: 'row-body' }, h('strong', null, `${r.prenom} ${r.nom}`), h('span', null, [r.ville, fmtDate(r.created_at)].filter(Boolean).join(' · '))),
        statusBadge(r.status), icon('right')))))
      : empty('users', 'Aucune demande ici', all.length ? 'Choisissez une autre étape.' : 'Les demandes envoyées depuis le site apparaîtront ici.'));
  };
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrer par étape' });
  for (const [value, label] of [['', 'Toutes'], ...Object.entries(STATUS)]) {
    const n = value ? all.filter((r) => r.status === value).length : all.length;
    const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(value === ''), onclick: () => {
      for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b));
      draw(value);
    } }, label, h('span', { class: 'chip-count' }, n));
    chips.append(b);
  }
  draw('');
  return h('div', null, pageHead('Adhésions', 'Les personnes qui veulent rejoindre le parti.'), sections(can, 'applications'), chips, holder);
}

async function applicationDetail(id, can) {
  const [a, staff] = await Promise.all([get(`/applications/${id}`), get('/staff')]);
  const write = can('adhesions.ecrire');
  const name = [a.prenom, a.postnom, a.nom].filter(Boolean).join(' ');
  const info = (label, value) => value && h('div', { class: 'kv' }, h('dt', null, label), h('dd', null, value));
  const digits = a.telephone.replace(/[^\d]/g, '');

  const badge = h('span', null, statusBadge(a.status));
  const steps = h('div', { class: 'steps', role: 'group', 'aria-label': 'Étape de la demande' }, Object.entries(STATUS).map(([v, l]) => h('button', {
    type: 'button', class: `step step--${v}`, 'aria-pressed': String(v === a.status), disabled: !write, onclick: async (e) => {
      const btn = e.currentTarget;
      await patch(`/applications/${id}`, { status: v });
      for (const s of steps.children) s.setAttribute('aria-pressed', String(s === btn));
      badge.replaceChildren(statusBadge(v));
      toast(`Demande marquée « ${l} »`);
    } }, l)));
  const assigned = h('select', { disabled: !write, onchange: async () => {
    await patch(`/applications/${id}`, { assigned_to: assigned.value ? Number(assigned.value) : null });
    toast('Responsable enregistré');
  } }, h('option', { value: '' }, 'Personne pour le moment'), staff.map((s) => h('option', { value: s.id, selected: s.id === a.assigned_to }, s.full_name)));

  const notes = h('ul', { class: 'notes' });
  const noteItem = (n, author) => h('li', null, h('p', null, n.note), h('small', null, `${author} · ${fmtDate(n.created_at)}`));
  notes.append(...a.notes.map((n) => noteItem(n, n.author || 'Compte supprimé')));
  const note = h('textarea', { rows: '3', oninput: () => { dirty.on = !!note.value.trim(); } });

  return h('div', null, back('#/applications', 'Toutes les demandes'),
    h('header', { class: 'page-head' }, h('div', null, h('h1', null, name), h('p', { class: 'intro' }, badge, ` Reçue le ${fmtDate(a.created_at)}`))),
    h('div', { class: 'contact-actions' },
      h('a', { class: 'btn btn--primary', href: `tel:${a.telephone}` }, icon('phone'), 'Appeler'),
      digits.length >= 9 && h('a', { class: 'btn', href: `https://wa.me/${digits}`, target: '_blank', rel: 'noopener noreferrer' }, icon('chat'), 'WhatsApp'),
      h('a', { class: 'btn', href: `mailto:${a.email}` }, icon('mail'), 'Écrire un e-mail')),
    h('section', { class: 'card' }, h('h2', null, 'Où en est la demande ?'), steps, field('Qui s’en occupe ?', assigned)),
    h('section', { class: 'card' }, h('h2', null, 'Ce que la personne a indiqué'), h('dl', null,
      info('Téléphone', a.telephone), info('E-mail', a.email), info('Sexe', a.sexe), info('Pièce d’identité', a.piece), info('Profession', a.profession),
      info('Ville', a.ville), info('Adresse', a.adresse), info('Accord donné le', fmtDate(a.consent_at)))),
    h('section', { class: 'card' }, h('h2', null, 'Notes de l’équipe'), notes,
      write && [field('Ajouter une note', note, { help: 'Visible seulement dans la console.' }),
        h('button', { type: 'button', class: 'btn', onclick: async () => {
          if (!note.value.trim()) return note.focus();
          const n = await post(`/applications/${id}/notes`, { note: note.value });
          notes.append(noteItem(n, 'Vous'));
          note.value = '';
          dirty.on = false;
          toast('Note ajoutée');
        } }, 'Ajouter la note')]));
}

// ------------------------------------------------------------ messages
export async function messagesView({ can }) {
  const rows = await get('/messages');
  return h('div', null, pageHead('Messages', 'Les messages envoyés au parti.'), sections((p) => can(p) && can('adhesions.lire'), 'messages'),
    rows.length ? rows.map((m) => {
      const card = h('article', { class: `card message${m.handled ? ' is-done' : ''}` });
      const btn = h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
        m.handled = !m.handled;
        await patch(`/messages/${m.id}`, { handled: m.handled });
        card.classList.toggle('is-done', m.handled);
        btn.textContent = m.handled ? 'Remettre à traiter' : 'Marquer comme traité';
      } }, m.handled ? 'Remettre à traiter' : 'Marquer comme traité');
      card.append(h('header', null, h('strong', null, m.name), h('time', null, fmtDate(m.created_at))),
        h('p', { class: 'pre' }, m.message),
        h('div', { class: 'actions' }, h('a', { class: 'btn btn--small', href: `mailto:${m.email}` }, icon('mail'), 'Répondre'), btn));
      return card;
    }) : empty('mail', 'Aucun message', 'Les messages reçus apparaîtront ici.'));
}
