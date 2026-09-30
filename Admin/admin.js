/* =========================================================
   CTY Ministries — central Admin dashboard
   Posts: upload / edit caption / delete
   Events: create / edit / delete
   Testimonies: approve / reject
   All write actions rely on Supabase RLS: these UI checks are
   presentation only — the database remains the authorization
   boundary (see SQL QUERIES/postPolicies.sql).
   ========================================================= */

import { supabase, friendlyError, SUPABASE_URL, SUPABASE_ANON_KEY } from "../Javascript files/supabaseclient.js";

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
};

const statPosts = document.getElementById("stat-posts");
const statEvents = document.getElementById("stat-events");
const statTestimonies = document.getElementById("stat-testimonies");
const statRsvps = document.getElementById("stat-rsvps");

/* ---------------- State ---------------- */
let currentUser = null;
let isAdmin = false;
let posts = [];
let events = [];
let pendingTestimonies = [];
let captionDialogContext = null;

/* ---------------- Small helpers ---------------- */
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

    const admin = profile?.role === "admin" && profile?.is_admin === true;

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
    gate.textContent = `Access check failed: ${friendlyError(err)}`;
  }
}

/* =========================================================
   TABS
   ========================================================= */
tabsWrap?.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (!tab) return;

  tabsWrap.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("is-active", t === tab);
    t.setAttribute("aria-selected", String(t === tab));
  });

  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    panel.classList.toggle("is-active", panel.dataset.panel === tab.dataset.tab);
  });
});

/* =========================================================
   POSTS — list, upload, edit caption, delete
   ========================================================= */
async function loadPosts() {
  setListLoading(els.postsList);

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, type, caption, media_url, is_featured, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    posts = data || [];
    if (statPosts) statPosts.textContent = posts.length;

    if (!posts.length) {
      setListMessage(els.postsList, `<div class="empty">No posts yet — upload the first one above.</div>`);
      return;
    }

    els.postsList.innerHTML = posts.map(postItemHTML).join("");
    bindPostActions();
  } catch (err) {
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
        <button class="btn btn-ghost" data-action="toggle-featured">${post.is_featured ? "Unfeature" : "Feature"}</button>
        <button class="btn btn-ghost" data-action="edit-caption">Edit caption</button>
        <button class="btn btn-danger" data-action="delete">Delete</button>
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
    // Remove the storage object first (best effort), then the row.
    if (post.media_url) {
      const entry = extractStoragePath(post.media_url);
      if (entry) {
        await supabase.storage.from(entry.bucket).remove([entry.path]).catch(() => {});
      }
    }

    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) throw error;

    animateRemoval(itemEl);
    posts = posts.filter((p) => p.id !== post.id);
    if (statPosts) statPosts.textContent = posts.length;
    toast("Post deleted.", "success");
  } catch (err) {
    toast(friendlyError(err), "error");
  }
}

/* Handles /object/public/<bucket>/<path> URLs from any bucket;
   returns { bucket, path } or null when the URL isn't storage-backed */
