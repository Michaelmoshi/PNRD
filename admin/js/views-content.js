// Listes en cartes et formulaires (décrits ci-dessous), réglages et photos
import { h, clear, toast, field, toggle, back, pageHead, empty, ask, uid, dirty, fmtDate, fmtDay, mediaUrl } from './dom.js';
import { calendarView, prefill } from './views-calendar.js';
import { icon } from './icons.js';
import { get, post, patch, put, del, upload } from './api.js';
import { PAGES } from './labels.js';

const PUBLISHED = { key: 'published', label: 'Afficher sur le site', type: 'bool', default: true };
const ORIGINAL_SLIDES = { 'slide--renouveau': 'assets/images/hero/slide-1-renouveau.jpeg', 'slide--jeunesse': 'assets/images/hero/slide-2-jeunesse.jpeg', 'slide--diversite': 'assets/images/hero/slide-3-diversite.jpeg' };

export const RESOURCES = {
  slides: { title: 'Bandeau d’accueil', intro: 'Les images qui défilent en haut de la page d’accueil.', add: 'Ajouter une grande photo', none: 'Aucune grande photo', order: true,
    name: (r) => r.title, meta: (r) => r.subtitle, image: (r) => r.image_id, fallback: (r) => ORIGINAL_SLIDES[r.style], icon: 'photo',
    fields: [{ key: 'image_id', label: 'Photo de fond', type: 'media', fallback: (r) => ORIGINAL_SLIDES[r.style], help: 'Choisissez de préférence une photo horizontale.' },
      { key: 'title', label: 'Grand titre', required: true }, { key: 'subtitle', label: 'Phrase sous le titre' }, { key: 'eyebrow', label: 'Petit texte au-dessus du titre' }, PUBLISHED] },
  programmes: { title: 'Programmes', intro: 'Les projets et réalisations du parti.', add: 'Ajouter un programme', none: 'Aucun programme', order: true,
    name: (r) => r.title, meta: (r) => r.body, col: ['Thème', (r) => r.summary], image: (r) => r.image_id, icon: 'programme',
    fields: [{ key: 'title', label: 'Titre', required: true }, { key: 'summary', label: 'Thème', help: 'Un ou deux mots, par exemple « Social ».' },
      { key: 'body', label: 'Présentation', type: 'textarea' }, { key: 'image_id', label: 'Photo', type: 'media', required: true }, PUBLISHED] },
  agenda: { title: 'Prochains événements', intro: 'Les rendez-vous annoncés sur la page d’accueil.', add: 'Annoncer un événement', none: 'Aucun événement annoncé',
    name: (r) => r.title, meta: (r) => r.description, col: ['Date', (r) => fmtDate(r.starts_at)], icon: 'calendar', calendar: true,
    warn: (r) => new Date(r.starts_at.replace(' ', 'T')) < new Date() && 'Date passée',
    fields: [{ key: 'title', label: 'Nom de l’événement', required: true }, { key: 'starts_at', label: 'Date et heure', type: 'datetime', required: true },
      { key: 'description', label: 'En une phrase', type: 'textarea' }, PUBLISHED] },
  events: { title: 'Événements passés', intro: 'Les vidéos à revoir sur la page d’accueil.', add: 'Ajouter un événement passé', none: 'Aucun événement passé',
    name: (r) => r.title, meta: (r) => r.description, col: ['Date', (r) => fmtDay(r.event_date)], image: (r) => r.poster_id, icon: 'video',
    warn: (r) => !r.video_mp4 && !r.video_webm && 'Sans vidéo : pas affiché sur l’accueil',
    fields: [{ key: 'title', label: 'Nom de l’événement', required: true }, { key: 'event_date', label: 'Date', type: 'date', required: true },
      { key: 'description', label: 'En une phrase', type: 'textarea' },
      { key: 'video_mp4', label: 'Adresse de la vidéo', help: 'Le lien du fichier vidéo (.mp4). Sans vidéo, l’événement n’apparaît pas sur l’accueil.' },
      { key: 'poster_id', label: 'Image d’attente de la vidéo', type: 'media' },
      { key: 'report', label: 'Compte rendu', type: 'lines', help: 'Allez à la ligne pour commencer un nouveau paragraphe.' }, PUBLISHED],
    more: [{ key: 'video_webm', label: 'Seconde adresse de la vidéo (.webm)' }] },
  members: { title: 'Équipe', intro: 'Les personnes présentées sur la page Équipe.', add: 'Ajouter une personne', none: 'Personne pour le moment', order: true, group: 'category_id', round: true,
    name: (r) => r.full_name, meta: (r) => r.function, image: (r) => r.photo_id, icon: 'user',
    extra: { href: '#/r/member-categories', label: 'Gérer les groupes' },
    fields: [{ key: 'full_name', label: 'Prénom et nom', required: true }, { key: 'function', label: 'Rôle dans le parti' },
      { key: 'category_id', label: 'Groupe', type: 'select', from: 'member-categories', required: true }, { key: 'photo_id', label: 'Photo', type: 'media', help: 'Sans photo, les initiales sont affichées.' },
      { key: 'description', label: 'Petite présentation', type: 'textarea' },
      { key: 'featured', label: 'Montrer aussi sur la page d’accueil (équipe dirigeante)', type: 'bool', default: false }, PUBLISHED] },
  'member-categories': { title: 'Groupes de l’équipe', intro: 'Par exemple : la Gouvernance, la Presse.', add: 'Ajouter un groupe', none: 'Aucun groupe', order: true, parent: '#/r/members',
    name: (r) => r.title, icon: 'users', noVisibility: true, fields: [{ key: 'title', label: 'Nom du groupe', required: true }],
    deleteWarning: async (r) => {
      const n = (await get('/members')).filter((m) => m.category_id === Number(r.id)).length;
      return n ? `Attention : les ${n} personne(s) de ce groupe seront aussi supprimées.` : 'Ce groupe est vide.';
    } },
  partners: { title: 'Partenaires', intro: 'Les logos qui défilent sur la page d’accueil.', add: 'Ajouter un partenaire', none: 'Aucun partenaire', order: true, contain: true,
    name: (r) => r.name, meta: (r) => r.url, image: (r) => r.logo_id, icon: 'partner',
    fields: [{ key: 'name', label: 'Nom', required: true }, { key: 'logo_id', label: 'Logo', type: 'media', required: true },
      { key: 'url', label: 'Adresse de son site', type: 'url', help: 'Commence par https://' }, PUBLISHED] },
};

