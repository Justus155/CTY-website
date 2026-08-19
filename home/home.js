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

  let video = { ...DUMMY_VIDEO };

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
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function initHomeContent() {
  await Promise.all([loadLatestVideo(), loadLatestPhotos()]);
}

initHomeContent();
