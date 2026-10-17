/* =========================================================
   CTY Ministries — central Admin dashboard (v7)
   Posts · Events · Testimonies (Full Management) · Reports
   ========================================================= */

import { supabase, showToast, setError, setLoading, friendlyError } from "../Javascript files/supabaseclient.js";

window.__ctyAdminBooted = true;

/* ---------------- Elements ---------------- */
const gate = document.getElementById("gate");
const app = document.getElementById("admin-app");
const tabsWrap = document.querySelector(".tabs");

const els = {
  postsList: document.getElementById("posts-list"),
  eventsList: document.getElementById("events-list"),
  testimoniesList: document.getElementById("testimonies-list"),
  refreshPosts: document.getElementById("refresh-posts-btn"),
  refreshEvents: document.getElementById("refresh-events-btn"),
  refreshTestimonies: document.getElementById("refresh-testimonies-btn"),
  toggleArchived: document.getElementById("toggle-archived-btn"),
  
  // Testimony specific elements
  togglePublishedTestimonies: document.getElementById("toggle-published-testimonies-btn"),
  testimonyListTitle: document.getElementById("testimony-list-title"),
};

const statPosts = document.getElementById("stat-posts");
const statEvents = document.getElementById("stat-events");
const statTestimonies = document.getElementById("stat-testimonies");
const statRsvps = document.getElementById("stat-rsvps");

const tabCountPosts = document.getElementById("tab-count-posts");
const tabCountEvents = document.getElementById("tab-count-events");
const tabCountTestimonies = document.getElementById("tab-count-testimonies");

/* ---------------- State ---------------- */
let currentUser = null;
let isAdmin = false;
let posts = [];
let events = [];
let testimonies = [];
let showArchivedEvents = false;
let showPublishedTestimonies = false;
let charts = {};

/* ---------------- Helpers ---------------- */
function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function toast(message, type = "info") {
  const el = document.querySelector(".cty-toast");
  if (!el) return;
  el.textContent = message;
  el.className = `cty-toast cty-toast--${type}`;
  void el.offsetWidth;
  el.classList.add("is-visible");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("is-visible"), 3200);
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("is-loading", loading);
  btn.disabled = loading;
}

function setListLoading(listEl) {
  if (!listEl) return;
  listEl.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;
}

function setListMessage(listEl, html) {
  if (listEl) listEl.innerHTML = html;
}

function setStat(el, value) {
  if (el) el.textContent = Number.isFinite(value) ? String(value) : "0";
}

/* =========================================================
   ACCESS GATE
   ========================================================= */
async function checkAccess() {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      gate.textContent = "Please sign in first. Redirecting…";
      setTimeout(() => window.location.replace("../login/signin.html"), 900);
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_admin, full_name")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw error;

    const admin = profile?.is_admin === true || profile?.role === "admin";

    if (!admin) {
      gate.textContent = "This page is for CTY admins only.";
      setTimeout(() => window.location.replace("../home/homepage.html"), 1200);
      return;
    }

    currentUser = session.user;
    isAdmin = true;

    gate.hidden = true;
    app.hidden = false;

    await Promise.all([loadPosts(), loadEvents(), loadTestimonies()]);
  } catch (err) {
    gate.innerHTML = `Access check failed: ${friendlyError(err)} <br><br> <button onclick="location.reload()" class="btn btn-primary">Try again</button>`;
  }
}

/* =========================================================
   TABS
   ========================================================= */
function activateTab(name) {
  tabsWrap.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.tab === name);
    t.setAttribute("aria-selected", String(t.dataset.tab === name));
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  if (name === "reports") renderReports();
}

tabsWrap?.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (!tab) return;
  activateTab(tab.dataset.tab);
});

/* =========================================================
   POSTS
   ========================================================= */
async function loadPosts() {
  setListLoading(els.postsList);
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, type, caption, media_url, is_featured, created_at")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;
    posts = data || [];
    setStat(statPosts, posts.length);
    if (tabCountPosts) tabCountPosts.textContent = posts.length;

    if (!posts.length) {
      setListMessage(els.postsList, `<div class="empty">No posts yet — upload the first one above.</div>`);
      return;
    }

    els.postsList.innerHTML = posts.map(postItemHTML).join("");
    bindPostActions();
  } catch (err) {
    setStat(statPosts, 0);
    setListMessage(els.postsList, `<div class="empty">Couldn't load posts: ${escapeHtml(friendlyError(err))}</div>`);
  }
}

