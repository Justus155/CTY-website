import "./site.js";
import { supabase } from "./supabase-client.js";

const grid = document.getElementById("posts-grid");
const filterTabs = document.getElementById("filter-tabs");
const loadMoreBtn = document.getElementById("load-more-btn");

const PAGE_SIZE = 9;
let currentFilter = "all";
let currentPage = 0;
let reachedEnd = false;

const DUMMY_POSTS = [
  { type: "video", caption: "Sunday Praise & Worship Highlights", created_at: "2025-06-01", media_url: null },
  { type: "photo", caption: "Youth choir leading Sunday worship", created_at: "2025-06-01", media_url: null },
  { type: "photo", caption: "Kids enjoying cake at the CTY family day", created_at: "2025-05-24", media_url: null },
  { type: "testimony", caption: "\"CTY gave me a family when I needed one most.\" — read the full story.", created_at: "2025-05-20", media_url: null },
  { type: "photo", caption: "Sweet 16 celebration on the church stage", created_at: "2025-05-24", media_url: null },
  { type: "photo", caption: "Fellowship after the youth service", created_at: "2025-05-17", media_url: null },
];

function typeLabel(type) {
  return { photo: "Photo", video: "Video", testimony: "Testimony" }[type] || type;
}

function postCardHTML(post) {
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";
  const mediaInner = post.media_url
    ? (post.type === "video"
        ? `<video src="${post.media_url}" muted></video>`
        : `<img src="${post.media_url}" alt="" loading="lazy" />`)
    : "";

  return `
    <article class="post-card">
      <div class="post-media">
        ${mediaInner}
        <span class="post-type-badge">${typeLabel(post.type)}</span>
      </div>
      <div class="post-body">
        ${date ? `<p class="post-date">${date}</p>` : ""}
        <p>${escapeHtml(post.caption || "")}</p>
      </div>
    </article>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function fetchPosts({ reset = false } = {}) {
  if (reset) {
    currentPage = 0;
    reachedEnd = false;
    grid.innerHTML = "";
  }

  let posts = [];
  let usedFallback = false;

  try {
    let query = supabase
      .from("posts")
      .select("type, caption, media_url, created_at")
      .order("created_at", { ascending: false })
      .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE - 1);

    if (currentFilter !== "all") query = query.eq("type", currentFilter);

    const { data, error } = await query;
    if (error) throw error;
    posts = data || [];
  } catch {
    // Supabase not connected yet — fall back to dummy content, first page only.
    usedFallback = true;
    if (currentPage === 0) {
      posts = currentFilter === "all"
        ? DUMMY_POSTS
        : DUMMY_POSTS.filter((p) => p.type === currentFilter);
    }
  }

  if (currentPage === 0 && posts.length === 0) {
    grid.innerHTML = `<p class="empty-state">No ${currentFilter === "all" ? "" : typeLabel(currentFilter).toLowerCase() + " "}posts yet — check back soon.</p>`;
    loadMoreBtn.hidden = true;
    return;
  }

  grid.insertAdjacentHTML("beforeend", posts.map(postCardHTML).join(""));

  reachedEnd = usedFallback || posts.length < PAGE_SIZE;
  loadMoreBtn.hidden = reachedEnd;
  currentPage += 1;
}

filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-tab");
  if (!btn) return;
  filterTabs.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("is-active"));
  btn.classList.add("is-active");
  currentFilter = btn.dataset.filter;
  fetchPosts({ reset: true });
});

loadMoreBtn.addEventListener("click", () => fetchPosts());

fetchPosts({ reset: true });