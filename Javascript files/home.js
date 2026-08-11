import "./site.js";
import { supabase } from "./supabase-client.js";

// -----------------------------------------------------------------
// (Mobile nav, year, and admin-link visibility now live in site.js,
// shared across every page.)
// -----------------------------------------------------------------

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
// Show the Admin link only to signed-in users whose profile role
// is 'admin'. This is now handled by site.js for every page — kept
// here only as a no-op import so nothing breaks if referenced.
// -----------------------------------------------------------------

loadLatestVideo();
loadLatestPhotos();