function postItemHTML(post) {
  const thumb = post.media_url
    ? post.type === "video"
      ? `<video src="${escapeHtml(post.media_url)}" muted preload="metadata"></video>`
      : `<img src="${escapeHtml(post.media_url)}" alt="" loading="lazy" />`
    : `<span aria-hidden="true">🖼</span>`;

  return `
    <div class="list-item" data-id="${post.id}">
      <div class="list-thumb">${thumb}</div>
      <div class="list-body">
        <strong>${escapeHtml(post.caption || "(no caption)")}</strong>
        <p>
          <span class="badge">${escapeHtml(post.type || "photo")}</span>
          ${post.is_featured ? `<span class="badge badge--featured">Featured</span>` : ""}
          <span class="badge badge--warn">${formatDate(post.created_at)}</span>
        </p>
      </div>
      <div class="list-actions">
        <button class="btn btn-ghost btn-sm" data-action="toggle-featured">${post.is_featured ? "Unfeature" : "Feature"}</button>
        <button class="btn btn-ghost btn-sm" data-action="edit-caption">Edit caption</button>
        <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
      </div>
    </div>
  `;
}

function bindPostActions() {
  els.postsList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".list-item");
      const id = item?.dataset.id;
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;
      if (btn.dataset.action === "delete") deletePost(post, item);
      if (btn.dataset.action === "edit-caption") openCaptionDialog(post, item);
      if (btn.dataset.action === "toggle-featured") toggleFeatured(post, btn);
    });
  });
}

async function deletePost(post, itemEl) {
  if (!confirm("Delete this post? The media file is removed too. This can't be undone.")) return;
  try {
    if (post.media_url) {
      const entry = extractStoragePath(post.media_url);
      if (entry) await supabase.storage.from(entry.bucket).remove([entry.path]).catch(() => {});
    }
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) throw error;
    animateRemoval(itemEl);
    posts = posts.filter((p) => p.id !== post.id);
    setStat(statPosts, posts.length);
    if (tabCountPosts) tabCountPosts.textContent = posts.length;
    toast("Post deleted.", "success");
  } catch (err) { toast(friendlyError(err), "error"); }
}

