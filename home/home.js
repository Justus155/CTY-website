import { supabase } from "../Javascript files/supabaseclient.js";
import { applyHeaderAuthState } from "../Javascript files/header-auth.js";

// -----------------------------------------------------------------
// Mobile nav toggle
// -----------------------------------------------------------------
const navToggle = document.getElementById("nav-toggle");
const mainNav = document.getElementById("main-nav");
navToggle?.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const profileDrawer = document.getElementById("profile-drawer");
const profileDrawerClose = document.getElementById("profile-drawer-close");
const profileDrawerBackdrop = document.getElementById("profile-drawer-backdrop");
let isAdmin = false;

document.getElementById("year").textContent = new Date().getFullYear();

// -----------------------------------------------------------------
// Fallback dummy content — shown if Supabase isn't connected yet,
// or if there's simply no content in the database yet.
// Replace/remove once real posts exist.
// -----------------------------------------------------------------
const DUMMY_VIDEO = {
  title: "Mataifa Yote — CTY Ministries",
  note: "A featured community worship moment from CTY Ministries.",
  video_url: "images/mataifa%20yote.mp4",
};

const DUMMY_PHOTOS = [
  { caption: "CTY community moment", created_at: "2025-06-01", image_url: "images/IMG_7732.jpg" },
  { caption: "Sunday fellowship snapshot", created_at: "2025-06-01", image_url: "images/IMG_8030.jpg" },
  { caption: "Youth gathering highlight", created_at: "2025-05-24", image_url: "images/IMG_8234.jpg" },
  { caption: "Worship team in action", created_at: "2025-05-24", image_url: "images/IMG_8248.jpg" },
  { caption: "Friends of CTY celebration", created_at: "2025-05-17", image_url: "images/IMG_8565.jpg" },
  { caption: "A joyful CTY memory", created_at: "2025-05-10", image_url: "images/IMG_8797.jpg" },
];

// -----------------------------------------------------------------
// Load latest video into the hero
// -----------------------------------------------------------------
async function loadLatestVideo() {
  const frame = document.getElementById("video-frame");
  const titleEl = document.getElementById("hero-title");
  const noteEl = document.getElementById("hero-note");

  let video = { ...DUMMY_VIDEO, id: null };

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, media_url, created_at, is_featured")
      .eq("type", "video")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      video = {
        id: data.id,
        title: data.caption || "CTY Ministries",
        note: data.caption || "A featured community worship moment from CTY Ministries.",
        video_url: data.media_url,
      };
    }
  } catch {
    // Supabase not configured yet — dummy content stays in place.
  }

  titleEl.textContent = video.title;
  noteEl.textContent = video.note;

  const existingDeleteBtn = document.getElementById("hero-delete-btn");
  if (existingDeleteBtn) existingDeleteBtn.remove();

  if (isAdmin && video.id) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.id = "hero-delete-btn";
    deleteBtn.className = "btn-ghost";
    deleteBtn.textContent = "Delete this video";
    deleteBtn.addEventListener("click", () => deletePost(video.id));
    noteEl.insertAdjacentElement("afterend", deleteBtn);
  }

  if (video.video_url) {
    frame.innerHTML = video.video_url.includes("youtube") || video.video_url.includes("youtu.be")
      ? `<iframe src="${video.video_url}" allowfullscreen loading="lazy"></iframe>`
      : `<video src="${video.video_url}" controls playsinline></video>`;
  }
}

// -----------------------------------------------------------------
// Load latest photos into the gallery grid
// -----------------------------------------------------------------
async function loadLatestPhotos() {
  const grid = document.getElementById("gallery-grid");
  let photos = DUMMY_PHOTOS.map((photo) => ({ ...photo, id: null, media_url: photo.image_url }));

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, media_url, created_at")
      .eq("type", "photo")
      .order("created_at", { ascending: false })
      .limit(6);

    if (!error && data && data.length) photos = data;
  } catch {
    // Supabase not configured yet — dummy content stays in place.
  }

  grid.innerHTML = photos.map(photoCardHTML).join("");
}

function photoCardHTML(photo) {
  const date = photo.created_at
    ? new Date(photo.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";
  const bg = photo.media_url
    ? `<img src="${photo.media_url}" alt="${escapeHtml(photo.caption || "")}" loading="lazy" />`
    : `<div class="photo-card skeleton" style="position:absolute;inset:0;"></div>`;

  return `
    <div class="photo-card" data-post-id="${photo.id || ""}">
      ${bg}
      <div class="caption">
        ${date ? `<span class="cap-date">${date}</span>` : ""}
        <p>${escapeHtml(photo.caption || "")}</p>
        ${isAdmin && photo.id ? `<button type="button" class="btn-ghost photo-delete-btn" data-post-id="${photo.id}">Delete</button>` : ""}
      </div>
    </div>
  `;
}

async function resolveAdminState() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      isAdmin = false;
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    isAdmin = profile?.role === "admin";
  } catch {
    isAdmin = false;
  }
}

async function deletePost(postId) {
  if (!postId || !isAdmin) return;
  if (!window.confirm("Delete this post? This cannot be undone.")) return;

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) {
    window.alert(error.message || "Could not delete post.");
    return;
  }

  await Promise.all([loadLatestVideo(), loadLatestPhotos()]);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function openProfileDrawer() {
  if (!profileDrawer || !profileDrawerBackdrop) return;
  profileDrawer.setAttribute("aria-hidden", "false");
  profileDrawerBackdrop.hidden = false;
  document.body.classList.add("profile-drawer-open");
}

function closeProfileDrawer() {
  if (!profileDrawer || !profileDrawerBackdrop) return;
  profileDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("profile-drawer-open");
  window.setTimeout(() => {
    if (!document.body.classList.contains("profile-drawer-open")) {
      profileDrawerBackdrop.hidden = true;
    }
  }, 220);
}

function setupProfileDrawer() {
  const profileLink = document.getElementById("profile-link");
  profileLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openProfileDrawer();
  });

  profileDrawerClose?.addEventListener("click", closeProfileDrawer);
  profileDrawerBackdrop?.addEventListener("click", closeProfileDrawer);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProfileDrawer();
  });

  window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;
    if (event.data.type === "close-profile-drawer") {
      closeProfileDrawer();
    }
    if (event.data.type === "profile-updated") {
      applyHeaderAuthState();
    }
    if (event.data.type === "signed-out") {
      window.location.href = "../login/signin.html";
    }
  });
}

document.getElementById("gallery-grid")?.addEventListener("click", (event) => {
  const btn = event.target.closest(".photo-delete-btn");
  if (!btn) return;
  deletePost(btn.dataset.postId);
});

async function initHomeContent() {
  await resolveAdminState();
  await Promise.all([loadLatestVideo(), loadLatestPhotos()]);
}

initHomeContent();
setupProfileDrawer();