const saved = (can) => toast(!can || can('publier') ? 'Enregistré. Pensez à publier.' : 'Enregistré');

// ------------------------------------------------------------ photos : envoi et choix
// Les grandes photos de téléphone sont réduites avant l'envoi : plus rapide, et moins de données mobiles consommées
async function shrink(file) {
  if (file.type !== 'image/jpeg' || file.size < 800 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88));
    return blob && blob.size < file.size ? new File([blob], file.name, { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
const send = async (file) => upload(await shrink(file));

function uploadButton(label, cls, multiple, onDone) {
  const id = uid();
  const text = h('span', null, label);
  const input = h('input', { type: 'file', accept: 'image/*', multiple, class: 'sr-only', id, onchange: async () => {
    const files = [...input.files];
    if (!files.length) return;
    wrap.classList.add('is-busy');
    const done = [];
    try {
      for (const [i, f] of files.entries()) {
        text.textContent = files.length > 1 ? `Envoi ${i + 1} sur ${files.length}…` : 'Envoi en cours…';
        done.push(await send(f));
      }
      toast(done.length > 1 ? `${done.length} photos ajoutées` : 'Photo ajoutée');
    } catch (e) { toast(e.message, 'error'); } finally {
      wrap.classList.remove('is-busy');
      text.textContent = label;
      input.value = '';
      if (done.length) await onDone(done);
    }
  } });
  const wrap = h('span', { class: 'upload' }, input, h('label', { for: id, class: cls }, icon('plus'), text));
  return wrap;
}

export function chooseMedia(selected) {
  return new Promise((resolve) => {
    const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const grid = h('div', { class: 'picker-grid' });
    const dlg = h('dialog', { class: 'dialog', 'aria-label': 'Choisir une photo' },
      h('div', { class: 'dialog-head' }, h('h2', null, 'Choisir une photo'), h('button', { type: 'button', class: 'btn btn--small', onclick: () => close(undefined) }, 'Fermer')),
      uploadButton('Ajouter une photo depuis cet appareil', 'btn btn--primary btn--block', false, ([m]) => close(m)),
      grid);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
    document.body.append(dlg);
    dlg.showModal();
    get('/media').then((items) => grid.append(...(items.length ? items.map((m) => h('button', { type: 'button', class: `pick${m.id === selected ? ' is-selected' : ''}`, onclick: () => close(m) },
      h('img', { src: mediaUrl(m.path), alt: m.alt || 'Photo sans description', loading: 'lazy' }))) : [h('p', { class: 'help' }, 'Aucune photo pour le moment.')])));
  });
}

function mediaField(f, value, item) {
  let id = value || null;
  const preview = h('div', { class: 'photo-preview' });
  const chooseText = h('span');
  const remove = h('button', { type: 'button', class: 'btn btn--small', onclick: () => { id = null; dirty.on = true; draw(); } }, 'Retirer');
  const choose = h('button', { type: 'button', class: 'btn', id: uid(), onclick: async () => {
    const m = await chooseMedia(id);
    if (!m) return;
    id = m.id;
    dirty.on = true;
    draw(m);
    wrap.setError('');
  } }, icon('photo'), chooseText);
  const draw = async (known) => {
    const m = id ? known || (await get('/media')).find((x) => x.id === id) : null;
    const src = m ? m.path : f.fallback?.(item);
    clear(preview).append(src ? h('img', { src: mediaUrl(src), alt: m?.alt || '' }) : icon('photo', 'icon--xl'));
    chooseText.textContent = src ? 'Changer la photo' : 'Choisir une photo';
    remove.hidden = !id;
  };
  const error = h('p', { class: 'field-error', role: 'alert' });
  const wrap = h('div', { class: 'field' }, h('span', { class: 'label' }, f.label, f.required && h('span', { class: 'req' }, ' (obligatoire)')),
    h('div', { class: 'photo-field' }, preview, h('div', { class: 'actions' }, choose, remove)), f.help && h('p', { class: 'help' }, f.help), error);
  wrap.setError = (msg) => { error.textContent = msg || ''; wrap.classList.toggle('has-error', !!msg); };
  wrap.getValue = () => id;
  wrap.control = choose;
  draw();
  return wrap;
}

// ------------------------------------------------------------ listes
export async function resourceView(name, id) {
  const res = RESOURCES[name];
  if (id === 'calendrier') return calendarView();
  const list = await resourceList(name, res);
  if (!id) return list;
  return h('div', null, list, await resourcePanel(name, res, id));
}

// Onglets Liste / Calendrier des evenements a venir
export const agendaTabs = (current) => h('nav', { class: 'tabs', 'aria-label': 'Affichage' },
  h('a', { href: '#/r/agenda', 'aria-current': current === 'liste' ? 'page' : false }, 'Liste'),
  h('a', { href: '#/r/agenda/calendrier', 'aria-current': current === 'calendrier' ? 'page' : false }, 'Calendrier'));

async function resourceList(name, res) {
  const [rows, media, groups] = await Promise.all([get(`/${name}`), get('/media'), res.group ? get('/member-categories') : null]);
  const paths = new Map(media.map((m) => [m.id, m.path]));
  const holder = h('div');
  const stats = h('p', { class: 'stats' });
  let query = '', filter = '', group = '';
  const column = res.col;
  const ordering = () => res.order && !query && !filter;

  const picture = (r) => {
    const src = paths.get(res.image?.(r)) || res.fallback?.(r);
    if (src) return h('img', { class: `thumb${res.round ? ' thumb--round' : ''}${res.contain ? ' thumb--contain' : ''}`, src: mediaUrl(src), alt: '', loading: 'lazy' });
    if (name === 'agenda') {
      const d = new Date(r.starts_at.replace(' ', 'T'));
      return h('span', { class: 'thumb thumb--date', 'aria-hidden': 'true' }, h('small', null, d.toLocaleDateString('fr-FR', { month: 'short' })), h('strong', null, d.getDate()));
    }
    if (res.round) {
      const letters = res.name(r).split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('');
      return h('span', { class: 'thumb thumb--round thumb--initials', 'aria-hidden': 'true' }, letters);
    }
    return h('span', { class: 'thumb thumb--icon', 'aria-hidden': 'true' }, icon(res.icon));
  };

  async function move(list, from, to) {
    [list[from], list[to]] = [list[to], list[from]];
    for (const [i, r] of list.entries()) {
      if (r.position !== i) { r.position = i; await patch(`/${name}/${r.id}`, { position: i }); }
    }
    rows.sort((a, b) => a.position - b.position || a.id - b.id);
    draw();
    holder.querySelector(`[data-move="${list[to].id}:${to > from ? 'down' : 'up'}"]:not([disabled])`)?.focus();
  }

  const count = () => {
    const shown = rows.filter((r) => r.published).length;
    clear(stats).append(h('span', null, h('strong', null, rows.length), ` au total`));
    if (!res.noVisibility) stats.append(h('span', null, h('strong', null, shown), ' sur le site'), rows.length - shown ? h('span', { class: 'stats-warn' }, `${rows.length - shown} masqué(s)`) : '');
    for (const b of tabs ? tabs.querySelectorAll('[data-count]') : []) b.textContent = b.dataset.count === 'on' ? shown : b.dataset.count === 'off' ? rows.length - shown : rows.length;
  };

  const row = (r, i, list) => {
    const label = res.name(r);
    const warning = res.warn?.(r);
    const li = h('li', { class: `item${r.published === false ? ' is-hidden' : ''}` },
      h('a', { class: 'item-main', href: `#/r/${name}/${r.id}` }, picture(r),
        h('span', { class: 'row-body' }, h('strong', null, label), res.meta?.(r) && h('span', null, res.meta(r)), warning && h('span', { class: 'pill pill--warn' }, warning))),
      column && h('span', { class: 'item-col' }, column[1](r) || '—'),
      !res.noVisibility && h('span', { class: 'item-state' }, (() => {
        const t = toggle(r.published ? 'Visible' : 'Masqué', r.published, async (on) => {
          try {
            await patch(`/${name}/${r.id}`, { published: on });
            r.published = on;
            li.classList.toggle('is-hidden', !on);
            t.querySelector('.switch-label').textContent = on ? 'Visible' : 'Masqué';
            count();
            toast(on ? `« ${label} » sera affiché après publication` : `« ${label} » sera masqué après publication`);
          } catch (e) { t.input.checked = !on; throw e; }
        });
        t.input.setAttribute('aria-label', `Afficher « ${label} » sur le site`);
        return t;
      })()),
      h('span', { class: 'item-actions' },
        ordering() && list.length > 1 && [
          h('button', { type: 'button', class: 'icon-btn', disabled: i === 0, 'data-move': `${r.id}:up`, 'aria-label': `Monter « ${label} »`, title: 'Monter', onclick: () => move(list, i, i - 1) }, icon('up')),
          h('button', { type: 'button', class: 'icon-btn', disabled: i === list.length - 1, 'data-move': `${r.id}:down`, 'aria-label': `Descendre « ${label} »`, title: 'Descendre', onclick: () => move(list, i, i + 1) }, icon('down'))],
        h('a', { class: 'icon-btn', href: `#/r/${name}/${r.id}`, 'aria-label': `Modifier « ${label} »`, title: 'Modifier' }, icon('pencil'))));
    return li;
  };

  const listOf = (items) => h('ul', { class: 'items' }, items.map((r, i) => row(r, i, items)));
  const header = () => h('div', { class: `items-head${column ? '' : ' no-col'}`, 'aria-hidden': 'true' },
    h('span', null, res.one || 'Nom'), column && h('span', { class: 'item-col' }, column[0]), !res.noVisibility && h('span', { class: 'item-state' }, 'Sur le site'), h('span', { class: 'item-actions' }, ''));

  function draw() {
    count();
    const shown = rows.filter((r) => (!query || `${res.name(r)} ${res.meta?.(r) || ''}`.toLowerCase().includes(query))
      && (!filter || r.published === (filter === 'on')) && (!group || r[res.group] === Number(group)));
    if (!rows.length) return clear(holder).append(empty(res.icon, res.none, 'Commencez avec le bouton « ' + res.add + ' ».'));
    if (!shown.length) return clear(holder).append(empty('search', 'Aucun résultat', 'Essayez un autre mot ou un autre filtre.'));
    if (!res.group) return clear(holder).append(header(), listOf(shown));
    clear(holder).append(header(), ...groups.map((g) => {
      const items = shown.filter((r) => r[res.group] === g.id);
      return items.length ? h('section', null, h('h2', { class: 'group-title' }, g.title, h('span', null, items.length)), listOf(items)) : '';
    }));
  }

  const tabs = !res.noVisibility && h('div', { class: 'tabs', role: 'group', 'aria-label': 'Filtrer' }, [['', 'Tous', 'all'], ['on', 'Visibles', 'on'], ['off', 'Masqués', 'off']].map(([v, label, key]) =>
    h('button', { type: 'button', 'aria-pressed': String(v === ''), onclick: (e) => {
      filter = v;
      for (const b of tabs.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      draw();
    } }, label, h('span', { class: 'count', 'data-count': key }))));

  const toolbar = rows.length > 0 && h('div', { class: 'toolbar' },
    h('div', { class: 'search' }, icon('search'), h('input', { type: 'search', placeholder: 'Rechercher…', 'aria-label': 'Chercher dans la liste', oninput: (e) => { query = e.target.value.trim().toLowerCase(); draw(); } })),
    res.group && h('select', { 'aria-label': 'Choisir un groupe', onchange: (e) => { group = e.target.value; draw(); } },
      h('option', { value: '' }, 'Tous les groupes'), groups.map((g) => h('option', { value: g.id }, g.title))));
  draw();

  return h('div', { class: 'list-page' },
    pageHead(res.title, res.intro, h('div', { class: 'head-actions' },
      res.extra && h('a', { class: 'btn btn--quiet', href: res.extra.href }, res.extra.label),
      h('a', { class: 'btn btn--accent', href: `#/r/${name}/new` }, icon('plus'), res.add)), res.parent ? [res.parent, 'Équipe'] : ['#/', 'Tableau de bord']),
    stats, name === 'agenda' && agendaTabs('liste'), tabs, h('div', { class: 'card card--list' }, toolbar, holder));
}

// ------------------------------------------------------------ panneau lateral : ajouter ou modifier
async function resourcePanel(name, res, id) {
  const isNew = id === 'new';
  const all = [...res.fields, ...(res.more || [])];
  const item = isNew ? { ...prefill.take() } : await get(`/${name}/${id}`);
  const refs = {};
  for (const f of all) if (f.from) refs[f.from] = await get(`/${f.from}`);
  const list = `#/r/${name}`;
  const controls = {};

  const build = (f) => {
    const val = item[f.key] ?? f.default ?? (f.type === 'bool' ? false : '');
    if (f.type === 'media') { const w = mediaField(f, val || null, item); controls[f.key] = { wrap: w, get: w.getValue, focus: () => w.control.focus() }; return w; }
    if (f.type === 'bool') {
      const t = toggle(f.label, !!val, () => { dirty.on = true; });
      controls[f.key] = { get: () => t.input.checked };
      return h('div', { class: 'field' }, t);
    }
    let input;
    if (f.type === 'textarea') input = h('textarea', { rows: '4' }, val);
    else if (f.type === 'lines') input = h('textarea', { rows: '8' }, (val || []).join('\n'));
    else if (f.type === 'date') input = h('input', { type: 'date', value: String(val).slice(0, 10) });
    else if (f.type === 'datetime') input = h('input', { type: 'datetime-local', value: String(val).slice(0, 16).replace(' ', 'T') });
    else if (f.type === 'select') input = h('select', null, h('option', { value: '' }, 'Choisir…'), refs[f.from].map((o) => h('option', { value: o.id, selected: o.id === val }, o.title)));
    else input = h('input', { type: f.type === 'url' ? 'url' : 'text', value: val });
    const w = field(f.label, input, f);
    input.addEventListener('input', () => { dirty.on = true; w.setError(''); });
    controls[f.key] = { wrap: w, focus: () => input.focus(), get: () => {
      if (f.type === 'select') return input.value === '' ? '' : Number(input.value);
      if (f.type === 'lines') return input.value.split('\n').map((s) => s.trim()).filter(Boolean);
      return input.value.trim();
    } };
    return w;
  };

  const aside = (f) => ['media', 'bool', 'select'].includes(f.type);
  const side = res.fields.filter(aside);
  const title = isNew ? res.add : res.name(item);
  const submit = h('button', { type: 'submit', class: 'btn btn--primary' }, isNew ? 'Ajouter' : 'Enregistrer');
  const remove = !isNew && h('span', { class: 'delete-zone' }, h('button', { type: 'button', class: 'btn btn--danger', onclick: async () => {
    const text = res.deleteWarning ? await res.deleteWarning(item) : 'Cette suppression est définitive. Pour le cacher seulement, désactivez « Afficher sur le site ».';
    if (!(await ask({ title: `Supprimer « ${title} » ?`, text, yes: 'Supprimer', no: 'Garder', danger: true }))) return;
    await del(`/${name}/${id}`);
    dirty.on = false;
    toast('Supprimé. Pensez à publier.');
    location.hash = list;
  } }, icon('trash'), 'Supprimer'));

  const form = h('form', { class: 'form panel-form', novalidate: true },
    h('div', { class: `panel-body${side.length ? '' : ' panel-body--single'}` },
      h('div', { class: 'panel-main' }, res.fields.filter((f) => !aside(f)).map(build),
        res.more && h('details', { class: 'more' }, h('summary', null, 'Options avancées'), res.more.map(build))),
      side.length > 0 && h('div', { class: 'panel-side' }, side.map(build))),
    h('div', { class: 'savebar' }, remove, h('a', { class: 'btn', href: list }, 'Annuler'), submit));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    let firstBad = null;
    for (const f of all) {
      const c = controls[f.key];
      const v = c.get();
      let problem = '';
      if (f.required && (v === '' || v == null)) problem = f.type === 'media' ? 'Choisissez une photo.' : 'Remplissez ce champ.';
      else if (f.type === 'url' && v && !/^https?:\/\/\S+$/i.test(v)) problem = 'L’adresse doit commencer par https://';
      c.wrap?.setError(problem);
      if (problem) firstBad = firstBad || c;
      data[f.key] = v;
    }
    if (firstBad) return firstBad.focus();
    submit.disabled = true;
    try {
      if (isNew) {
        if (res.order) {                                    // un nouvel element se place a la fin de sa liste
          const peers = (await get(`/${name}`)).filter((r) => !res.group || r[res.group] === data[res.group]);
          data.position = peers.reduce((m, r) => Math.max(m, r.position + 1), 0);
        }
        await post(`/${name}`, data);
      } else await patch(`/${name}/${id}`, data);
      dirty.on = false;
      saved();
      location.hash = list;
    } finally { submit.disabled = false; }
  });

  return h('div', { class: 'overlay' }, h('a', { class: 'overlay-back', href: list, tabindex: '-1', 'aria-hidden': 'true' }),
    h('section', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'panel-title', tabindex: '-1' },
      h('header', { class: 'panel-head' },
        h('div', null, h('span', { class: 'pill pill--blue' }, isNew ? 'Nouveau' : 'Modification'), h('h2', { id: 'panel-title' }, title),
          h('p', null, 'Enregistrez, puis publiez pour mettre le site à jour.')),
        h('a', { class: 'icon-btn panel-close', href: list, 'aria-label': 'Fermer' }, icon('close'))),
      form));
}