function extractStoragePath(url) {
  const marker = "/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length);
  const slash = rest.indexOf("/");
  return slash === -1 ? null : { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

async function openCaptionDialog(post, itemEl) {
  const dialog = document.getElementById("caption-dialog");
  const input = document.getElementById("caption-dialog-input");
  dialog.dataset.postId = post.id;
  input.value = post.caption || "";
  dialog.showModal();
}

document.getElementById("caption-form")?.addEventListener("submit", async (event) => {
  const dialog = document.getElementById("caption-dialog");
  const action = event.submitter?.value || "save";
  if (action !== "save") return;
  const postId = dialog.dataset.postId;
  const post = posts.find(p => p.id === postId);
  const input = document.getElementById("caption-dialog-input");
  const caption = input.value.trim();
  if (caption === (post.caption || "")) return;

  try {
    const { error } = await supabase.from("posts").update({ caption }).eq("id", post.id);
    if (error) throw error;
    post.caption = caption;
    const itemEl = els.postsList.querySelector(`[data-id="${post.id}"]`);
    const strong = itemEl?.querySelector(".list-body strong");
    if (strong) strong.textContent = caption || "(no caption)";
    toast("Caption updated.", "success");
  } catch (err) {
    event.preventDefault();
    toast(friendlyError(err), "error");
  } finally {
    dialog.close();
  }
});

async function toggleFeatured(post, btn) {
  setButtonLoading(btn, true);
  try {
    const next = !post.is_featured;
    const { error } = await supabase.from("posts").update({ is_featured: next }).eq("id", post.id);
    if (error) throw error;
    post.is_featured = next;
    btn.textContent = next ? "Unfeature" : "Feature";
    toast(next ? "Post featured." : "Post unfeatured.", "success");
  } catch (err) { toast(friendlyError(err), "error"); } finally { setButtonLoading(btn, false); }
}

/* =========================================================
   EVENTS
   ========================================================= */
async function loadEvents() {
  setListLoading(els.eventsList);
  try {
    let query = supabase.from("events").select("id, title, description, event_date, category, rsvp_count, status, is_deleted").order("event_date", { ascending: false }).limit(80);
    if (!showArchivedEvents) query = query.eq("is_deleted", false);

    const { data, error } = await query;
    if (error) throw error;

    events = data || [];
    const upcoming = events.filter((e) => !e.is_deleted && new Date(e.event_date) >= new Date(new Date().toDateString()));
    setStat(statEvents, upcoming.length);
    if (tabCountEvents) tabCountEvents.textContent = upcoming.length;

    const rsvpTotal = events.reduce((sum, e) => sum + (e.rsvp_count || 0), 0);
    setStat(statRsvps, rsvpTotal);

    if (!events.length) {
      setListMessage(els.eventsList, `<div class="empty">No events yet — create the first one.</div>`);
      return;
    }

    els.eventsList.innerHTML = events.map(eventItemHTML).join("");
    bindEventActions();
    els.toggleArchived.textContent = showArchivedEvents ? "Hide archived" : "Show archived";
  } catch (err) {
    setStat(statEvents, 0);
    setStat(statRsvps, 0);
    setListMessage(els.eventsList, `<div class="empty">Couldn't load events: ${escapeHtml(friendlyError(err))}</div>`);
  }
}

function eventItemHTML(ev) {
  const date = new Date(`${ev.event_date}T12:00:00`);
  const isPast = date < new Date(new Date().toDateString());
  const isDeleted = !!ev.is_deleted;

  return `
    <div class="list-item ${isDeleted ? "is-archived" : ""}" data-id="${ev.id}">
      <div class="list-thumb">${date.getDate()}<small>${date.toLocaleString("default", { month: "short" })}</small></div>
      <div class="list-body">
        <strong>${escapeHtml(ev.title)}</strong>
        <p>
          <span class="badge">${escapeHtml(ev.category || "General")}</span>
          <span class="badge ${isPast ? "" : "badge--warn"}">${formatDate(ev.event_date)}</span>
          <span class="badge badge--ok">${ev.rsvp_count || 0} going</span>
          ${isDeleted ? `<span class="badge badge--danger">archived</span>` : ""}
        </p>
      </div>
      <div class="list-actions">
        ${isDeleted
          ? `<button class="btn btn-ghost btn-sm" data-action="restore">Restore</button>`
          : `<button class="btn btn-ghost btn-sm" data-action="edit">Edit</button><button class="btn btn-danger btn-sm" data-action="delete">Archive</button>`}
      </div>
    </div>
  `;
}

function bindEventActions() {
  els.eventsList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".list-item");
      const ev = events.find((e) => String(e.id) === String(item?.dataset.id));
      if (!ev) return;
      if (btn.dataset.action === "edit") openEventModal(ev);
      if (btn.dataset.action === "delete") archiveEvent(ev, item);
      if (btn.dataset.action === "restore") restoreEvent(ev, item);
    });
  });
}

const eventModal = document.getElementById("event-modal");
const eventForm = document.getElementById("event-form");
const eventError = document.getElementById("event-error");

function openEventModal(ev = null) {
  eventError.textContent = "";
  document.getElementById("event-id").value = ev?.id || "";
  document.getElementById("event-title").value = ev?.title || "";
  document.getElementById("event-description").value = ev?.description || "";
  document.getElementById("event-date").value = ev?.event_date || new Date().toISOString().split("T")[0];
  document.getElementById("event-category").value = ev?.category || "";
  document.getElementById("event-modal-title").textContent = ev ? "Edit event" : "New event";
  document.getElementById("event-submit-btn").querySelector(".btn-label").textContent = ev ? "Save changes" : "Create event";
  eventModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEventModal() {
  eventModal.classList.remove("active");
  document.body.style.overflow = "";
  eventForm.reset();
}

document.getElementById("new-event-btn")?.addEventListener("click", () => openEventModal());
document.getElementById("event-cancel-btn")?.addEventListener("click", closeEventModal);
eventModal?.addEventListener("click", (e) => { if (e.target === eventModal) closeEventModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && eventModal?.classList.contains("active")) closeEventModal(); });

eventForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  eventError.textContent = "";
  const id = document.getElementById("event-id").value;
  const title = document.getElementById("event-title").value.trim();
  const description = document.getElementById("event-description").value.trim();
  const date = document.getElementById("event-date").value;
  const category = document.getElementById("event-category").value.trim();

  if (!title || !date) return eventError.textContent = "Title and date are required.";

  const btn = document.getElementById("event-submit-btn");
  setButtonLoading(btn, true);

  try {
    const payload = { title, description: description || null, event_date: date, category: category || "General" };
    if (id) {
      const { error } = await supabase.from("events").update(payload).eq("id", id);
      if (error) throw error;
      toast("Event updated.", "success");
    } else {
      const { error } = await supabase.from("events").insert({ ...payload, status: "published", is_deleted: false, rsvp_count: 0 });
      if (error) throw error;
      toast("Event created.", "success");
    }
    closeEventModal();
    await loadEvents();
  } catch (err) { eventError.textContent = friendlyError(err); } finally { setButtonLoading(btn, false); }
});

async function archiveEvent(ev, itemEl) {
  if (!confirm(`Archive "${ev.title}"? Members will no longer see it.`)) return;
  try {
    const { error } = await supabase.from("events").update({ is_deleted: true, status: "deleted" }).eq("id", ev.id);
    if (error) throw error;
    animateRemoval(itemEl);
    events = events.filter((e) => e.id !== ev.id);
    setStat(statEvents, events.filter((e) => !e.is_deleted && new Date(e.event_date) >= new Date(new Date().toDateString())).length);
    toast("Event archived.", "success");
  } catch (err) { toast(friendlyError(err), "error"); }
}

async function restoreEvent(ev, itemEl) {
  try {
    const { error } = await supabase.from("events").update({ is_deleted: false, status: "published" }).eq("id", ev.id);
    if (error) throw error;
    animateRemoval(itemEl);
    await loadEvents();
    toast("Event restored.", "success");
  } catch (err) { toast(friendlyError(err), "error"); }
}

els.refreshEvents?.addEventListener("click", loadEvents);
els.toggleArchived?.addEventListener("click", () => {
  showArchivedEvents = !showArchivedEvents;
  loadEvents();
});

/* =========================================================
   TESTIMONIES (Full Management)
   ========================================================= */
async function loadTestimonies() {
  setListLoading(els.testimoniesList);

  try {
    const statusToFetch = showPublishedTestimonies ? "published" : "pending";

    if (els.testimonyListTitle) {
      els.testimonyListTitle.textContent = showPublishedTestimonies ? "Published Testimonies" : "Pending Review";
    }
    if (els.togglePublishedTestimonies) {
      els.togglePublishedTestimonies.textContent = showPublishedTestimonies ? "Show Pending" : "Show Published";
    }

    const { data, error } = await supabase
      .from("testimonies")
      .select(`
        id, name, location, theme, description, photo_url, video_url,
        status, created_at, submitted_by,
        profiles:submitted_by ( avatar_url, full_name )
      `)
      .eq("status", statusToFetch)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    testimonies = data || [];

    if (!showPublishedTestimonies) {
      setStat(statTestimonies, testimonies.length);
      if (tabCountTestimonies) tabCountTestimonies.textContent = testimonies.length;
    }

    if (!testimonies.length) {
      setListMessage(
        els.testimoniesList,
        `<div class="empty">${showPublishedTestimonies ? "No published testimonies yet." : "Queue is clear — nothing waiting for review. 🎉"}</div>`
      );
      return;
    }

    els.testimoniesList.innerHTML = testimonies.map(testimonyItemHTML).join("");
    bindTestimonyActions();
  } catch (err) {
    setStat(statTestimonies, 0);
    setListMessage(
      els.testimoniesList,
      `<div class="empty">Couldn't load testimonies: ${escapeHtml(friendlyError(err))}</div>`
    );
  }
}

