// Shared behaviour for CTY Ministries policy pages.
(function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  var toggle = document.getElementById("menuToggle");
  var mobileNav = document.getElementById("mobileNav");

  if (toggle && mobileNav) {
    var closeMenu = function () {
      toggle.setAttribute("aria-expanded", "false");
      mobileNav.classList.remove("is-open");
    };

    toggle.addEventListener("click", function () {
      var isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      mobileNav.classList.toggle("is-open", !isOpen);
    });

    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- Sidebar scrollspy ---------- */
  var sections = document.querySelectorAll(".policy-section[id]");
  var sidebarLinks = document.querySelectorAll(".policy-sidebar nav a");

  if (sections.length && sidebarLinks.length && "IntersectionObserver" in window) {
    var linkFor = function (id) {
      return document.querySelector('.policy-sidebar nav a[href="#' + id + '"]');
    };

    var setActive = function (id) {
      sidebarLinks.forEach(function (l) { l.classList.remove("active"); });
      var active = linkFor(id);
      if (active) {
        active.classList.add("active");
        if (active.scrollIntoView) {
          active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        }
      }
    };

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---------- Back to top ---------- */
  var backTop = document.getElementById("backTop");
  if (backTop) {
    var ticking = false;
    var updateBackTop = function () {
      backTop.classList.toggle("visible", window.scrollY > 500);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(updateBackTop);
        ticking = true;
      }
    }, { passive: true });
    backTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();