function extractStoragePath(url) {
  const marker = "/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length); // e.g. "photos/123.jpg"
  const slash = rest.indexOf("/");
  return slash === -1 ? null : { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

async function openCaptionDialog(post, itemEl) {
  const dialog = document.getElementById("caption-dialog");
  const input = document.getElementById("caption-dialog-input");
  captionDialogContext = { post, itemEl };

  input.value = post.caption || "";
  dialog.showModal();
}

document.getElementById("caption-form")?.addEventListener("submit", async (event) => {
  const dialog = document.getElementById("caption-dialog");
  const action = event.submitter?.value || "save";
  const { post, itemEl } = captionDialogContext || {};

  if (action !== "save" || !post) {
    captionDialogContext = null;
    return;
  }

  const input = document.getElementById("caption-dialog-input");
  const caption = input.value.trim();

  if (caption === (post.caption || "")) return; // nothing changed

  try {
    const { error } = await supabase.from("posts").update({ caption }).eq("id", post.id);
    if (error) throw error;

    post.caption = caption;
    const strong = itemEl?.querySelector(".list-body strong");
    if (strong) strong.textContent = caption || "(no caption)";
    toast("Caption updated.", "success");
  } catch (err) {
    event.preventDefault();
    toast(friendlyError(err), "error");
  } finally {
    captionDialogContext = null;
    dialog.close();
  }
});

async function toggleFeatured(post, btn) {
  setButtonLoading(btn, true);
  try {
    const next = !post.is_featured;
    const { error } = await (next
      ? supabase.from("posts").update({ is_featured: true }).eq("id", post.id)
      : supabase.from("posts").update({ is_featured: false }).eq("id", post.id));

    if (error) throw error;

    post.is_featured = next;
    btn.textContent = next ? "Unfeature" : "Feature";
    toast(next ? "Post featured — it leads the homepage feed." : "Post unfeatured.", "success");
  } catch (err) {
    toast(friendlyError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ---------------- Upload ---------------- */
const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const fileField = document.getElementById("file-field");
const fileHint = document.getElementById("file-hint");
const preview = document.getElementById("preview");
const typeToggle = document.getElementById("type-toggle");
const progressEl = document.getElementById("upload-progress");
const errorEl = document.getElementById("upload-error");
let currentType = "photo";

const MAX_SIZES = { photo: 10 * 1024 * 1024, video: 150 * 1024 * 1024 };

typeToggle?.addEventListener("click", (event) => {
  const btn = event.target.closest(".type-btn");
  if (!btn) return;

  typeToggle.querySelectorAll(".type-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
  currentType = btn.dataset.type;

  fileInput.value = "";
  preview.hidden = true;
  preview.innerHTML = "";
  fileInput.accept = currentType === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp";
  fileHint.textContent = currentType === "video" ? "MP4 or WebM · up to 150 MB" : "JPG, PNG or WEBP · up to 10 MB";
});

fileInput?.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) {
    preview.hidden = true;
    return;
  }

  const url = URL.createObjectURL(file);
  preview.innerHTML = currentType === "video" ? `<video src="${url}" controls></video>` : `<img src="${url}" alt="" />`;
  preview.hidden = false;
});

function uploadError(message) {
  errorEl.textContent = message;
}

uploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  uploadError("");

  const caption = document.getElementById("caption-input").value.trim();
  const file = fileInput.files[0];
  const btn = document.getElementById("upload-btn");

  if (caption.length < 3) return uploadError("Please add a short caption (3+ characters).");
  if (!file) return uploadError(`Please choose a ${currentType} to upload.`);
  if (file.size > MAX_SIZES[currentType]) {
    return uploadError(`File too large — max ${currentType === "video" ? "150 MB" : "10 MB"}.`);
  }

  setButtonLoading(btn, true);
  progressEl.hidden = false;
  progressEl.textContent = "Uploading file…";

  try {
    const bucket = currentType === "video" ? "videos" : "photos";
    const ext = file.name.split(".").pop();
    const objectPath = `${currentType}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    if (file.size <= 6 * 1024 * 1024) {
      const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
    } else {
      // Large files use the resumable TUS protocol (same approach as the posts page)
      await tusUpload(bucket, objectPath, file, (percent) => {
        progressEl.textContent = `Uploading ${percent}%…`;
      });
    }

    progressEl.textContent = "Saving post…";
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);

    const { data: { session } } = await supabase.auth.getSession();
    const { error: insertError } = await supabase.from("posts").insert({
      user_id: session.user.id,
      type: currentType,
      caption,
      media_url: publicUrlData.publicUrl,
      status: "published",
      is_deleted: false,
      is_featured: document.getElementById("featured-input").checked,
    });
    if (insertError) throw insertError;

    toast("Published — it's live on the site now.", "success");
    uploadForm.reset();
    preview.hidden = true;
    preview.innerHTML = "";
    await loadPosts();
  } catch (err) {
    uploadError(friendlyError(err));
  } finally {
    setButtonLoading(btn, false);
    progressEl.hidden = true;
  }
});

async function tusUpload(bucket, objectPath, file, onProgress) {
  const { Upload, isSupported } = await import("https://esm.sh/tus-js-client@4.3.1");
  if (!isSupported) throw new Error("This browser doesn't support large uploads.");

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new Error("Sign in again before uploading.");

  const projectId = new URL(SUPABASE_URL).hostname.split(".")[0];

  await new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType: file.type,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: (uploaded, total) => onProgress(Math.round((uploaded / total) * 100)),
      onError: reject,
      onSuccess: resolve,
    });
    upload.start();
  });
}

els.refreshPosts?.addEventListener("click", loadPosts);

/* =========================================================
   EVENTS — create, edit, delete
   ========================================================= */
async function loadEvents() {
  setListLoading(els.eventsList);

  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, event_date, category, rsvp_count, status, is_deleted")
      .order("event_date", { ascending: false })
      .limit(50);

    if (error) throw error;

    events = data || [];
    const upcoming = events.filter((e) => new Date(e.event_date) >= new Date(new Date().toDateString()));
    if (statEvents) statEvents.textContent = upcoming.length;
    const rsvpTotal = events.reduce((sum, e) => sum + (e.rsvp_count || 0), 0);
    if (statRsvps) statRsvps.textContent = rsvpTotal;

    if (!events.length) {
      setListMessage(els.eventsList, `<div class="empty">No events yet — create the first one.</div>`);
      return;
    }

    els.eventsList.innerHTML = events.map(eventItemHTML).join("");
    bindEventActions();
  } catch (err) {
    setListMessage(els.eventsList, `<div class="empty">Couldn't load events: ${escapeHtml(friendlyError(err))}</div>`);
  }
}

function eventItemHTML(ev) {
  const date = new Date(`${ev.event_date}T12:00:00`);
  const isPast = date < new Date(new Date().toDateString());

  return `
    <div class="list-item" data-id="${ev.id}">
      <div class="list-thumb">${date.getDate()}<small>${date.toLocaleString("default", { month: "short" })}</small></div>
      <div class="list-body">
        <strong>${escapeHtml(ev.title)}</strong>
        <p>
          <span class="badge">${escapeHtml(ev.category || "General")}</span>
          <span class="badge ${isPast ? "" : "badge--warn"}">${formatDate(ev.event_date)}</span>
          <span class="badge badge--ok">${ev.rsvp_count || 0} going</span>
          ${ev.is_deleted ? `<span class="badge badge--warn">deleted</span>` : ""}
        </p>
      </div>
      <div class="list-actions">
        <button class="btn btn-ghost" data-action="edit">Edit</button>
        <button class="btn btn-danger" data-action="delete">Delete</button>
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
      if (btn.dataset.action === "delete") deleteEvent(ev, item);
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
eventModal?.addEventListener("click", (e) => {
  if (e.target === eventModal) closeEventModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && eventModal?.classList.contains("active")) closeEventModal();
});

eventForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  eventError.textContent = "";

  const id = document.getElementById("event-id").value;
  const title = document.getElementById("event-title").value.trim();
  const description = document.getElementById("event-description").value.trim();
  const date = document.getElementById("event-date").value;
  const category = document.getElementById("event-category").value.trim();

  if (!title || !date) {
    eventError.textContent = "Title and date are required.";
    return;
  }

  const btn = document.getElementById("event-submit-btn");
  setButtonLoading(btn, true);

  try {
    const payload = {
      title,
      description: description || null,
      event_date: date,
      category: category || "General",
    };

    if (id) {
      const { error } = await supabase.from("events").update(payload).eq("id", id);
      if (error) throw error;
      toast("Event updated.", "success");
    } else {
      const { error } = await supabase.from("events").insert({
        ...payload,
        status: "published",
        is_deleted: false,
        rsvp_count: 0,
      });
      if (error) throw error;
      toast("Event created.", "success");
    }

    closeEventModal();
    await loadEvents();
  } catch (err) {
    eventError.textContent = friendlyError(err);
  } finally {
    setButtonLoading(btn, false);
  }
});

async function deleteEvent(ev, itemEl) {
  if (!confirm(`Delete "${ev.title}"? Members will no longer see or be able to RSVP.`)) return;

  try {
    const { error } = await supabase
      .from("events")
      .update({ is_deleted: true, status: "deleted" })
      .eq("id", ev.id);

    if (error) throw error;

    animateRemoval(itemEl);
    events = events.filter((e) => e.id !== ev.id);
    const upcoming = events.filter((e) => new Date(e.event_date) >= new Date(new Date().toDateString()));
    if (statEvents) statEvents.textContent = upcoming.length;
    toast("Event deleted.", "success");
  } catch (err) {
    toast(friendlyError(err), "error");
  }
}

els.refreshEvents?.addEventListener("click", loadEvents);

/* =========================================================
   TESTIMONIES — approve / reject
   ========================================================= */
async function loadTestimonies() {
  setListLoading(els.testimoniesList);

  try {
    const { data, error } = await supabase
      .from("testimonies")
      .select("id, name, location, theme, description, photo_url, status, created_at")
      .eq("status", "pending")
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (error) throw error;

    pendingTestimonies = data || [];
    if (statTestimonies) statTestimonies.textContent = pendingTestimonies.length;

    if (!pendingTestimonies.length) {
      setListMessage(els.testimoniesList, `<div class="empty">Queue is clear — nothing waiting for review. 🎉</div>`);
      return;
    }

    els.testimoniesList.innerHTML = pendingTestimonies.map(testimonyItemHTML).join("");
    bindTestimonyActions();
  } catch (err) {
    setListMessage(
      els.testimoniesList,
      `<div class="empty">Couldn't load testimonies: ${escapeHtml(friendlyError(err))}</div>`
    );
  }
}

