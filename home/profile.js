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

function getSupabaseErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
}

async function saveProfileFields(fields) {
  const userId = currentSession?.user?.id;
  if (!userId) {
    return { error: new Error("Missing user session.") };
  }

  // Prefer UPDATE first because many RLS setups allow update on own row
  // but block INSERT (which upsert may require).
  const { data: updatedRow, error: updateError } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (!updateError && updatedRow) {
    return { error: null };
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      ...fields,
    });

  return { error: upsertError || updateError || null };
}

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
    setError(
      errorEl,
      `Upload failed: ${getSupabaseErrorMessage(uploadError, "Ensure an 'avatars' bucket exists and storage policies allow authenticated uploads.")}`
    );
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const avatarUrl = publicUrlData.publicUrl;

  const { error: profileError } = await saveProfileFields({
    full_name: nameInput.value,
    avatar_url: avatarUrl,
  });

  if (profileError) {
    setError(
      errorEl,
      `Image uploaded, but profile save failed: ${getSupabaseErrorMessage(profileError, "Check your profiles table RLS policy for update/insert on own row.")}`
    );
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

  const { error: profileError } = await saveProfileFields({
    full_name: nameInput.value,
    avatar_url: null,
  });

  if (profileError) {
    setError(
      errorEl,
      `Could not remove profile picture: ${getSupabaseErrorMessage(profileError, "Check profiles update policy.")}`
    );
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

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "signed-out" }, "*");
    return;
  }

  window.location.href = "../login/signin.html";
});

loadProfile();
