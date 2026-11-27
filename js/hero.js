// Reveal the hero panel on the first downward scroll (or immediately if the
// page loads already scrolled, e.g. after a refresh).
(function () {
  var panel = document.querySelector(".hero-panel");
  if (!panel) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function reveal() {
    panel.classList.add("is-visible");
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("wheel", onScroll);
    window.removeEventListener("touchmove", onScroll);
  }
  function onScroll() {
    reveal();
  }
  if (reduce || window.pageYOffset > 0) {
    reveal();
    return;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("wheel", onScroll, { passive: true });
  window.addEventListener("touchmove", onScroll, { passive: true });
})();
