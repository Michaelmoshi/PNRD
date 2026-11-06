// Page « détail d'un événement » : une seule page, alimentée par data/evenements.json (?id=1, ?id=2…).
(function () {
  var base = document.documentElement.getAttribute('data-base') || '';
  var external = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
  var path = function (p) { return !p || external.test(p) ? p : base + p; };

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') node.textContent = props[k];
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  // Sans affiche, « #t=0.5 » fait afficher une image de la vidéo elle-même
  function videoSources(video, v, firstFrame) {
    video.innerHTML = '';
    if (v.webm) video.appendChild(el('source', { src: path(v.webm) + (firstFrame ? '#t=0.5' : ''), type: 'video/webm' }));
    if (v.mp4) video.appendChild(el('source', { src: path(v.mp4) + (firstFrame ? '#t=0.5' : ''), type: 'video/mp4' }));
    video.load();
  }

  function notFound() {
    document.title = 'Événement introuvable — PNRD';
    document.getElementById('ev-title').textContent = 'Événement introuvable';
    document.getElementById('ev-desc').textContent = 'Cet événement n\'existe pas ou n\'est plus disponible.';
    document.getElementById('ev-content').hidden = true;
  }

  function render(list, id) {
    var ev = list.filter(function (e) { return e.id === id; })[0];
    if (!ev) return notFound();

    document.title = ev.title + ' — PNRD';
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', ev.description);

    var date = document.getElementById('ev-date');
    date.textContent = ev.dateLabel;
    date.setAttribute('datetime', ev.date);
    document.getElementById('ev-title').textContent = ev.title;
    document.getElementById('ev-desc').textContent = ev.description;

    var video = document.getElementById('ev-video');
    if (ev.poster) video.setAttribute('poster', path(ev.poster));
    videoSources(video, ev.video, !ev.poster);

    var report = document.getElementById('ev-report');
    var paragraphs = (ev.report && ev.report.length) ? ev.report : [ev.description, 'Le compte rendu détaillé de cet événement sera publié prochainement.'];
    paragraphs.forEach(function (p) { report.appendChild(el('p', { text: p })); });

    var others = document.getElementById('ev-others');
    list.filter(function (e) { return e.id !== id; }).forEach(function (o) {
      var thumb = el('span', { 'class': 'archive-thumb' });
      if (o.poster) {
        thumb.appendChild(el('img', { src: path(o.poster), alt: '', loading: 'lazy' }));
      } else {
        thumb.appendChild(el('video', { src: path(o.video.mp4) + '#t=0.5', preload: 'metadata', muted: '', playsinline: '', tabindex: '-1' }));
        thumb.lastChild.muted = true;
      }
      thumb.appendChild(el('span', { 'class': 'archive-play', 'aria-hidden': 'true' }));
      var body = el('span', { 'class': 'archive-item-body' }, [
        el('time', { datetime: o.date, text: o.dateLabel }),
        el('strong', { text: o.title })
      ]);
      var link = el('a', { 'class': 'ev-link', href: 'evenement.html?id=' + o.id }, [thumb, body]);
      others.appendChild(el('li', {}, [link]));
    });
  }

  var id = parseInt(new URLSearchParams(location.search).get('id'), 10);
  fetch(base + 'data/evenements.json')
    .then(function (r) { if (!r.ok) throw new Error('Données introuvables'); return r.json(); })
    .then(function (list) { render(list, id); })
    .catch(function (err) { console.error(err); notFound(); });
})();
