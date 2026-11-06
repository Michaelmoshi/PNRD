// Slider d'accueil (fragment partials/slider.html).

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

document.addEventListener('partials:ready', function () {
  if (document.querySelector('.slider')) initSlider();
});
