// Menu mobile toggle — appelé après injection du header dans le DOM
function initMenuToggle() {
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("nav");

  if (!menuToggle || !nav) return; // sécurité si header absent

  menuToggle.addEventListener("click", () => {
    nav.classList.toggle("active");
  });

  // Fermer le menu si le curseur quitte la zone du menu (uniquement en mobile)
  nav.addEventListener("mouseleave", () => {
    if (window.innerWidth <= 768) {
      nav.classList.remove("active");
    }
  });

  // Fermer le menu si on clique sur un lien (uniquement en mobile)
  const navLinks = nav.querySelectorAll("a");
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        nav.classList.remove("active");
      }
    });
  });
}

// Sur index.html le header est déjà dans le DOM, on peut appeler directement
if (document.querySelector(".menu-toggle")) {
  initMenuToggle();
}

// Social icons active effect + open link in new tab
function initSocialIcons() {
  const socialLinks = document.querySelectorAll(".social-icons a");
  socialLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      socialLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      setTimeout(() => {
        window.open(link.href, "_blank");
      }, 150);
    });
  });
}

// Slider avec rotation automatique + navigation manuelle (flèches et points)
// Appelée après injection de slider.html dans le DOM
function initSlider() {
  const slider = document.querySelector(".slider");
  const slides = document.querySelectorAll(".slide");
  if (!slider || !slides.length) return;

  const dots = slider.querySelectorAll(".slider-dot");
  const prevBtn = slider.querySelector(".slider-arrow-prev");
  const nextBtn = slider.querySelector(".slider-arrow-next");
  let currentSlide = 0;
  let autoplay;

  function showSlide(index) {
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentSlide);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentSlide);
      dot.setAttribute("aria-selected", i === currentSlide ? "true" : "false");
    });
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function startAutoplay() {
    autoplay = setInterval(nextSlide, 8000); // Change slide toutes les 8s
  }

  function resetAutoplay() {
    clearInterval(autoplay);
    startAutoplay();
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      nextSlide();
      resetAutoplay();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      prevSlide();
      resetAutoplay();
    });
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(parseInt(dot.dataset.index, 10));
      resetAutoplay();
    });
    dot.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showSlide(parseInt(dot.dataset.index, 10));
        resetAutoplay();
      }
    });
  });

  startAutoplay();
}




// Mini-sliders de la section "Qui sommes-nous ?"
function initIntroGallery() {
  const sliders = document.querySelectorAll('.mini-slider');
  sliders.forEach(function (slider) {
    const slides = slider.querySelectorAll('.mini-slide');
    if (slides.length < 2) return;
    let current = 0;
    const interval = parseInt(slider.dataset.interval) || 3500;

    setInterval(function () {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, interval);
  });
}

if (document.querySelector('.mini-slider')) {
  initIntroGallery();
}


///////////////////// PAGE MEMBRES/////////////////////////////////////////////////////////////

// Onglets de catégories — desktop uniquement (carte + liste).
// Sur mobile toutes les catégories restent affichées, il suffit de scroller.
function initTeamTabs() {
  const tabs = document.querySelectorAll('.team-tab');
  const groups = document.querySelectorAll('.team-group');
  if (!tabs.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
      groups.forEach(function (g) { g.classList.toggle('active', g.dataset.team === tab.dataset.team); });
    });
  });
}

if (document.querySelector('.team-tab')) {
  initTeamTabs();
}
