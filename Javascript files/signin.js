import { supabase, showToast, setError, setLoading, friendlyError } from "./supabaseclient.js";

function setupFloatingSwitch() {
  const links = document.querySelectorAll('a[href="signup.html"]');
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      document.body.classList.add("is-leaving-left");
      window.setTimeout(() => {
        window.location.href = link.getAttribute("href") || "signup.html";
      }, 240);
    });
  });
}

setupFloatingSwitch();

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