import { supabase } from "./supabaseclient.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getSignInPath() {
  return new URL("../login/signin.html", window.location.href).toString();
}

function bindSignOut() {
  const signOutBtn = document.getElementById("signout-btn");
  if (!signOutBtn || signOutBtn.dataset.bound === "true") return;

  signOutBtn.dataset.bound = "true";
  signOutBtn.addEventListener("click", async () => {
    signOutBtn.disabled = true;

    const redirectToSignIn = () => window.location.replace(getSignInPath());
    const redirectFallback = window.setTimeout(redirectToSignIn, 120);

    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      window.clearTimeout(redirectFallback);
      redirectToSignIn();
    }
  });
}

export async function applyHeaderAuthState() {
  const signInLink = document.getElementById("signin-link");
  const signUpLink = document.getElementById("signup-link");
  const signOutBtn = document.getElementById("signout-btn");
  const profileLink = document.getElementById("profile-link");
  const profileName = document.getElementById("profile-name");
  const profileAvatar = document.getElementById("profile-avatar");
  const adminLink = document.getElementById("admin-link");

  if (!signInLink && !signOutBtn) return;

  bindSignOut();

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      if (profileLink) profileLink.hidden = true;
      if (adminLink) adminLink.hidden = true;
      if (signInLink) signInLink.hidden = false;
      if (signUpLink) signUpLink.hidden = false;
      if (signOutBtn) signOutBtn.hidden = true;
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

    if (signInLink) signInLink.hidden = true;
    if (signUpLink) signUpLink.hidden = true;
    if (signOutBtn) signOutBtn.hidden = false;
  } catch {
    if (profileLink) profileLink.hidden = true;
    if (adminLink) adminLink.hidden = true;
    if (signInLink) signInLink.hidden = false;
    if (signUpLink) signUpLink.hidden = false;
    if (signOutBtn) signOutBtn.hidden = true;
  }
}

supabase.auth.onAuthStateChange(() => {
  applyHeaderAuthState();
});

applyHeaderAuthState();
