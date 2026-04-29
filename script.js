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

// Simple slider automatic rotation
// Appelée après injection de slider.html dans le DOM
function initSlider() {
  const slides = document.querySelectorAll(".slide");
  if (!slides.length) return;
  let currentSlide = 0;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }

  setInterval(nextSlide, 8000); // Change slide toutes les 8s
}




///////////////////// PAGE MEMBRES/////////////////////////////////////////////////////////////
