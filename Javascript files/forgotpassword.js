import { supabase, setError, setLoading, friendlyError, showToast } from "./supabaseclient.js";

const sendCodeForm = document.getElementById("form-send-code");
const resetPasswordForm = document.getElementById("form-reset-password");
const resetSuccess = document.getElementById("reset-success");

const sendCodeErrorEl = document.getElementById("send-code-error");
const resetPasswordErrorEl = document.getElementById("reset-password-error");
const sentEmailEl = document.getElementById("sent-email");
const resendCodeBtn = document.getElementById("resend-code-btn");
const codeInputs = Array.from(document.querySelectorAll(".code-digit"));
const codeHiddenInput = document.getElementById("reset-code");

let recoveryEmail = "";
let resendCountdownTimer = null;
let resendSecondsLeft = 0;

const RESEND_COOLDOWN_SECONDS = 30;

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function syncCodeValue() {
  if (!codeHiddenInput) return "";
  const code = codeInputs.map((input) => input.value).join("");
  codeHiddenInput.value = code;
  return code;
}

function clearCodeInputs() {
  codeInputs.forEach((input) => {
    input.value = "";
  });
  syncCodeValue();
  codeInputs[0]?.focus();
}

function setupCodeInputs() {
  if (!codeInputs.length || !codeHiddenInput) return;

  codeInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      const digit = input.value.replace(/\D/g, "").slice(0, 1);
      input.value = digit;
      syncCodeValue();
      if (digit && index < codeInputs.length - 1) {
        codeInputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && index > 0) {
        codeInputs[index - 1].focus();
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        codeInputs[index - 1].focus();
      }
      if (event.key === "ArrowRight" && index < codeInputs.length - 1) {
        event.preventDefault();
        codeInputs[index + 1].focus();
      }
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();
      const pasted = (event.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, codeInputs.length);
      if (!pasted) return;

      codeInputs.forEach((box, boxIndex) => {
        box.value = pasted[boxIndex] || "";
      });
      syncCodeValue();

      const nextIndex = Math.min(pasted.length, codeInputs.length - 1);
      codeInputs[nextIndex].focus();
    });
  });
}

function renderResendButtonState() {
  if (!resendCodeBtn) return;

  if (resendSecondsLeft > 0) {
    resendCodeBtn.disabled = true;
    resendCodeBtn.textContent = `Resend code in ${resendSecondsLeft}s`;
    return;
  }

  resendCodeBtn.disabled = false;
  resendCodeBtn.textContent = "Resend code";
}

function startResendCooldown(seconds = RESEND_COOLDOWN_SECONDS) {
  if (resendCountdownTimer) {
    clearInterval(resendCountdownTimer);
    resendCountdownTimer = null;
  }

  resendSecondsLeft = seconds;
  renderResendButtonState();

  resendCountdownTimer = setInterval(() => {
    resendSecondsLeft -= 1;
    renderResendButtonState();

    if (resendSecondsLeft <= 0) {
      clearInterval(resendCountdownTimer);
      resendCountdownTimer = null;
    }
  }, 1000);
}

async function sendResetCode(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });
  if (error) throw error;
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
    recoveryEmail = email;
    sentEmailEl.textContent = email;
    clearCodeInputs();
    sendCodeForm.hidden = true;
    sendCodeForm.classList.remove("is-active");
    resetPasswordForm.hidden = false;
    resetPasswordForm.classList.add("is-active");
    startResendCooldown();
    showToast("Reset code sent. Check your email.");
  } catch (err) {
    setError(sendCodeErrorEl, friendlyError(err));
  } finally {
    setLoading(submitBtn, false);
  }
});

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(resetPasswordErrorEl, "");

  const code = syncCodeValue().trim();
  const password = resetPasswordForm.password.value;
  const confirmPassword = resetPasswordForm.confirmPassword.value;
  const submitBtn = resetPasswordForm.querySelector(".btn-primary");

  if (!recoveryEmail) {
    setError(resetPasswordErrorEl, "Start by entering your email to receive a reset code.");
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    setError(resetPasswordErrorEl, "Please enter the 6-digit reset code from your email.");
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
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: recoveryEmail,
      token: code,
      type: "email",
    });
    if (verifyError) throw verifyError;

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

resendCodeBtn.addEventListener("click", async () => {
  setError(resetPasswordErrorEl, "");

  if (!recoveryEmail) {
    setError(resetPasswordErrorEl, "Enter your email first to receive a code.");
    return;
  }

  try {
    await sendResetCode(recoveryEmail);
    clearCodeInputs();
    startResendCooldown();
    showToast("A new reset code has been sent.");
  } catch (err) {
    setError(resetPasswordErrorEl, friendlyError(err));
  }
});

setupCodeInputs();
renderResendButtonState();