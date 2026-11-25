// Contenu du site : listes et formulaires générés depuis une description, textes, réglages, images
import { h, clear, toast, fmtDay, mediaUrl } from './dom.js';
import { get, post, patch, put, del, upload } from './api.js';

const PUBLISHED = { key: 'published', label: 'Visible sur le site', type: 'bool', default: true };
const ORDER = { key: 'position', label: 'Ordre d’affichage', type: 'number', default: 0, help: 'Plus le nombre est petit, plus l’élément est haut.' };

export const RESOURCES = {
  slides: { title: 'Bandeau d’accueil', one: 'une slide', columns: [['title', 'Titre'], ['subtitle', 'Sous-titre'], ['published', 'Visible', 'bool']],
    fields: [{ key: 'eyebrow', label: 'Sur-titre' }, { key: 'title', label: 'Titre', required: true }, { key: 'subtitle', label: 'Sous-titre' },
      { key: 'image_id', label: 'Image de fond', type: 'media' }, ORDER, PUBLISHED] },
  programmes: { title: 'Programmes', one: 'un programme', columns: [['title', 'Titre'], ['summary', 'Thème'], ['published', 'Visible', 'bool']],
    fields: [{ key: 'title', label: 'Titre', required: true }, { key: 'slug', label: 'Identifiant dans l’adresse', required: true, help: 'Lettres minuscules et tirets, par exemple « education ».' },
      { key: 'summary', label: 'Thème (ex. Social)' }, { key: 'body', label: 'Description', type: 'textarea' }, { key: 'image_id', label: 'Image', type: 'media' }, ORDER, PUBLISHED] },
  events: { title: 'Événements', one: 'un événement', columns: [['event_date', 'Date', 'date'], ['title', 'Titre'], ['published', 'Visible', 'bool']],
    fields: [{ key: 'title', label: 'Titre', required: true }, { key: 'event_date', label: 'Date', type: 'date', required: true },
      { key: 'description', label: 'Description courte', type: 'textarea' },
      { key: 'report', label: 'Compte rendu', type: 'lines', help: 'Un paragraphe par ligne.' },
      { key: 'poster_id', label: 'Affiche', type: 'media' },
      { key: 'video_mp4', label: 'Vidéo (lien MP4)', help: 'Chemin ou adresse du fichier vidéo.' }, { key: 'video_webm', label: 'Vidéo (lien WebM, facultatif)' }, PUBLISHED] },
  members: { title: 'Équipe', one: 'un membre', columns: [['full_name', 'Nom'], ['function', 'Fonction'], ['category_id', 'Catégorie', 'ref:member-categories'], ['published', 'Visible', 'bool']],
    fields: [{ key: 'full_name', label: 'Nom complet', required: true }, { key: 'function', label: 'Fonction' }, { key: 'description', label: 'Présentation', type: 'textarea' },
      { key: 'category_id', label: 'Catégorie', type: 'select', from: 'member-categories', required: true }, { key: 'photo_id', label: 'Photo', type: 'media' }, ORDER, PUBLISHED],
    extra: { href: '#/r/member-categories', label: 'Gérer les catégories' } },
  'member-categories': { title: 'Catégories de l’équipe', one: 'une catégorie', back: '#/r/members', columns: [['title', 'Nom'], ['position', 'Ordre']],
    fields: [{ key: 'title', label: 'Nom', required: true }, { key: 'intro', label: 'Introduction', type: 'textarea' }, ORDER] },
  partners: { title: 'Partenaires', one: 'un partenaire', columns: [['name', 'Nom'], ['url', 'Site'], ['published', 'Visible', 'bool']],
    fields: [{ key: 'name', label: 'Nom', required: true }, { key: 'url', label: 'Site web' }, { key: 'logo_id', label: 'Logo', type: 'media' }, ORDER, PUBLISHED] },
};

let seq = 0;
const uid = () => `f${++seq}`;

