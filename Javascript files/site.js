  import { supabase } from "./supabaseclient.js";

export function initSiteChrome() {
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");
  navToggle?.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  checkAdminStatus();
}

export async function checkAdminStatus() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const adminLink = document.getElementById("admin-link");
    const signInLink = document.getElementById("signin-link");
    if (!session) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.role === "admin" && adminLink) adminLink.hidden = false;
    if (signInLink && profile?.full_name) {
      signInLink.textContent = profile.full_name.split(" ")[0];
      signInLink.href = "profile.html";
    }
  } catch {
    // Supabase not configured yet — header behaves as signed-out.
  }
}

initSiteChrome();