// ------------------------------------------------------------ réglages
const LABELS = { 'contact.adresse': 'Adresse du siège', 'contact.email': 'Adresse e-mail', 'contact.telephone': 'Téléphone',
  'social.facebook': 'Facebook', 'social.instagram': 'Instagram', 'social.twitter': 'X (Twitter)', 'social.whatsapp': 'WhatsApp', 'social.youtube': 'YouTube',
  'site.url': 'Adresse publique du site', 'site.api_url': 'Adresse du serveur du parti' };
const HELP = { 'contact.telephone': 'Avec l’indicatif du pays, par exemple +243 842 042 152.', 'social.whatsapp': 'Sous la forme https://wa.me/243… (votre numéro sans le +).',
  'site.api_url': 'Laisser vide tant que le serveur n’est pas en ligne.' };
const SETTINGS_PAGES = {
  contact: { title: 'Coordonnées', intro: 'Affichées sur la page d’accueil et en bas de toutes les pages.', match: (k) => /^(contact|social)\./.test(k) },
  chiffres: { title: 'Chiffres clés', intro: 'Les quatre grands nombres de la page d’accueil.', match: (k) => k.startsWith('stats.') },
  google: { title: 'Présence sur Google', intro: 'Le titre et le résumé de chaque page dans Google et lors d’un partage.', match: (k) => k.startsWith('seo.') },
  technique: { title: 'Réglages techniques', intro: 'À ne modifier qu’avec la personne qui s’occupe du serveur.', match: (k) => k.startsWith('site.'), admin: true },
};

