import { supabase } from "../Javascript files/supabaseclient.js";

const list = document.getElementById("testimonies");
const form = document.getElementById("testimony-form");
const overlay = document.getElementById("form-overlay");
const openForm = document.getElementById("open-form");
const closeForm = document.getElementById("close-form");
const submitButton = document.getElementById("submit-button");
const formMessage = document.getElementById("form-message");
const year = document.getElementById("year");
const menuToggle = document.getElementById("menuToggle");
const mobileNav = document.getElementById("mobileNav");

year.textContent = new Date().getFullYear();

menuToggle?.addEventListener("click", () => {
  const isOpen = mobileNav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

mobileNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mobileNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

/* =========================
   Helpers
========================= */

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function showMessage(text, type) {
  const box = document.getElementById("message");
  box.textContent = text;
  box.className = `message show ${type}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showFormMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = `message show ${type}`;
}

function closeFormModal() {
  overlay.classList.remove("show");
  document.body.classList.remove("locked");
  form.reset();
  formMessage.className = "message";
  formMessage.textContent = "";
}

/* =========================
   Load published testimonies
========================= */

async function loadTestimonies() {
  const { data, error } = await supabase
    .from("testimonies")
    .select(`
      id, name, location, theme, description, photo_url, video_url, created_at,
      profiles:submitted_by ( avatar_url, full_name )
    `)
    .eq("status", "published")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = `<div class="empty">We could not load the testimonies right now.</div>`;
    return;
  }

  if (!data.length) {
    list.innerHTML = `<div class="empty">No testimonies have been published yet. Be the first to share your story.</div>`;
    return;
  }

  list.innerHTML = data.map(story => {
    const ytId = getYouTubeId(story.video_url);
    const thumb = story.profiles?.avatar_url || story.photo_url ||
      (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

    return `
      <article class="card" data-id="${story.id}">
        <span class="tag">${escapeHtml(story.theme)}</span>
        <h3>${escapeHtml(story.name)}</h3>
        ${story.location ? `<p class="location">${escapeHtml(story.location)}</p>` : ""}
        ${thumb ? `<div class="thumb"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(story.name)}">${ytId ? '<span class="play">▶</span>' : ""}</div>` : ""}
        <p class="story">“${escapeHtml(story.description)}”</p>
        ${ytId ? `<button class="watch-btn" data-watch="${story.id}">▶ Watch story</button>` : ""}
      </article>
    `;
  }).join("");

  // Wire up "Watch story" buttons
  list.querySelectorAll("[data-watch]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.watch;
      const story = data.find(s => String(s.id) === String(id));
      if (story) openVideoModal(story);
    });
  });
}

/* =========================
   Inline YouTube modal
========================= */

function openVideoModal(story) {
  const ytId = getYouTubeId(story.video_url);
  if (!ytId) return;

  const videoOverlay = document.createElement("div");
  videoOverlay.className = "overlay show";
  videoOverlay.innerHTML = `
    <div class="modal" style="max-width:820px">
      <div class="modal-head">
        <div>
          <div class="eyebrow">${escapeHtml(story.theme)}</div>
          <h2 style="margin:5px 0 0">${escapeHtml(story.name)}'s story</h2>
        </div>
        <button class="close" type="button" aria-label="Close video">×</button>
      </div>
      <div class="video-wrap">
        <iframe
          src="https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0"
          title="${escapeHtml(story.name)}'s testimony"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      <p class="hint" style="margin-top:14px">${escapeHtml(story.location || "")}</p>
      <p class="story" style="margin-top:10px">${escapeHtml(story.description)}</p>
    </div>
  `;
  document.body.appendChild(videoOverlay);
  document.body.classList.add("locked");

  const close = () => {
    videoOverlay.remove();
    document.body.classList.remove("locked");
  };
  videoOverlay.querySelector(".close").addEventListener("click", close);
  videoOverlay.addEventListener("click", (e) => {
    if (e.target === videoOverlay) close();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });
}

/* =========================
   Submit form
========================= */

openForm.addEventListener("click", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showMessage("Please sign in before submitting a testimony.", "error");
    return;
  }
  overlay.classList.add("show");
  document.body.classList.add("locked");
});

closeForm.addEventListener("click", closeFormModal);
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeFormModal();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showFormMessage("Your session has expired. Please sign in again.", "error");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const location = document.getElementById("location").value.trim();
  const theme = document.getElementById("theme").value;
  const story = document.getElementById("story").value.trim();
  const video = document.getElementById("video").value.trim();
  const photo = document.getElementById("photo").files[0];

  if (story.length < 30) {
    showFormMessage("Please tell your story in at least 30 characters.", "error");
    return;
  }
  if (photo && photo.size > 5 * 1024 * 1024) {
    showFormMessage("Your photo is too large. Please choose one under 5 MB.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  try {
    let photoUrl = null;

    if (photo) {
      const extension = photo.name.split(".").pop().toLowerCase();
      const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("testimonies")
        .upload(path, photo, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("testimonies")
        .getPublicUrl(path);

      photoUrl = publicUrl.publicUrl;
    }

    // NOTE: submitted_by — matches the schema column
    const { error } = await supabase
      .from("testimonies")
      .insert({
        submitted_by: session.user.id,
        name,
        location: location || null,
        theme,
        description: story,
        video_url: video || null,
        photo_url: photoUrl,
        status: "pending",
        is_deleted: false,
      });

    if (error) throw error;

    form.reset();
    showFormMessage("Thank you! Your testimony has been sent to the admin team for review.", "success");
    setTimeout(closeFormModal, 2500);

  } catch (error) {
    console.error("Testimony submission error:", error);
    showFormMessage(
      error?.message?.includes("submitted_by")
        ? "Your account can't submit yet — please make sure you're signed in with a full profile."
        : "We could not submit your testimony. Please try again.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send for Review";
  }
});

loadTestimonies();