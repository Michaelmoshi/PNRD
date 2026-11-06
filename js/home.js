// Page d'accueil : menu actif selon la section visible, lecteur des événements passés, chiffres clés.

// --- Menu actif selon la section visible (après chargement de l'en-tête)
document.addEventListener('partials:ready', function () {
  var navLinks = document.querySelectorAll('header nav a');

  function setActive() {
    var scrollY = window.scrollY + 100;
    var current = '';

    document.querySelectorAll('section[id]').forEach(function (section) {
      if (section.offsetTop <= scrollY) current = section.getAttribute('id');
    });

    navLinks.forEach(function (link) {
      link.classList.remove('active');
      var href = link.getAttribute('href') || '';
      var hash = href.indexOf('#') > -1 ? href.split('#')[1] : '';
      if (current && hash === current) link.classList.add('active');
      if (!current && href === 'index.html') link.classList.add('active');
    });

    // Le menu déroulant parent s'allume quand une de ses sections est visible
    document.querySelectorAll('.nav-item[data-sections]').forEach(function (item) {
      var list = item.getAttribute('data-sections').split(' ');
      item.classList.toggle('has-active', list.indexOf(current) > -1);
    });
  }

  window.addEventListener('scroll', setActive);
  setActive();
});

// --- Événements passés : un clic sur une miniature charge la vidéo dans le lecteur principal
(function () {
  var video = document.getElementById('archive-video');
  var caption = document.getElementById('archive-caption');
  if (!video || !caption) return;
  var items = document.querySelectorAll('.archive-item');

  function sources(btn) {
    var html = '';
    if (btn.dataset.videoWebm) html += '<source src="' + btn.dataset.videoWebm + '" type="video/webm">';
    if (btn.dataset.videoMp4) html += '<source src="' + btn.dataset.videoMp4 + '" type="video/mp4">';
    return html;
  }

  function show(btn) {
    items.forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    video.pause();
    if (btn.dataset.poster) { video.poster = btn.dataset.poster; } else { video.removeAttribute('poster'); }
    video.innerHTML = sources(btn);
    video.load();
    caption.classList.add('is-changing');
    setTimeout(function () {
      var d = document.getElementById('archive-date');
      d.textContent = btn.dataset.date;
      d.setAttribute('datetime', btn.dataset.iso);
      document.getElementById('archive-title').textContent = btn.dataset.title;
      document.getElementById('archive-text').textContent = btn.dataset.text;
      document.getElementById('archive-cta').setAttribute('href', btn.dataset.href);
      caption.classList.remove('is-changing');
    }, 150);
  }

  items.forEach(function (b) { b.addEventListener('click', function () { show(b); }); });
})();

// --- Chiffres clés : décompte animé quand la bande entre à l'écran (la valeur finale est déjà dans le HTML)
(function () {
  var nums = document.querySelectorAll('.stat-number[data-count]');
  if (!nums.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  function fmt(n) { return n.toLocaleString('fr-FR'); }

  function run(el) {
    var end = parseInt(el.dataset.count, 10), suffix = el.dataset.suffix || '', start = null, dur = 1400;
    function step(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(end * eased)) + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
    });
  }, { threshold: 0.6 });
  nums.forEach(function (n) { io.observe(n); });
})();
