// Publication du site : état, bouton « Publier », aperçu et versions précédentes
import { h, clear, toast, field, pageHead, ask, empty, fmtDate } from './dom.js';
import { icon } from './icons.js';
import { get, post } from './api.js';

export async function publishView({ can }) {
  const root = h('div');
  const draw = async () => {
    const [st, history] = await Promise.all([get('/publish/status'), get('/publish/history')]);
    const canPublish = can('publier');
    const note = h('input', { type: 'text', maxlength: '300', placeholder: 'Ex. : nouvel événement, photos de l’équipe' });

    const publishBtn = h('button', { type: 'button', class: 'btn btn--primary btn--large', onclick: async () => {
      publishBtn.disabled = true;
      publishBtn.textContent = 'Publication en cours…';
      try {
        const r = await post('/publish', { note: note.value });
        toast(r.unchanged ? 'Rien de nouveau à publier' : 'C’est publié ! Votre site est à jour.');
      } finally { await draw(); }
    } }, icon('publish'), 'Publier le site');

    clear(root).append(pageHead('Publier', 'Vos changements restent privés tant que vous n’avez pas publié.'),
      st.upToDate
        ? h('section', { class: 'hero-status is-ok' }, h('span', { class: 'hero-icon' }, icon('check')),
          h('div', null, h('h2', null, 'Votre site est à jour'), h('p', null, `Publié le ${fmtDate(st.live.created_at)}${st.live.user_name ? ` par ${st.live.user_name}` : ''}.`)),
          h('div', { class: 'hero-actions' }, h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Voir le site')))
        : h('ol', { class: 'flow' },
          h('li', null, h('div', null, h('h2', null, 'Vérifiez l’aperçu'), h('p', null, 'Le site tel qu’il sera après publication. Personne d’autre ne le voit.'),
            h('a', { class: 'btn', href: '/apercu/', target: '_blank', rel: 'noopener noreferrer' }, icon('eye'), 'Voir l’aperçu'))),
          h('li', null, h('div', null, h('h2', null, 'Publiez'),
            canPublish
              ? [field('Qu’est-ce qui a changé ? (facultatif)', note), publishBtn]
              : h('p', null, 'Votre compte ne permet pas de publier. Demandez à un éditeur ou à l’administrateur.')))),
      h('h2', null, 'Publications précédentes'),
      history.length
        ? h('ul', { class: 'rows' }, history.map((v) => h('li', { class: 'row row--static' },
          h('span', { class: 'row-body' }, h('strong', null, v.note || `Publication n° ${v.id}`), h('span', null, `${fmtDate(v.created_at)}${v.user_name ? ` · ${v.user_name}` : ''}`)),
          v.live ? h('span', { class: 'badge badge--acceptee' }, 'En ligne')
            : v.purged ? h('span', { class: 'badge' }, 'Trop ancienne')
              : canPublish && h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
                if (!(await ask({ title: 'Remettre cette version en ligne ?', text: 'Le site redeviendra comme à cette date. Vos textes et listes dans la console ne changent pas.', yes: 'Remettre en ligne' }))) return;
                await post(`/publish/${v.id}/restore`);
                toast('Ancienne version remise en ligne');
                await draw();
              } }, 'Remettre en ligne'))))
        : empty('publish', 'Pas encore de publication', 'La première apparaîtra ici.'),
      h('p', { class: 'help' }, 'Les 10 dernières publications sont conservées.'));
  };
  await draw();
  return root;
}
