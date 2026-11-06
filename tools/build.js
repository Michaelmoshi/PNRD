// Assemble les pages du site à partir de leurs sources :
//   - partials/*.html        -> en-tête, slider et pied de page copiés dans chaque page
//   - data/evenements.json   -> lecteur « Événements passés » de l'accueil
//   - site.json              -> adresse canonique, image de partage, sitemap.xml et robots.txt
//
//   node tools/build.js            met les fichiers à jour
//   node tools/build.js --check    ne modifie rien ; code de sortie 1 si un fichier n'est pas à jour
//
// À relancer après toute modification d'un de ces fichiers source (npm run build).
// Les zones générées sont encadrées de marqueurs :  <!-- nom --> ... <!-- /nom -->
// (au premier passage, un fragment peut être écrit  <div data-include="partials/header.html"></div>).

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

const PAGES = [
  'index.html',
  'pages/a-propos.html',
  'pages/programmes.html',
  'pages/membres.html',
  'pages/adhesion.html',
  'pages/evenement.html',
  'pages/mentions-legales.html',
  'pages/confidentialite.html',
];
// Pages sans adresse canonique ni entrée dans le sitemap (contenu dynamique)
const NOT_INDEXED = new Set(['pages/evenement.html']);

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const readIfExists = (p) => (fs.existsSync(path.join(root, p)) ? read(p) : null);
const absolute = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Liens écrits depuis la racine du site -> liens valables depuis la page (ajoute « ../ » dans pages/)
function rebase(html, base) {
  if (!base) return html;
  const fix = (v) => (!v || absolute.test(v) ? v : base + v);
  return html.replace(/\b(href|src|poster)="([^"]*)"/g, (m, attr, v) => `${attr}="${fix(v)}"`);
}

// Remplace la zone  <!-- marker --> … <!-- /marker -->  (ou, au premier passage, l'emplacement de départ)
function inject(html, marker, content, placeholder) {
  const open = `<!-- ${marker} -->`;
  const close = `<!-- /${marker} -->`;
  const block = `${open}\n${content}\n${close}`;
  if (html.includes(open) && html.includes(close)) {
    const a = html.indexOf(open);
    const b = html.indexOf(close) + close.length;
    return html.slice(0, a) + block + html.slice(b);
  }
  if (placeholder && html.includes(placeholder)) return html.replace(placeholder, block);
  return html;
}

