// Assemble les pages : copie l'en-tête, le pied de page et le slider (dossier partials/)
// directement dans le HTML de chaque page, en corrigeant les liens selon la profondeur de la page.
//
//   node tools/build.js
//
// À relancer après toute modification d'un fichier de partials/.
// Les pages contiennent alors leur menu et leur pied de page en dur : rien n'est chargé par JavaScript,
// le site fonctionne même ouvert directement depuis un fichier.
//
// Dans une page, un fragment est repéré par ses marqueurs :
//   <!-- include:header --> ... <!-- /include:header -->
// (au premier passage, on part de  <div data-include="partials/header.html"></div>)

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
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

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const absolute = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

// Liens écrits depuis la racine du site -> liens valables depuis la page (ajoute « ../ » dans pages/)
function rebase(html, base) {
  if (!base) return html;
  const fix = (v) => (!v || absolute.test(v) ? v : base + v);
  return html
    .replace(/\b(href|src|poster)="([^"]*)"/g, (m, attr, v) => `${attr}="${fix(v)}"`)
    .replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => `url(${q}${fix(u)}${q})`);
}

let changed = 0;
for (const page of PAGES) {
  let html = read(page);
  const base = page.startsWith('pages/') ? '../' : '';

  for (const name of ['header', 'slider', 'footer']) {
    const partialFile = `partials/${name}.html`;
    const open = `<!-- include:${name} -->`;
    const close = `<!-- /include:${name} -->`;
    const block = `${open}\n${rebase(read(partialFile).trim(), base)}\n${close}`;
    const placeholder = `<div data-include="${partialFile}"></div>`;

    if (html.includes(open) && html.includes(close)) {
      const a = html.indexOf(open);
      const b = html.indexOf(close) + close.length;
      html = html.slice(0, a) + block + html.slice(b);
    } else if (html.includes(placeholder)) {
      html = html.replace(placeholder, block);
    }
  }

  const before = fs.readFileSync(path.join(root, page), 'utf8').replace(/\r\n/g, '\n');
  if (html !== before) {
    fs.writeFileSync(path.join(root, page), html, 'utf8');
    changed++;
    console.log('mis à jour :', page);
  }
}
console.log(changed ? `${changed} page(s) mise(s) à jour.` : 'Rien à changer.');
