// Comptes et historique des actions (administrateur)
import { h, clear, toast, field, back, pageHead, ask, fmtDate } from './dom.js';
import { icon } from './icons.js';
import { get, post, patch } from './api.js';
import { ACTIONS, ENTITIES } from './labels.js';

const ROLES = { admin: 'Administrateur', editeur: 'Éditeur du contenu', secretariat: 'Secrétariat des adhésions' };
const ROLE_HELP = { admin: 'peut tout faire', editeur: 'modifie et publie le site', secretariat: 'traite les adhésions et les messages' };

function newPassword(user) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false' });
    const f = field('Nouveau mot de passe', input, { help: '10 caractères minimum. Transmettez-le à la personne, de préférence de vive voix.' });
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const dlg = h('dialog', { class: 'dialog dialog--small' }, h('form', { onsubmit: (e) => {
      e.preventDefault();
      if (input.value.length < 10) return f.setError('Au moins 10 caractères.');
      done(input.value);
    } }, h('h2', null, `Mot de passe de ${user.full_name}`), f,
    h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => done(null) }, 'Annuler'), h('button', { type: 'submit', class: 'btn btn--primary' }, 'Changer le mot de passe'))));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export async function usersView() {
  const [users, roles] = await Promise.all([get('/users'), get('/roles')]);
  const holder = h('div');
  const draw = (list) => clear(holder).append(h('ul', { class: 'rows' }, list.map((u) => h('li', { class: `row row--static${u.active ? '' : ' is-off'}` },
    h('span', { class: 'avatar', 'aria-hidden': 'true' }, u.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()),
    h('span', { class: 'row-body' }, h('strong', null, u.full_name, !u.active && h('span', { class: 'badge' }, 'Désactivé')),
      h('span', null, `${ROLES[u.role] || u.role} · ${u.email}`), h('span', null, u.last_login_at ? `Dernière connexion : ${fmtDate(u.last_login_at)}` : 'Jamais connecté')),
    h('span', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
        const pw = await newPassword(u);
        if (!pw) return;
        await patch(`/users/${u.id}`, { password: pw });
        toast('Mot de passe changé');
      } }, 'Mot de passe'),
      h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
        if (u.active && !(await ask({ title: `Désactiver le compte de ${u.full_name} ?`, text: 'Cette personne ne pourra plus se connecter. Vous pourrez réactiver le compte.', yes: 'Désactiver', danger: true }))) return;
        await patch(`/users/${u.id}`, { active: !u.active });
        u.active = !u.active;
        toast(u.active ? 'Compte réactivé' : 'Compte désactivé');
        draw(list);
      } }, u.active ? 'Désactiver' : 'Réactiver'))))));
  draw(users);

  const name = h('input', { type: 'text', required: true, autocomplete: 'off' });
  const email = h('input', { type: 'email', required: true, autocomplete: 'off' });
  const pass = h('input', { type: 'text', minlength: '10', required: true, autocomplete: 'off', spellcheck: 'false' });
  const role = h('select', null, roles.map((r) => h('option', { value: r.code, selected: r.code === 'editeur' }, `${ROLES[r.code] || r.label} : ${ROLE_HELP[r.code] || ''}`)));
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    await post('/users', { full_name: name.value, email: email.value, password: pass.value, role: role.value });
    toast('Compte créé');
    form.reset();
    draw(await get('/users'));
  } }, field('Nom complet', name, { required: true }), field('Adresse e-mail', email, { required: true }),
  field('Mot de passe de départ', pass, { required: true, help: '10 caractères minimum.' }), field('Ce que la personne peut faire', role),
  h('button', { type: 'submit', class: 'btn btn--primary' }, 'Créer le compte'));

  return h('div', null, back('#/', 'Tableau de bord'), pageHead('Comptes', 'Les personnes qui peuvent se connecter à la console.'), holder,
    h('details', { class: 'card more' }, h('summary', null, icon('userPlus'), 'Ajouter un compte'), form));
}

export async function auditView() {
  const rows = await get('/audit?limit=100');
  return h('div', null, back('#/', 'Tableau de bord'), pageHead('Historique des actions', 'Les 100 dernières actions.'),
    h('ul', { class: 'rows' }, rows.map((r) => h('li', { class: 'row row--static' }, h('span', { class: 'row-body' },
      h('strong', null, `${r.user_name || 'Un visiteur'} ${ACTIONS[r.action] || r.action} ${ENTITIES[r.entity] ?? r.entity}`.trim()),
      h('span', null, fmtDate(r.created_at)))))));
}
