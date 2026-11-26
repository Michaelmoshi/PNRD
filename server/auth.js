// Mots de passe (scrypt), sessions par cookie HttpOnly, permissions par role, journal d'audit
const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'pnrd_session';
const SESSION_DAYS = 7;
const PROD = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------- mots de passe
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------- sessions
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)', [sha(token), userId, expires]);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: PROD, expires, path: '/' });
}

async function destroySession(req, res) {
  const token = req.cookies[COOKIE];
  if (token) await db.query('DELETE FROM sessions WHERE id = $1', [sha(token)]);
  res.clearCookie(COOKIE, { path: '/' });
}

// Lit le cookie et charge req.user (ou null)
async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies[COOKIE];
  if (token) {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.full_name, r.code AS role, r.permissions
         FROM sessions s JOIN users u ON u.id = s.user_id JOIN roles r ON r.id = u.role_id
        WHERE s.id = $1 AND s.expires_at > now() AND u.active`, [sha(token)]);
    req.user = rows[0] || null;
  }
  next();
}

const can = (user, perm) => !!user && (user.permissions.includes('*') || user.permissions.includes(perm));

// Exige une connexion et, si perm est donnee, cette permission
const require_ = (perm) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Connexion requise' });
  if (perm && !can(req.user, perm)) return res.status(403).json({ error: 'Votre compte ne permet pas cette action' });
  next();
};

// ---------------------------------------------------------------- audit
async function audit(req, action, entity, entityId, details = {}) {
  await db.query(
    'INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.user?.id ?? null, action, entity, entityId == null ? null : String(entityId), details, req.ip]);
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, loadUser, require: require_, can, audit };
