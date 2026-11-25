// Importe le contenu actuel du site statique dans PostgreSQL :  npm run db:import
// ATTENTION : remplace tout le contenu du site (slides, textes, programmes, evenements, membres, partenaires,
// reglages, images) par celui des pages du depot. A n'utiliser qu'au depart : les modifications faites ensuite
// dans la console seraient ecrasees. Ne touche jamais aux utilisateurs ni aux adhesions.
const fs = require('fs');
const path = require('path');
const { connect } = require('./lib');
const { REGIONS, PLACEHOLDERS, token, pageKey } = require('./regions');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘' };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
const text = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const first = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };
const all = (html, re) => [...html.matchAll(re)];
const FILES = ['index.html', 'pages/a-propos.html', 'pages/programmes.html', 'pages/membres.html', 'pages/adhesion.html',
  'pages/evenement.html', 'pages/mentions-legales.html', 'pages/confidentialite.html'];

(async () => {
  const db = await connect();
  const media = new Map();
  const addMedia = async (p, kind, alt = '') => {
    if (!p) return null;
    if (media.has(p)) return media.get(p);
    const { rows } = await db.query(
      `INSERT INTO media (path, kind, alt) VALUES ($1, $2, $3) ON CONFLICT (path) DO UPDATE SET alt = EXCLUDED.alt RETURNING id`, [p, kind, alt]);
    media.set(p, rows[0].id);
    return rows[0].id;
  };
  const clean = (p) => p.replace(/^(\.\.\/)+/, '');
  const home = read('index.html');
  const footer = read('partials/footer.html');

  await db.query('BEGIN');
  try {
    await db.query(`TRUNCATE slides, content_blocks, programmes, events, agenda, members, member_categories,
                    partners, settings RESTART IDENTITY CASCADE`);
    await db.query('DELETE FROM media');

    // ------------------------------------------------ bandeau d'accueil
    const slider = read('partials/slider.html');
    let pos = 0;
    for (const [, style, body] of all(slider, /<div class="slide (slide--[\w-]+)[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g)) {
      await db.query('INSERT INTO slides (position, eyebrow, title, subtitle, style) VALUES ($1,$2,$3,$4,$5)', [
        pos++, text(first(body, /slide-eyebrow">([\s\S]*?)<\/span>/)), text(first(body, /<h1>([\s\S]*?)<\/h1>/)), text(first(body, /<p>([\s\S]*?)<\/p>/)), style]);
    }

    // ------------------------------------------------ evenements passes
    for (const ev of JSON.parse(read('data/evenements.json'))) {
      await db.query(
        `INSERT INTO events (id, event_date, title, description, report, poster_id, video_mp4, video_webm) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ev.id, ev.date, ev.title, ev.description, ev.report || [], await addMedia(ev.poster, 'image', ev.title), ev.video.mp4 || '', ev.video.webm || '']);
    }
    await db.query("SELECT setval(pg_get_serial_sequence('events','id'), (SELECT max(id) FROM events))");

    // ------------------------------------------------ prochains evenements (agenda de l'accueil)
    const upcoming = first(home, /<section[^>]*id="prochains-evenements"[^>]*>([\s\S]*?)<\/section>/);
    for (const [, dt, body] of all(upcoming, /<article class="event-card">[\s\S]*?datetime="([^"]+)"([\s\S]*?)<\/article>/g)) {
      await db.query('INSERT INTO agenda (starts_at, title, description) VALUES ($1,$2,$3)', [
        dt.replace('T', ' '), text(first(body, /<h3>([\s\S]*?)<\/h3>/)), text(first(body, /<p>([\s\S]*?)<\/p>/))]);
    }

    // ------------------------------------------------ programmes
    const prog = read('pages/programmes.html');
    pos = 0;
    for (const slug of ['education', 'environnement', 'infrastructures', 'innovation']) {
      const sec = first(prog, new RegExp(`<section[^>]*id="${slug}"[^>]*>([\\s\\S]*?)</section>`));
      await db.query('INSERT INTO programmes (slug, position, title, summary, body, image_id) VALUES ($1,$2,$3,$4,$5,$6)', [
        slug, pos++, text(first(sec, /<h2>([\s\S]*?)<\/h2>/)), text(first(sec, /section-eyebrow">([\s\S]*?)<\/span>/)), text(first(sec, /<p>([\s\S]*?)<\/p>/)),
        await addMedia(first(sec, /<img[^>]*src="([^"]+)"/), 'image', text(first(sec, /<img[^>]*alt="([^"]*)"/)))]);
    }

    // ------------------------------------------------ membres
    const mem = read('pages/membres.html');
    const labels = new Map(all(mem, /<button class="team-tab[^"]*" data-team="(\w+)"[\s\S]*?<\/svg>\s*([^<]+?)\s*<\/button>/g).map(([, k, l]) => [k, text(l)]));
    const display = mem.slice(mem.indexOf('<div class="team-display">'), mem.indexOf('<nav class="team-nav"'));
    pos = 0;
    for (const group of display.split(/<div class="team-group(?: active)?" /).slice(1)) {
      const key = first(group, /data-team="(\w+)"/);
      const icon = first(group, /<svg[^>]*>([\s\S]*?)<\/svg>/).split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
      const { rows } = await db.query('INSERT INTO member_categories (position, title, slug, icon) VALUES ($1,$2,$3,$4) RETURNING id', [pos++, labels.get(key) || key, key, icon]);
      let mp = 0;
      for (const card of group.split('<div class="member-card">').slice(1)) {
        const name = text(first(card, /member-name">([\s\S]*?)<\/div>/));
        await db.query('INSERT INTO members (category_id, position, full_name, function, description, photo_id) VALUES ($1,$2,$3,$4,$5,$6)', [
          rows[0].id, mp++, name, text(first(card, /member-function">([\s\S]*?)<\/div>/)), text(first(card, /member-description">([\s\S]*?)<\/div>/)),
          await addMedia(clean(first(card, /<img[^>]*src="([^"]+)"/)), 'image', name)]);
      }
    }
    // equipe dirigeante de l'accueil : membres mis en avant
    const lead = first(home, /<section[^>]*id="equipe-dirigeante"[^>]*>([\s\S]*?)<\/section>/);
    for (const [, name] of all(lead, /leadership-name">([\s\S]*?)<\/p>/g)) {
      await db.query('UPDATE members SET featured = true WHERE full_name = $1', [text(name)]);
    }

    // ------------------------------------------------ partenaires
    const track = first(home, /<div class="partners-track">([\s\S]*?)<!-- Série 2/);
    const seen = new Set();
    pos = 0;
    for (const [, url, name, imgTag] of all(track, /<a href="([^"]*)"[^>]*title="([^"]*)"[^>]*>\s*(<img[^>]*>)/g)) {
      if (seen.has(name)) continue;
      seen.add(name);
      await db.query('INSERT INTO partners (position, name, url, logo_id, logo_class) VALUES ($1,$2,$3,$4,$5)', [
        pos++, text(name), url, await addMedia(first(imgTag, /src="([^"]+)"/), 'image', text(first(imgTag, /alt="([^"]*)"/))), first(imgTag, /class="([^"]*)"/)]);
    }

    // ------------------------------------------------ textes des pages (zones de regions.js)
    const settings = {};
    const pages = new Map(FILES.map((f) => [f, read(f)]));
    for (const reg of REGIONS) {
      const html = pages.get(reg.file);
      const at = reg.find(html);
      if (!at) throw new Error(`Zone introuvable : ${reg.file} / ${reg.key}`);
      let body = html.slice(at.start, at.end).trim();
      const ph = PLACEHOLDERS.find((p) => p.block === `${reg.page}/${reg.key}`);
      if (ph) {
        if (!ph.re.test(body)) throw new Error(`Liste introuvable : ${ph.block}`);
        body = body.replace(ph.re, (_, a, b) => `${a || ''}${token(ph.name)}${b || ''}`);
      }
      if (reg.key === 'contact') body = contactTokens(body, settings);
      await db.query('INSERT INTO content_blocks (page, key, title, body) VALUES ($1,$2,$3,$4)',
        [reg.page, reg.key, text(first(body, /<h[12][^>]*>([\s\S]*?)<\/h[12]>/)), body]);
    }

    // ------------------------------------------------ reglages
    Object.assign(settings, {
      'contact.email': first(footer, /href="mailto:([^"]+)"/),
      'contact.telephone': first(footer, /href="tel:([^"]+)"/),
      'social.facebook': first(footer, /href="(https:\/\/facebook\.com[^"]*)"/),
      'social.twitter': first(footer, /href="(https:\/\/twitter\.com[^"]*)"/),
      'social.instagram': first(footer, /href="(https:\/\/instagram\.com[^"]*)"/),
      'social.youtube': first(footer, /href="(https:\/\/youtube\.com[^"]*)"/),
      'social.whatsapp': first(footer, /href="(https:\/\/wa\.me[^"]*)"/),
      'site.url': JSON.parse(read('site.json')).url,
      'site.api_url': '',
    });
    all(first(home, /<ul class="stats-list">([\s\S]*?)<\/ul>/), /data-count="(\d+)"(?: data-suffix="([^"]*)")?[^>]*>[\s\S]*?stat-label">([\s\S]*?)<\/span>/g)
      .forEach(([, n, suffix, label], i) => {
        settings[`stats.${i + 1}.nombre`] = n;
        settings[`stats.${i + 1}.suffixe`] = suffix || '';
        settings[`stats.${i + 1}.libelle`] = text(label);
      });
    for (const [file, html] of pages) {                      // referencement : titre et descriptions de chaque page
      const k = pageKey(file);
      settings[`seo.${k}.titre`] = decode(first(html, /<title>([\s\S]*?)<\/title>/));
      settings[`seo.${k}.description`] = decode(first(html, /<meta name="description" content="([^"]*)"/));
      settings[`seo.${k}.partage`] = decode(first(html, /<meta property="og:description" content="([^"]*)"/));
    }
    for (const [k, v] of Object.entries(settings)) await db.query('INSERT INTO settings (key, value) VALUES ($1,$2)', [k, v]);

    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }

  for (const t of ['slides', 'agenda', 'events', 'programmes', 'member_categories', 'members', 'partners', 'content_blocks', 'settings', 'media']) {
    console.log(t.padEnd(18), (await db.query(`SELECT count(*) FROM ${t}`)).rows[0].count);
  }
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });

// Section contact : adresse, e-mail, telephone et reseaux deviennent des jetons {{...}} relies aux reglages
function contactTokens(body, settings) {
  const addr = first(body, /<span class="contact-details-value">([\s\S]*?)<\/span>/);
  settings['contact.adresse'] = decode(addr.trim());
  body = body.replace(addr, '{{contact.adresse}}');
  body = body.replace(/href="mailto:[^"]*">[^<]*<\/a>/, 'href="mailto:{{contact.email}}">{{contact.email}}</a>');
  body = body.replace(/href="tel:[^"]*">[^<]*<\/a>/, 'href="tel:{{contact.telephone}}">{{contact.telephone_affiche}}</a>');
  const social = { Facebook: 'facebook', 'X (Twitter)': 'twitter', Instagram: 'instagram', YouTube: 'youtube', WhatsApp: 'whatsapp' };
  for (const [label, key] of Object.entries(social)) {
    const re = new RegExp(`<a href="[^"]*"([^>]*aria-label="${label.replace(/[()]/g, '\\$&')}")`);
    body = body.replace(re, `<a href="{{social.${key}}}"$1`);
  }
  return body;
}
