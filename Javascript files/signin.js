import { supabase, showToast, setError, setLoading, friendlyError } from "./supabase-client.js";

const form = document.getElementById("form-signin");
const errorEl = document.getElementById("signin-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");
  const email = form.email.value.trim();
  const password = form.password.value;
  const btn = form.querySelector(".btn-primary");

  setLoading(btn, true);
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showToast("Welcome back! Redirecting…");
    // window.location.href = "/dashboard.html";
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});