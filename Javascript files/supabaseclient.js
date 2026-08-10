// ---------------------------------------------------------------
// Shared Supabase client — used by signin.js, signup.js, forgot-password.js
// ---------------------------------------------------------------
// 1. Create a project at https://supabase.com
// 2. Project Settings → API → copy your Project URL and anon public key
// 3. Paste them below. This is the ONLY place you need to add them.
// ---------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Shared UI helpers, reused across pages ----------
export function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  clearTimeout(showToast._t);
  toast.textContent = message;
  toast.classList.add("is-visible");
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

export function setError(el, message) {
  if (!el) return;
  if (!message) {
    el.textContent = "";
    el.classList.remove("is-visible");
    return;
  }
  el.textContent = message;
  el.classList.add("is-visible");
}

export function setLoading(button, loading) {
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
}

export function friendlyError(err) {
  const msg = err?.message || "Something went wrong. Please try again.";
  if (/already registered/i.test(msg)) return "That email is already registered — try signing in instead.";
  if (/invalid login credentials/i.test(msg)) return "Email or password didn't match. Please try again.";
  if (/password/i.test(msg) && /6|8/.test(msg)) return "Password must be at least 8 characters.";
  return msg;
}