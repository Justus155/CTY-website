import { supabase } from "../Javascript files/supabaseclient.js";

const list = document.getElementById("testimonies");
const form = document.getElementById("testimony-form");
const overlay = document.getElementById("form-overlay");
const openForm = document.getElementById("open-form");
const closeForm = document.getElementById("close-form");
const submitButton = document.getElementById("submit-button");
const formMessage = document.getElementById("form-message");
const year = document.getElementById("year");
const menuToggle = document.getElementById("menuToggle");
const mobileNav = document.getElementById("mobileNav");

year.textContent = new Date().getFullYear();

menuToggle.addEventListener("click", () => {
  const isOpen = mobileNav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
});

mobileNav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mobileNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
  });
});

openForm.addEventListener("click", async () => {
  // Require a signed-in church member.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    showMessage("Please sign in before submitting a testimony.", "error");
    return;
  }

  overlay.classList.add("show");
  document.body.classList.add("locked");
});

closeForm.addEventListener("click", closeFormModal);
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeFormModal();
});

function closeFormModal() {
  overlay.classList.remove("show");
  document.body.classList.remove("locked");
  form.reset();
  formMessage.className = "message";
  formMessage.textContent = "";
}

function showMessage(text, type) {
  const box = document.getElementById("message");
  box.textContent = text;
  box.className = `message show ${type}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showFormMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = `message show ${type}`;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

async function loadTestimonies() {
  const { data, error } = await supabase
    .from("testimonies")
    .select("id, name, location, theme, description, photo_url, created_at")
    .eq("status", "published")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="empty">We could not load the testimonies right now.</div>`;
    console.error(error);
    return;
  }

  if (!data.length) {
    list.innerHTML = `<div class="empty">No testimonies have been published yet. Be the first to share your story.</div>`;
    return;
  }

  list.innerHTML = data.map(story => `
    <article class="card">
      <span class="tag">${escapeHtml(story.theme)}</span>
      <h3>${escapeHtml(story.name)}</h3>
      ${story.location ? `<p class="location">${escapeHtml(story.location)}</p>` : ""}
      ${story.photo_url ? `<img src="${escapeHtml(story.photo_url)}" alt="${escapeHtml(story.name)}" style="width:100%;height:210px;object-fit:cover;border-radius:12px;margin:12px 0;">` : ""}
      <p class="story">“${escapeHtml(story.description)}”</p>
    </article>
  `).join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showFormMessage("Your session has expired. Please sign in again.", "error");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const location = document.getElementById("location").value.trim();
  const theme = document.getElementById("theme").value;
  const story = document.getElementById("story").value.trim();
  const photo = document.getElementById("photo").files[0];

  if (story.length < 30) {
    showFormMessage("Please tell your story in at least 30 characters.", "error");
    return;
  }

  if (photo && photo.size > 5 * 1024 * 1024) {
    showFormMessage("Your photo is too large. Please choose one under 5 MB.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  try {
    let photoUrl = null;

    if (photo) {
      const extension = photo.name.split(".").pop().toLowerCase();
      const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("testimonies")
        .upload(path, photo, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("testimonies")
        .getPublicUrl(path);

      photoUrl = publicUrl.publicUrl;
    }

    const { error } = await supabase
      .from("testimonies")
      .insert({
        user_id: session.user.id,
        name,
        location: location || null,
        theme,
        description: story,
        photo_url: photoUrl,
        status: "pending",
        is_deleted: false
      });

    if (error) throw error;

    form.reset();
    showFormMessage("Thank you! Your testimony has been sent to the admin team for review.", "success");

    setTimeout(closeFormModal, 2500);

  } catch (error) {
    console.error(error);
    showFormMessage("We could not submit your testimony. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send for Review";
  }
});

loadTestimonies();