function getYouTubeId(url) {
  if (!url) return null;
  // Universal regex that hunts for exactly 11 characters belonging to the ID
  const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return (m && m[1]) ? m[1] : null;
}

function testimonyThumb(story) {
  if (story.profiles?.avatar_url) return `<img src="${escapeHtml(story.profiles.avatar_url)}" alt="" loading="lazy" />`;
  if (story.photo_url) return `<img src="${escapeHtml(story.photo_url)}" alt="" loading="lazy" />`;
  const yt = getYouTubeId(story.video_url);
  if (yt) return `<img src="https://img.youtube.com/vi/${yt}/mqdefault.jpg" alt="" loading="lazy" />`;
  return "🙏";
}

function testimonyItemHTML(story) {
  const yt = getYouTubeId(story.video_url);
  const isPending = story.status === "pending";

  return `
    <div class="list-item" data-id="${story.id}">
      <div class="list-thumb">${testimonyThumb(story)}</div>
      <div class="list-body">
        <strong>${escapeHtml(story.name)}</strong>
        <p>
          <span class="badge">${escapeHtml(story.theme)}</span>
          ${story.location ? `<span class="badge badge--warn">${escapeHtml(story.location)}</span>` : ""}
          <span class="badge badge--warn">${formatDate(story.created_at)}</span>
        </p>
        <p class="caption-text">${escapeHtml(story.description)}</p>
      </div>
      <div class="list-actions">
        ${yt ? `<button class="btn btn-ghost btn-sm" data-action="watch">▶ Watch</button>` : ""}
        
        ${isPending ? `
          <button class="btn btn-success btn-sm" data-action="approve">Approve & publish</button>
          <button class="btn btn-danger btn-sm" data-action="reject">Reject</button>
        ` : `
          <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
          <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
        `}
      </div>
    </div>
  `;
}

function bindTestimonyActions() {
  els.testimoniesList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".list-item");
      const story = testimonies.find((t) => String(t.id) === String(item?.dataset.id));
      if (!story) return;

      const action = btn.dataset.action;

      if (action === "watch") {
        openTestimonyVideo(story);
        return;
      }

      if (action === "edit") {
        openEditTestimonyModal(story);
        return;
      }

      if (action === "delete") {
        if (!confirm("Permanently delete this testimony? It will disappear from the site.")) return;
        try {
          const { error } = await supabase.from("testimonies").update({ is_deleted: true }).eq("id", story.id);
          if (error) throw error;
          animateRemoval(item);
          testimonies = testimonies.filter((t) => t.id !== story.id);
          toast("Testimony deleted.", "success");
        } catch (err) {
          toast(friendlyError(err), "error");
        }
        return;
      }

      const approving = action === "approve";
      if (!approving && !confirm("Reject this testimony? The submitter will not see it published.")) return;

      setButtonLoading(btn, true);

      try {
        const { error } = await supabase
          .from("testimonies")
          .update({
            status: approving ? "published" : "rejected",
            reviewed_by: currentUser.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", story.id);

        if (error) throw error;

        animateRemoval(item);
        testimonies = testimonies.filter((t) => t.id !== story.id);
        if (!showPublishedTestimonies) {
          setStat(statTestimonies, testimonies.length);
          if (tabCountTestimonies) tabCountTestimonies.textContent = testimonies.length;
        }
        toast(approving ? "Testimony published." : "Testimony rejected.", "success");
      } catch (err) {
        toast(friendlyError(err), "error");
        setButtonLoading(btn, false);
      }
    });
  });
}

els.refreshTestimonies?.addEventListener("click", loadTestimonies);
els.togglePublishedTestimonies?.addEventListener("click", () => {
  showPublishedTestimonies = !showPublishedTestimonies;
  loadTestimonies();
});

/* -------- YouTube modal -------- */
const testimonyModal = document.getElementById("testimony-modal");
const testimonyModalBody = document.getElementById("testimony-modal-body");
const testimonyModalTitle = document.getElementById("testimony-modal-title");

