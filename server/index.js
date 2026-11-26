// API PNRD :  npm run server   (http://localhost:3000)
//   /api/v1/public/*  formulaires du site (adhesion, contact)
//   /api/v1/admin/*   console d'administration (connexion par cookie requise)
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const crud = require('./crud');
const media = require('./media');
const publish = require('./publish');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_ORIGINS = (process.env.PUBLIC_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080').split(',');
const ADMIN_ORIGINS = (process.env.ADMIN_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));   // ignore les envois d'images (type non JSON)
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store' });
  next();
});
app.use((req, _res, next) => {                       // lecture minimale du cookie
  req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  next();
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bad = (res, msg) => res.status(400).json({ error: msg });

// ================================================================ PUBLIC
const pub = express.Router();
pub.use((req, res, next) => {                        // CORS : seulement les sites autorises
  const o = req.headers.origin;
  if (o && PUBLIC_ORIGINS.includes(o)) res.set({ 'Access-Control-Allow-Origin': o, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const hits = new Map();                              // limite simple : N requetes / 15 min / IP
app.locals.resetRateLimits = () => hits.clear();     // utilise par les tests
function limit(max) {
  return (req, res, next) => {
    const key = req.path + req.ip;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < 15 * 60e3);
    if (list.length >= max) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans un quart d’heure.' });
    list.push(now);
    hits.set(key, list);
    next();
  };
}

pub.post('/adhesion', limit(10), wrap(async (req, res) => {
  const b = req.body || {};
  if (str(b.site, 200)) return res.status(201).json({ ok: true });      // champ piege rempli : robot, on fait semblant
  const d = { nom: str(b.nom, 100), postnom: str(b.postnom, 100), prenom: str(b.prenom, 100), telephone: str(b.telephone, 30), email: str(b.email, 200),
    piece: str(b.piece, 100), sexe: str(b.sexe, 20), profession: str(b.profession, 150), ville: str(b.ville, 100), adresse: str(b.adresse, 300) };
  if (!d.nom || !d.prenom || !d.telephone) return bad(res, 'Nom, prenom et telephone sont obligatoires');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return bad(res, 'Adresse e-mail invalide');
  if (b.consent !== true) return bad(res, 'Le consentement est obligatoire');
  const { rows } = await db.query(
    `INSERT INTO applications (nom, postnom, prenom, telephone, email, piece, sexe, profession, ville, adresse, consent_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now()) RETURNING id`,
    [d.nom, d.postnom, d.prenom, d.telephone, d.email, d.piece, d.sexe, d.profession, d.ville, d.adresse]);
  res.status(201).json({ ok: true, id: rows[0].id });
}));

pub.post('/contact', limit(10), wrap(async (req, res) => {
  const b = req.body || {};
  const d = { name: str(b.name, 100), email: str(b.email, 200), message: str(b.message, 5000) };
  if (!d.name || !d.message) return bad(res, 'Nom et message obligatoires');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return bad(res, 'Adresse e-mail invalide');
  await db.query('INSERT INTO contact_messages (name, email, message) VALUES ($1,$2,$3)', [d.name, d.email, d.message]);
  res.status(201).json({ ok: true });
}));

app.use('/api/v1/public', pub);

// ================================================================ ADMIN
const admin = express.Router();
admin.use((req, res, next) => {                      // anti-CSRF : origine connue pour toute ecriture
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const o = req.headers.origin;
    if (o && !ADMIN_ORIGINS.includes(o)) return res.status(403).json({ error: 'Origine refusee' });
    const isUpload = req.path === '/media' && req.method === 'POST';
    if (!isUpload && !req.is('application/json') && Number(req.headers['content-length'])) return res.status(415).json({ error: 'JSON requis' });
  }
  next();
});
admin.use(wrap(auth.loadUser));

admin.post('/auth/login', limit(10), wrap(async (req, res) => {
  const email = str(req.body?.email, 200);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const { rows } = await db.query(
    `SELECT u.id, u.password_hash, u.active FROM users u WHERE u.email = $1`, [email]);
  const u = rows[0];
  const ok = u && u.active && auth.verifyPassword(password, u.password_hash);
  if (!ok) {
    await db.query("INSERT INTO audit_log (action, entity, details, ip) VALUES ('connexion_echec','auth',$1,$2)", [{ email }, req.ip]);
    return res.status(401).json({ error: 'Adresse e-mail ou mot de passe incorrect' });
  }
  await auth.createSession(res, u.id);
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);
  req.user = { id: u.id };
  await auth.audit(req, 'connexion', 'auth', u.id);
  res.json({ ok: true });
}));

admin.post('/auth/logout', wrap(async (req, res) => {
  if (req.user) await auth.audit(req, 'deconnexion', 'auth', req.user.id);
  await auth.destroySession(req, res);
  res.json({ ok: true });
}));

admin.get('/auth/me', auth.require(), (req, res) => {
  const { id, email, full_name, role, permissions } = req.user;
  res.json({ id, email, full_name, role, permissions });
});

admin.use(crud());
admin.use('/media', media);
admin.use(publish.admin);

// ---- blocs de texte : /content/:page/:key
admin.get('/content', auth.require('contenu.lire'), wrap(async (_req, res) => {
  res.json((await db.query('SELECT page, key, title, updated_at FROM content_blocks ORDER BY page, key')).rows);
}));
admin.get('/content/:page/:key', auth.require('contenu.lire'), wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM content_blocks WHERE page = $1 AND key = $2', [req.params.page, req.params.key]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Introuvable' });
}));
admin.put('/content/:page/:key', auth.require('contenu.ecrire'), wrap(async (req, res) => {
  const { title, body } = req.body || {};
  if (typeof body !== 'string') return bad(res, 'body (texte) obligatoire');
  // seul l'administrateur peut introduire du code actif dans une page du site
  if (!auth.can(req.user, '*') && /<\s*(script|object|embed|base|meta)\b|[\s/"']on\w+\s*=|javascript:/i.test(body)) {
    return bad(res, 'Ce texte contient du code qui n’est pas autorisé.');
  }
  const { rows } = await db.query(
    `UPDATE content_blocks SET title = COALESCE($3, title), body = $4, updated_by = $5, updated_at = now()
      WHERE page = $1 AND key = $2 RETURNING page, key, title, updated_at`,
    [req.params.page, req.params.key, typeof title === 'string' ? title.trim() : null, body, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
  await auth.audit(req, 'modifier', 'content', `${req.params.page}/${req.params.key}`);
  res.json(rows[0]);
}));

// ---- parametres
admin.get('/settings', auth.require('contenu.lire'), wrap(async (_req, res) => {
  res.json(Object.fromEntries((await db.query('SELECT key, value FROM settings ORDER BY key')).rows.map((r) => [r.key, r.value])));
}));
admin.put('/settings', auth.require('contenu.ecrire'), wrap(async (req, res) => {
  const entries = Object.entries(req.body || {});
  if (!entries.length || entries.some(([k, v]) => typeof v !== 'string' || k.length > 100)) return bad(res, 'Objet { cle: "valeur" } attendu');
  for (const [k, v] of entries) {
    await db.query(`INSERT INTO settings (key, value) VALUES ($1,$2)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [k, v.slice(0, 5000)]);
  }
  await auth.audit(req, 'modifier', 'settings', null, { cles: entries.map(([k]) => k) });
  res.json({ ok: true });
}));

// ---- adhesions
const STATUSES = ['recue', 'en_etude', 'acceptee', 'declinee'];
admin.get('/applications', auth.require('adhesions.lire'), wrap(async (req, res) => {
  const st = STATUSES.includes(req.query.status) ? req.query.status : null;
  res.json((await db.query(
    `SELECT a.*, u.full_name AS assigned_name FROM applications a LEFT JOIN users u ON u.id = a.assigned_to
      WHERE ($1::application_status IS NULL OR a.status = $1) ORDER BY a.created_at DESC`, [st])).rows);
}));
admin.get('/applications/:id', auth.require('adhesions.lire'), wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
  const notes = (await db.query(
    `SELECT n.id, n.note, n.created_at, u.full_name AS author FROM application_notes n
       LEFT JOIN users u ON u.id = n.author_id WHERE n.application_id = $1 ORDER BY n.created_at`, [req.params.id])).rows;
  await auth.audit(req, 'consulter', 'applications', req.params.id);
  res.json({ ...rows[0], notes });
}));
admin.patch('/applications/:id', auth.require('adhesions.ecrire'), wrap(async (req, res) => {
  const { status, assigned_to } = req.body || {};
  if (status !== undefined && !STATUSES.includes(status)) return bad(res, 'Statut invalide');
  if (assigned_to !== undefined && assigned_to !== null && !Number.isInteger(assigned_to)) return bad(res, 'assigned_to invalide');
  const { rows } = await db.query(
    `UPDATE applications SET status = COALESCE($2::application_status, status),
            assigned_to = CASE WHEN $3::boolean THEN $4::integer ELSE assigned_to END, updated_at = now()
      WHERE id = $1 RETURNING id, status, assigned_to`,
    [req.params.id, status ?? null, assigned_to !== undefined, assigned_to ?? null]);
  if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
  await auth.audit(req, 'modifier', 'applications', rows[0].id, { status, assigned_to });
  res.json(rows[0]);
}));
admin.post('/applications/:id/notes', auth.require('adhesions.ecrire'), wrap(async (req, res) => {
  const note = str(req.body?.note, 5000);
  if (!note) return bad(res, 'Note vide');
  const { rows } = await db.query(
    `INSERT INTO application_notes (application_id, author_id, note)
     SELECT id, $2, $3 FROM applications WHERE id = $1 RETURNING id, note, created_at`, [req.params.id, req.user.id, note]);
  if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
  await auth.audit(req, 'noter', 'applications', req.params.id);
  res.status(201).json(rows[0]);
}));

// ---- messages de contact
admin.get('/messages', auth.require('messages.lire'), wrap(async (_req, res) => {
  res.json((await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC')).rows);
}));
admin.patch('/messages/:id', auth.require('messages.lire'), wrap(async (req, res) => {
  const { rows } = await db.query('UPDATE contact_messages SET handled = $2 WHERE id = $1 RETURNING id, handled', [req.params.id, req.body?.handled === true]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Introuvable' });
}));

// ---- collaborateurs (pour assigner une adhesion)
admin.get('/staff', auth.require('adhesions.lire'), wrap(async (_req, res) => {
  res.json((await db.query('SELECT id, full_name FROM users WHERE active ORDER BY full_name')).rows);
}));

// ---- utilisateurs et audit (administrateur seulement)
admin.get('/roles', auth.require('*'), wrap(async (_req, res) => { res.json((await db.query('SELECT id, code, label FROM roles ORDER BY id')).rows); }));
admin.get('/users', auth.require('*'), wrap(async (_req, res) => {
  res.json((await db.query(`SELECT u.id, u.email, u.full_name, u.active, u.last_login_at, r.code AS role
                              FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`)).rows);
}));
admin.post('/users', auth.require('*'), wrap(async (req, res) => {
  const email = str(req.body?.email, 200), full_name = str(req.body?.full_name, 150), password = req.body?.password;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !full_name) return bad(res, 'Indiquez le nom et l’adresse e-mail');
  if (typeof password !== 'string' || password.length < 10) return bad(res, 'Le mot de passe doit contenir au moins 10 caractères');
  const role = await db.query('SELECT id FROM roles WHERE code = $1', [req.body?.role]);
  if (!role.rows[0]) return bad(res, 'Role inconnu');
  try {
    const { rows } = await db.query('INSERT INTO users (email, full_name, password_hash, role_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [email, full_name, auth.hashPassword(password), role.rows[0].id]);
    await auth.audit(req, 'creer', 'users', rows[0].id, { email, role: req.body.role });
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Cette adresse e-mail a déjà un compte' });
    throw e;
  }
}));
admin.patch('/users/:id', auth.require('*'), wrap(async (req, res) => {
  const { active, password } = req.body || {};
  if (active === false && Number(req.params.id) === req.user.id) return bad(res, 'Vous ne pouvez pas désactiver votre propre compte');
  if (password !== undefined && (typeof password !== 'string' || password.length < 10)) return bad(res, 'Le mot de passe doit contenir au moins 10 caractères');
  const { rows } = await db.query(
    `UPDATE users SET active = COALESCE($2, active), password_hash = COALESCE($3, password_hash) WHERE id = $1 RETURNING id, active`,
    [req.params.id, typeof active === 'boolean' ? active : null, password ? auth.hashPassword(password) : null]);
  if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
  if (active === false || password) await db.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
  await auth.audit(req, 'modifier', 'users', rows[0].id, { active, motdepasse: !!password });
  res.json(rows[0]);
}));
admin.get('/audit', auth.require('*'), wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json((await db.query(`SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.ip, a.created_at, u.full_name AS user_name
                              FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT $1`, [limit])).rows);
}));

admin.get('/dashboard', auth.require(), wrap(async (req, res) => {
  const q = async (sql) => (await db.query(sql)).rows;
  const out = { user: { full_name: req.user.full_name, role: req.user.role } };
  if (auth.can(req.user, 'adhesions.lire')) {
    out.applications = Object.fromEntries((await q('SELECT status, count(*)::int AS n FROM applications GROUP BY status')).map((r) => [r.status, r.n]));
    out.recentApplications = await q('SELECT id, nom, prenom, status, created_at FROM applications ORDER BY created_at DESC LIMIT 5');
  }
  if (auth.can(req.user, 'messages.lire')) out.messagesToHandle = (await q('SELECT count(*)::int AS n FROM contact_messages WHERE NOT handled'))[0].n;
  if (auth.can(req.user, 'contenu.lire')) {
    out.content = (await q(`SELECT (SELECT count(*) FROM programmes)::int AS programmes, (SELECT count(*) FROM events)::int AS events,
      (SELECT count(*) FROM members)::int AS members, (SELECT count(*) FROM partners)::int AS partners, (SELECT count(*) FROM media)::int AS media`))[0];
    out.upcoming = await q(`SELECT id, title, starts_at FROM agenda WHERE published AND starts_at >= now()::timestamp ORDER BY starts_at LIMIT 4`);
    out.photosWithoutText = (await q("SELECT count(*)::int AS n FROM media WHERE alt = ''"))[0].n;
  }
  if (auth.can(req.user, 'adhesions.lire')) {             // demandes recues par mois, six derniers mois
    out.applicationsByMonth = await q(`SELECT to_char(m, 'YYYY-MM') AS month, count(a.id)::int AS n
      FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
      LEFT JOIN applications a ON date_trunc('month', a.created_at) = m GROUP BY m ORDER BY m`);
  }
  if (auth.can(req.user, 'contenu.lire')) out.publication = await publish.status();
  if (auth.can(req.user, '*')) {
    out.recentActivity = await q(`SELECT a.action, a.entity, a.created_at, u.full_name AS user_name FROM audit_log a
                                  LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 8`);
  }
  res.json(out);
}));

app.use('/api/v1/admin', admin);

// ---- console (fichiers statiques) et images envoyees
const ROOT = path.join(__dirname, '..');
app.use('/admin', (_req, res, next) => {
  res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; media-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  next();
}, express.static(path.join(ROOT, 'admin'), { index: 'index.html' }));
// css, scripts et images viennent du depot ; les pages viennent de la derniere version publiee
const assets = express.Router();
for (const d of ['css', 'js']) assets.use('/' + d, express.static(path.join(ROOT, d), { maxAge: '5m' }));
assets.use('/assets', express.static(path.join(ROOT, 'assets'), { maxAge: '1h' }));
app.use('/apercu', publish.previewPages, assets);   // apercu des modifications non publiees (connexion requise)
app.use(assets);
app.use(publish.publicSite);                        // le site public, a la racine
publish.refreshLive().catch((e) => console.error('Publication :', e.message));

app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Fichier trop lourd (10 Mo au maximum)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.code === '23505') return res.status(409).json({ error: 'Cette valeur est déjà utilisée' });
  if (err.code === '23503') return res.status(409).json({ error: 'Impossible : cet élément est utilisé ailleurs' });
  if (err.code === '22P02' || err.code === '22007') return res.status(400).json({ error: 'Valeur invalide' });
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

if (require.main === module) app.listen(PORT, () => console.log(`API PNRD : http://localhost:${PORT}/api/v1/health`));
module.exports = app;
