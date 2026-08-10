import { supabase } from "../Javascript files/supabaseclient.js";

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

document.getElementById("year").textContent = new Date().getFullYear();

// -----------------------------------------------------------------
// Fallback dummy content — shown if Supabase isn't connected yet,
// or if there's simply no content in the database yet.
// Replace/remove once real posts exist.
// -----------------------------------------------------------------
const DUMMY_VIDEO = {
  title: "Sunday Praise & Worship Highlights",
  note: "The worship team leading us into a powerful time of praise this past Sunday — a reminder of why we gather every week.",
  video_url: null, // e.g. a YouTube embed URL or direct .mp4 from Supabase Storage
};

const DUMMY_PHOTOS = [
  { caption: "Youth choir leading Sunday worship", created_at: "2025-06-01", image_url: null },
  { caption: "Kids enjoying cake at the CTY family day", created_at: "2025-06-01", image_url: null },
  { caption: "Sweet 16 celebration on the church stage", created_at: "2025-05-24", image_url: null },
  { caption: "Sharing testimonies with the little ones", created_at: "2025-05-24", image_url: null },
  { caption: "Fellowship after the youth service", created_at: "2025-05-17", image_url: null },
  { caption: "Celebrating a birthday within the CTY family", created_at: "2025-05-10", image_url: null },
];

// -----------------------------------------------------------------
// Load latest video into the hero
// -----------------------------------------------------------------
async function loadLatestVideo() {
  const frame = document.getElementById("video-frame");
  const titleEl = document.getElementById("hero-title");
  const noteEl = document.getElementById("hero-note");

  let video = DUMMY_VIDEO;

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("title, note, video_url, created_at")
      .eq("type", "video")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) video = data;
  } catch {
    // Supabase not configured yet — dummy content stays in place.
  }

  titleEl.textContent = video.title;
  noteEl.textContent = video.note;

  if (video.video_url) {
    frame.innerHTML = video.video_url.includes("youtube") || video.video_url.includes("youtu.be")
      ? `<iframe src="${video.video_url}" allowfullscreen loading="lazy"></iframe>`
      : `<video src="${video.video_url}" controls playsinline></video>`;
  } else {
    document.getElementById("video-caption").textContent = "No video uploaded yet — check back soon.";
  }
}

// -----------------------------------------------------------------
// Load latest photos into the gallery grid
// -----------------------------------------------------------------
async function loadLatestPhotos() {
  const grid = document.getElementById("gallery-grid");
  let photos = DUMMY_PHOTOS;

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("caption, image_url, created_at")
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
  const bg = photo.image_url
    ? `<img src="${photo.image_url}" alt="${escapeHtml(photo.caption || "")}" loading="lazy" />`
    : `<div class="photo-card skeleton" style="position:absolute;inset:0;"></div>`;

  return `
    <div class="photo-card">
      ${bg}
      <div class="caption">
        ${date ? `<span class="cap-date">${date}</span>` : ""}
        <p>${escapeHtml(photo.caption || "")}</p>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// -----------------------------------------------------------------
// Signed-in users see a profile chip; guests see the Sign in button.
// -----------------------------------------------------------------
async function checkHeaderSession() {
  const { data: { session } } = await supabase.auth.getSession();
  const signInLink = document.getElementById("signin-link");
  const profileLink = document.getElementById("profile-link");
  const profileName = document.getElementById("profile-name");
  const profileAvatar = document.getElementById("profile-avatar");

  if (!session) {
    if (profileLink) profileLink.hidden = true;
    if (signInLink) signInLink.hidden = false;
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", session.user.id)
    .maybeSingle();

  const fullName =
    profile?.full_name ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] ||
    "Profile";
  const firstName = fullName.split(" ")[0];

  if (profileName) profileName.textContent = firstName;
  if (profileAvatar) {
    if (profile?.avatar_url) {
      profileAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${escapeHtml(firstName)}" />`;
    } else {
      profileAvatar.textContent = firstName.charAt(0).toUpperCase();
    }
  }
  if (profileLink) {
    profileLink.hidden = false;
    profileLink.href = "profile.html";
    profileLink.title = fullName;
  }

  if (signInLink) {
    signInLink.hidden = true;
  }
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
      checkHeaderSession();
    }
    if (event.data.type === "signed-out") {
      window.location.href = "../login/signin.html";
    }
  });
}

loadLatestVideo();
loadLatestPhotos();
checkHeaderSession();
setupProfileDrawer();