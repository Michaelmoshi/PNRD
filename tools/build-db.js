// Genere le site public a partir de la base PostgreSQL.
//   node tools/build-db.js              ecrit le site complet dans dist/
//   node tools/build-db.js --compare    ne rien ecrire ; code 1 si une page generee differe du site actuel
//   node tools/build-db.js --adopt      reecrit les pages du depot avec la version generee (a relire avec git diff)
//
// Principe : on part des pages actuelles (deja assemblees par tools/build.js) et on remplace les zones pilotees
// par la base (db/regions.js, listes, reglages). Tant que la base contient le contenu importe, le resultat doit
// etre identique a l'existant.
const fs = require('fs');
const path = require('path');
const { connect } = require('../db/lib');
const { REGIONS, token, pageKey } = require('../db/regions');
const { esc, rebase, archiveHtml, PAGES, read } = require('./build');

const root = path.join(__dirname, '..');
const COMPARE = process.argv.includes('--compare');
const ADOPT = process.argv.includes('--adopt');

// ---------------------------------------------------------------- outils
const indent = (text, n) => text.split('\n').map((l) => ' '.repeat(n) + l).join('\n');
// adresse d'image : guillemets neutralises seulement, les & des adresses restent tels qu'ecrits dans le site
const url = (v) => String(v || '').replace(/"/g, '&quot;');
const frDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const initials = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('');
const titleCase = (name) => name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
const MONTHS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
const CLOCK = '<svg class="hero-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>';
const DEFAULT_ICON = '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" />';
const SVG_OPEN = '<svg class="hero-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">';

// Remplace l'interieur d'une zone en gardant la balise ouvrante et les espaces autour
function replaceRegion(html, find, render) {
  const at = find(html);
  if (!at) return html;
  const old = html.slice(at.start, at.end);
  return html.slice(0, at.start) + old.match(/^\s*/)[0] + render() + old.match(/\s*$/)[0] + html.slice(at.end);
}

// ---------------------------------------------------------------- lecture de la base
async function load(db) {
  const q = async (sql) => (await db.query(sql)).rows;
  const d = {};
  d.slides = await q(`SELECT s.*, m.path AS image FROM slides s LEFT JOIN media m ON m.id = s.image_id
                       WHERE s.published ORDER BY s.position, s.id`);
  d.events = await q(`SELECT e.id, e.event_date AS date, e.title, e.description, e.report, e.video_mp4, e.video_webm, COALESCE(m.path, '') AS poster
                        FROM events e LEFT JOIN media m ON m.id = e.poster_id WHERE e.published ORDER BY e.id`);
  d.agenda = await q('SELECT * FROM agenda WHERE published ORDER BY starts_at, id');
  d.programmes = await q(`SELECT p.*, m.path AS image, m.alt AS image_alt FROM programmes p LEFT JOIN media m ON m.id = p.image_id
                           WHERE p.published ORDER BY p.position, p.id`);
  d.categories = (await q('SELECT * FROM member_categories ORDER BY position, id'))
    .map((c) => ({ ...c, slug: c.slug || `categorie-${c.id}`, icon: c.icon || DEFAULT_ICON }));
  d.members = await q(`SELECT mb.*, m.path AS photo FROM members mb JOIN member_categories c ON c.id = mb.category_id
                         LEFT JOIN media m ON m.id = mb.photo_id WHERE mb.published ORDER BY c.position, mb.position, mb.id`);
  d.partners = await q(`SELECT p.*, m.path AS logo, m.alt AS logo_alt FROM partners p LEFT JOIN media m ON m.id = p.logo_id
                         WHERE p.published ORDER BY p.position, p.id`);
  d.blocks = Object.fromEntries((await q('SELECT * FROM content_blocks')).map((b) => [`${b.page}/${b.key}`, b]));
  d.settings = Object.fromEntries((await q('SELECT key, value FROM settings')).map((s) => [s.key, s.value]));
  return d;
}

// ---------------------------------------------------------------- rendus
function sliderHtml(slides) {
  const items = slides.map((s, i) => `  <div class="slide ${esc(s.style)}${i === 0 ? ' active' : ''}">${s.image ? `\n    <img class="slide-bg" src="${esc(s.image)}" alt="" />` : ''}
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

function archiveBlock(events) {
  const videos = events.filter((e) => e.video.mp4 || e.video.webm);
  return videos.length ? archiveHtml(videos) : '    <p class="archive-empty">Les vidéos de nos événements seront bientôt disponibles.</p>';
}

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

const programmesTeaser = (ps) => ps.map((p, i) => `      <article class="programme-item${i === 0 ? ' programme-featured' : ''}">
        <img loading="lazy" decoding="async" src="${url(p.image)}" alt="${esc(p.image_alt || '')}" />
        <div class="programme-content">
          <span class="programme-tag">${esc(p.summary)}</span>
          <h3>${esc(p.title)}</h3>
          <p>
            ${esc(p.body)}
          </p>${i === 0 ? `\n          <a class="programme-cta" href="pages/programmes.html#${esc(p.slug)}">Voir le projet</a>` : ''}
        </div>
      </article>`).join('\n');

const agendaHtml = (items) => items.map((a) => {
  const [day, time] = a.starts_at.split(/[ T]/);
  const [, m, dd] = day.split('-');
  return `        <article class="event-card">
          <time class="event-date-box" datetime="${day}T${time.slice(0, 5)}"><span class="event-day">${dd}</span><span class="event-month">${MONTHS[+m - 1]}</span></time>
          <div class="event-info">
            <h3>${esc(a.title)}</h3>
            <p>${esc(a.description)}</p>
            <span class="event-time">${CLOCK}${time.slice(0, 2)}h${time.slice(3, 5)}</span>
          </div>
          <span class="event-badge">À venir</span>
        </article>`;
}).join('\n');

const leadershipHtml = (members) => members.filter((m) => m.featured).map((m) => `      <div class="leadership-item">
        <img loading="lazy" decoding="async" src="${esc(m.photo || 'assets/images/team/avatar.svg')}" alt="${esc(titleCase(m.full_name))}" class="leadership-photo" />
        <p class="leadership-name">${esc(m.full_name)}</p>
        <p class="leadership-role">${esc(m.function)}</p>
      </div>`).join('\n');

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

// chiffres cles : nombre et libelle de chaque <li class="stat"> sans toucher au reste du dessin
function patchStats(html, s) {
  let i = 0;
  return html.replace(/<li class="stat[^"]*">[\s\S]*?<\/li>/g, (li) => {
    i += 1;
    const n = s[`stats.${i}.nombre`];
    if (n === undefined) return li;
    const suffix = s[`stats.${i}.suffixe`] || '';
    const shown = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '&nbsp;') + esc(suffix);
    return li
      .replace(/<span class="stat-number"[^>]*>[\s\S]*?<\/span>/, `<span class="stat-number" data-count="${esc(n)}"${suffix ? ` data-suffix="${esc(suffix)}"` : ''}>${shown}</span>`)
      .replace(/<span class="stat-label">[\s\S]*?<\/span>/, `<span class="stat-label">${esc(s[`stats.${i}.libelle`] || '')}</span>`);
  });
}

const phoneShown = (tel) => tel.replace(/^(\+\d{3})(\d{3})(\d{3})(\d{3})$/, '$1&nbsp;$2&nbsp;$3&nbsp;$4');

// jetons {{cle}} des textes : valeurs des reglages
function fillTokens(body, s) {
  return body.replace(/\{\{([\w.]+)\}\}/g, (_, k) => (k === 'contact.telephone_affiche' ? phoneShown(s['contact.telephone'] || '') : esc(s[k] ?? '')));
}

// coordonnees du pied de page (commun a toutes les pages)
function patchFooter(html, s) {
  const a = html.indexOf('<!-- include:footer -->');
  const b = html.indexOf('<!-- /include:footer -->');
  if (a < 0 || b < 0) return html;
  let f = html.slice(a, b);
  f = f.replace(/href="mailto:[^"]*">[^<]*<\/a>/, `href="mailto:${esc(s['contact.email'])}">${esc(s['contact.email'])}</a>`)
    .replace(/href="tel:[^"]*">[^<]*<\/a>/, `href="tel:${esc(s['contact.telephone'])}">${phoneShown(s['contact.telephone'] || '')}</a>`);
  const social = { Facebook: 'facebook', 'X (Twitter)': 'twitter', Instagram: 'instagram', YouTube: 'youtube', WhatsApp: 'whatsapp' };
  for (const [label, key] of Object.entries(social)) {
    f = f.replace(new RegExp(`href="[^"]*"( target="_blank" rel="noopener" aria-label="${label.replace(/[()]/g, '\\$&')}")`), `href="${esc(s['social.' + key])}"$1`);
  }
  return html.slice(0, a) + f + html.slice(b);
}

