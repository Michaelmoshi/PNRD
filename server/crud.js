// Routes CRUD generiques pour les tables de contenu, avec droits et journal d'audit
const express = require('express');
const db = require('./db');
const auth = require('./auth');

// table, colonnes modifiables (nom -> type), colonnes obligatoires a la creation, ordre d'affichage
const RESOURCES = {
  slides: { table: 'slides', cols: { position: 'int', eyebrow: 's', title: 's', subtitle: 's', style: 's', image_id: 'int?', published: 'bool' }, required: ['title'], order: 'position, id' },
  programmes: { table: 'programmes', cols: { slug: 's', position: 'int', title: 's', summary: 's', body: 's', image_id: 'int?', published: 'bool' }, required: ['slug', 'title'], order: 'position, id' },
  events: { table: 'events', cols: { event_date: 'date', title: 's', description: 's', report: 'arr', poster_id: 'int?', video_mp4: 's', video_webm: 's', published: 'bool' }, required: ['event_date', 'title'], order: 'event_date DESC, id' },
  'member-categories': { table: 'member_categories', cols: { position: 'int', title: 's', intro: 's' }, required: ['title'], order: 'position, id' },
  agenda: { table: 'agenda', cols: { starts_at: 'datetime', title: 's', description: 's', published: 'bool' }, required: ['starts_at', 'title'], order: 'starts_at, id' },
  members: { table: 'members', cols: { category_id: 'int', position: 'int', full_name: 's', function: 's', description: 's', photo_id: 'int?', featured: 'bool', published: 'bool' }, required: ['category_id', 'full_name'], order: 'category_id, position, id' },
  partners: { table: 'partners', cols: { position: 'int', name: 's', url: 's', logo_id: 'int?', published: 'bool' }, required: ['name'], order: 'position, id' },
};

function coerce(type, v) {
  if (type.endsWith('?') && (v === null || v === '')) return null;
  const t = type.replace('?', '');
  if (t === 'int') { const n = Number(v); if (!Number.isInteger(n)) throw new Error('entier attendu'); return n; }
  if (t === 'bool') return v === true || v === 'true';
  if (t === 'arr') { if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error('liste de textes attendue'); return v; }
  if (t === 'datetime') { if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(String(v))) throw new Error('date et heure AAAA-MM-JJ HH:MM attendues'); return String(v).replace('T', ' '); }
  if (t === 'date') { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error('date AAAA-MM-JJ attendue'); return v; }
  if (typeof v !== 'string') throw new Error('texte attendu');
  return v.trim();
}

function pick(res, body, partial) {
  const out = {};
  for (const [col, type] of Object.entries(res.cols)) {
    if (body[col] === undefined) continue;
    try { out[col] = coerce(type, body[col]); } catch (e) { throw Object.assign(new Error(`${col} : ${e.message}`), { status: 400 }); }
  }
  if (!partial) {
    for (const col of res.required) {
      if (out[col] === undefined || out[col] === '' || out[col] === null) throw Object.assign(new Error(`${col} obligatoire`), { status: 400 });
    }
  }
  return out;
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function crud(name, res) {
  const r = express.Router();
  const read = auth.require('contenu.lire');
  const write = auth.require('contenu.ecrire');

  r.get('/', read, wrap(async (_req, out) => {
    out.json((await db.query(`SELECT * FROM ${res.table} ORDER BY ${res.order}`)).rows);
  }));

  r.get('/:id', read, wrap(async (req, out) => {
    const { rows } = await db.query(`SELECT * FROM ${res.table} WHERE id = $1`, [req.params.id]);
    rows[0] ? out.json(rows[0]) : out.status(404).json({ error: 'Introuvable' });
  }));

  r.post('/', write, wrap(async (req, out) => {
    const data = pick(res, req.body, false);
    const cols = Object.keys(data);
    const { rows } = await db.query(
      `INSERT INTO ${res.table} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
      cols.map((c) => data[c]));
    await auth.audit(req, 'creer', name, rows[0].id, data);
    out.status(201).json(rows[0]);
  }));

  r.patch('/:id', write, wrap(async (req, out) => {
    const data = pick(res, req.body, true);
    const cols = Object.keys(data);
    if (!cols.length) return out.status(400).json({ error: 'Aucun champ a modifier' });
    const { rows } = await db.query(
      `UPDATE ${res.table} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(',')} WHERE id = $${cols.length + 1} RETURNING *`,
      [...cols.map((c) => data[c]), req.params.id]);
    if (!rows[0]) return out.status(404).json({ error: 'Introuvable' });
    await auth.audit(req, 'modifier', name, rows[0].id, data);
    out.json(rows[0]);
  }));

  r.delete('/:id', write, wrap(async (req, out) => {
    const { rowCount } = await db.query(`DELETE FROM ${res.table} WHERE id = $1`, [req.params.id]);
    if (!rowCount) return out.status(404).json({ error: 'Introuvable' });
    await auth.audit(req, 'supprimer', name, req.params.id);
    out.status(204).end();
  }));

  return r;
}

module.exports = () => {
  const r = express.Router();
  for (const [name, res] of Object.entries(RESOURCES)) r.use('/' + name, crud(name, res));
  return r;
};
