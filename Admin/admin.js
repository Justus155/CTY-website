/* =========================================================
   CTY Ministries — Admin dashboard script
   ========================================================= */

import { supabase, showToast, setError, setLoading, friendlyError } from "../Javascript files/supabaseclient.js";

console.log("✅ admin.js loaded");

window.__ctyAdminBooted = true;

/* ---------------- DOM refs ---------------- */
const gate = document.getElementById("gate");
const app = document.getElementById("admin-app");
const ACCESS_TIMEOUT_MS = 12000;

/* =========================================================
   ACCESS GATE
   ========================================================= */

function setGateMessage(message, showRetry = false) {
  if (!gate) return;
  gate.dataset.status = "updated";
  gate.innerHTML = showRetry
    ? `
      <div style="text-align:center;max-width:420px;">
        <p style="color:var(--muted);margin:0 0 14px;">${message}</p>
        <button class="btn btn-primary" id="gate-retry">Try again</button>
      </div>
    `
    : message;

  if (showRetry) {
    document.getElementById("gate-retry")?.addEventListener("click", () => location.reload());
  }
}

async function withTimeout(promise, label, timeoutMs = ACCESS_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Check your internet connection or Supabase URL/key.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkAccess() {
  try {
    setGateMessage("Checking session...");

    // ---------- 1. Session ----------
    const { data: sessionData, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      "Session check"
    );
    if (sessionError) throw sessionError;

    const session = sessionData?.session;
    if (!session) {
      setGateMessage("Please sign in first. Redirecting…");
      setTimeout(() => (window.location.href = "../login/signin.html"), 900);
      return;
    }

    setGateMessage("Checking profile...");

    // ---------- 2. Profile ----------
    const { data: profile, error: profileError } = await withTimeout(
      supabase
        .from("profiles")
        .select("is_admin, role, full_name")
        .eq("id", session.user.id)
        .maybeSingle(),
      "Profile check"
    );

    if (profileError) throw profileError;

    if (!profile) {
      setGateMessage(
        "We couldn't find your profile row. Ask an admin to run: <code>INSERT INTO profiles (id) VALUES ('" +
          session.user.id +
          "');</code>",
        true
      );
      return;
    }

    // ---------- 3. Admin check (either flag accepted) ----------
    const isAdmin = profile.is_admin === true || profile.role === "admin";

    if (!isAdmin) {
      setGateMessage("This page is for CTY admins only. Redirecting…");
      setTimeout(() => (window.location.href = "../home/homepage.html"), 1200);
      return;
    }

    // ---------- 4. Unlock ----------
    gate.hidden = true;
    app.hidden = false;
    loadRecent();
  } catch (err) {
    console.error("Access check failed:", err);
    setGateMessage(`Access check failed: ${friendlyError(err)}`, true);
  }
}

checkAccess();

/* =========================================================
   UPLOAD TYPE TOGGLE
   ========================================================= */

const typeToggle = document.getElementById("type-toggle");
const fileField = document.getElementById("file-field");
const fileInput = document.getElementById("file-input");
const fileHint = document.getElementById("file-hint");
const preview = document.getElementById("preview");
let currentType = "photo";

typeToggle?.addEventListener("click", (e) => {
  const btn = e.target.closest(".type-btn");
  if (!btn) return;
  typeToggle.querySelectorAll(".type-btn").forEach((b) => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  currentType = btn.dataset.type;

  fileInput.value = "";
  preview.hidden = true;
  preview.innerHTML = "";

  if (currentType === "testimony") {
    fileField.hidden = true;
    fileInput.required = false;
  } else {
    fileField.hidden = false;
    fileInput.required = true;
    fileInput.accept = currentType === "video" ? "video/*" : "image/*";
    fileHint.textContent = currentType === "video"
      ? "MP4 or MOV, up to 100MB."
      : "JPG or PNG, up to 10MB.";
  }
});

fileInput?.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) {
    preview.hidden = true;
    return;
  }

  const url = URL.createObjectURL(file);
  preview.innerHTML = currentType === "video"
    ? `<video src="${url}" controls></video>`
    : `<img src="${url}" alt="" />`;
  preview.hidden = false;
});

/* =========================================================
   UPLOAD FORM
   ========================================================= */

const form = document.getElementById("upload-form");
const errorEl = document.getElementById("upload-error");
const progressEl = document.getElementById("upload-progress");
const captionInput = document.getElementById("caption-input");
const featuredInput = document.getElementById("featured-input");

const MAX_SIZES = { photo: 10 * 1024 * 1024, video: 100 * 1024 * 1024 };

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");
  progressEl.hidden = true;

  const caption = captionInput.value.trim();
  const file = fileInput.files[0];
  const btn = document.getElementById("upload-btn");

  if (caption.length < 3) {
    setError(errorEl, "Please add a short caption.");
    return;
  }
  if (currentType !== "testimony" && !file) {
    setError(errorEl, `Please choose a ${currentType} to upload.`);
    return;
  }
  if (file && file.size > MAX_SIZES[currentType]) {
    setError(errorEl, `File is too large — max ${currentType === "video" ? "100MB" : "10MB"}.`);
    return;
  }

  setLoading(btn, true);
  try {
    let mediaUrl = null;

    if (file) {
      progressEl.hidden = false;
      progressEl.textContent = "Uploading file...";

      const ext = file.name.split(".").pop();
      const path = `${currentType}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);
      mediaUrl = publicUrlData.publicUrl;
    }

    progressEl.textContent = "Saving post...";

    const { data: { session } } = await supabase.auth.getSession();
    const { error: insertError } = await supabase.from("posts").insert({
      user_id: session.user.id,
      type: currentType,
      caption,
      media_url: mediaUrl,
      is_featured: featuredInput.checked,
    });
    if (insertError) throw insertError;

    showToast("Published! It will show up on the site now.");
    form.reset();
    preview.hidden = true;
    progressEl.hidden = true;
    loadRecent();
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
    progressEl.hidden = true;
  }
});

/* =========================================================
   RECENT POSTS
   ========================================================= */

async function loadRecent() {
  const list = document.getElementById("recent-list");
  if (!list) return;

  const { data, error } = await supabase
    .from("posts")
    .select("id, type, caption, media_url, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data || !data.length) {
    list.innerHTML = `<p class="empty-hint">Nothing uploaded yet.</p>`;
    return;
  }

  list.innerHTML = data.map(recentItemHTML).join("");
  list.querySelectorAll(".recent-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecentPost(btn.dataset.id));
  });
}

function recentItemHTML(post) {
  const date = new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const thumb = post.media_url
    ? (post.type === "video"
        ? `<video src="${escapeHtml(post.media_url)}" muted></video>`
        : `<img src="${escapeHtml(post.media_url)}" alt="" />`)
    : "";

  return `
    <div class="recent-item">
      <div class="recent-thumb">${thumb}</div>
      <div class="recent-body">
        <p>${escapeHtml(post.caption || "")}</p>
        <p class="recent-meta">${post.type} · ${date}</p>
      </div>
      <button class="recent-delete" data-id="${post.id}">Delete</button>
    </div>
  `;
}

async function deleteRecentPost(id) {
  if (!confirm("Delete this post? This cannot be undone.")) return;
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) {
    showToast(friendlyError(error));
    return;
  }
  showToast("Post deleted.");
  loadRecent();
}

/* =========================================================
   UTILITY
   ========================================================= */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}