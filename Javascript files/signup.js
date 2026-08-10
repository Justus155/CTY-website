import { supabase, showToast, setError, setLoading, friendlyError } from "./supabaseclient.js";

const form = document.getElementById("form-signup");
const errorEl = document.getElementById("signup-error");
const passwordInput = document.getElementById("signup-password");
const dobInput = document.getElementById("dob-input");

if (!form || !errorEl || !passwordInput || !dobInput) {
  throw new Error("Signup page is missing required form elements.");
}

// Stop people from picking a birthday in the future.
dobInput.max = new Date().toISOString().split("T")[0];

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function validate(form) {
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const dob = form.dateOfBirth.value;
  const ministryGroup = form.ministryGroup.value;
  const agreed = form.terms.checked;

  if (fullName.length < 2) {
    return "Please enter your full name.";
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return "Please enter a valid email address.";
  }
  if (!PASSWORD_RULE.test(password)) {
    passwordInput.classList.add("is-invalid");
    return "Password must be 8+ characters and include uppercase, lowercase, a number, and a special character.";
  }
  passwordInput.classList.remove("is-invalid");
  if (password !== confirmPassword) {
    return "Passwords don't match — please re-enter them.";
  }
  if (!dob) {
    return "Please enter your birthday.";
  }
  if (!ministryGroup) {
    return "Please choose a ministry group.";
  }
  if (!agreed) {
    return "Please agree to the community guidelines and privacy policy to continue.";
  }
  return null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");

  const validationError = validate(form);
  if (validationError) {
    setError(errorEl, validationError);
    return;
  }

  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const dateOfBirth = form.dateOfBirth.value;
  const ministryGroup = form.ministryGroup.value;
  const btn = form.querySelector(".btn-primary");

  setLoading(btn, true);
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Read by the `handle_new_user` database trigger, which creates
        // the matching row in `profiles` automatically — no manual
        // insert needed here, so there's no risk of an orphaned auth
        // user if this tab closes right after signup.
        data: {
          full_name: fullName,
          date_of_birth: dateOfBirth,
          ministry_group: ministryGroup,
        },
      },
    });
    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        date_of_birth: dateOfBirth,
        ministry_group: ministryGroup,
      });

      // If email confirmation is enabled, session can be null here and RLS
      // may block direct client upsert. In that case, rely on your DB trigger.
      if (profileError && data.session) {
        throw new Error(`Account created, but profile save failed: ${profileError.message}`);
      }
    }

    if (data.user && !data.session) {
      // Email confirmation is required before the account is active.
      showToast(`Almost there — confirm your email at ${email}`);
    } else {
      showToast("Account created! Redirecting…");
    }
    form.reset();
    setTimeout(() => { window.location.href = "signin.html"; }, 1100);
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});