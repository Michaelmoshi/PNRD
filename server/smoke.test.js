// Test de bout en bout de l'API sur la base locale :  npm test
// Cree deux comptes temporaires (admin, editeur), verifie droits, CRUD, adhesions, audit, puis nettoie.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const app = require('./index');
const { generate } = require('../tools/build-db');

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

test('images : envoi converti en WebP reduit, service statique, suppression', async () => {
  const c = client();
  await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });
  const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#336699' } }).png().toBuffer();
  const up = await fetch(`${base}${A}/media?name=Photo%20d%27%C3%A9t%C3%A9.png&alt=Essai`, {
    method: 'POST', headers: { 'Content-Type': 'image/png', Cookie: (await (async () => { const r = await fetch(`${base}${A}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EDIT, password: PW }) }); return r.headers.get('set-cookie').split(';')[0]; })()) },
    body: png,
  });
  assert.equal(up.status, 201);
  const m = await up.json();
  assert.match(m.path, /^assets\/uploads\/\d{4}\/photo-d-ete-[0-9a-f]{6}\.webp$/);
  assert.equal(m.width, 1600);
  assert.equal((await fetch(`${base}/${m.path}`)).status, 200);

  const bad = await fetch(`${base}${A}/media`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: (await (async () => { const r = await fetch(`${base}${A}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EDIT, password: PW }) }); return r.headers.get('set-cookie').split(';')[0]; })()) }, body: 'pas une image' });
  assert.equal(bad.status, 415);

  assert.equal((await c('DELETE', `${A}/media/${m.id}`)).status, 204);
  assert.equal(fs.existsSync(path.join(__dirname, '..', m.path)), false);
});

