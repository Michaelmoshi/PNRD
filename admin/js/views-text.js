// Textes des pages : chaque phrase devient un champ simple. La mise en page (balises) n'est jamais touchée.
import { h, toast, field, pageHead, dirty, mediaUrl } from './dom.js';
import { icon } from './icons.js';
import { get, put } from './api.js';
import { PAGES, BLOCKS, BLOCK_ORDER } from './labels.js';
import { chooseMedia } from './views-content.js';

// morceaux « à ne pas toucher » : commentaires, dessins, cartes et balises
const MARKUP = /(<!--[\s\S]*?-->|<svg[\s\S]*?<\/svg>|<iframe[\s\S]*?<\/iframe>|<[^>]+>)/;
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);

const decoder = document.createElement('textarea');
const decode = (s) => { decoder.innerHTML = s; return decoder.value; };      // un textarea n'exécute jamais rien
const encode = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
const attr = (s) => encode(s).replace(/"/g, '&quot;');
const readAttr = (tag, name) => decode((tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1] || '');

function kind(stack) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const { name, cls } = stack[i];
    if (cls.includes('section-eyebrow') || cls.includes('slide-eyebrow')) return 'Petit titre';
    if (name === 'h1') return 'Grand titre';
    if (name === 'h2') return 'Titre';
    if (name === 'h3' || name === 'h4') return 'Sous-titre';
    if (name === 'a' || name === 'button') return 'Texte du bouton';
    if (name === 'strong' || name === 'em' || name === 'b') return 'Mots mis en valeur';
    if (name === 'li') return 'Point de la liste';
    if (name === 'p') return 'Paragraphe';
  }
  return 'Texte';
}

// Découpe le texte stocké : parts[i] pairs = texte, impairs = balises. Renvoie les éléments modifiables.
export function parse(body) {
  const parts = body.split(MARKUP);
  const stack = [];
  const items = [];
  parts.forEach((part, i) => {
    if (i % 2) {
      if (/^<(!--|svg|iframe)/i.test(part)) return;
      const closing = part.match(/^<\/([\w-]+)/);
      if (closing) {
        const at = stack.map((s) => s.name).lastIndexOf(closing[1].toLowerCase());
        if (at >= 0) stack.length = at;
        return;
      }
      const open = part.match(/^<([\w-]+)/);
      if (!open) return;
      const name = open[1].toLowerCase();
      if (name === 'img') items.push({ type: 'image', index: i });
      if (!VOID.has(name) && !part.endsWith('/>')) stack.push({ name, cls: readAttr(part, 'class') });
      return;
    }
    if (!part.trim()) return;
    if (stack.some((s) => s.cls.includes('stats-list'))) return;            // chiffres gérés dans « Chiffres clés »
    const value = decode(part).replace(/[ \t\r\n]+/g, ' ').trim();
    if (!/[\p{L}\p{N}]/u.test(value) || /^(\{\{[\w.]+\}\}\s*)+$/.test(value)) return;   // ponctuation seule ou réglage
    items.push({ type: 'text', index: i, value, label: kind(stack) });
  });
  return { parts, items };
}

export async function textView(page, key, { can }) {
  return page ? editor(page, key, can) : list();
}

