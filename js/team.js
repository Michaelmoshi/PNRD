// Page Membres : onglets de catégories.

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
