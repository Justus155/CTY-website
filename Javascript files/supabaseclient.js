// ---------------------------------------------------------------
// Shared Supabase client — used by signin.js, signup.js, forgot-password.js
// ---------------------------------------------------------------
// 1. Create a project at https://supabase.com
// 2. Project Settings → API → copy your Project URL and anon public key
// 3. Paste them below. This is the ONLY place you need to add them.
// ---------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://emaljtnwkxmhuhcawsud.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_F0xGhM7E4RpFXVcgu_px6w_JOPdVAe2";

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

  if (/already registered|already exists/i.test(msg))
    return "That email is already registered — try signing in instead.";
  if (/invalid login credentials/i.test(msg))
    return "Email or password didn't match. Please check and try again.";
  if (/email not confirmed/i.test(msg))
    return "Please confirm your email before signing in — check your inbox for the link.";
  if (/rate limit|too many requests/i.test(msg))
    return "Too many attempts — please wait a minute before trying again.";
  if (/password.*(least|weak|short)/i.test(msg))
    return "Password must be at least 8 characters, with uppercase, lowercase, a number, and a special character.";
  if (/invalid email/i.test(msg))
    return "That email address doesn't look valid — please double-check it.";
  if (/network|fetch/i.test(msg))
    return "Couldn't reach the server — check your connection and try again.";
  if (/user not found/i.test(msg))
    return "We couldn't find an account with that email.";

  return msg;
}