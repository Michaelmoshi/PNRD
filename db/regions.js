// Zones modifiables des pages du site. Utilise par l'import (page -> base) et par la generation (base -> page),
// pour que les deux restent strictement coherents.
//
// Une zone = un morceau de page (l'interieur d'une balise) stocke en base dans content_blocks (page, cle).
// Dans le texte stocke :
//   <!--@nom-->      emplacement d'une liste geree ailleurs dans la console (programmes, agenda, equipe...)
//   {{cle}}          valeur d'un reglage (coordonnees, reseaux sociaux...)

const pageKey = (file) => (file === 'index.html' ? 'accueil' : file.replace(/^pages\//, '').replace(/\.html$/, ''));

// Interieur de la premiere balise qui correspond a openRe, jusqu'a la premiere occurrence de close
const tag = (openRe, close) => (html) => {
  const m = openRe.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = html.indexOf(close, start);
  return end < 0 ? null : { start, end };
};
const section = (id) => tag(new RegExp(`<section[^>]*\\bid="${id}"[^>]*>`), '</section>');
const hero = tag(/<section class="ap-hero">/, '</section>');
const main = tag(/<main id="contenu">/, '</main>');

const r = (file, key, find) => ({ file, key, page: pageKey(file), find });

const REGIONS = [
  r('index.html', 'a-propos', section('a-propos')),
  r('index.html', 'vision', section('vision')),
  r('index.html', 'programme', section('programme')),
  r('index.html', 'implantation', section('implantation')),
  r('index.html', 'prochains-evenements', section('prochains-evenements')),
  r('index.html', 'evenements', section('evenements')),
  r('index.html', 'contact', section('contact')),
  r('index.html', 'equipe-dirigeante', section('equipe-dirigeante')),
  r('index.html', 'partenaires', section('partenaires')),

  r('pages/a-propos.html', 'hero', hero),
  ...['creation', 'ideologie', 'valeurs', 'embleme', 'organisation', 'adhesion'].map((k) => r('pages/a-propos.html', k, section(k))),
  r('pages/programmes.html', 'hero', hero),
  r('pages/programmes.html', 'adhesion', section('adhesion')),
  r('pages/membres.html', 'hero', hero),
  r('pages/adhesion.html', 'hero', hero),
  r('pages/adhesion.html', 'aside', tag(/<aside class="adhesion-aside">/, '</aside>')),
  r('pages/mentions-legales.html', 'hero', hero),
  r('pages/mentions-legales.html', 'main', main),
  r('pages/confidentialite.html', 'hero', hero),
  r('pages/confidentialite.html', 'main', main),
];

// Listes remplacees par un emplacement a l'import : [page/cle, expression, jeton]
const grid = (open, closeIndent) => new RegExp(`(${open}\\n)[\\s\\S]*?(\\n${closeIndent}<\\/div>)`);
const PLACEHOLDERS = [
  { block: 'accueil/programme', name: 'programmes', re: grid('<div class="programme-grid">', '    ') },
  { block: 'accueil/prochains-evenements', name: 'agenda', re: grid('<div class="events-container">', '      ') },
  { block: 'accueil/equipe-dirigeante', name: 'equipe', re: grid('<div class="leadership-grid">', '    ') },
  { block: 'accueil/partenaires', name: 'partenaires', re: grid('<div class="partners-track">', '      ') },
  { block: 'accueil/evenements', name: 'archive', re: /(<!-- build:archive -->\n)[\s\S]*?(\n<!-- \/build:archive -->)/ },
];
const token = (name) => `<!--@${name}-->`;

module.exports = { pageKey, REGIONS, PLACEHOLDERS, token };
