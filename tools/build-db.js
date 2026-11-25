// Genere le site public a partir de la base PostgreSQL.
//   node tools/build-db.js              ecrit le site complet dans dist/
//   node tools/build-db.js --compare    ne rien ecrire ; code 1 si une page generee differe du site actuel
//
// Principe : on part des pages actuelles (deja assemblees par tools/build.js) et on remplace seulement les zones
// pilotees par la base. Tant que la base contient le contenu importe, le resultat doit etre identique a l'existant.
const fs = require('fs');
const path = require('path');
const { connect } = require('../db/lib');
const { esc, rebase, archiveHtml, PAGES, read } = require('./build');

const root = path.join(__dirname, '..');
const COMPARE = process.argv.includes('--compare');

// ---------------------------------------------------------------- outils
const indent = (text, n) => text.split('\n').map((l) => ' '.repeat(n) + l).join('\n');

// Remplace l'element <section ... id="id"> en entier (indentation comprise)
function replaceSection(html, id, render) {
  const open = html.search(new RegExp(`<section[^>]*\\bid="${id}"`));
  if (open < 0) return html;
  const start = html.lastIndexOf('\n', open) + 1;
  const end = html.indexOf('</section>', open) + '</section>'.length;
  return html.slice(0, start) + render() + html.slice(end);
}

// Remplace l'interieur d'une section en gardant la balise ouvrante et les espaces autour
function replaceSectionInner(html, id, render) {
  const open = html.search(new RegExp(`<section[^>]*\\bid="${id}"`));
  if (open < 0) return html;
  const innerStart = html.indexOf('>', open) + 1;
  const innerEnd = html.indexOf('</section>', innerStart);
  const old = html.slice(innerStart, innerEnd);
  const lead = old.match(/^\s*/)[0];
  const trail = old.match(/\s*$/)[0];
  return html.slice(0, innerStart) + lead + render(old.trim()) + trail + html.slice(innerEnd);
}