function check(key, value) {
  if (key === 'contact.telephone' && !/^\+\d{9,15}$/.test(value)) return 'Commencez par + puis l’indicatif et le numéro.';
  if (key === 'contact.email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Cette adresse e-mail n’est pas complète.';
  if ((key.startsWith('social.') || key.startsWith('site.')) && value && !/^https?:\/\/\S+$/i.test(value)) return 'L’adresse doit commencer par https://';
  if (key.endsWith('.nombre') && !/^\d+$/.test(value)) return 'Un nombre, sans espace ni signe.';
  return '';
}

export async function settingsView(section = 'contact', { can }) {
  const page = SETTINGS_PAGES[section] || SETTINGS_PAGES.contact;
  if (page.admin && !can('*')) return empty('shield', 'Réservé à l’administrateur', '');
  const values = await get('/settings');
  const keys = Object.keys(values).filter(page.match);
  const controls = {};
  const make = (k, label, long) => {
    const input = long ? h('textarea', { rows: '3' }, values[k]) : h('input', { type: k.endsWith('.email') ? 'email' : k.endsWith('.telephone') ? 'tel' : 'text', value: values[k], inputmode: k.endsWith('.nombre') ? 'numeric' : false });
    const w = field(label, input, { help: HELP[k] });
    input.addEventListener('input', () => { dirty.on = true; w.setError(''); });
    controls[k] = { w, input };
    return w;
  };

  let body;
  if (section === 'chiffres') {
    const numbers = [...new Set(keys.map((k) => k.split('.')[1]))];
    body = numbers.map((n) => h('fieldset', { class: 'card stat-fields' }, h('legend', null, `Chiffre ${n}`),
      make(`stats.${n}.nombre`, 'Nombre'), make(`stats.${n}.suffixe`, 'Signe après (ex. +)'), make(`stats.${n}.libelle`, 'Texte sous le nombre')));
  } else if (section === 'google') {
    const parts = [['titre', 'Titre'], ['description', 'Résumé dans Google'], ['partage', 'Résumé lors d’un partage']];
    body = Object.keys(PAGES).filter((p) => keys.includes(`seo.${p}.titre`)).map((p) => h('details', { class: 'card more' }, h('summary', null, PAGES[p]),
      parts.map(([part, label]) => make(`seo.${p}.${part}`, label, part !== 'titre'))));
  } else {
    body = h('div', { class: 'card' }, keys.map((k) => make(k, LABELS[k] || k)));
  }

  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--large' }, 'Enregistrer');
  const form = h('form', { class: 'form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const data = {};
    let bad = null;
    for (const [k, c] of Object.entries(controls)) {
      let v = c.input.value.trim();
      if (k === 'contact.telephone') v = v.replace(/[\s().-]/g, '');
      const problem = v === values[k] ? '' : check(k, v);      // on ne verifie que ce qui a change
      c.w.setError(problem);
      if (problem) bad = bad || c;
      if (v !== values[k]) data[k] = v;
    }
    if (bad) { bad.input.closest('details')?.setAttribute('open', ''); return bad.input.focus(); }
    if (!Object.keys(data).length) return toast('Rien à enregistrer');
    submit.disabled = true;
    try {
      await put('/settings', data);
      Object.assign(values, data);
      dirty.on = false;
      saved();
    } finally { submit.disabled = false; }
  } }, body, h('div', { class: 'savebar' }, submit));

  return h('div', { class: 'narrow' }, pageHead(page.title, page.intro, null, ['#/', 'Tableau de bord']), form);
}

