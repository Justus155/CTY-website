import { supabase } from "./supabaseclient.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export async function applyHeaderAuthState() {
  const signInLink = document.getElementById("signin-link");
  const profileLink = document.getElementById("profile-link");
  const profileName = document.getElementById("profile-name");
  const profileAvatar = document.getElementById("profile-avatar");
  const adminLink = document.getElementById("admin-link");

  if (!signInLink) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      if (profileLink) profileLink.hidden = true;
      if (adminLink) adminLink.hidden = true;
      signInLink.hidden = false;
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", session.user.id)
      .maybeSingle();

    const fullName =
      profile?.full_name ||
      session.user.user_metadata?.full_name ||
      session.user.email?.split("@")[0] ||
      "Profile";
    const firstName = fullName.split(" ")[0] || "Profile";

    if (profileAvatar) {
      if (profile?.avatar_url) {
        profileAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${escapeHtml(firstName)}" />`;
      } else {
        profileAvatar.textContent = firstName.charAt(0).toUpperCase();
      }
    }

    if (profileName) profileName.textContent = firstName;

    if (profileLink) {
      profileLink.hidden = false;
      profileLink.href = "../home/profile.html";
      profileLink.title = fullName;
      profileLink.setAttribute("aria-label", `${fullName} profile`);
    }

    if (adminLink) {
      adminLink.hidden = profile?.role !== "admin";
      adminLink.href = "../admin/admin.html";
    }

    signInLink.hidden = true;
  } catch {
    if (profileLink) profileLink.hidden = true;
    if (adminLink) adminLink.hidden = true;
    signInLink.hidden = false;
  }
}

supabase.auth.onAuthStateChange(() => {
  applyHeaderAuthState();
});

applyHeaderAuthState();
