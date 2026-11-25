// Cree (ou reinitialise) un compte :  npm run admin:create -- email "Nom complet" [role] [mot-de-passe]
// Sans mot de passe, un mot de passe aleatoire est genere et affiche UNE fois.
const crypto = require('crypto');
const { connect } = require('./lib');
const { hashPassword } = require('../server/auth');

(async () => {
  const [email, name, role = 'admin', given] = process.argv.slice(2);
  if (!email || !name) throw new Error('Usage : npm run admin:create -- email "Nom complet" [admin|editeur|secretariat] [mot-de-passe]');
  const password = given || crypto.randomBytes(12).toString('base64url');
  if (password.length < 10) throw new Error('Mot de passe : 10 caracteres minimum');
  const db = await connect();
  const r = await db.query('SELECT id FROM roles WHERE code = $1', [role]);
  if (!r.rows[0]) throw new Error(`Role inconnu : ${role}`);
  await db.query(
    `INSERT INTO users (email, full_name, password_hash, role_id) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name,
                                       role_id = EXCLUDED.role_id, active = true`,
    [email, name, hashPassword(password), r.rows[0].id]);
  await db.end();
  console.log(`Compte pret : ${email} (${role})`);
  if (!given) console.log(`Mot de passe : ${password}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
