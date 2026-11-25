// Publication du site : état, bouton « Publier », aperçu et historique des versions
import { h, clear, toast, fmtDate } from './dom.js';
import { get, post } from './api.js';

export async function publishView({ can }) {
  const root = h('div');
  const draw = async () => {
    const [st, history] = await Promise.all([get('/publish/status'), get('/publish/history')]);
    const canPublish = can('publier');
    const note = h('input', { id: 'p-note', type: 'text', maxlength: '300', placeholder: 'Ex. : nouveau programme, photos de l’équipe…' });

    const state = !st.published
      ? h('div', { class: 'notice' }, 'Le site n’a jamais été publié depuis la console.')
      : st.upToDate
        ? h('div', { class: 'notice notice--ok' }, `Le site en ligne est à jour (version ${st.live.id}, publiée le ${fmtDate(st.live.created_at)}${st.live.user_name ? ` par ${st.live.user_name}` : ''}).`)
        : h('div', { class: 'notice' }, 'Des modifications ne sont pas encore en ligne. Vérifiez l’aperçu, puis publiez.');

    const publishBtn = h('button', { type: 'button', class: 'btn btn--primary', disabled: st.upToDate, onclick: async (e) => {
      e.currentTarget.disabled = true;
      const r = await post('/publish', { note: note.value });
      toast(r.unchanged ? 'Rien de nouveau à publier' : `Site publié (version ${r.id})`);
      await draw();
    } }, 'Publier le site');

    clear(root).append(
      h('h1', null, 'Publication du site'),
      h('p', { class: 'muted' }, 'Les modifications faites dans la console n’apparaissent sur le site qu’après publication. Chaque publication est conservée : on peut revenir à une version précédente.'),
      state,
      h('div', { class: 'card' },
        h('h2', null, 'Publier'),
        h('p', null, h('a', { href: '/apercu/', target: '_blank', rel: 'noopener noreferrer' }, 'Voir l’aperçu des modifications (nouvel onglet)'),
          st.published && [' · ', h('a', { href: '/', target: '_blank', rel: 'noopener noreferrer' }, 'Voir le site actuellement en ligne')]),
        canPublish
          ? [h('label', { for: 'p-note' }, 'Note (facultative) : qu’est-ce qui a changé ?'), note, h('div', { class: 'form-actions' }, publishBtn)]
          : h('p', { class: 'muted' }, 'Votre rôle ne permet pas de publier.')),
      h('h2', null, 'Historique des versions'),
      history.length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, ['Version', 'Date', 'Par', 'Note', 'État', ''].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', null, history.map((v) => h('tr', null,
            h('td', null, `#${v.id}`), h('td', null, fmtDate(v.created_at)), h('td', null, v.user_name || '—'), h('td', null, v.note || '—'),
            h('td', null, v.live ? h('span', { class: 'badge badge--acceptee' }, 'En ligne') : v.purged ? h('span', { class: 'badge' }, 'Supprimée') : h('span', { class: 'badge badge--en_etude' }, 'Ancienne')),
            h('td', null, canPublish && !v.live && !v.purged && h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
              if (!confirm(`Remettre en ligne la version ${v.id} ? Le contenu de la console n’est pas modifié : seul le site en ligne change.`)) return;
              await post(`/publish/${v.id}/restore`);
              toast(`Version ${v.id} remise en ligne`);
              await draw();
            } }, 'Revenir à cette version')))))))
        : h('p', { class: 'muted' }, 'Aucune publication pour le moment.'),
      h('p', { class: 'muted' }, 'Les 10 dernières versions sont conservées.'));
  };
  await draw();
  return root;
}