// adresse d'image : guillemets neutralises seulement, les & des adresses restent tels qu'ecrits dans le site actuel
const url = (v) => String(v || '').replace(/"/g, '&quot;');
const frDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const initials = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('');

// ---------------------------------------------------------------- lecture de la base
async function load(db) {
  const q = async (sql) => (await db.query(sql)).rows;
  const data = {};
  data.slides = await q('SELECT * FROM slides WHERE published ORDER BY position, id');
  data.events = await q(`SELECT e.id, to_char(e.event_date, 'YYYY-MM-DD') AS date, e.title, e.description, e.report, e.video_mp4, e.video_webm,
                                COALESCE(m.path, '') AS poster
                           FROM events e LEFT JOIN media m ON m.id = e.poster_id WHERE e.published ORDER BY e.id`);
  data.programmes = await q(`SELECT p.*, m.path AS image, m.alt AS image_alt FROM programmes p LEFT JOIN media m ON m.id = p.image_id
                              WHERE p.published ORDER BY p.position, p.id`);
  data.categories = await q('SELECT * FROM member_categories ORDER BY position, id');
  data.members = await q(`SELECT mb.*, m.path AS photo FROM members mb LEFT JOIN media m ON m.id = mb.photo_id
                           WHERE mb.published ORDER BY mb.position, mb.id`);
  data.partners = await q(`SELECT p.*, m.path AS logo, m.alt AS logo_alt FROM partners p LEFT JOIN media m ON m.id = p.logo_id
                            WHERE p.published ORDER BY p.position, p.id`);
  data.blocks = Object.fromEntries((await q('SELECT * FROM content_blocks')).map((b) => [`${b.page}/${b.key}`, b]));
  data.settings = Object.fromEntries((await q('SELECT key, value FROM settings')).map((s) => [s.key, s.value]));
  return data;
}

// ---------------------------------------------------------------- rendus
function sliderHtml(slides) {
  const items = slides.map((s, i) => `  <div class="slide ${esc(s.style)}${i === 0 ? ' active' : ''}">
    <div class="slider-content">
      <span class="slide-eyebrow">${esc(s.eyebrow)}</span>
      <h1>${esc(s.title)}</h1>
      <p>${esc(s.subtitle)}</p>
    </div>
  </div>`).join('\n');
  const dots = slides.map((_, i) => `    <span class="slider-dot${i === 0 ? ' active' : ''}" data-index="${i}" role="tab" tabindex="0" aria-label="Slide ${i + 1}"></span>`).join('\n');
  return `<!-- Fragment : slider -->
<div class="slider">
${items}

  <button type="button" class="slider-arrow slider-arrow-prev" aria-label="Slide précédente">&#10094;</button>
  <button type="button" class="slider-arrow slider-arrow-next" aria-label="Slide suivante">&#10095;</button>

  <div class="slider-dots" role="tablist" aria-label="Choisir une slide">
${dots}
  </div>
</div>`;
}

const eventsForSite = (events) => events.map((e) => ({
  id: e.id, date: e.date, dateLabel: frDate(e.date), title: e.title, description: e.description, report: e.report || [],
  poster: e.poster, video: { webm: e.video_webm, mp4: e.video_mp4 },
}));

function programmeHtml(p, i) {
  return `    <section class="ap-section${i % 2 ? ' ap-band-gray' : ''}" id="${esc(p.slug)}">
      <div class="ap-inner ap-split${i % 2 ? ' is-reverse' : ''}">
        <div class="ap-prog-media">
          <img src="${url(p.image)}" alt="${esc(p.image_alt || '')}" loading="lazy" decoding="async" />
        </div>
        <div class="ap-text">
          <div class="section-head">
            <span class="section-eyebrow">${esc(p.summary)}</span>
            <h2>${esc(p.title)}</h2>
          </div>
          <p>${esc(p.body)}</p>
        </div>
      </div>
    </section>`;
}

function memberCard(m) {
  const photo = m.photo
    ? `<img loading="lazy" decoding="async" src="${esc(m.photo)}" alt="${esc(m.full_name)}" class="member-photo">`
    : `<div class="member-photo member-photo-empty" role="img" aria-label="Photo à venir : ${esc(m.full_name)}"><span aria-hidden="true">${esc(initials(m.full_name))}</span></div>`;
  return `            <div class="member-card">
              ${photo}
              <div class="member-name">${esc(m.full_name)}</div>
              <div class="member-function">${esc(m.function)}</div>
              <div class="member-description">${esc(m.description)}</div>
            </div>`;
}

const SVG_OPEN = '<svg class="hero-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">';

function teamHtml(categories, members) {
  const groups = categories.map((c, i) => `        <div class="team-group${i === 0 ? ' active' : ''}" data-team="${esc(c.slug)}">
          <div class="team-group-header">
            ${SVG_OPEN}
${indent(c.icon, 14)}
            </svg>
            <span>${esc(c.title)}</span>
          </div>
          <div class="member-grid">
${members.filter((m) => m.category_id === c.id).map(memberCard).join('\n')}
          </div>
        </div>
`).join('\n');
  const tabs = categories.map((c, i) => `        <button class="team-tab${i === 0 ? ' active' : ''}" data-team="${esc(c.slug)}" type="button">
          ${SVG_OPEN}
${indent(c.icon, 12)}
          </svg>
          ${esc(c.title)}
        </button>`).join('\n');
  return { groups, tabs };
}

function partnersHtml(partners) {
  const items = partners.map((p) => `        <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="${esc(p.name)}">
          <img${p.logo_class ? ` class="${esc(p.logo_class)}"` : ''} loading="lazy" decoding="async" src="${esc(p.logo || '')}" alt="${esc(p.logo_alt || '')}" />
        </a>`).join('\n');
  return `        <!-- Série 1 -->\n${items}\n        <!-- Série 2 — copie pour boucle infinie -->\n${items}`;
}

// chiffres cles : on met a jour nombre et libelle de chaque <li class="stat"> sans toucher au reste du dessin
function patchStats(html, s) {
  let i = 0;
  return html.replace(/<li class="stat[^"]*">[\s\S]*?<\/li>/g, (li) => {
    i += 1;
    const n = s[`stats.${i}.nombre`];
    if (n === undefined) return li;
    const suffix = s[`stats.${i}.suffixe`] || '';
    const shown = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '&nbsp;') + esc(suffix);
    return li
      .replace(/<span class="stat-number"[^>]*>[\s\S]*?<\/span>/,
        `<span class="stat-number" data-count="${esc(n)}"${suffix ? ` data-suffix="${esc(suffix)}"` : ''}>${shown}</span>`)
      .replace(/<span class="stat-label">[\s\S]*?<\/span>/, `<span class="stat-label">${esc(s[`stats.${i}.libelle`] || '')}</span>`);
  });
}