function testimonyItemHTML(story) {
  return `
    <div class="list-item" data-id="${story.id}">
      <div class="list-thumb">${story.photo_url ? `<img src="${escapeHtml(story.photo_url)}" alt="" loading="lazy" />` : "🙏"}</div>
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
        <button class="btn btn-success" data-action="approve">Approve & publish</button>
        <button class="btn btn-danger" data-action="reject">Reject</button>
      </div>
    </div>
  `;
}

function bindTestimonyActions() {
  els.testimoniesList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".list-item");
      const story = pendingTestimonies.find((t) => String(t.id) === String(item?.dataset.id));
      if (!story) return;

      const approving = btn.dataset.action === "approve";
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
        pendingTestimonies = pendingTestimonies.filter((t) => t.id !== story.id);
        if (statTestimonies) statTestimonies.textContent = pendingTestimonies.length;
        toast(approving ? "Testimony published." : "Testimony rejected.", "success");
      } catch (err) {
        toast(friendlyError(err), "error");
        setButtonLoading(btn, false);
      }
    });
  });
}

els.refreshTestimonies?.addEventListener("click", loadTestimonies);

/* ---------------- Shared ---------------- */
function animateRemoval(itemEl) {
  if (!itemEl) return;
  itemEl.classList.add("is-removing");
  setTimeout(() => {
    itemEl.remove();
    if (!els.postsList.children.length && !posts.length) loadPosts();
  }, 320);
}

/* ---------------- Boot ---------------- */
checkAccess();
