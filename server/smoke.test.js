// Test de bout en bout de l'API sur la base locale :  npm test
// Cree deux comptes temporaires (admin, editeur), verifie droits, CRUD, adhesions, audit, puis nettoie.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const app = require('./index');

let base;
let server;
const PW = 'test-' + crypto.randomBytes(8).toString('hex');
const ADMIN = `t-admin-${Date.now()}@test.local`;
const EDIT = `t-edit-${Date.now()}@test.local`;

function client() {
  let cookie = '';
  return async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: set };
  };
}
const A = '/api/v1/admin';

test.before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [email, role] of [[ADMIN, 'admin'], [EDIT, 'editeur']]) {
    await db.query('INSERT INTO users (email, full_name, password_hash, role_id) VALUES ($1,$2,$3,(SELECT id FROM roles WHERE code=$4))',
      [email, 'Test ' + role, auth.hashPassword(PW), role]);
  }
});

test.after(async () => {
  await db.query('DELETE FROM users WHERE email = ANY($1)', [[ADMIN, EDIT]]);
  await db.query("DELETE FROM applications WHERE email = 'candidat@test.local'");
  await db.query("DELETE FROM contact_messages WHERE email = 'candidat@test.local'");
  await db.query("DELETE FROM programmes WHERE slug = 'test-prog'");
  server.close();
  await db.end();
});

test('sans connexion : acces refuse', async () => {
  const c = client();
  assert.equal((await c('GET', `${A}/programmes`)).status, 401);
  assert.equal((await c('GET', `${A}/auth/me`)).status, 401);
});

test('connexion : mauvais mot de passe refuse, bon mot de passe pose un cookie HttpOnly', async () => {
  const c = client();
  assert.equal((await c('POST', `${A}/auth/login`, { email: EDIT, password: 'faux' })).status, 401);
  const ok = await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });
  assert.equal(ok.status, 200);
  assert.match(ok.setCookie, /HttpOnly/i);
  assert.match(ok.setCookie, /SameSite=Lax/i);
  const me = await c('GET', `${A}/auth/me`);
  assert.equal(me.body.role, 'editeur');
});

test('editeur : CRUD contenu autorise, mais pas utilisateurs ni audit ni adhesions', async () => {
  const c = client();
  await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });
  const list = await c('GET', `${A}/programmes`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length >= 4, true);

  const created = await c('POST', `${A}/programmes`, { slug: 'test-prog', title: 'Test' });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await c('PATCH', `${A}/programmes/${id}`, { title: 'Modifie' })).body.title, 'Modifie');
  assert.equal((await c('POST', `${A}/programmes`, { slug: 'test-prog', title: 'Doublon' })).status, 409);
  assert.equal((await c('POST', `${A}/programmes`, { slug: '' })).status, 400);
  assert.equal((await c('DELETE', `${A}/programmes/${id}`)).status, 204);

  assert.equal((await c('GET', `${A}/users`)).status, 403);
  assert.equal((await c('GET', `${A}/audit`)).status, 403);
  assert.equal((await c('GET', `${A}/applications`)).status, 403);
});

test('origine inconnue refusee sur ecriture (anti-CSRF)', async () => {
  const c = client();
  await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });
  const r = await c('POST', `${A}/programmes`, { slug: 'x', title: 'x' }, { Origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('adhesion publique, puis traitement par un administrateur, audit', async () => {
  const pub = client();
  assert.equal((await pub('POST', '/api/v1/public/adhesion', { nom: 'A', prenom: 'B', telephone: '1', email: 'pas-un-mail', consent: true })).status, 400);
  assert.equal((await pub('POST', '/api/v1/public/adhesion', { nom: 'A', prenom: 'B', telephone: '1', email: 'candidat@test.local' })).status, 400);
  const sent = await pub('POST', '/api/v1/public/adhesion', { nom: 'Dupont', prenom: 'Jean', telephone: '+243000', email: 'candidat@test.local', consent: true });
  assert.equal(sent.status, 201);

  const c = client();
  await c('POST', `${A}/auth/login`, { email: ADMIN, password: PW });
  const id = sent.body.id;
  assert.equal((await c('PATCH', `${A}/applications/${id}`, { status: 'inconnu' })).status, 400);
  assert.equal((await c('PATCH', `${A}/applications/${id}`, { status: 'en_etude' })).body.status, 'en_etude');
  assert.equal((await c('POST', `${A}/applications/${id}/notes`, { note: 'Dossier complet' })).status, 201);
  const detail = await c('GET', `${A}/applications/${id}`);
  assert.equal(detail.body.notes.length, 1);

  const log = await c('GET', `${A}/audit?limit=20`);
  assert.equal(log.status, 200);
  assert.equal(log.body.some((l) => l.entity === 'applications' && l.action === 'modifier'), true);
});

test('deconnexion invalide la session', async () => {
  const c = client();
  await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });
  await c('POST', `${A}/auth/logout`, {});
  assert.equal((await c('GET', `${A}/auth/me`)).status, 401);
});