// referencement : titre et descriptions de la page
function patchSeo(html, page, s) {
  const k = pageKey(page);
  const titre = s[`seo.${k}.titre`], desc = s[`seo.${k}.description`], partage = s[`seo.${k}.partage`];
  const set = (re, v) => { if (v !== undefined) html = html.replace(re, (_, a, b) => `${a}${esc(v)}${b || ''}`); };
  set(/(<title>)[\s\S]*?(<\/title>)/, titre);
  set(/(<meta name="description" content=")[^"]*(")/, desc);
  set(/(<meta property="og:title" content=")[^"]*(")/, titre);
  set(/(<meta name="twitter:title" content=")[^"]*(")/, titre);
  set(/(<meta property="og:description" content=")[^"]*(")/, partage);
  set(/(<meta name="twitter:description" content=")[^"]*(")/, partage);
  return html;
}

// formulaire d'adhesion : envoi vers l'API du parti quand son adresse est renseignee, sinon EmailJS (comme aujourd'hui)
function patchAdhesion(html, s) {
  const api = (s['site.api_url'] || '').replace(/\/$/, '');
  if (!api) return html;
  return html
    .replace('<form id="adhesion-form"', `<form id="adhesion-form" data-api="${esc(api)}/api/v1/public/adhesion"`)
    .replace(/[ \t]*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@emailjs\/browser[^>]*><\/script>\n/, '');
}

// ---------------------------------------------------------------- assemblage page par page
function buildPage(page, d) {
  let html = read(page);
  const base = page.startsWith('pages/') ? '../' : '';
  const s = d.settings;

  html = html.replace(/(<!-- include:slider -->\n)[\s\S]*?(\n<!-- \/include:slider -->)/, (_, a, b) => a + rebase(sliderHtml(d.slides), base) + b);
  html = patchFooter(html, s);
  html = patchSeo(html, page, s);

  // zones de texte
  const lists = {
    programmes: () => programmesTeaser(d.programmes),
    agenda: () => agendaHtml(d.agenda),
    equipe: () => leadershipHtml(d.members),
    partenaires: () => partnersHtml(d.partners),
    archive: () => archiveBlock(eventsForSite(d.events)),
  };
  for (const reg of REGIONS.filter((x) => x.file === page)) {
    const block = d.blocks[`${reg.page}/${reg.key}`];
    if (!block) continue;
    html = replaceRegion(html, reg.find, () => {
      let body = block.body;
      for (const [name, render] of Object.entries(lists)) body = body.split(token(name)).join(render());
      if (reg.key === 'implantation') body = patchStats(body, s);
      return fillTokens(body, s);
    });
  }

  if (page === 'pages/programmes.html') {
    const cards = d.programmes.map((p, i) => rebase(programmeHtml(p, i), base)).join('\n');
    // la zone remplacee s'arrete avant la section « adhesion » (et le commentaire qui la precede)
    html = html.replace(/(<main id="contenu">\n)[\s\S]*?((?:\n\n[ \t]*<!--[^\n]*-->)?\n[ \t]*<section class="ap-section ap-cta" id="adhesion">)/, (_, a, b) => a + cards + b);
  }
  if (page === 'pages/membres.html') {
    const { groups, tabs } = teamHtml(d.categories, d.members);
    html = html.replace(/(<div class="team-display">\n\n)[\s\S]*?(\n      <\/div>\n\n      <!-- Liste de sélection)/, (_, a, b) => a + rebase(groups, base) + b);
    html = html.replace(/(<nav class="team-nav"[^>]*>\n)[\s\S]*?(\n      <\/nav>)/, (_, a, b) => a + tabs + b);
  }
  if (page === 'pages/adhesion.html') html = patchAdhesion(html, s);
  return html;
}

// ---------------------------------------------------------------- generation (utilisable par le serveur)
// db : client ou pool PostgreSQL. Renvoie Map(fichier -> contenu) : les pages et data/evenements.json.
async function generate(db) {
  const d = await load(db);
  const out = new Map();
  for (const page of PAGES) out.set(page, buildPage(page, d));
  out.set('data/evenements.json', JSON.stringify(eventsForSite(d.events), null, 2) + '\n');
  return out;
}

// ---------------------------------------------------------------- ligne de commande
async function main() {
  const db = await connect();
  const out = await generate(db);
  await db.end();

  if (COMPARE || ADOPT) {
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
      if (ADOPT) fs.writeFileSync(path.join(root, file), content, 'utf8');
    }
    if (ADOPT) console.log(bad ? `${bad} fichier(s) reecrit(s) : relire avec git diff.` : 'Rien a adopter.');
    process.exit(ADOPT ? 0 : bad ? 1 : 0);
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
}

module.exports = { generate };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
