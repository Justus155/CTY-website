import { supabase, showToast, setError, setLoading, friendlyError } from "./supabaseclient.js";

const form = document.getElementById("form-signin");
const errorEl = document.getElementById("signin-error");

// Only allow same-site paths to prevent open redirects.
function getRedirectTarget() {
  const raw = new URLSearchParams(window.location.search).get("redirect");
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) return raw;
  return "../home/homepage.html";
}

// If they're already signed in, don't make them log in again.
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = getRedirectTarget();
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");

  const email = form.email.value.trim();
  const password = form.password.value;
  const btn = form.querySelector(".btn-primary");

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    setError(errorEl, "Please enter a valid email address.");
    return;
  }
  if (!password) {
    setError(errorEl, "Please enter your password.");
    return;
  }

  setLoading(btn, true);
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showToast("Welcome back! Redirecting…");
    setTimeout(() => { window.location.href = getRedirectTarget(); }, 700);
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});