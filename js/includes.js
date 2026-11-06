// Fragments communs : repli au chargement dynamique + signal « partials:ready ».
//
// En fonctionnement normal, l'en-tête, le pied de page et le slider sont déjà copiés dans chaque page
// par « node tools/build.js ». Ce script ne charge donc rien, mais prévient les autres scripts
// (menu, slider, repérage de la page) que la page est prête.
// Il sait aussi charger un fragment resté sous la forme  <div data-include="partials/header.html"></div>.
//
// Les liens du fragment sont écrits depuis la racine du site ; ils sont corrigés ici selon la
// profondeur de la page (<html data-base="../"> pour les pages du dossier pages/).
(function () {
  var base = document.documentElement.getAttribute('data-base') || '';
  var absolute = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

  function fix(value) {
    return !value || absolute.test(value) ? value : base + value;
  }

  function rewrite(fragment) {
    fragment.querySelectorAll('[href], [src], [poster]').forEach(function (el) {
      ['href', 'src', 'poster'].forEach(function (attr) {
        if (el.hasAttribute(attr)) el.setAttribute(attr, fix(el.getAttribute(attr)));
      });
    });
  }

  function load(placeholder) {
    var file = placeholder.getAttribute('data-include');
    return fetch(base + file)
      .then(function (response) {
        if (!response.ok) throw new Error('Impossible de charger ' + file);
        return response.text();
      })
      .then(function (html) {
        var template = document.createElement('template');
        template.innerHTML = html;
        rewrite(template.content);
        placeholder.replaceWith(template.content);
      })
      .catch(function (err) { console.error(err); });
  }

  function run() {
    var placeholders = Array.prototype.slice.call(document.querySelectorAll('[data-include]'));
    Promise.all(placeholders.map(load)).then(function () {
      // Les scripts (menu, slider, repérage de la page…) démarrent quand les fragments sont en place
      document.dispatchEvent(new CustomEvent('partials:ready'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