async function list() {
  const rows = await get('/content');
  const rank = (k) => { const i = BLOCK_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  return h('div', null, pageHead('Textes des pages', 'Choisissez la page, puis la partie à corriger.', null, ['#/', 'Tableau de bord']),
    Object.keys(PAGES).map((p) => {
      const blocks = rows.filter((r) => r.page === p).sort((a, b) => rank(a.key) - rank(b.key));
      return blocks.length ? h('details', { class: 'card more', open: p === 'accueil' }, h('summary', null, PAGES[p]),
        h('ul', { class: 'rows' }, blocks.map((r) => h('li', null, h('a', { class: 'row', href: `#/content/${r.page}/${r.key}` },
          h('span', { class: 'row-body' }, h('strong', null, BLOCKS[r.key] || r.key), r.title && h('span', null, r.title)), icon('right')))))) : null;
    }));
}

async function editor(page, key, can) {
  const block = await get(`/content/${page}/${key}`);
  let body = block.body;
  const { parts, items } = parse(body);
  const readers = [];
  const changed = () => { dirty.on = true; };

  const rows = items.map((item) => {
    if (item.type === 'text') {
      const input = h('textarea', { rows: String(Math.min(8, Math.max(1, Math.ceil(item.value.length / 70)))), oninput: changed }, item.value);
      readers.push(() => {
        const v = input.value.replace(/\s*\n\s*/g, ' ').trim();
        if (v === item.value) return;                                       // inchangé : on garde l'écriture d'origine
        const old = parts[item.index];
        parts[item.index] = old.match(/^\s*/)[0] + encode(v) + old.match(/\s*$/)[0];
        item.value = v;
      });
      item.input = input;
      return field(item.label, input);
    }
    const tag = parts[item.index];
    let src = readAttr(tag, 'src');
    const alt = h('input', { type: 'text', value: readAttr(tag, 'alt'), oninput: changed });
    const img = h('img', { src: mediaUrl(src), alt: '' });
    let newSrc = null;
    readers.push(() => {
      let t = parts[item.index];
      if (newSrc) t = t.replace(/(\ssrc=")[^"]*(")/, (_, a, b) => a + attr(newSrc) + b);
      if (alt.value !== readAttr(t, 'alt')) t = t.replace(/(\salt=")[^"]*(")/, (_, a, b) => a + attr(alt.value) + b);
      parts[item.index] = t;
    });
    return h('div', { class: 'field' }, h('span', { class: 'label' }, 'Photo'),
      h('div', { class: 'photo-field' }, h('div', { class: 'photo-preview' }, img), h('button', { type: 'button', class: 'btn', onclick: async () => {
        const m = await chooseMedia();
        if (!m) return;
        newSrc = page === 'accueil' ? m.path : `../${m.path}`;
        img.src = mediaUrl(m.path);
        if (!alt.value && m.alt) alt.value = m.alt;
        changed();
      } }, icon('photo'), 'Changer la photo')),
      field('Que montre la photo ?', alt));
  });

  const save = async (next, button) => {
    button.disabled = true;
    try {
      const heading = items.find((i) => i.type === 'text' && /^(Grand titre|Titre)$/.test(i.label));
      await put(`/content/${page}/${key}`, { body: next, ...(heading && { title: heading.value }) });
      body = next;
      dirty.on = false;
      toast(can('publier') ? 'Enregistré. Pensez à publier.' : 'Enregistré');
    } finally { button.disabled = false; }
  };

  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--large' }, 'Enregistrer');
  const form = h('form', { class: 'form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    readers.forEach((r) => r());
    await save(parts.join(''), submit);
    if (raw) raw.value = body;
  } },
  h('div', { class: 'card' }, rows.length ? rows : h('p', null, 'Cette partie ne contient pas de texte à modifier.')),
  h('div', { class: 'savebar' }, submit, h('a', { class: 'btn btn--large', href: '#/content' }, 'Annuler')));

  // mode réservé à l'administrateur : le code de la zone, pour ajouter ou retirer un paragraphe
  let raw = null;
  let advanced = null;
  if (can('*')) {
    raw = h('textarea', { rows: '18', class: 'code', spellcheck: 'false', oninput: changed }, body);
    advanced = h('details', { class: 'card more' }, h('summary', null, 'Mode avancé : modifier le code'),
      h('p', { class: 'help' }, 'Pour ajouter ou retirer des paragraphes. Ne supprimez pas les lignes <!--@…--> ni les mots entre {{…}}.'),
      field('Code de la zone', raw),
      h('button', { type: 'button', class: 'btn', onclick: async (e) => {
        await save(raw.value, e.currentTarget);
        window.dispatchEvent(new HashChangeEvent('hashchange'));            // recharge les champs
      } }, 'Enregistrer le code'));
  }

  return h('div', { class: 'narrow' }, pageHead(BLOCKS[key] || key, PAGES[page] || page, h('a', { class: 'btn', href: '/apercu/', target: '_blank', rel: 'noopener noreferrer' }, icon('eye'), 'Voir l’aperçu'), ['#/content', 'Textes des pages']), form, advanced);
}
