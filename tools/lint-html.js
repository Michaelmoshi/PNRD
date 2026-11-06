// Vérifie que les fichiers HTML ne contiennent que du HTML :
//   - pas de CSS dans la page    (balise <style>, attribut style="…")
//   - pas de JavaScript en ligne  (balise <script> sans src, attributs onclick="…", href="javascript:…")
//
// Le style va dans css/, le comportement dans js/. Seule exception admise : les données structurées
// pour les moteurs de recherche (<script type="application/ld+json">), qui sont des données, pas du code.
//
//   node tools/lint-html.js        (code de sortie 1 si un problème est trouvé)

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const IGNORED = new Set(['.git', '.claude', '.idea', '.vscode', 'node_modules']);

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (IGNORED.has(e.name)) return [];
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(full);
    return e.name.endsWith('.html') ? [full] : [];
  });
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const problems = [];

for (const file of htmlFiles(root)) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const add = (re, message) => {
    for (const m of html.matchAll(re)) problems.push(`${rel}:${lineOf(html, m.index)}  ${message}`);
  };

  add(/<style[\s>]/g, 'balise <style> : déplacer le CSS dans css/');
  add(/\sstyle\s*=\s*["']/g, 'attribut style="…" : utiliser une classe CSS');
  add(/\son[a-z]+\s*=\s*["']/gi, 'gestionnaire en ligne (onclick…) : utiliser un fichier dans js/');
  add(/href\s*=\s*["']\s*javascript:/gi, 'lien javascript: : utiliser un bouton ou un fichier dans js/');

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;                       // script externe : correct
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;  // données structurées : admis
    problems.push(`${rel}:${lineOf(html, m.index)}  script en ligne : déplacer le code dans js/`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problème(s) :\n` + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log('HTML propre : aucun CSS ni JavaScript en ligne.');
