import { supabase, showToast, setError } from "../Javascript files/supabaseclient.js";

const form = document.getElementById("profile-form");
const fileInput = document.getElementById("avatar-file");
const avatarPreview = document.getElementById("avatar-preview");
const nameInput = document.getElementById("profile-name");
const emailInput = document.getElementById("profile-email");
const groupInput = document.getElementById("profile-group");
const errorEl = document.getElementById("profile-error");
const signoutBtn = document.getElementById("signout-btn");
const removeAvatarBtn = document.getElementById("remove-avatar-btn");
const resetPasswordBtn = document.getElementById("reset-password-btn");
const panelCloseBtn = document.getElementById("panel-close-btn");

let currentSession = null;
let selectedFile = null;
let currentAvatarUrl = null;
const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "1";

if (isEmbedded) {
  document.body.classList.add("is-embedded");
  if (panelCloseBtn) panelCloseBtn.hidden = false;
}

function renderAvatar(avatarUrl, fallbackName) {
  if (avatarUrl) {
    avatarPreview.innerHTML = `<img src="${avatarUrl}" alt="${fallbackName}" />`;
    return;
  }
  avatarPreview.textContent = (fallbackName || "U").trim().charAt(0).toUpperCase() || "U";
}

async function loadProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../login/signin.html";
    return;
  }
  currentSession = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, ministry_group")
    .eq("id", session.user.id)
    .maybeSingle();

  const fullName =
    profile?.full_name ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] ||
    "User";

  nameInput.value = fullName;
  nameInput.readOnly = true;
  emailInput.value = session.user.email || "";
  if (groupInput) {
    groupInput.value = profile?.ministry_group || "Not set";
    groupInput.readOnly = true;
  }

  currentAvatarUrl = profile?.avatar_url || null;

  renderAvatar(currentAvatarUrl, fullName);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    selectedFile = null;
    return;
  }

  if (!file.type.startsWith("image/")) {
    setError(errorEl, "Please select an image file.");
    fileInput.value = "";
    selectedFile = null;
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setError(errorEl, "Image is too large. Maximum file size is 5MB.");
    fileInput.value = "";
    selectedFile = null;
    return;
  }

  selectedFile = file;
  setError(errorEl, "");

  const localUrl = URL.createObjectURL(file);
  avatarPreview.innerHTML = `<img src="${localUrl}" alt="Preview" />`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(errorEl, "");

  if (!currentSession) {
    setError(errorEl, "Your session expired. Please sign in again.");
    return;
  }

  if (!selectedFile) {
    setError(errorEl, "Choose a profile picture before saving.");
    return;
  }

  const extension = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
  const filePath = `${currentSession.user.id}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, selectedFile, { upsert: true, cacheControl: "3600" });

  if (uploadError) {
    setError(errorEl, "Could not upload image. Ensure an 'avatars' storage bucket exists and allows uploads.");
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const avatarUrl = publicUrlData.publicUrl;

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: currentSession.user.id,
      full_name: nameInput.value,
      avatar_url: avatarUrl,
    });

  if (profileError) {
    setError(errorEl, "Image uploaded but profile update failed. Check your profiles table RLS policy.");
    return;
  }

  showToast("Profile picture updated.");
  currentAvatarUrl = avatarUrl;
  selectedFile = null;
  if (fileInput) fileInput.value = "";
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "profile-updated" }, "*");
  }
  setError(errorEl, "");
});

removeAvatarBtn?.addEventListener("click", async () => {
  setError(errorEl, "");

  if (!currentSession) {
    setError(errorEl, "Your session expired. Please sign in again.");
    return;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: currentSession.user.id,
      full_name: nameInput.value,
      avatar_url: null,
    });

  if (profileError) {
    setError(errorEl, "Could not remove profile picture. Please try again.");
    return;
  }

  currentAvatarUrl = null;
  selectedFile = null;
  if (fileInput) fileInput.value = "";
  renderAvatar(null, nameInput.value || "U");
  showToast("Profile picture removed.");
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "profile-updated" }, "*");
  }
});

resetPasswordBtn?.addEventListener("click", async () => {
  setError(errorEl, "");

  const email = emailInput.value.trim();
  if (!email) {
    setError(errorEl, "No email found for this account.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    setError(errorEl, error.message || "Could not send password reset email.");
    return;
  }

  showToast("Password reset email sent.");
});

panelCloseBtn?.addEventListener("click", () => {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "close-profile-drawer" }, "*");
  }
});

signoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "../login/signin.html";
});

loadProfile();