// ------------------------------------------------------------ choix d'une image
export function mediaPicker(value, onChange) {
  const preview = h('img', { class: 'thumb', alt: '' });
  const label = h('span', { class: 'muted' });
  const holder = h('div', { class: 'picker' }, preview, label);
  const state = { id: value, items: [] };
  const sync = () => {
    const m = state.items.find((x) => x.id === state.id);
    preview.toggleAttribute('hidden', !m);
    if (m) preview.src = mediaUrl(m.path);
    label.textContent = m ? (m.alt || m.path) : 'Aucune image';
    clearBtn.toggleAttribute('hidden', !m);
  };
  const clearBtn = h('button', { type: 'button', class: 'btn btn--small', onclick: () => { state.id = null; onChange(null); sync(); } }, 'Retirer');
  const chooseBtn = h('button', { type: 'button', class: 'btn btn--small', onclick: async () => {
    const m = await chooseMedia(state.id);
    if (m === undefined) return;
    state.items = await get('/media');
    state.id = m;
    onChange(m);
    sync();
  } }, 'Choisir ou envoyer une image');
  holder.append(chooseBtn, clearBtn);
  get('/media').then((items) => { state.items = items; sync(); });
  return Object.assign(holder, { getValue: () => state.id });
}

function chooseMedia(selected) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog', 'aria-label': 'Choisir une image' });
    const grid = h('div', { class: 'media-grid' });
    const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const draw = async () => {
      const items = (await get('/media'));
      clear(grid).append(...items.map((m) => h('button', { type: 'button', class: `media-item${m.id === selected ? ' is-selected' : ''}`, onclick: () => close(m.id) },
        h('img', { src: mediaUrl(m.path), alt: m.alt || '', loading: 'lazy' }), h('span', null, m.alt || m.path.split('/').pop()))));
      if (!items.length) grid.append(h('p', { class: 'muted' }, 'Aucune image pour le moment.'));
    };
    const file = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', id: 'dlg-file', onchange: async () => {
      if (!file.files[0]) return;
      const m = await upload(file.files[0]);
      toast('Image envoyée');
      close(m.id);
    } });
    dlg.append(h('div', { class: 'dialog-head' }, h('h2', null, 'Choisir une image'),
      h('label', { class: 'btn btn--primary', for: 'dlg-file' }, 'Envoyer une nouvelle image'), file,
      h('button', { type: 'button', class: 'btn', onclick: () => close(undefined) }, 'Fermer')), grid);
    dlg.addEventListener('cancel', () => close(undefined));
    document.body.append(dlg);
    dlg.showModal();
    draw();
  });
}

// ------------------------------------------------------------ liste et formulaire
async function loadRefs(res) {
  const refs = {};
  for (const f of res.fields) if (f.from) refs[f.from] = await get(`/${f.from}`);
  for (const c of res.columns) if (c[2]?.startsWith('ref:')) refs[c[2].slice(4)] = refs[c[2].slice(4)] || await get(`/${c[2].slice(4)}`);
  return refs;
}

export async function resourceView(name, id) {
  const res = RESOURCES[name];
  const refs = await loadRefs(res);
  return id ? resourceForm(name, res, id, refs) : resourceList(name, res, refs);
}

async function resourceList(name, res, refs) {
  const rows = await get(`/${name}`);
  const cell = (r, [key, , type]) => {
    const v = r[key];
    if (type === 'bool') return v ? 'Oui' : 'Non';
    if (type === 'date') return fmtDay(v);
    if (type?.startsWith('ref:')) return (refs[type.slice(4)].find((x) => x.id === v) || {}).title || '—';
    return v == null || v === '' ? '—' : String(v).slice(0, 90);
  };
  return h('div', null,
    res.back && h('p', null, h('a', { href: res.back }, '← Retour')),
    h('div', { class: 'page-head' }, h('h1', null, res.title),
      h('div', null, res.extra && h('a', { class: 'btn', href: res.extra.href }, res.extra.label), ' ',
        h('a', { class: 'btn btn--primary', href: `#/r/${name}/new` }, `Ajouter ${res.one}`))),
    rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, res.columns.map((c) => h('th', { scope: 'col' }, c[1])))),
      h('tbody', null, rows.map((r) => h('tr', null, res.columns.map((c, i) => h('td', null,
        i === 0 ? h('a', { href: `#/r/${name}/${r.id}` }, cell(r, c)) : cell(r, c))))))))
      : h('p', { class: 'muted' }, 'Rien pour le moment.'));
}

