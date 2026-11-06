// Éléments d'interface communs : bouton « retour en haut » et apparition des blocs au défilement.
(function () {
  var btn = document.getElementById('back-to-top');
  if (btn) {
    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 400);
    });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (!('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(
    '.vision-item, .programme-item, .event-card, .intro-text, #equipe-dirigeante, #partenaires, #contact'
  ).forEach(function (el) {
    el.classList.add('scroll-hidden');
    observer.observe(el);
  });
})();
