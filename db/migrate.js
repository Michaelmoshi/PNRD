// Applique les fichiers db/migrations/*.sql pas encore appliques :  npm run db:migrate
const fs = require('fs');
const path = require('path');
const { connect } = require('./lib');

(async () => {
  const db = await connect();
  const dir = path.join(__dirname, 'migrations');
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');

  // Base creee a la main avant l'existence de ce script : on declare 001 comme deja appliquee
  const { rows: seen } = await db.query('SELECT 1 FROM schema_migrations');
  const { rows: roles } = await db.query("SELECT to_regclass('public.roles') AS t");
  if (!seen.length && roles[0].t) await db.query("INSERT INTO schema_migrations (name) VALUES ('001_schema.sql')");

  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await db.query('BEGIN');
    try {
      await db.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await db.query('COMMIT');
      console.log('appliquee :', file);
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  }
  console.log('Migrations a jour.');
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