async function resourceForm(name, res, id, refs) {
  const isNew = id === 'new';
  const item = isNew ? {} : await get(`/${name}/${id}`);
  const inputs = {};
  const form = h('form', { class: 'card form', novalidate: true });
  for (const f of res.fields) {
    const fid = uid();
    const val = item[f.key] ?? f.default ?? (f.type === 'bool' ? false : '');
    let input;
    if (f.type === 'textarea') input = h('textarea', { id: fid, rows: '6' }, val);
    else if (f.type === 'lines') input = h('textarea', { id: fid, rows: '8' }, (val || []).join('\n'));
    else if (f.type === 'bool') input = h('input', { id: fid, type: 'checkbox', checked: !!val });
    else if (f.type === 'number') input = h('input', { id: fid, type: 'number', value: val });
    else if (f.type === 'date') input = h('input', { id: fid, type: 'date', value: String(val).slice(0, 10) });
    else if (f.type === 'select') {
      input = h('select', { id: fid }, h('option', { value: '' }, '— Choisir —'), refs[f.from].map((o) => h('option', { value: o.id, selected: o.id === val }, o.title)));
    } else if (f.type === 'media') input = mediaPicker(val || null, () => {});
    else input = h('input', { id: fid, type: 'text', value: val });
    if (f.required && f.type !== 'bool') input.setAttribute('required', '');
    inputs[f.key] = input;
    form.append(f.type === 'bool'
      ? h('div', { class: 'check' }, input, h('label', { for: fid }, f.label))
      : h('div', { class: 'field' }, h('label', { for: fid }, f.label, f.required && h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), input, f.help && h('small', { class: 'help' }, f.help)));
  }
  const read = () => {
    const out = {};
    for (const f of res.fields) {
      const el = inputs[f.key];
      if (f.type === 'bool') out[f.key] = el.checked;
      else if (f.type === 'media') out[f.key] = el.getValue();
      else if (f.type === 'number') out[f.key] = el.value === '' ? 0 : Number(el.value);
      else if (f.type === 'select') out[f.key] = el.value === '' ? '' : Number(el.value);
      else if (f.type === 'lines') out[f.key] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else out[f.key] = el.value;
    }
    return out;
  };
  const back = res.back || `#/r/${name}`;
  form.append(h('div', { class: 'form-actions' },
    h('button', { type: 'submit', class: 'btn btn--primary' }, isNew ? 'Ajouter' : 'Enregistrer'),
    h('a', { class: 'btn', href: back }, 'Annuler'),
    !isNew && h('button', { type: 'button', class: 'btn btn--danger', onclick: async () => {
      if (!confirm('Supprimer définitivement cet élément ?')) return;
      await del(`/${name}/${id}`);
      toast('Supprimé');
      location.hash = back;
    } }, 'Supprimer')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (isNew) await post(`/${name}`, read()); else await patch(`/${name}/${id}`, read());
    toast('Enregistré');
    location.hash = back;
  });
  return h('div', null, h('p', null, h('a', { href: back }, '← Retour')), h('h1', null, isNew ? `Ajouter ${res.one}` : 'Modifier'), form);
}