// ------------------------------------------------------------ photos
export async function mediaView() {
  const holder = h('div');
  const stats = h('p', { class: 'stats' });
  let items = [], filter = '', query = '';
  const draw = () => {
    const missing = items.filter((m) => !m.alt).length;
    clear(stats).append(h('span', null, h('strong', null, items.length), ' photos'), missing ? h('span', { class: 'stats-warn' }, `${missing} sans description`) : '');
    for (const b of tabs.querySelectorAll('[data-count]')) b.textContent = b.dataset.count === 'none' ? missing : items.length;
    const shown = items.filter((m) => (!filter || !m.alt) && (!query || `${m.alt} ${m.path}`.toLowerCase().includes(query)));
    clear(holder).append(shown.length ? h('ul', { class: 'gallery' }, shown.map((m) => {
      const label = m.alt || 'Photo sans description';
      const file = m.path.startsWith('http') ? 'Photo en ligne' : m.path.split('/').pop();
      const alt = h('input', { type: 'text', value: m.alt, placeholder: 'Que montre la photo ?', 'aria-label': `Description : ${label}`, onchange: async () => {
        await patch(`/media/${m.id}`, { alt: alt.value });
        m.alt = alt.value.trim();
        toast('Description enregistrée');
        draw();
      } });
      return h('li', null, h('div', { class: 'gallery-image' }, h('img', { src: mediaUrl(m.path), alt: label, loading: 'lazy', class: /\.(svg|png)$/i.test(m.path) ? 'is-contain' : false }), !m.alt && h('span', { class: 'pill pill--warn' }, 'Sans description')),
        h('div', { class: 'gallery-info' }, h('strong', { title: file }, file), h('small', null, m.width ? `${m.width} × ${m.height}` : m.path.startsWith('http') ? 'Hébergée ailleurs' : 'Fournie avec le site')),
        h('div', { class: 'gallery-tools' }, alt, h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Supprimer : ${label}`, title: 'Supprimer', onclick: async () => {
          if (!(await ask({ title: 'Supprimer cette photo ?', text: 'Elle disparaîtra de tous les endroits où elle est utilisée.', yes: 'Supprimer', no: 'Garder', danger: true }))) return;
          await del(`/media/${m.id}`);
          toast('Photo supprimée');
          await load();
        } }, icon('trash'))));
    })) : empty('photo', items.length ? 'Aucun résultat' : 'Aucune photo', items.length ? 'Essayez un autre filtre.' : 'Ajoutez vos premières photos.'));
  };
  const load = async () => { items = await get('/media'); draw(); };
  const tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Filtrer les photos' }, [['', 'Toutes', 'all'], ['none', 'Sans description', 'none']].map(([v, label, key]) =>
    h('button', { type: 'button', 'aria-pressed': String(v === ''), onclick: (e) => {
      filter = v;
      for (const b of tabs.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      draw();
    } }, label, h('span', { class: 'count', 'data-count': key }))));
  await load();

  const page = h('div', { class: 'drop-zone' },
    pageHead('Photos', 'Toutes les photos du site. Vous pouvez aussi les déposer sur cette page.', uploadButton('Ajouter des photos', 'btn btn--accent', true, load), ['#/', 'Tableau de bord']),
    stats, tabs,
    h('div', { class: 'toolbar toolbar--bare' }, h('div', { class: 'search' }, icon('search'), h('input', { type: 'search', placeholder: 'Rechercher une photo…', 'aria-label': 'Rechercher une photo', oninput: (e) => { query = e.target.value.trim().toLowerCase(); draw(); } }))),
    holder);
  page.addEventListener('dragover', (e) => { e.preventDefault(); page.classList.add('is-over'); });
  page.addEventListener('dragleave', (e) => { if (!page.contains(e.relatedTarget)) page.classList.remove('is-over'); });
  page.addEventListener('drop', async (e) => {
    e.preventDefault();
    page.classList.remove('is-over');
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return toast('Déposez des images.', 'error');
    for (const f of files) await send(f);
    toast(files.length > 1 ? `${files.length} photos ajoutées` : 'Photo ajoutée');
    await load();
  });
  return page;
}
