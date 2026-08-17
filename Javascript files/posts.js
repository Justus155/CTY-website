import { supabase } from "./supabaseclient.js";
import { isAdmin, deletePost, updatePostCaption } from "./admin-tools.js";

const grid = document.getElementById("posts-grid");
const filterTabs = document.getElementById("filter-tabs");
const loadMoreBtn = document.getElementById("load-more-btn");

const PAGE_SIZE = 9;
let currentFilter = "all";
let currentPage = 0;
let admin = false;

function typeLabel(type) {
  return { photo: "Photo", video: "Video", testimony: "Testimony" }[type] || type;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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

  const adminBar = admin
    ? `<div class="admin-bar">
         <button class="admin-btn" data-action="edit" data-id="${post.id}">Edit</button>
         <button class="admin-btn admin-btn--danger" data-action="delete" data-id="${post.id}">Delete</button>
       </div>`
    : "";

  return `
    <article class="post-card" data-post-id="${post.id}">
      <div class="post-media">
        ${mediaInner}
        <span class="post-type-badge">${typeLabel(post.type)}</span>
      </div>
      <div class="post-body">
        ${date ? `<p class="post-date">${date}</p>` : ""}
        <p class="post-caption">${escapeHtml(post.caption || "")}</p>
        ${adminBar}
      </div>
    </article>
  `;
}

async function fetchPosts({ reset = false } = {}) {
  if (reset) {
    currentPage = 0;
    grid.innerHTML = "";
  }

  let query = supabase
    .from("posts")
    .select("id, type, caption, media_url, created_at")
    .order("created_at", { ascending: false })
    .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE - 1);

  if (currentFilter !== "all") query = query.eq("type", currentFilter);

  const { data, error } = await query;
  const posts = error ? [] : (data || []);

  if (currentPage === 0 && posts.length === 0) {
    grid.innerHTML = `<p class="empty-state">No ${currentFilter === "all" ? "" : typeLabel(currentFilter).toLowerCase() + " "}posts yet — check back soon.</p>`;
    loadMoreBtn.hidden = true;
    return;
  }

  grid.insertAdjacentHTML("beforeend", posts.map(postCardHTML).join(""));
  loadMoreBtn.hidden = posts.length < PAGE_SIZE;
  currentPage += 1;
}

grid.addEventListener("click", async (e) => {
  const btn = e.target.closest(".admin-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  const card = btn.closest(".post-card");

  if (btn.dataset.action === "delete") {
    if (!confirm("Delete this post? This removes the photo/video too and can't be undone.")) return;
    try {
      await deletePost({ id, media_url: card.querySelector("img,video")?.src });
      card.remove();
    } catch (err) {
      alert(err.message || "Couldn't delete this post.");
    }
  }

  if (btn.dataset.action === "edit") {
    const captionEl = card.querySelector(".post-caption");
    const newCaption = prompt("Edit caption:", captionEl.textContent);
    if (newCaption === null || newCaption.trim() === "") return;
    try {
      await updatePostCaption(id, newCaption.trim());
      captionEl.textContent = newCaption.trim();
    } catch (err) {
      alert(err.message || "Couldn't update this post.");
    }
  }
});

filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-tab");
  if (!btn) return;
  filterTabs.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("is-active"));
  btn.classList.add("is-active");
  currentFilter = btn.dataset.filter;
  fetchPosts({ reset: true });
});

loadMoreBtn.addEventListener("click", () => fetchPosts());

(async () => {
  admin = await isAdmin();
  fetchPosts({ reset: true });
})();