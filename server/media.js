// Mediatheque : envoi d'images (recadrees a 1600 px max, converties en WebP), liste, legende, suppression
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const db = require('./db');
const auth = require('./auth');

const ROOT = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'assets', 'uploads');
const MAX_BYTES = 10 * 1024 * 1024;

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[^.]*$/, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'image';

const r = express.Router();

r.get('/', auth.require('contenu.lire'), wrap(async (_req, res) => {
  res.json((await db.query('SELECT * FROM media ORDER BY created_at DESC, id DESC')).rows);
}));

r.post('/', auth.require('medias.ecrire'), express.raw({ type: () => true, limit: MAX_BYTES }), wrap(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Aucun fichier recu' });
  let image;
  try {
    image = sharp(req.body, { limitInputPixels: 50e6 }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 });
    await image.metadata();
  } catch {
    return res.status(415).json({ error: 'Fichier non reconnu : envoyez une image JPEG, PNG, WebP ou GIF' });
  }
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  const year = String(new Date().getFullYear());
  const file = `${slug(req.query.name || 'image')}-${crypto.randomBytes(3).toString('hex')}.webp`;
  const rel = `assets/uploads/${year}/${file}`;
  fs.mkdirSync(path.join(UPLOADS, year), { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, year, file), data);
  const alt = typeof req.query.alt === 'string' ? req.query.alt.slice(0, 200) : '';
  const { rows } = await db.query(
    'INSERT INTO media (path, kind, alt, width, height, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [rel, 'image', alt, info.width, info.height, req.user.id]);
  await auth.audit(req, 'envoyer', 'media', rows[0].id, { path: rel, octets: data.length });
  res.status(201).json(rows[0]);
}));

r.patch('/:id', auth.require('medias.ecrire'), wrap(async (req, res) => {
  if (typeof req.body?.alt !== 'string') return res.status(400).json({ error: 'alt (texte) obligatoire' });
  const { rows } = await db.query('UPDATE media SET alt = $2 WHERE id = $1 RETURNING *', [req.params.id, req.body.alt.trim().slice(0, 200)]);
  if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
  await auth.audit(req, 'modifier', 'media', rows[0].id);
  res.json(rows[0]);
}));

r.delete('/:id', auth.require('medias.ecrire'), wrap(async (req, res) => {
  const { rows } = await db.query('DELETE FROM media WHERE id = $1 RETURNING path', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
  const abs = path.resolve(ROOT, rows[0].path);
  if (abs.startsWith(UPLOADS + path.sep) && fs.existsSync(abs)) fs.unlinkSync(abs);   // jamais les images du site
  await auth.audit(req, 'supprimer', 'media', req.params.id, { path: rows[0].path });
  res.status(204).end();
}));

module.exports = r;