function openTestimonyVideo(story) {
  const yt = getYouTubeId(story.video_url);
  if (!yt) return;

  testimonyModalTitle.textContent = `${story.name}'s testimony`;
  testimonyModalBody.innerHTML = `
    <div class="video-embed">
      <iframe
        src="https://www.youtube.com/embed/${yt}?autoplay=1&rel=0"
        title="${escapeHtml(story.name)} testimony"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
    <p class="caption-text">${escapeHtml(story.description || "")}</p>
  `;
  testimonyModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeTestimonyModal() {
  testimonyModal.classList.remove("active");
  testimonyModalBody.innerHTML = "";
  document.body.style.overflow = "";
}

testimonyModal?.addEventListener("click", (e) => {
  if (e.target === testimonyModal) closeTestimonyModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && testimonyModal?.classList.contains("active")) closeTestimonyModal();
});

/* =========================================================
   EDIT TESTIMONY MODAL LOGIC
   ========================================================= */
const editTestimonyModal = document.getElementById("edit-testimony-modal");
const editTestimonyForm = document.getElementById("edit-testimony-form");
const editTestimonyError = document.getElementById("edit-testimony-error");

function openEditTestimonyModal(story) {
  editTestimonyError.textContent = "";
  document.getElementById("edit-testimony-id").value = story.id;
  document.getElementById("edit-testimony-name").value = story.name || "";
  document.getElementById("edit-testimony-location").value = story.location || "";
  document.getElementById("edit-testimony-theme").value = story.theme || "Other";
  document.getElementById("edit-testimony-description").value = story.description || "";
  document.getElementById("edit-testimony-video").value = story.video_url || "";
  
  editTestimonyModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEditTestimonyModal() {
  editTestimonyModal.classList.remove("active");
  document.body.style.overflow = "";
  editTestimonyForm.reset();
}

document.getElementById("edit-testimony-cancel-btn")?.addEventListener("click", closeEditTestimonyModal);
editTestimonyModal?.addEventListener("click", (e) => { if (e.target === editTestimonyModal) closeEditTestimonyModal(); });

editTestimonyForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  editTestimonyError.textContent = "";
  
  const id = document.getElementById("edit-testimony-id").value;
  const name = document.getElementById("edit-testimony-name").value.trim();
  const location = document.getElementById("edit-testimony-location").value.trim();
  const theme = document.getElementById("edit-testimony-theme").value;
  const description = document.getElementById("edit-testimony-description").value.trim();
  const video_url = document.getElementById("edit-testimony-video").value.trim();

  if (!name || !description) {
    editTestimonyError.textContent = "Name and Story are required fields.";
    return;
  }

  const btn = document.getElementById("edit-testimony-submit-btn");
  setButtonLoading(btn, true);

  try {
    const { error } = await supabase
      .from("testimonies")
      .update({
        name,
        location: location || null,
        theme,
        description,
        video_url: video_url || null,
      })
      .eq("id", id);

    if (error) throw error;

    toast("Testimony updated successfully.", "success");
    closeEditTestimonyModal();
    
    await loadTestimonies();
  } catch (err) {
    editTestimonyError.textContent = friendlyError(err);
  } finally {
    setButtonLoading(btn, false);
  }
});

/* =========================================================
   REPORTS
   ========================================================= */
const reportRangeEl = document.getElementById("report-range");
const reportsRefreshBtn = document.getElementById("reports-refresh-btn");
const reportsExportBtn = document.getElementById("reports-export-btn");
let lastReportData = null;

