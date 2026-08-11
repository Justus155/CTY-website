import { supabase, showToast, setError, setLoading, friendlyError } from "../admin/supabase-client.js";

const gate = document.getElementById("gate");
const app = document.getElementById("admin-app");

// -----------------------------------------------------------------
// Access gate — this is a UX nicety (redirect non-admins away).
// The REAL protection is the storage + posts RLS policies, which
// reject the request server-side even if someone bypasses this page.
// -----------------------------------------------------------------
async function checkAccess() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login/signin.html";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    gate.textContent = "This page is for CTY admins only.";
    return;
  }

  gate.hidden = true;
  app.hidden = false;
  loadRecent();
}

checkAccess();

// -----------------------------------------------------------------
// Type toggle (photo / video / testimony)
// -----------------------------------------------------------------
const typeToggle = document.getElementById("type-toggle");
const fileField = document.getElementById("file-field");
const fileInput = document.getElementById("file-input");
const fileHint = document.getElementById("file-hint");
const preview = document.getElementById("preview");
let currentType = "photo";

typeToggle.addEventListener("click", (e) => {
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

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) { preview.hidden = true; return; }

  const url = URL.createObjectURL(file);
  preview.innerHTML = currentType === "video"
    ? `<video src="${url}" controls></video>`
    : `<img src="${url}" alt="" />`;
  preview.hidden = false;
});

// -----------------------------------------------------------------
// Upload + publish
// -----------------------------------------------------------------
const form = document.getElementById("upload-form");
const errorEl = document.getElementById("upload-error");
const progressEl = document.getElementById("upload-progress");
const captionInput = document.getElementById("caption-input");
const featuredInput = document.getElementById("featured-input");

const MAX_SIZES = { photo: 10 * 1024 * 1024, video: 100 * 1024 * 1024 };

form.addEventListener("submit", async (e) => {
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
      progressEl.textContent = "Uploading file…";

      const ext = file.name.split(".").pop();
      const path = `${currentType}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);
      mediaUrl = publicUrlData.publicUrl;
    }

    progressEl.textContent = "Saving post…";

    const { data: { session } } = await supabase.auth.getSession();
    const { error: insertError } = await supabase.from("posts").insert({
      user_id: session.user.id,
      type: currentType,
      caption,
      media_url: mediaUrl,
      is_featured: featuredInput.checked,
    });
    if (insertError) throw insertError;

    showToast("Published! It'll show up on the site now.");
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

// -----------------------------------------------------------------
// Recently uploaded list, with delete
// -----------------------------------------------------------------
async function loadRecent() {
  const list = document.getElementById("recent-list");
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
    btn.addEventListener("click", () => deletePost(btn.dataset.id));
  });
}

function recentItemHTML(post) {
  const date = new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const thumb = post.media_url
    ? (post.type === "video"
        ? `<video src="${post.media_url}" muted></video>`
        : `<img src="${post.media_url}" alt="" />`)
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

async function deletePost(id) {
  if (!confirm("Delete this post? This can't be undone.")) return;
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) {
    showToast(friendlyError(error));
    return;
  }
  showToast("Post deleted.");
  loadRecent();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}