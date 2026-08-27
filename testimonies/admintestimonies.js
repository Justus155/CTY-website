import { supabase } from "../Javascript files/supabaseclient.js";

const pendingBox = document.getElementById("pending");
const messageBox = document.getElementById("message");
const refreshButton = document.getElementById("refresh");

function message(text, type) {
  messageBox.textContent = text;
  messageBox.className = type;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

async function checkAdmin() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    message("Please sign in as an administrator.", "error");
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .single();

  if (error || !profile?.is_admin) {
    message("You do not have permission to review testimonies.", "error");
    return null;
  }

  return session.user;
}

async function loadPending() {
  const admin = await checkAdmin();
  if (!admin) return;

  pendingBox.innerHTML = "<p>Loading submissions...</p>";

  const { data, error } = await supabase
    .from("testimonies")
    .select("*")
    .eq("status", "pending")
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    message("Could not load submissions.", "error");
    console.error(error);
    return;
  }

  if (!data.length) {
    pendingBox.innerHTML = `<div class="empty">There are no pending testimonies.</div>`;
    return;
  }

  pendingBox.innerHTML = data.map(story => `
    <article class="card" data-id="${story.id}">
      <strong>${escapeHtml(story.name)}</strong>
      <div class="meta">${escapeHtml(story.theme)}${story.location ? " · " + escapeHtml(story.location) : ""}</div>
      <p class="story">${escapeHtml(story.description)}</p>
      ${story.photo_url ? `<img src="${escapeHtml(story.photo_url)}" alt="Submitted photo" style="max-width:260px;border-radius:12px;margin-bottom:18px">` : ""}
      <div class="buttons">
        <button class="approve" data-action="approve">Approve & Publish</button>
        <button class="reject" data-action="reject">Reject</button>
      </div>
    </article>
  `).join("");

  pendingBox.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest(".card");
      updateStatus(card.dataset.id, button.dataset.action);
    });
  });
}

async function updateStatus(id, action) {
  const admin = await checkAdmin();
  if (!admin) return;

  const newStatus = action === "approve" ? "published" : "rejected";

  const { error } = await supabase
    .from("testimonies")
    .update({
      status: newStatus,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    message("Could not update this testimony.", "error");
    console.error(error);
    return;
  }

  message(action === "approve" ? "Testimony published." : "Testimony rejected.", "success");
  loadPending();
}

refreshButton.addEventListener("click", loadPending);
loadPending();