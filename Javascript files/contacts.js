import "./site.js";
import { supabase, setError, setLoading, friendlyError } from "./supabase-client.js";

const form = document.getElementById("contact-form");
const errorEl = document.getElementById("contact-error");
const successEl = document.getElementById("contact-success");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError(errorEl, "");

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();
  const btn = form.querySelector(".btn-primary");

  if (name.length < 2) return setError(errorEl, "Please enter your name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return setError(errorEl, "Please enter a valid email address.");
  if (message.length < 5) return setError(errorEl, "Please write a short message so we know how to help.");

  setLoading(btn, true);
  try {
    // Requires a `contact_messages` table with an RLS policy allowing
    // public inserts (see contact_messages_schema.sql).
    const { error } = await supabase.from("contact_messages").insert({ name, email, message });
    if (error) throw error;

    form.hidden = true;
    successEl.classList.add("is-visible");
  } catch (err) {
    setError(errorEl, friendlyError(err));
  } finally {
    setLoading(btn, false);
  }
});