// ---------------------------------------------------------------- lecteur « Événements passés »
function archiveHtml(events) {
  const frame = (ev) => (ev.poster ? '' : '#t=0.5');   // sans affiche : 1re image de la vidéo
  const mp4 = (ev) => ev.video.mp4 + frame(ev);
  const webm = (ev) => (ev.video.webm ? ev.video.webm + frame(ev) : '');
  const href = (ev) => `pages/evenement.html?id=${ev.id}`;
  const first = events[0];

  const sources = [
    first.video.webm ? `            <source src="${esc(webm(first))}" type="video/webm" />` : '',
    `            <source src="${esc(mp4(first))}" type="video/mp4" />`,
  ].filter(Boolean).join('\n');

  const thumb = (ev) => (ev.poster
    ? `<img src="${esc(ev.poster)}" alt="" loading="lazy" />`
    : `<video src="${esc(mp4(ev))}" preload="metadata" muted playsinline tabindex="-1"></video>`);

  const items = events.map((ev, i) => `        <li>
          <button type="button" class="archive-item${i === 0 ? ' is-active' : ''}" data-video-webm="${esc(webm(ev))}" data-video-mp4="${esc(mp4(ev))}" data-poster="${esc(ev.poster || '')}" data-iso="${esc(ev.date)}" data-date="${esc(ev.dateLabel)}" data-title="${esc(ev.title)}" data-text="${esc(ev.description)}" data-href="${href(ev)}" aria-pressed="${i === 0}">
            <span class="archive-thumb">${thumb(ev)}<span class="archive-play" aria-hidden="true"></span></span>
            <span class="archive-item-body">
              <time datetime="${esc(ev.date)}">${esc(ev.dateLabel)}</time>
              <strong>${esc(ev.title)}</strong>
            </span>
          </button>
        </li>`).join('\n');

  return `    <div class="archive">
      <div class="archive-stage">
        <div class="archive-player">
          <video id="archive-video" controls preload="metadata"${first.poster ? ` poster="${esc(first.poster)}"` : ''}>
${sources}
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        </div>
        <div class="archive-caption" id="archive-caption">
          <time class="archive-date" id="archive-date" datetime="${esc(first.date)}">${esc(first.dateLabel)}</time>
          <h3 id="archive-title">${esc(first.title)}</h3>
          <p id="archive-text">${esc(first.description)}</p>
          <a class="archive-cta" id="archive-cta" href="${href(first)}">Lire le compte rendu</a>
        </div>
      </div>
      <div class="archive-list">
        <span class="archive-list-label">À revoir · ${String(events.length).padStart(2, '0')} vidéos</span>
        <ul>
${items}
        </ul>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- SEO : adresse canonique et image de partage
function seoHtml(site, page) {
  const url = site.url.replace(/\/$/, '');
  const pageUrl = page === 'index.html' ? `${url}/` : `${url}/${page}`;
  const image = `${url}/${site.shareImage}`;
  const lines = [];
  if (!NOT_INDEXED.has(page)) {
    lines.push(`  <link rel="canonical" href="${esc(pageUrl)}" />`);
    lines.push(`  <meta property="og:url" content="${esc(pageUrl)}" />`);
  }
  lines.push(`  <meta property="og:image" content="${esc(image)}" />`);
  lines.push('  <meta name="twitter:card" content="summary_large_image" />');
  lines.push(`  <meta name="twitter:image" content="${esc(image)}" />`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- assemblage
const out = new Map();           // fichier -> contenu attendu
const events = JSON.parse(read('data/evenements.json'));
const siteRaw = readIfExists('site.json');
const site = siteRaw ? JSON.parse(siteRaw) : null;

for (const page of PAGES) {
  let html = read(page);
  const base = page.startsWith('pages/') ? '../' : '';

  for (const name of ['header', 'slider', 'footer']) {
    const file = `partials/${name}.html`;
    html = inject(html, `include:${name}`, rebase(read(file).trim(), base), `<div data-include="${file}"></div>`);
  }

  if (page === 'index.html') html = inject(html, 'build:archive', archiveHtml(events));

  if (site && site.url) {
    // le bloc SEO remplace les anciennes balises de partage écrites à la main
    html = html.replace(/[ \t]*<meta (?:property="og:image"|name="twitter:image"|name="twitter:card")[^>]*>\n/g, '');
    if (!html.includes('<!-- build:seo -->')) html = html.replace('</head>', '<!-- build:seo -->\n<!-- /build:seo -->\n</head>');
    html = inject(html, 'build:seo', seoHtml(site, page));
  }
  out.set(page, html);
}

if (site && site.url) {
  const url = site.url.replace(/\/$/, '');
  const urls = PAGES.filter((p) => !NOT_INDEXED.has(p)).map((p) => (p === 'index.html' ? `${url}/` : `${url}/${p}`));
  out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') + '\n</urlset>\n');
  out.set('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`);
}

// ---------------------------------------------------------------- écriture ou vérification
const stale = [];
for (const [file, content] of out) {
  if (readIfExists(file) === content) continue;
  stale.push(file);
  if (!CHECK) fs.writeFileSync(path.join(root, file), content, 'utf8');
}

if (CHECK) {
  if (stale.length) {
    console.error('Fichiers pas à jour (lancer « npm run build ») :\n' + stale.map((f) => '  ' + f).join('\n'));
    process.exit(1);
  }
  console.log('Pages à jour.');
} else {
  stale.forEach((f) => console.log('mis à jour :', f));
  console.log(stale.length ? `${stale.length} fichier(s) mis à jour.` : 'Rien à changer.');
}
