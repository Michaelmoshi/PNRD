// Publication du site : genere les pages depuis la base, garde les versions, permet de revenir en arriere.
//   published/v<id>/   pages generees d'une version (pages HTML et data/evenements.json)
//   la version "live" est celle servie a la racine du serveur ; css, js et images viennent du depot (assets/)
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const { generate } = require('../tools/build-db');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'published');
const KEEP = 10;                                           // versions conservees sur disque

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const dirOf = (id) => path.join(PUB, `v${id}`);
const hashOf = (map) => {
  const h = crypto.createHash('sha256');
  for (const k of [...map.keys()].sort()) h.update(k + '\0' + map.get(k) + '\0');
  return h.digest('hex');
};

// ---------------------------------------------------------------- version en ligne (gardee en memoire)
let liveStatic = null;
let liveId = null;
const cacheHeaders = (res) => res.setHeader('Cache-Control', 'public, max-age=60');

async function refreshLive() {
  const { rows } = await db.query('SELECT id FROM publications WHERE live AND NOT purged');
  liveId = rows[0]?.id ?? null;
  liveStatic = liveId && fs.existsSync(dirOf(liveId)) ? express.static(dirOf(liveId), { setHeaders: cacheHeaders }) : null;
}

// Sert le site publie a la racine ; passe la main s'il n'y a rien de publie
const publicSite = (req, res, next) => (liveStatic ? liveStatic(req, res, next) : next());

// ---------------------------------------------------------------- ecriture d'une version
function writeVersion(id, map) {
  const tmp = path.join(PUB, `.tmp-${id}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const [file, content] of map) {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), content, 'utf8');
  }
  fs.renameSync(tmp, dirOf(id));
}

async function purgeOld() {
  const { rows } = await db.query('SELECT id FROM publications WHERE NOT purged AND NOT live ORDER BY id DESC OFFSET $1', [KEEP - 1]);
  for (const r of rows) {
    fs.rmSync(dirOf(r.id), { recursive: true, force: true });
    await db.query('UPDATE publications SET purged = true WHERE id = $1', [r.id]);
  }
}

async function status() {
  const map = await generate(db);
  const hash = hashOf(map);
  const { rows } = await db.query(
    `SELECT p.id, p.created_at, p.note, p.content_hash, u.full_name AS user_name FROM publications p
       LEFT JOIN users u ON u.id = p.user_id WHERE p.live`);
  const live = rows[0] || null;
  return { published: !!live, upToDate: !!live && live.content_hash === hash,
    live: live && { id: live.id, created_at: live.created_at, note: live.note, user_name: live.user_name } };
}

// ---------------------------------------------------------------- routes admin
const admin = express.Router();

admin.get('/publish/status', auth.require('contenu.lire'), wrap(async (_req, res) => { res.json(await status()); }));

admin.get('/publish/history', auth.require('contenu.lire'), wrap(async (_req, res) => {
  res.json((await db.query(
    `SELECT p.id, p.created_at, p.note, p.live, p.purged, u.full_name AS user_name FROM publications p
       LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 50`)).rows);
}));

admin.post('/publish', auth.require('publier'), wrap(async (req, res) => {
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
  const map = await generate(db);
  const hash = hashOf(map);
  const cur = await db.query('SELECT 1 FROM publications WHERE live AND content_hash = $1', [hash]);
  if (cur.rowCount) return res.json({ unchanged: true });               // rien de nouveau depuis la derniere publication

  fs.mkdirSync(PUB, { recursive: true });
  const client = await db.connect();
  let id;
  try {
    await client.query('BEGIN');
    id = (await client.query('INSERT INTO publications (user_id, note, content_hash) VALUES ($1,$2,$3) RETURNING id', [req.user.id, note, hash])).rows[0].id;
    writeVersion(id, map);                                                // si l'ecriture echoue, tout est annule
    await client.query('UPDATE publications SET live = false WHERE live');
    await client.query('UPDATE publications SET live = true WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    fs.rmSync(dirOf(id || 0), { recursive: true, force: true });
    throw e;
  } finally { client.release(); }

  await refreshLive();
  await purgeOld();
  await auth.audit(req, 'publier', 'site', id, { note });
  res.status(201).json({ id });
}));

admin.post('/publish/:id/restore', auth.require('publier'), wrap(async (req, res) => {
  const { rows } = await db.query('SELECT id, purged FROM publications WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Version introuvable' });
  if (rows[0].purged || !fs.existsSync(dirOf(rows[0].id))) return res.status(410).json({ error: 'Cette version est trop ancienne et n’est plus conservee' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE publications SET live = false WHERE live');
    await client.query('UPDATE publications SET live = true WHERE id = $1', [rows[0].id]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  await refreshLive();
  await auth.audit(req, 'restaurer', 'site', rows[0].id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- apercu : pages generees a la volee, sans publier
const previewPages = wrap(async (req, res, next) => {
  await new Promise((ok) => auth.loadUser(req, res, ok));
  if (!auth.can(req.user, 'contenu.lire')) return res.status(401).type('text/plain').send('Connexion requise : ouvrez la console puis cliquez sur « Aperçu ».');
  let p = decodeURIComponent(req.path).replace(/^\/+/, '');
  if (!p || p.endsWith('/')) p += 'index.html';
  const map = await generate(db);
  if (!map.has(p)) return next();
  res.set('Cache-Control', 'no-store').type(path.extname(p)).send(map.get(p));
});

module.exports = { admin, publicSite, previewPages, refreshLive, status };