test('console : page servie avec une politique CSP stricte', async () => {
  const res = await fetch(`${base}/admin/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
});

test('dates : renvoyees telles quelles, sans decalage de fuseau', async () => {
  const c = client();
  await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });
  const ev = (await c('GET', `${A}/events`)).body.find((e) => e.id === 1);
  assert.equal(ev.event_date, '2025-07-15');
  const made = await c('POST', `${A}/agenda`, { starts_at: '2030-01-05T09:30', title: 'Test agenda' });
  assert.equal(made.status, 201);
  assert.equal(made.body.starts_at, '2030-01-05 09:30:00');
  assert.equal((await c('POST', `${A}/agenda`, { starts_at: 'demain', title: 'x' })).status, 400);
  assert.equal((await c('DELETE', `${A}/agenda/${made.body.id}`)).status, 204);
});

test('formulaire public : CORS pour le site autorise seulement, champ piege ignore', async () => {
  const site = 'http://localhost:8080';
  const ok = await fetch(`${base}/api/v1/public/adhesion`, { method: 'OPTIONS', headers: { Origin: site, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), site);
  const evil = await fetch(`${base}/api/v1/public/adhesion`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);

  const before = (await db.query('SELECT count(*)::int AS n FROM applications')).rows[0].n;
  const bot = await fetch(`${base}/api/v1/public/adhesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Bot', prenom: 'Bot', telephone: '1', email: 'candidat@test.local', consent: true, site: 'http://spam' }) });
  assert.equal(bot.status, 201);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM applications')).rows[0].n, before);
});

test('publication : version, site en ligne, aperçu, retour arriere (sans laisser de trace)', async () => {
  const liveBefore = (await db.query('SELECT id FROM publications WHERE live')).rows[0]?.id ?? null;
  const maxBefore = (await db.query('SELECT coalesce(max(id), 0) AS m FROM publications')).rows[0].m;
  app.locals.resetRateLimits();
  const marker = 'Programme-test-publication';
  try {
    const c = client();
    assert.equal((await c('POST', `${A}/publish`, {})).status, 401);
    await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });

    // un contenu visible sur l'accueil (cartes des programmes)
    const prog = await c('POST', `${A}/programmes`, { slug: 'test-pub', title: marker, summary: 'Test', body: 'Texte' });
    assert.equal(prog.status, 201);
    assert.equal((await c('GET', `${A}/publish/status`)).body.upToDate, false);

    // apercu : connexion requise, montre la modification avant publication
    assert.equal((await fetch(`${base}/apercu/`)).status, 401);
    const cookie = (await (await fetch(`${base}${A}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EDIT, password: PW }) })).headers.get('set-cookie')).split(';')[0];
    const preview = await fetch(`${base}/apercu/`, { headers: { Cookie: cookie } });
    assert.equal(preview.status, 200);
    assert.match(await preview.text(), new RegExp(marker));

    const first = await c('POST', `${A}/publish`, { note: 'test 1' });
    assert.equal(first.status, 201);
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), new RegExp(marker));
    assert.equal((await fetch(`${base}/css/base.css`)).status, 200);
    assert.equal((await fetch(`${base}/pages/membres.html`)).status, 200);
    assert.equal((await c('GET', `${A}/publish/status`)).body.upToDate, true);
    assert.equal((await c('POST', `${A}/publish`, {})).body.unchanged, true);

    // on retire le contenu, on republie : le site ne l'affiche plus
    assert.equal((await c('DELETE', `${A}/programmes/${prog.body.id}`)).status, 204);
    assert.equal((await c('GET', `${A}/publish/status`)).body.upToDate, false);
    const second = await c('POST', `${A}/publish`, { note: 'test 2' });
    assert.equal(second.status, 201);
    assert.doesNotMatch(await (await fetch(`${base}/`)).text(), new RegExp(marker));

    // retour a la premiere version
    assert.equal((await c('POST', `${A}/publish/${first.body.id}/restore`)).status, 200);
    assert.match(await (await fetch(`${base}/`)).text(), new RegExp(marker));
    const hist = (await c('GET', `${A}/publish/history`)).body;
    assert.equal(hist.find((v) => v.id === first.body.id).live, true);
    assert.equal((await c('POST', `${A}/publish/999999/restore`)).status, 404);
  } finally {
    await db.query("DELETE FROM programmes WHERE slug = 'test-pub'");
    const mine = (await db.query('SELECT id FROM publications WHERE id > $1', [maxBefore])).rows;
    await db.query('DELETE FROM publications WHERE id > $1', [maxBefore]);
    for (const r of mine) fs.rmSync(path.join(__dirname, '..', 'published', `v${r.id}`), { recursive: true, force: true });
    if (liveBefore) await db.query('UPDATE publications SET live = true WHERE id = $1', [liveBefore]);
  }
});

test('ajouts depuis la console : identifiant automatique, visibles sur le site (sans toucher aux donnees)', async () => {
  const client2 = await db.connect();
  try {
    await client2.query('BEGIN');                       // tout est annule a la fin
    await client2.query("INSERT INTO programmes (slug, position, title, body) VALUES ('test-zz', 99, 'Programme ajoute', 'x')");
    const cat = (await client2.query("INSERT INTO member_categories (position, title) VALUES (99, 'Groupe ajoute') RETURNING id")).rows[0].id;
    const media = (await client2.query("INSERT INTO media (path, kind) VALUES ('assets/uploads/test/bandeau.webp', 'image') RETURNING id")).rows[0].id;
    await client2.query("INSERT INTO slides (position, title, image_id) VALUES (99, 'Photo ajoutee', $1)", [media]);
    let out = await generate(client2);
    assert.match(out.get('pages/programmes.html'), /Programme ajoute/);
    assert.match(out.get('pages/membres.html'), new RegExp(`data-team="categorie-${cat}"`));
    assert.match(out.get('index.html'), /class="slide-bg" src="assets\/uploads\/test\/bandeau\.webp"/);

    await client2.query("UPDATE programmes SET published = false WHERE slug = 'test-zz'");
    await client2.query('UPDATE events SET published = false');
    out = await generate(client2);                      // aucun evenement : pas d'erreur
    assert.doesNotMatch(out.get('pages/programmes.html'), /Programme ajoute/);
    assert.match(out.get('index.html'), /bientôt disponibles/);
  } finally {
    await client2.query('ROLLBACK');
    client2.release();
  }
});

test('programme sans identifiant saisi, et code actif refuse a un editeur', async () => {
  app.locals.resetRateLimits();
  const c = client();
  await c('POST', `${A}/auth/login`, { email: EDIT, password: PW });
  const a = await c('POST', `${A}/programmes`, { title: 'Santé pour tous (test auto)' });
  const b = await c('POST', `${A}/programmes`, { title: 'Santé pour tous (test auto)' });
  try {
    assert.equal(a.body.slug, 'sante-pour-tous-test-auto');
    assert.equal(b.body.slug, 'sante-pour-tous-test-auto-2');
  } finally {
    await db.query("DELETE FROM programmes WHERE slug LIKE 'sante-pour-tous-test-auto%'");
  }
  const block = (await c('GET', `${A}/content/accueil/vision`)).body.body;
  for (const bad of ['<script>alert(1)</script>', '<img src=x onerror="alert(1)">', '<a href="javascript:alert(1)">x</a>']) {
    assert.equal((await c('PUT', `${A}/content/accueil/vision`, { body: block + bad })).status, 400, bad);
  }
  assert.equal((await c('GET', `${A}/content/accueil/vision`)).body.body, block);
});
