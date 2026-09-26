/**
 * Hanging card — a lanyard-style card that swings, can be dragged and
 * tossed, and flips on click. Call `HangingCard.show(post)` whenever a
 * new post is published to pop it into view.
 *
 * Usage:
 *   import { HangingCard } from "./hanging-card.js";
 *   HangingCard.mount(); // once, e.g. in home.js
 *   HangingCard.show({
 *     type: "photo",           // "photo" | "video" | "testimony"
 *     image: "https://...",    // thumbnail / poster image
 *     title: "New photo posted",
 *     subtitle: "Youth choir leading Sunday worship",
 *   });
 */

const SWING_SPRING = 0.06;
const SWING_DAMPING = 0.92;
const MAX_ANGLE = 32;

class HangingCardController {
  constructor() {
    this.mounted = false;
    this.angle = 0;
    this.velocity = 0;
    this.dragging = false;
    this.dragStartX = 0;
    this.dragStartAngle = 0;
    this.rafId = null;
  }

  mount() {
    if (this.mounted) return;
    this.mounted = true;

    this.stage = document.createElement("div");
    this.stage.className = "hcard-stage";
    this.stage.innerHTML = `
      <div class="hcard-pivot">
        <div class="hcard-lanyard"></div>
        <div class="hcard-card">
          <button type="button" class="hcard-close" aria-label="Close">×</button>
          <div class="hcard-face-inner">
            <div class="hcard-face hcard-face--front">
              <div class="hcard-media"></div>
              <div class="hcard-body">
                <span class="hcard-badge"></span>
                <p class="hcard-title"></p>
                <p class="hcard-sub"></p>
                <span class="hcard-hint">Drag to swing • Click to flip</span>
              </div>
            </div>
            <div class="hcard-face hcard-face--back">
              <div class="hcard-body">
                <div class="hcard-qr">CTY</div>
                <p class="hcard-sub">Tap "See all posts" to view this on the site.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.stage);

    this.pivot = this.stage.querySelector(".hcard-pivot");
    this.card = this.stage.querySelector(".hcard-card");
    this.closeBtn = this.stage.querySelector(".hcard-close");
    this.mediaEl = this.stage.querySelector(".hcard-media");
    this.badgeEl = this.stage.querySelector(".hcard-badge");
    this.titleEl = this.stage.querySelector(".hcard-title");
    this.subEl = this.stage.querySelector(".hcard-sub");

    this.bindEvents();
    this.loop();
  }

  bindEvents() {
    const start = (clientX) => {
      this.dragging = true;
      this.dragStartX = clientX;
      this.dragStartAngle = this.angle;
      this.card.classList.add("is-grabbing");
    };
    const move = (clientX) => {
      if (!this.dragging) return;
      const dx = clientX - this.dragStartX;
      this.angle = clamp(this.dragStartAngle + dx * 0.35, -MAX_ANGLE, MAX_ANGLE);
    };
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.card.classList.remove("is-grabbing");
      // Whatever angle it's released at becomes the swing's starting energy.
      this.velocity += this.angle * 0.02;
    };

    this.card.addEventListener("mousedown", (e) => { start(e.clientX); e.preventDefault(); });
    window.addEventListener("mousemove", (e) => move(e.clientX));
    window.addEventListener("mouseup", end);

    this.card.addEventListener("touchstart", (e) => start(e.touches[0].clientX), { passive: true });
    window.addEventListener("touchmove", (e) => move(e.touches[0].clientX), { passive: true });
    window.addEventListener("touchend", end);

    let moved = false;
    this.card.addEventListener("mousedown", () => { moved = false; });
    window.addEventListener("mousemove", () => { if (this.dragging) moved = true; });
    this.card.addEventListener("click", () => {
      if (moved) return; // don't flip if it was a drag, only a genuine click
      this.card.classList.toggle("is-flipped");
    });

    this.closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
    });
  }

  loop() {
    if (!this.dragging) {
      // Simple spring-back-to-center with damping, like a real pendulum.
      const force = -this.angle * SWING_SPRING;
      this.velocity = (this.velocity + force) * SWING_DAMPING;
      this.angle += this.velocity;
    }
    this.pivot.style.transform = `rotate(${this.angle}deg)`;
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  show(post) {
    if (!this.mounted) this.mount();

    this.mediaEl.style.backgroundImage = post.image ? `url(${post.image})` : "none";
    this.badgeEl.textContent = post.type || "Update";
    this.titleEl.textContent = post.title || "New post";
    this.subEl.textContent = post.subtitle || "";
    this.card.classList.remove("is-flipped");

    // Give it a little starting swing so it doesn't just appear static.
    this.angle = 14;
    this.velocity = 0;

    this.stage.classList.add("is-visible");

    clearTimeout(this._autoHideTimer);
    this._autoHideTimer = setTimeout(() => this.hide(), 9000);
  }

  hide() {
    if (!this.stage) return;
    this.stage.classList.remove("is-visible");
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export const HangingCard = new HangingCardController();