// coordonnees du pied de page
function patchFooter(html, s) {
  const open = '<!-- include:footer -->';
  const a = html.indexOf(open);
  const b = html.indexOf('<!-- /include:footer -->');
  if (a < 0 || b < 0) return html;
  let f = html.slice(a, b);
  const tel = s['contact.telephone'] || '';
  const shown = tel.replace(/^(\+\d{3})(\d{3})(\d{3})(\d{3})$/, '$1&nbsp;$2&nbsp;$3&nbsp;$4');
  f = f.replace(/href="mailto:[^"]*">[^<]*<\/a>/, `href="mailto:${esc(s['contact.email'])}">${esc(s['contact.email'])}</a>`)
    .replace(/href="tel:[^"]*">[^<]*<\/a>/, `href="tel:${esc(tel)}">${shown}</a>`);
  const social = { Facebook: 'facebook', 'X (Twitter)': 'twitter', Instagram: 'instagram', YouTube: 'youtube', WhatsApp: 'whatsapp' };
  for (const [label, key] of Object.entries(social)) {
    f = f.replace(new RegExp(`href="[^"]*"( target="_blank" rel="noopener" aria-label="${label.replace(/[()]/g, '\\$&')}")`), `href="${esc(s['social.' + key])}"$1`);
  }
  return html.slice(0, a) + f + html.slice(b);
}

// ---------------------------------------------------------------- assemblage page par page
function buildPage(page, d) {
  let html = read(page);
  const base = page.startsWith('pages/') ? '../' : '';

  // bandeau d'accueil (inclus dans chaque page)
  html = html.replace(/(<!-- include:slider -->\n)[\s\S]*?(\n<!-- \/include:slider -->)/, (_, a, b) => a + rebase(sliderHtml(d.slides), base) + b);
  html = patchFooter(html, d.settings);

  if (page === 'index.html') {
    html = html.replace(/(<!-- build:archive -->\n)[\s\S]*?(\n<!-- \/build:archive -->)/, (_, a, b) => a + archiveHtml(eventsForSite(d.events)) + b);
    html = html.replace(/(<div class="partners-track">\n)[\s\S]*?(\n      <\/div>\n    <\/div>\n  <\/section>)/, (_, a, b) => a + partnersHtml(d.partners) + b);
    const block = d.blocks['accueil/implantation'];
    if (block) html = replaceSectionInner(html, 'implantation', () => patchStats(block.body, d.settings));
  }

  if (page === 'pages/programmes.html') {
    d.programmes.forEach((p, i) => { html = replaceSection(html, p.slug, () => rebase(programmeHtml(p, i), base)); });
  }

  if (page === 'pages/membres.html') {
    const { groups, tabs } = teamHtml(d.categories, d.members);
    html = html.replace(/(<div class="team-display">\n\n)[\s\S]*?(\n      <\/div>\n\n      <!-- Liste de sélection)/, (_, a, b) => a + rebase(groups, base) + b);
    html = html.replace(/(<nav class="team-nav"[^>]*>\n)[\s\S]*?(\n      <\/nav>)/, (_, a, b) => a + tabs + b);
  }

  if (page === 'pages/a-propos.html') {
    for (const [key, block] of Object.entries(d.blocks)) {
      if (key.startsWith('a-propos/')) html = replaceSectionInner(html, key.split('/')[1], () => block.body);
    }
  }
  return html;
}

// ---------------------------------------------------------------- principal
(async () => {
  const db = await connect();
  const d = await load(db);
  await db.end();

  const out = new Map();
  for (const page of PAGES) out.set(page, buildPage(page, d));
  out.set('data/evenements.json', JSON.stringify(eventsForSite(d.events), null, 2) + '\n');

  if (COMPARE) {
    let bad = 0;
    for (const [file, content] of out) {
      const current = read(file);
      if (current === content) { console.log('identique :', file); continue; }
      bad += 1;
      const a = current.split('\n'), b = content.split('\n');
      let i = 0;
      while (i < a.length && a[i] === b[i]) i += 1;
      console.log(`DIFFERENT : ${file} (premiere difference ligne ${i + 1})`);
      console.log('  actuel  :', JSON.stringify((a[i] || '').slice(0, 150)));
      console.log('  genere  :', JSON.stringify((b[i] || '').slice(0, 150)));
    }
    process.exit(bad ? 1 : 0);
  }

  const dist = path.join(root, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  for (const [file, content] of out) {
    fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
    fs.writeFileSync(path.join(dist, file), content, 'utf8');
  }
  for (const item of ['404.html', 'robots.txt', 'sitemap.xml', '.nojekyll', 'css', 'js', 'assets']) {
    if (fs.existsSync(path.join(root, item))) fs.cpSync(path.join(root, item), path.join(dist, item), { recursive: true });
  }
  console.log(`Site genere dans dist/ (${out.size} fichiers de contenu).`);
})().catch((e) => { console.error(e.message); process.exit(1); });
