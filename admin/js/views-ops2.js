// Adhésions, messages, utilisateurs, journal d'activité
import { h, fmtDate, toast, clear } from './dom.js';
import { get, post, patch } from './api.js';
import { STATUS, ACTIONS, statusBadge } from './views-ops.js';

const th = (...t) => h('thead', null, h('tr', null, t.map((x) => h('th', { scope: 'col' }, x))));

// ------------------------------------------------------------ adhésions
export async function applicationsView(id) {
  return id ? applicationDetail(id) : applicationList();
}

async function applicationList() {
  const root = h('div', null, h('h1', null, 'Demandes d’adhésion'));
  const holder = h('div');
  let current = '';
  const tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Filtrer par étape' });
  const load = async () => {
    const rows = await get('/applications' + (current ? `?status=${current}` : ''));
    clear(holder).append(rows.length
      ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, th('Candidat', 'Contact', 'Ville', 'Étape', 'Responsable', 'Reçue le'),
        h('tbody', null, rows.map((r) => h('tr', null,
          h('td', null, h('a', { href: `#/applications/${r.id}` }, `${r.prenom} ${r.nom}`)), h('td', null, r.telephone), h('td', null, r.ville || '—'),
          h('td', null, statusBadge(r.status)), h('td', null, r.assigned_name || '—'), h('td', null, fmtDate(r.created_at)))))))
      : h('p', { class: 'muted' }, 'Aucune demande dans cette étape.'));
  };
  for (const [value, label] of [['', 'Toutes'], ...Object.entries(STATUS)]) {
    const b = h('button', { type: 'button', class: 'tab', 'aria-pressed': String(value === current), onclick: async () => {
      current = value;
      for (const t of tabs.children) t.setAttribute('aria-pressed', String(t === b));
      await load();
    } }, label);
    tabs.append(b);
  }
  root.append(tabs, holder);
  await load();
  return root;
}

async function applicationDetail(id) {
  const [a, staff] = await Promise.all([get(`/applications/${id}`), get('/staff')]);
  const field = (label, value) => h('div', { class: 'kv' }, h('dt', null, label), h('dd', null, value || '—'));
  const status = h('select', { id: 'a-status' }, Object.entries(STATUS).map(([v, l]) => h('option', { value: v, selected: v === a.status }, l)));
  const assigned = h('select', { id: 'a-assigned' }, h('option', { value: '' }, 'Non assignée'),
    staff.map((s) => h('option', { value: s.id, selected: s.id === a.assigned_to }, s.full_name)));
  const notes = h('ul', { class: 'notes' });
  const renderNotes = (list) => clear(notes).append(...list.map((n) => h('li', null, h('p', null, n.note), h('small', null, `${n.author || 'Inconnu'} · ${fmtDate(n.created_at)}`))));
  renderNotes(a.notes);
  const noteInput = h('textarea', { id: 'a-note', rows: '3', placeholder: 'Ajouter une note interne…' });

  return h('div', null,
    h('p', null, h('a', { href: '#/applications' }, '← Toutes les demandes')),
    h('h1', null, `${a.prenom} ${a.postnom} ${a.nom}`.replace(/\s+/g, ' ')),
    h('div', { class: 'two-col' },
      h('section', { class: 'card' }, h('h2', null, 'Informations'),
        h('dl', null, field('Téléphone', a.telephone), field('E-mail', a.email), field('Sexe', a.sexe), field('Pièce d’identité', a.piece),
          field('Profession', a.profession), field('Ville', a.ville), field('Adresse', a.adresse), field('Reçue le', fmtDate(a.created_at)), field('Consentement donné le', fmtDate(a.consent_at)))),
      h('section', { class: 'card' }, h('h2', null, 'Traitement'),
        h('label', { for: 'a-status' }, 'Étape'), status,
        h('label', { for: 'a-assigned' }, 'Responsable'), assigned,
        h('button', { type: 'button', class: 'btn btn--primary', onclick: async () => {
          await patch(`/applications/${id}`, { status: status.value, assigned_to: assigned.value ? Number(assigned.value) : null });
          toast('Demande mise à jour');
        } }, 'Enregistrer'))),
    h('section', { class: 'card' }, h('h2', null, 'Notes internes'), notes,
      h('label', { for: 'a-note', class: 'sr-only' }, 'Nouvelle note'), noteInput,
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        if (!noteInput.value.trim()) return;
        const n = await post(`/applications/${id}/notes`, { note: noteInput.value });
        const li = h('li', null, h('p', null, n.note), h('small', null, `Vous · ${fmtDate(n.created_at)}`));
        notes.append(li);
        noteInput.value = '';
        toast('Note ajoutée');
      } }, 'Ajouter la note')));
}