async function renderReports() {
  if (!window.Chart) await new Promise((r) => setTimeout(r, 200));
  if (!window.Chart) return;

  const days = Number(reportRangeEl?.value || 30);
  const since = new Date(Date.now() - days * 864e5).toISOString();

  try {
    const [rsvpRes, postsRes, eventsRes, likesRes] = await Promise.all([
      supabase.from("event_rsvps").select("created_at").gte("created_at", since),
      supabase.from("posts").select("created_at, id, caption").eq("is_deleted", false).gte("created_at", since),
      supabase.from("events").select("category").eq("is_deleted", false),
      supabase.from("post_likes").select("post_id"),
    ]);

    const rsvps = rsvpRes.data || [];
    const postsData = postsRes.data || [];
    const eventsData = eventsRes.data || [];
    const likes = likesRes.data || [];

    const rsvpByDay = groupByDay(rsvps.map((r) => r.created_at), days);
    drawChart("chart-rsvps", "line", { labels: rsvpByDay.labels, datasets: [{ label: "RSVPs", data: rsvpByDay.values, borderColor: "#d2a238", backgroundColor: "rgba(210,162,56,.15)", tension: .35, fill: true, pointRadius: 0, borderWidth: 2 }] });

    const catMap = {};
    eventsData.forEach((e) => { const key = e.category || "General"; catMap[key] = (catMap[key] || 0) + 1; });
    drawChart("chart-events-category", "doughnut", { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ["#d2a238", "#9a741e", "#ead8a9", "#1b1916", "#716c61", "#b3401f"], borderWidth: 0 }] });

    const postByWeek = groupByWeek(postsData.map((p) => p.created_at));
    drawChart("chart-posts", "bar", { labels: postByWeek.labels, datasets: [{ label: "Posts", data: postByWeek.values, backgroundColor: "#d2a238", borderRadius: 6, barThickness: 20 }] });

    const likeCounts = {};
    likes.forEach((l) => { likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1; });
    const topIds = Object.entries(likeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topListEl = document.getElementById("top-posts-list");
    if (topListEl) {
      topListEl.innerHTML = topIds.length ? topIds.map(([id, count]) => {
        const post = postsData.find((p) => p.id === id);
        return `<li><span>${escapeHtml(post?.caption?.slice(0, 48) || `Post ${id.slice(0, 6)}`)}</span><span class="metric">${count} ♥</span></li>`;
      }).join("") : `<li style="justify-content:center;color:var(--muted);">No likes yet in this range.</li>`;
    }
    lastReportData = { rsvps, posts: postsData, events: eventsData, likes };
  } catch (err) { toast("Couldn't load reports: " + friendlyError(err), "error"); }
}

function groupByDay(dates, days) {
  const labels = [], values = [], counts = {};
  dates.forEach((d) => { const k = new Date(d).toISOString().slice(0, 10); counts[k] = (counts[k] || 0) + 1; });
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    values.push(counts[d.toISOString().slice(0, 10)] || 0);
  }
  return { labels, values };
}

function groupByWeek(dates) {
  const counts = {};
  dates.forEach((d) => {
    const dt = new Date(d);
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const k = monday.toISOString().slice(0, 10);
    counts[k] = (counts[k] || 0) + 1;
  });
  const keys = Object.keys(counts).sort().slice(-12);
  return { labels: keys.map((k) => new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" })), values: keys.map((k) => counts[k]) };
}

function drawChart(canvasId, type, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(canvas, { type, data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type === "doughnut" } }, scales: type === "doughnut" ? {} : { x: { grid: { display: false } }, y: { beginAtZero: true } } } });
}

reportsRefreshBtn?.addEventListener("click", renderReports);
reportRangeEl?.addEventListener("change", renderReports);

reportsExportBtn?.addEventListener("click", () => {
  if (!lastReportData) return toast("Nothing to export yet.", "error");
  const lines = ["Report generated," + new Date().toISOString(), "", "RSVPs", "created_at"];
  lastReportData.rsvps.forEach((r) => lines.push(r.created_at));
  lines.push("", "Posts", "id,caption,created_at");
  lastReportData.posts.forEach((p) => lines.push(`${p.id},"${(p.caption || "").replace(/"/g, '""')}",${p.created_at}`));
  lines.push("", "Events by category", "category");
  lastReportData.events.forEach((e) => lines.push(e.category || "General"));
  lines.push("", "Likes", "post_id");
  lastReportData.likes.forEach((l) => lines.push(l.post_id));

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `cty-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  toast("Report exported.", "success");
});

/* =========================================================
   SHARED
   ========================================================= */
function animateRemoval(itemEl) {
  if (!itemEl) return;
  itemEl.classList.add("is-removing");
  setTimeout(() => {
    itemEl.remove();
    if (!els.postsList.children.length && !posts.length) loadPosts();
  }, 320);
}

checkAccess();
renderReports();