const SWING_SPRING = 0.06;
const SWING_DAMPING = 0.92;
const MAX_ANGLE = 32;

class HangingCardController {
  constructor() {
    this.angle = 0;
    this.velocity = 0;
    this.dragging = false;
    this.moved = false;
    this.rafId = null;
    this.hideTimer = null;
  }

  mount() {
    if (this.stage) return;

    this.stage = document.createElement("div");
    this.stage.className = "hcard-stage";
    this.stage.setAttribute("aria-hidden", "true");
    this.stage.innerHTML = `
      <div class="hcard-pivot">
        <div class="hcard-lanyard" aria-hidden="true"></div>
        <div class="hcard-card" tabindex="0" aria-label="Flip announcement card">
          <button type="button" class="hcard-close" aria-label="Close announcement">&times;</button>
          <div class="hcard-face-inner">
            <div class="hcard-face hcard-face--front">
              <div class="hcard-media"></div>
              <div class="hcard-body">
                <span class="hcard-badge"></span>
                <p class="hcard-title"></p>
                <p class="hcard-sub"></p>
                <span class="hcard-hint">Drag to swing · Click to flip</span>
              </div>
            </div>
            <div class="hcard-face hcard-face--back">
              <div class="hcard-body">
                <span class="hcard-back-mark" aria-hidden="true">CTY</span>
                <p class="hcard-back-title">Just shared</p>
                <a class="hcard-link" href="#">View on this page</a>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.append(this.stage);

    this.pivot = this.stage.querySelector(".hcard-pivot");
    this.card = this.stage.querySelector(".hcard-card");
    this.mediaEl = this.stage.querySelector(".hcard-media");
    this.badgeEl = this.stage.querySelector(".hcard-badge");
    this.titleEl = this.stage.querySelector(".hcard-title");
    this.subEl = this.stage.querySelector(".hcard-sub");
    this.linkEl = this.stage.querySelector(".hcard-link");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.stage.querySelector(".hcard-close").addEventListener("click", event => {
      event.stopPropagation();
      this.hide();
    });
    this.card.addEventListener("pointerdown", event => {
      if (event.target.closest("button, a")) return;
      this.dragging = true;
      this.moved = false;
      this.dragStartX = event.clientX;
      this.dragStartAngle = this.angle;
      this.activePointerId = event.pointerId;
      this.card.classList.add("is-grabbing");
    });
    window.addEventListener("pointermove", event => {
      if (!this.dragging || event.pointerId !== this.activePointerId) return;
      const distance = event.clientX - this.dragStartX;
      if (Math.abs(distance) > 5) this.moved = true;
      this.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, this.dragStartAngle + distance * 0.35));
      this.pivot.style.transform = `rotate(${this.angle}deg)`;
    });
    const release = event => {
      if (!this.dragging || event.pointerId !== this.activePointerId) return;
      this.dragging = false;
      this.card.classList.remove("is-grabbing");
      if (this.reducedMotion.matches) {
        this.angle = 0;
        this.pivot.style.transform = "rotate(0deg)";
      } else {
        this.velocity += this.angle * 0.02;
      }
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    this.card.addEventListener("click", event => {
      if (event.target.closest("button, a")) return;
      if (!this.moved) this.card.classList.toggle("is-flipped");
      this.moved = false;
    });
    this.card.addEventListener("keydown", event => {
      if (event.target !== this.card || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      this.card.classList.toggle("is-flipped");
    });
    this.stage.addEventListener("keydown", event => {
      if (event.key === "Escape") this.hide();
    });
  }

  loop() {
    if (!this.dragging) {
      this.velocity = (this.velocity - this.angle * SWING_SPRING) * SWING_DAMPING;
      this.angle += this.velocity;
    }
    this.pivot.style.transform = `rotate(${this.angle}deg)`;
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  show(post) {
    this.mount();
    clearTimeout(this.hideTimer);
    cancelAnimationFrame(this.rafId);

    this.mediaEl.replaceChildren();
    this.mediaEl.classList.toggle("hcard-media--event", post.type === "event");
    if (post.image) {
      const image = document.createElement("img");
      image.src = post.image;
      image.alt = "";
      this.mediaEl.append(image);
    } else {
      const label = document.createElement("span");
      label.textContent = post.date || (post.type === "video" ? "VIDEO" : "CTY");
      this.mediaEl.append(label);
    }

    this.badgeEl.textContent = post.type || "Update";
    this.titleEl.textContent = post.title || "New update";
    this.subEl.textContent = post.subtitle || "";
    this.linkEl.href = post.type === "event" ? "#events-list" : "#ig-feed";
    this.card.classList.remove("is-flipped");
    this.stage.classList.add("is-visible");
    this.stage.setAttribute("aria-hidden", "false");
    this.angle = this.reducedMotion.matches ? 0 : 14;
    this.velocity = 0;
    this.pivot.style.transform = `rotate(${this.angle}deg)`;
    if (!this.reducedMotion.matches) this.loop();
    this.hideTimer = setTimeout(() => this.hide(), 9000);
  }

  hide() {
    if (!this.stage) return;
    clearTimeout(this.hideTimer);
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.dragging = false;
    this.card.classList.remove("is-grabbing");
    this.stage.classList.remove("is-visible");
    this.stage.setAttribute("aria-hidden", "true");
  }
}

export const HangingCard = new HangingCardController();