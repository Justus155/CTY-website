import { supabase, showToast, setError, setLoading, friendlyError } from "./supabaseclient.js";

function getAgeFromBirthday(birthdayValue) {
  const birthday = new Date(birthdayValue);
  if (Number.isNaN(birthday.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());

  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function getMinistryGroupFromAge(age) {
  if (age >= 4 && age <= 12) return "children";
  if (age >= 13 && age <= 18) return "teens";
  if (age >= 19 && age <= 30) return "youth";
  return null;
}

const form = document.getElementById("form-signup");
const errorEl = document.getElementById("signup-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const birthday = form.birthday.value;
  const age = getAgeFromBirthday(birthday);
  const ministryGroup = age === null ? null : getMinistryGroupFromAge(age);
  const btn = form.querySelector(".btn-primary");

  if (age === null) {
    setError(errorEl, "Please enter a valid birthday.");
    return;
  }

  if (!ministryGroup) {
    setError(errorEl, "Signup is only available for ages 4 to 30.");
    return;
  }

  setLoading(btn, true);
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          birthday,
          age,
          ministry_group: ministryGroup,
        },
      },
    });
    if (error) throw error;

    // Create the matching profile row (requires a `profiles` table + RLS
    // policy allowing a user to insert their own row).
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        birthday,
        age,
        ministry_group: ministryGroup,
      });
    }

    showToast("Account created! Check your email to confirm.");
    setTimeout(() => { window.location.href = "signin.html"; }, 900);
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});