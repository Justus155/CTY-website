import { supabase, showToast, setError, setLoading, friendlyError } from "./supabaseclient.js";

// ============================================
// DOM
// ============================================
const signupForm   = document.getElementById("form-signup");
const verifyForm   = document.getElementById("form-verify");
const errorEl      = document.getElementById("signup-error");
const verifyErrorEl= document.getElementById("verify-error");
const passwordInput= document.getElementById("signup-password");
const dobInput     = document.getElementById("dob-input");
const codeInputs   = document.querySelectorAll(".code-digit");
const verifyEmailDisplay = document.getElementById("verify-email-display");
const resendBtn    = document.getElementById("resend-code-btn");
const backBtn      = document.getElementById("back-to-signup-btn");
const switchLine   = document.getElementById("switch-line");

if (!signupForm || !verifyForm || !errorEl || !verifyErrorEl || !passwordInput || !dobInput) {
  throw new Error("Signup page is missing required form elements.");
}

// ============================================
// PASSWORD RULES + DOB
// ============================================
dobInput.max = new Date().toISOString().split("T")[0];
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// ============================================
// STATE
// ============================================
let pendingEmail = null; // email we're currently verifying

const emailRedirectTo = /^https?:$/.test(window.location.protocol)
  ? new URL("../home/homepage.html", window.location.href).href
  : null;

const signupOptions = {
  data: {
    full_name: "",
    date_of_birth: "",
    ministry_group: "",
  },
};
if (emailRedirectTo) signupOptions.emailRedirectTo = emailRedirectTo;

// ============================================
// VALIDATION
// ============================================
function validateSignup(form) {
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const dob = form.dateOfBirth.value;
  const ministryGroup = form.ministryGroup.value;
  const agreed = form.terms.checked;

  if (fullName.length < 2) return "Please enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Please enter a valid email address.";
  if (!PASSWORD_RULE.test(password)) {
    passwordInput.classList.add("is-invalid");
    return "Password must be 8+ characters and include uppercase, lowercase, a number, and a special character.";
  }
  passwordInput.classList.remove("is-invalid");
  if (password !== confirmPassword) return "Passwords don't match — please re-enter them.";
  if (!dob) return "Please enter your birthday.";
  if (!ministryGroup) return "Please choose a ministry group.";
  if (!agreed) return "Please agree to the community guidelines and privacy policy to continue.";
  return null;
}

// ============================================
// STEP SWITCHER
// ============================================
function showSignupStep() {
  signupForm.classList.add("is-active");
  verifyForm.classList.remove("is-active");
  switchLine.style.display = "";
}

function showVerifyStep(email) {
  pendingEmail = email;
  verifyEmailDisplay.textContent = email;
  signupForm.classList.remove("is-active");
  verifyForm.classList.add("is-active");
  switchLine.style.display = "none";

  // Focus first digit
  setTimeout(() => codeInputs[0]?.focus(), 100);
}

// ============================================
// SIGNUP SUBMIT
// ============================================
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");

  const validationError = validateSignup(signupForm);
  if (validationError) {
    setError(errorEl, validationError);
    return;
  }

  const fullName = signupForm.fullName.value.trim();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;
  const dateOfBirth = signupForm.dateOfBirth.value;
  const ministryGroup = signupForm.ministryGroup.value;
  const btn = signupForm.querySelector(".btn-primary");

  setLoading(btn, true);
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...signupOptions,
        data: {
          ...signupOptions.data,
          full_name: fullName,
          date_of_birth: dateOfBirth,
          ministry_group: ministryGroup,
        },
      },
    });
    if (error) throw error;

    // Try to save the profile row in case the DB trigger isn't set up.
    if (data.user && data.session) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        date_of_birth: dateOfBirth,
        ministry_group: ministryGroup,
      });
      if (profileError) {
        console.warn("Profile upsert skipped:", profileError.message);
      }
    }

    // If a session already exists, this project has email confirmation OFF.
    if (data.session) {
      showToast("Account created! Redirecting…");
      setTimeout(() => { window.location.href = "../home/homepage.html"; }, 900);
      return;
    }

    // Otherwise: email confirmation is ON — go to OTP step.
    showToast(`We sent a code to ${email}`);
    showVerifyStep(email);

  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});

// ============================================
// OTP INPUT BEHAVIOR
// ============================================
codeInputs.forEach((input, idx) => {
  input.addEventListener("input", (e) => {
    const val = e.target.value.replace(/\D/g, "");
    e.target.value = val.slice(0, 1);
    if (val && idx < codeInputs.length - 1) codeInputs[idx + 1].focus();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.value && idx > 0) {
      codeInputs[idx - 1].focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) codeInputs[idx - 1].focus();
    if (e.key === "ArrowRight" && idx < codeInputs.length - 1) codeInputs[idx + 1].focus();
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    pasted.split("").forEach((char, i) => {
      if (codeInputs[i]) codeInputs[i].value = char;
    });
    const lastIdx = Math.min(pasted.length, codeInputs.length) - 1;
    if (lastIdx >= 0) codeInputs[lastIdx].focus();
  });
});

// ============================================
// OTP VERIFY SUBMIT
// ============================================
verifyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(verifyErrorEl, "");

  const token = Array.from(codeInputs).map(i => i.value).join("");
  if (token.length !== 6) {
    setError(verifyErrorEl, "Please enter the 6-digit code from your email.");
    return;
  }
  if (!pendingEmail) {
    setError(verifyErrorEl, "Something went wrong. Please go back and sign up again.");
    return;
  }

  const btn = verifyForm.querySelector(".btn-primary");
  setLoading(btn, true);

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token,
      type: "signup",
    });
    if (error) throw error;

    // Optional: ensure a profile row exists now that we have a user.
    if (data.user) {
      const meta = data.user.user_metadata || {};
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: meta.full_name || null,
        date_of_birth: meta.date_of_birth || null,
        ministry_group: meta.ministry_group || null,
      });
      if (profileError) {
        console.warn("Profile upsert skipped:", profileError.message);
      }
    }

    showToast("Email verified! Welcome to CTY 🎉");
    setTimeout(() => { window.location.href = "../home/homepage.html"; }, 900);

  } catch (err) {
    setError(verifyErrorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});

// ============================================
// RESEND CODE
// ============================================
resendBtn.addEventListener("click", async () => {
  setError(verifyErrorEl, "");
  if (!pendingEmail) {
    setError(verifyErrorEl, "No email to resend to. Please go back and sign up again.");
    return;
  }

  resendBtn.disabled = true;
  const originalText = resendBtn.textContent;
  resendBtn.textContent = "Sending…";

  try {
    const resendOptions = { type: "signup", email: pendingEmail };
    if (emailRedirectTo) resendOptions.options = { emailRedirectTo };
    const { error } = await supabase.auth.resend(resendOptions);
    if (error) throw error;
    showToast("New code sent! Check your email.");
  } catch (err) {
    setError(verifyErrorEl, friendlyError(err));
  } finally {
    resendBtn.disabled = false;
    resendBtn.textContent = originalText;
  }
});

// ============================================
// BACK TO SIGNUP
// ============================================
backBtn.addEventListener("click", () => {
  setError(verifyErrorEl, "");
  codeInputs.forEach(i => i.value = "");
  showSignupStep();
});