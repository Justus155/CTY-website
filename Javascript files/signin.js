import { supabase, showToast, setError, setLoading, friendlyError } from "./supabaseclient.js";

const form = document.getElementById("form-signin");
const errorEl = document.getElementById("signin-error");

// If they're already signed in, don't make them log in again.
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = "../home/homepage.html";
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
    setTimeout(() => { window.location.href = "../home/homepage.html"; }, 700);
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});