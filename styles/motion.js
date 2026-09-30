/* =========================================================
   CTY Ministries — shared motion & UX layer (vanilla ES module)
   - Scroll progress bar
   - Staggered reveal-on-scroll (IntersectionObserver)
   - Button ripple / press feedback
   - Accessible image lightbox (works on .cty-photo and gallery imgs)
   - Shared toast API (CTY.toast)
   No dependencies. Honors prefers-reduced-motion.
   ========================================================= */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------------------------------------------------------
   1. Scroll progress bar
--------------------------------------------------------- */
function initScrollProgress() {
  if (document.getElementById("cty-scroll-progress")) return;

  const bar = document.createElement("div");
  bar.id = "cty-scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);

  let ticking = false;

  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.transform = `scaleX(${ratio})`;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );

  update();
}

/* ---------------------------------------------------------
   2. Reveal on scroll
--------------------------------------------------------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

function initReveals() {
  const candidates = document.querySelectorAll(
    ".stage, .gallery-card, .connect-panel, .event-card, .ig-card, .leader-card, .story-card, " +
    ".pillar-card, .symbol-item, .card, .cta, .intro-text, .video-wrapper, .intro-label, .contact-item, " +
    ".contact-form-wrap, .contact-panel, .photo-card, .submit-box, .events-empty, .testimonies .card, .hero-card, .hero-copy"
  );

  let i = 0;
  candidates.forEach((el) => {
    if (el.classList.contains("cty-reveal") || el.classList.contains("skeleton")) return;
    el.classList.add("cty-reveal");
    // subtle stagger between siblings within the same parent
    const siblings = el.parentElement
      ? Array.from(el.parentElement.children).filter((c) => c.classList.contains("cty-reveal"))
      : [el];
    const idx = siblings.indexOf(el);
    el.style.setProperty("--reveal-delay", `${Math.min(idx * 90, 450)}ms`);
    revealObserver.observe(el);
    i += 1;
  });
}

/* ---------------------------------------------------------
   3. Button press + ripple
--------------------------------------------------------- */
function initPressFeedback() {
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target.closest("button, .button, .btn-primary, .btn-ghost, .ig-btn, .nav-button, .rsvp-btn");
      if (!target || reducedMotion.matches) return;

      target.classList.add("cty-press");

      const rect = target.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "cty-ripple";
      const size = Math.max(rect.width, rect.height) * 1.1;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      target.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    },
    { passive: true }
  );

  document.addEventListener(
    "pointerup",
    (event) => {
      const target = event.target.closest(".cty-press");
      if (target) setTimeout(() => target.classList.remove("cty-press"), 180);
    },
    { passive: true }
  );
}

/* ---------------------------------------------------------
   4. Lightbox
--------------------------------------------------------- */
const lightboxState = { el: null, img: null, caption: null };

function ensureLightbox() {
  if (lightboxState.el) return lightboxState.el;

  const el = document.createElement("div");
  el.className = "cty-lightbox";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Image viewer");
  el.innerHTML = `
    <button type="button" class="cty-lightbox-close" aria-label="Close image viewer">&times;</button>
    <img alt="" />
    <p class="cty-lightbox-caption"></p>
  `;
  document.body.append(el);

  lightboxState.el = el;
  lightboxState.img = el.querySelector("img");
  lightboxState.caption = el.querySelector(".cty-lightbox-caption");

  el.addEventListener("click", (event) => {
    if (event.target === el || event.target.closest(".cty-lightbox-close")) closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.classList.contains("is-open")) closeLightbox();
  });

  return el;
}

function openLightbox(src, alt = "", captionText = "") {
  const el = ensureLightbox();
  lightboxState.img.src = src;
  lightboxState.img.alt = alt;
  lightboxState.caption.textContent = captionText;
  el.classList.add("is-open");
  document.body.classList.add("cty-lightbox-open");
  el.querySelector(".cty-lightbox-close").focus();
}

function closeLightbox() {
  if (!lightboxState.el) return;
  lightboxState.el.classList.remove("is-open");
  document.body.classList.remove("cty-lightbox-open");
}

function initLightbox() {
  document.addEventListener("click", (event) => {
    const photo = event.target.closest(".cty-photo, .gallery-card");
    if (!photo) return;

    const img = photo.querySelector("img");
    if (!img || !img.src) return;

    event.preventDefault();
    const caption = photo.querySelector(".carousel-caption, .caption, figcaption");
    openLightbox(img.currentSrc || img.src, img.alt || "", caption ? caption.textContent.trim() : "");
  });
}

/* ---------------------------------------------------------
   5. Toasts
--------------------------------------------------------- */
let toastTimer = null;

function showToast(message, type = "info") {
  let toast = document.querySelector(".cty-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "cty-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.append(toast);
  }

  toast.textContent = message;
  toast.className = `cty-toast cty-toast--${type}`;
  void toast.offsetWidth; // restart transition
  toast.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3400);
}

/* ---------------------------------------------------------
   Boot
--------------------------------------------------------- */
function initMotion() {
  initScrollProgress();
  initReveals();
  initPressFeedback();
  initLightbox();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMotion, { once: true });
} else {
  initMotion();
}

/* Public API for page scripts */
export const CTY = { showToast, openLightbox, closeLightbox };