// ------------------------------------------------------------ textes des pages
const PAGES = { 'a-propos': 'À propos', accueil: 'Accueil' };
export async function contentView(page, key) {
  if (!page) {
    const rows = await get('/content');
    return h('div', null, h('h1', null, 'Textes des pages'),
      h('p', { class: 'muted' }, 'Chaque bloc correspond à une section du site.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['Page', 'Section', 'Titre'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', null, rows.map((r) => h('tr', null, h('td', null, PAGES[r.page] || r.page), h('td', null, h('a', { href: `#/content/${r.page}/${r.key}` }, r.key)), h('td', null, r.title)))))));
  }
  const b = await get(`/content/${page}/${key}`);
  const title = h('input', { id: 'c-title', type: 'text', value: b.title });
  const body = h('textarea', { id: 'c-body', rows: '22', class: 'code', spellcheck: 'false' }, b.body);
  return h('div', null, h('p', null, h('a', { href: '#/content' }, '← Tous les textes')), h('h1', null, `${PAGES[page] || page} · ${key}`),
    h('form', { class: 'card form', onsubmit: async (e) => {
      e.preventDefault();
      await put(`/content/${page}/${key}`, { title: title.value, body: body.value });
      toast('Texte enregistré');
    } },
    h('div', { class: 'notice' }, 'Ce bloc contient du texte avec des balises HTML (<p>, <h3>, <strong>…). Modifiez seulement les mots, sans toucher aux balises.'),
    h('div', { class: 'field' }, h('label', { for: 'c-title' }, 'Titre de la section'), title),
    h('div', { class: 'field' }, h('label', { for: 'c-body' }, 'Contenu'), body),
    h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn--primary' }, 'Enregistrer'), h('a', { class: 'btn', href: '#/content' }, 'Annuler'))));
}

// ------------------------------------------------------------ réglages
const SETTING_LABELS = { 'contact.email': 'Adresse e-mail du parti', 'contact.telephone': 'Téléphone', 'social.facebook': 'Page Facebook', 'social.twitter': 'Compte X (Twitter)',
  'social.instagram': 'Compte Instagram', 'social.youtube': 'Chaîne YouTube', 'social.whatsapp': 'Lien WhatsApp', 'site.url': 'Adresse du site' };
const STAT_PART = { nombre: 'nombre', suffixe: 'signe après le nombre (ex. +)', libelle: 'texte' };
const labelFor = (k) => SETTING_LABELS[k] || (k.startsWith('stats.') ? `Chiffre clé ${k.split('.')[1]} : ${STAT_PART[k.split('.')[2]] || k}` : k);

export async function settingsView() {
  const s = await get('/settings');
  const inputs = {};
  const form = h('form', { class: 'card form', onsubmit: async (e) => {
    e.preventDefault();
    await put('/settings', Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])));
    toast('Réglages enregistrés');
  } });
  for (const k of Object.keys(s)) {
    const id = uid();
    inputs[k] = h('input', { id, type: 'text', value: s[k] });
    form.append(h('div', { class: 'field' }, h('label', { for: id }, labelFor(k)), inputs[k]));
  }
  form.append(h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn--primary' }, 'Enregistrer')));
  return h('div', null, h('h1', null, 'Coordonnées et chiffres'), form);
}

// ------------------------------------------------------------ médiathèque
export async function mediaView() {
  const grid = h('div', { class: 'media-grid media-grid--large' });
  const draw = async () => {
    const items = await get('/media');
    clear(grid).append(...items.map((m) => {
      const alt = h('input', { type: 'text', value: m.alt, 'aria-label': `Description de ${m.path.split('/').pop()}`, placeholder: 'Description de l’image' });
      return h('figure', { class: 'media-card' }, h('img', { src: mediaUrl(m.path), alt: m.alt || '', loading: 'lazy' }),
        h('figcaption', null, h('small', { class: 'muted' }, m.path.split('/').pop(), m.width ? ` · ${m.width}×${m.height}` : ''), alt,
          h('div', { class: 'actions' },
            h('button', { type: 'button', class: 'btn btn--small', onclick: async () => { await patch(`/media/${m.id}`, { alt: alt.value }); toast('Description enregistrée'); } }, 'Enregistrer'),
            h('button', { type: 'button', class: 'btn btn--small btn--danger', onclick: async () => {
              if (!confirm('Supprimer cette image ? Elle sera retirée partout où elle est utilisée.')) return;
              await del(`/media/${m.id}`); toast('Image supprimée'); draw();
            } }, 'Supprimer'))));
    }));
    if (!items.length) grid.append(h('p', { class: 'muted' }, 'Aucune image.'));
  };
  const file = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', id: 'm-file', onchange: async () => {
    for (const f of file.files) await upload(f);
    file.value = '';
    toast('Images envoyées');
    draw();
  } });
  await draw();
  return h('div', null, h('div', { class: 'page-head' }, h('h1', null, 'Images'), h('label', { class: 'btn btn--primary', for: 'm-file' }, 'Envoyer des images'), file),
    h('p', { class: 'muted' }, 'Les images sont réduites et compressées automatiquement (format WebP, 1600 pixels de large au maximum).'), grid);
}
