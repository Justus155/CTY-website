import { supabase, setError, setLoading, friendlyError } from "./supabase-client.js";

const form = document.getElementById("form-forgot");
const errorEl = document.getElementById("forgot-error");
const successState = document.getElementById("forgot-success");
const sentEmailEl = document.getElementById("sent-email");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");
  const email = form.email.value.trim();
  const btn = form.querySelector(".btn-primary");

  setLoading(btn, true);
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password.html",
    });
    if (error) throw error;

    sentEmailEl.textContent = email;
    form.hidden = true;
    successState.hidden = false;
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});