// ------------------------------------------------------------ messages
export async function messagesView() {
  const rows = await get('/messages');
  return h('div', null, h('h1', null, 'Messages reçus'),
    rows.length ? rows.map((m) => {
      const card = h('article', { class: `card message${m.handled ? ' is-done' : ''}` },
        h('header', null, h('strong', null, m.name), ' ', h('a', { href: `mailto:${m.email}` }, m.email), h('time', null, fmtDate(m.created_at))),
        h('p', { class: 'pre' }, m.message),
        h('button', { type: 'button', class: 'btn', onclick: async (e) => {
          const done = !card.classList.contains('is-done');
          await patch(`/messages/${m.id}`, { handled: done });
          card.classList.toggle('is-done', done);
          e.currentTarget.textContent = done ? 'Marquer à traiter' : 'Marquer traité';
        } }, m.handled ? 'Marquer à traiter' : 'Marquer traité'));
      return card;
    }) : h('p', { class: 'muted' }, 'Aucun message.'));
}

// ------------------------------------------------------------ utilisateurs
export async function usersView() {
  const [users, roles] = await Promise.all([get('/users'), get('/roles')]);
  const holder = h('div');
  const draw = (list) => clear(holder).append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, th('Nom', 'E-mail', 'Rôle', 'Dernière connexion', 'Actions'),
    h('tbody', null, list.map((u) => h('tr', null, h('td', null, u.full_name), h('td', null, u.email), h('td', null, u.role),
      h('td', null, fmtDate(u.last_login_at)),
      h('td', { class: 'actions' },
        h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
          await patch(`/users/${u.id}`, { active: !u.active });
          u.active = !u.active;
          toast(u.active ? 'Compte réactivé' : 'Compte désactivé');
          draw(list);
        } }, u.active ? 'Désactiver' : 'Réactiver'),
        h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
          const pw = prompt(`Nouveau mot de passe pour ${u.full_name} (10 caractères minimum) :`);
          if (!pw) return;
          await patch(`/users/${u.id}`, { password: pw });
          toast('Mot de passe changé');
        } }, 'Nouveau mot de passe'))))))));
  draw(users);

  const f = { name: h('input', { id: 'u-name', required: true }), email: h('input', { id: 'u-email', type: 'email', required: true }),
    pass: h('input', { id: 'u-pass', type: 'password', minlength: '10', required: true, autocomplete: 'new-password' }),
    role: h('select', { id: 'u-role' }, roles.map((r) => h('option', { value: r.code }, r.label))) };
  const form = h('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault();
    await post('/users', { full_name: f.name.value, email: f.email.value, password: f.pass.value, role: f.role.value });
    toast('Compte créé');
    form.reset();
    draw(await get('/users'));
  } }, h('h2', null, 'Nouveau compte'),
    h('label', { for: 'u-name' }, 'Nom complet'), f.name, h('label', { for: 'u-email' }, 'Adresse e-mail'), f.email,
    h('label', { for: 'u-pass' }, 'Mot de passe (10 caractères minimum)'), f.pass, h('label', { for: 'u-role' }, 'Rôle'), f.role,
    h('button', { type: 'submit', class: 'btn btn--primary' }, 'Créer le compte'));
  return h('div', null, h('h1', null, 'Utilisateurs'), holder, form);
}

// ------------------------------------------------------------ journal
export async function auditView() {
  const rows = await get('/audit?limit=200');
  return h('div', null, h('h1', null, 'Journal d’activité'), h('p', { class: 'muted' }, 'Les 200 dernières actions.'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, th('Date', 'Personne', 'Action', 'Sur', 'Adresse IP'),
      h('tbody', null, rows.map((r) => h('tr', null, h('td', null, fmtDate(r.created_at)), h('td', null, r.user_name || '—'),
        h('td', null, ACTIONS[r.action] || r.action), h('td', null, r.entity + (r.entity_id ? ` #${r.entity_id}` : '')), h('td', null, r.ip || '—')))))));
}
