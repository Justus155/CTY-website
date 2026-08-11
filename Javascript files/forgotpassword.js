import { supabase, setError, setLoading, friendlyError, showToast } from "./supabaseclient.js";

const sendCodeForm = document.getElementById("form-send-code");
const resetPasswordForm = document.getElementById("form-reset-password");
const resetSuccess = document.getElementById("reset-success");
const linkSentState = document.getElementById("link-sent-state");

const sendCodeErrorEl = document.getElementById("send-code-error");
const resetPasswordErrorEl = document.getElementById("reset-password-error");
const sentEmailEl = document.getElementById("sent-email");

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
let hasRecoveryContext = false;

function hide(el) {
  if (!el) return;
  el.hidden = true;
  el.classList.remove("is-active");
}

function show(el) {
  if (!el) return;
  el.hidden = false;
  el.classList.add("is-active");
}

function showEmailForm() {
  hide(resetPasswordForm);
  hide(linkSentState);
  show(sendCodeForm);
}

function showLinkSent(email) {
  hide(sendCodeForm);
  hide(resetPasswordForm);
  if (sentEmailEl) sentEmailEl.textContent = email;
  show(linkSentState);
}

function showResetForm() {
  hasRecoveryContext = true;
  hide(sendCodeForm);
  hide(linkSentState);
  show(resetPasswordForm);
}

function hasRecoveryInUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";
}

async function sendResetCode(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Keep recovery on this app route if the user clicks the email link.
    redirectTo: `${window.location.origin}/login/forgotpassword.html`,
  });
  if (error) throw error;
}

function initRecoveryState() {
  if (hasRecoveryInUrl()) {
    showResetForm();
  } else {
    showEmailForm();
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      showResetForm();
      // Remove one-time hash tokens from the URL after session is established.
      if (window.location.hash) {
        history.replaceState({}, document.title, window.location.pathname);
      }
    }
  });
}

sendCodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(sendCodeErrorEl, "");

  const email = sendCodeForm.email.value.trim();
  const submitBtn = sendCodeForm.querySelector(".btn-primary");

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    setError(sendCodeErrorEl, "Please enter a valid email address.");
    return;
  }

  setLoading(submitBtn, true);
  try {
    await sendResetCode(email);
    showLinkSent(email);
    showToast("Reset link sent. Check your email.");
  } catch (err) {
    setError(sendCodeErrorEl, friendlyError(err));
  } finally {
    setLoading(submitBtn, false);
  }
});

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(resetPasswordErrorEl, "");

  const password = resetPasswordForm.password.value;
  const confirmPassword = resetPasswordForm.confirmPassword.value;
  const submitBtn = resetPasswordForm.querySelector(".btn-primary");

  if (!hasRecoveryContext) {
    setError(resetPasswordErrorEl, "Please open the password reset link from your email first.");
    return;
  }

  if (!PASSWORD_RULE.test(password)) {
    setError(
      resetPasswordErrorEl,
      "Password must be 8+ characters and include uppercase, lowercase, a number, and a special character."
    );
    return;
  }

  if (password !== confirmPassword) {
    setError(resetPasswordErrorEl, "New password and confirm password do not match.");
    return;
  }

  setLoading(submitBtn, true);
  try {
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;

    await supabase.auth.signOut();

    resetPasswordForm.hidden = true;
    resetPasswordForm.classList.remove("is-active");
    resetSuccess.hidden = false;
    showToast("Password updated successfully.");
  } catch (err) {
    setError(resetPasswordErrorEl, friendlyError(err));
  } finally {
    setLoading(submitBtn, false);
  }
});

initRecoveryState();