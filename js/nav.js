// Navigation : menu burger (mobile), menus déroulants et repérage de la page courante.

// Menu mobile toggle — appelé après injection du header dans le DOM
function initMenuToggle() {
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("header nav");

  if (!menuToggle || !nav) return; // sécurité si header absent

  menuToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Fermer le menu si le curseur quitte la zone du menu (uniquement en mobile)
  nav.addEventListener("mouseleave", () => {
    if (window.innerWidth <= 1000) {
      nav.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });

  initNavDropdowns(nav);

  // Fermer le menu si on clique sur un lien (uniquement en mobile)
  const navLinks = nav.querySelectorAll("a");
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 1000) {
        nav.classList.remove("active");
      }
    });
  });
}

// Menus déroulants du header : clic (mobile/clavier), Échap, clic extérieur.
// Sur ordinateur, l'ouverture au survol est gérée en CSS.
function initNavDropdowns(nav) {
  const items = nav.querySelectorAll(".nav-item");

  function closeAll(except) {
    items.forEach((item) => {
      if (item === except) return;
      item.classList.remove("open");
      const t = item.querySelector(".nav-trigger");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }

  items.forEach((item) => {
    const trigger = item.querySelector(".nav-trigger");
    if (!trigger) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !item.classList.contains("open");
      closeAll(item);
      item.classList.toggle("open", willOpen);
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    // Après un clic sur un sous-lien, le panneau se referme même si la souris reste dessus
    item.querySelectorAll(".nav-dropdown a").forEach((link) => {
      link.addEventListener("click", () => {
        item.classList.remove("open");
        item.classList.add("suppress");
        trigger.setAttribute("aria-expanded", "false");
      });
    });
    item.addEventListener("mouseleave", () => item.classList.remove("suppress"));
  });

  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) closeAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAll();
      const focused = nav.querySelector(".nav-trigger:focus");
      if (focused) focused.blur();
    }
  });
}

// Surligne le lien de la page courante (les ancres de l'accueil sont gérées par home.js)
function markCurrentPage() {
  var path = location.pathname;
  if (/index\.html$|\/$/.test(path)) return;
  document.querySelectorAll('header nav a').forEach(function (link) {
    var url = new URL(link.href, location.href);
    if (url.hash || url.pathname !== path) return;
    link.classList.add('active');
    var item = link.closest('.nav-item');
    if (item) item.classList.add('has-active');
  });
}

document.addEventListener('partials:ready', function () {
  initMenuToggle();
  markCurrentPage();
});
