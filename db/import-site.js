// Importe le contenu actuel du site statique dans PostgreSQL :  npm run db:import
// Peut etre relance : il remplace le contenu du site (slides, pages, programmes, evenements,
// membres, partenaires, parametres) mais ne touche jamais aux utilisateurs ni aux adhesions.
const fs = require('fs');
const path = require('path');
const { connect } = require('./lib');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘' };
const text = (s) => s
  .replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&(\w+);/g, (m, n) => ENT[n] ?? m)
  .replace(/\s+/g, ' ')
  .trim();
const first = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };
const all = (html, re) => [...html.matchAll(re)];

// Contenu entre <section id="x"> et </section>
function section(html, id) {
  const open = html.search(new RegExp(`<section[^>]*\\bid="${id}"`));
  if (open < 0) return '';
  const start = html.indexOf('>', open) + 1;
  return html.slice(start, html.indexOf('</section>', start)).trim();
}

(async () => {
  const db = await connect();
  const media = new Map();
  const addMedia = async (p, kind, alt = '') => {
    if (!p) return null;
    if (media.has(p)) return media.get(p);
    const { rows } = await db.query(
      `INSERT INTO media (path, kind, alt) VALUES ($1, $2, $3)
       ON CONFLICT (path) DO UPDATE SET alt = EXCLUDED.alt RETURNING id`, [p, kind, alt]);
    media.set(p, rows[0].id);
    return rows[0].id;
  };
  const clean = (p) => p.replace(/^(\.\.\/)+/, '');

  await db.query('BEGIN');
  try {
    await db.query(`TRUNCATE slides, content_blocks, programmes, events, members, member_categories,
                    partners, settings RESTART IDENTITY CASCADE`);
    await db.query('DELETE FROM media');

    // ------------------------------------------------ slides
    const slider = read('partials/slider.html');
    const slides = all(slider, /<div class="slide (slide--[\w-]+)[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g);
    let pos = 0;
    for (const [, style, body] of slides) {
      await db.query('INSERT INTO slides (position, eyebrow, title, subtitle, style) VALUES ($1,$2,$3,$4,$5)', [
        pos++, text(first(body, /slide-eyebrow">([\s\S]*?)<\/span>/)),
        text(first(body, /<h1>([\s\S]*?)<\/h1>/)), text(first(body, /<p>([\s\S]*?)<\/p>/)), style]);
    }

    // ------------------------------------------------ evenements
    const events = JSON.parse(read('data/evenements.json'));
    for (const ev of events) {
      const poster = await addMedia(ev.poster, 'image', ev.title);
      await db.query(
        `INSERT INTO events (id, event_date, title, description, report, poster_id, video_mp4, video_webm)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ev.id, ev.date, ev.title, ev.description, ev.report || [], poster, ev.video.mp4 || '', ev.video.webm || '']);
    }
    await db.query("SELECT setval(pg_get_serial_sequence('events','id'), (SELECT max(id) FROM events))");

    // ------------------------------------------------ programmes
    const prog = read('pages/programmes.html');
    pos = 0;
    for (const slug of ['education', 'environnement', 'infrastructures', 'innovation']) {
      const sec = section(prog, slug);
      const img = first(sec, /<img[^>]*src="([^"]+)"/);
      const alt = text(first(sec, /<img[^>]*alt="([^"]*)"/));
      await db.query('INSERT INTO programmes (slug, position, title, summary, body, image_id) VALUES ($1,$2,$3,$4,$5,$6)', [
        slug, pos++, text(first(sec, /<h2>([\s\S]*?)<\/h2>/)),
        text(first(sec, /section-eyebrow">([\s\S]*?)<\/span>/)),     // sur-titre (ex. Social)
        text(first(sec, /<p>([\s\S]*?)<\/p>/)), await addMedia(clean(img), 'image', alt)]);
    }

    // ------------------------------------------------ membres
    const mem = read('pages/membres.html');
    const labels = new Map(all(mem, /<button class="team-tab[^"]*" data-team="(\w+)"[\s\S]*?<\/svg>\s*([^<]+?)\s*<\/button>/g)
      .map(([, k, l]) => [k, text(l)]));
    pos = 0;
    const display = mem.slice(mem.indexOf('<div class="team-display">'), mem.indexOf('<nav class="team-nav"'));
    for (const group of display.split(/<div class="team-group(?: active)?" /).slice(1)) {
      const key = first(group, /data-team="(\w+)"/);
      const { rows } = await db.query('INSERT INTO member_categories (position, title) VALUES ($1,$2) RETURNING id', [pos++, labels.get(key) || key]);
      let mp = 0;
      for (const card of group.split('<div class="member-card">').slice(1)) {
        const name = text(first(card, /member-name">([\s\S]*?)<\/div>/));
        const img = first(card, /<img[^>]*src="([^"]+)"/);
        await db.query('INSERT INTO members (category_id, position, full_name, function, description, photo_id) VALUES ($1,$2,$3,$4,$5,$6)', [
          rows[0].id, mp++, name, text(first(card, /member-function">([\s\S]*?)<\/div>/)),
          text(first(card, /member-description">([\s\S]*?)<\/div>/)), await addMedia(clean(img), 'image', name)]);
      }
    }

    // ------------------------------------------------ partenaires (accueil, serie 1 seulement)
    const home = read('index.html');
    const track = first(home, /<div class="partners-track">([\s\S]*?)<!-- Série 2/) || first(home, /<div class="partners-track">([\s\S]*?)<\/div>/);
    const seen = new Set();
    pos = 0;
    for (const [, url, name, logo, alt] of all(track, /<a href="([^"]*)"[^>]*title="([^"]*)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g)) {
      if (seen.has(name)) continue;
      seen.add(name);
      await db.query('INSERT INTO partners (position, name, url, logo_id) VALUES ($1,$2,$3,$4)', [pos++, text(name), url, await addMedia(logo, 'image', text(alt))]);
    }

    // ------------------------------------------------ blocs de texte (HTML des sections, conserve tel quel)
    const apropos = read('pages/a-propos.html');
    for (const id of ['creation', 'ideologie', 'valeurs', 'embleme', 'organisation']) {
      const sec = section(apropos, id);
      await db.query('INSERT INTO content_blocks (page, key, title, body) VALUES ($1,$2,$3,$4)',
        ['a-propos', id, text(first(sec, /<h2>([\s\S]*?)<\/h2>/)), sec]);
    }
    await db.query('INSERT INTO content_blocks (page, key, title, body) VALUES ($1,$2,$3,$4)',
      ['accueil', 'implantation', text(first(section(home, 'implantation'), /<h2[^>]*>([\s\S]*?)<\/h2>/)), section(home, 'implantation')]);

    // ------------------------------------------------ parametres
    const footer = read('partials/footer.html');
    const settings = {
      'contact.email': first(footer, /href="mailto:([^"]+)"/),
      'contact.telephone': first(footer, /href="tel:([^"]+)"/),
      'social.facebook': first(footer, /href="(https:\/\/facebook\.com[^"]*)"/),
      'social.twitter': first(footer, /href="(https:\/\/twitter\.com[^"]*)"/),
      'social.instagram': first(footer, /href="(https:\/\/instagram\.com[^"]*)"/),
      'social.youtube': first(footer, /href="(https:\/\/youtube\.com[^"]*)"/),
      'social.whatsapp': first(footer, /href="(https:\/\/wa\.me[^"]*)"/),
      'site.url': JSON.parse(read('site.json')).url,
    };
    const stats = all(first(home, /<ul class="stats-list">([\s\S]*?)<\/ul>/), /data-count="(\d+)"(?: data-suffix="([^"]*)")?[^>]*>[\s\S]*?stat-label">([\s\S]*?)<\/span>/g);
    stats.forEach(([, n, suffix, label], i) => {
      settings[`stats.${i + 1}.nombre`] = n;
      settings[`stats.${i + 1}.suffixe`] = suffix || '';
      settings[`stats.${i + 1}.libelle`] = text(label);
    });
    for (const [k, v] of Object.entries(settings)) await db.query('INSERT INTO settings (key, value) VALUES ($1,$2)', [k, v]);

    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }

  for (const t of ['slides', 'events', 'programmes', 'member_categories', 'members', 'partners', 'content_blocks', 'settings', 'media']) {
    const { rows } = await db.query(`SELECT count(*) FROM ${t}`);
    console.log(t.padEnd(18), rows[0].count);
  }
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
