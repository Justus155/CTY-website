import { supabase } from "./supabaseclient.js";
import { isAdmin, deleteEvent } from "./admin-tools.js";

const list = document.getElementById("events-list");
let admin = false;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function eventCardHTML(ev) {
  const date = new Date(ev.starts_at);
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: "short" });
  const timeStr = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dateStr = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const adminBar = admin
    ? `<button class="admin-btn admin-btn--danger" data-action="delete" data-id="${ev.id}">Delete</button>`
    : `<a href="#" class="event-rsvp">RSVP →</a>`;

  return `
    <article class="event-card" data-event-id="${ev.id}">
      <div class="event-date-badge">
        <span class="day">${day}</span>
        <span class="mon">${month}</span>
      </div>
      <div class="event-info">
        <p class="event-meta">${dateStr} · ${timeStr}${ev.location ? " · " + escapeHtml(ev.location) : ""}</p>
        <h3>${escapeHtml(ev.title)}</h3>
        <p>${escapeHtml(ev.description || "")}</p>
      </div>
      ${adminBar}
    </article>
  `;
}

function adminFormHTML() {
  return `
    <form id="add-event-form" class="admin-add-form">
      <h3>Add an event</h3>
      <div class="admin-add-grid">
        <input type="text" name="title" placeholder="Event title" required />
        <input type="text" name="location" placeholder="Location" />
        <input type="datetime-local" name="starts_at" required />
        <input type="text" name="description" placeholder="Short description" />
      </div>
      <button type="submit" class="btn-primary">Publish event</button>
      <p class="error" id="add-event-error" role="alert"></p>
    </form>
  `;
}

async function loadEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, location, starts_at")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  const events = error ? [] : (data || []);

  const formHTML = admin ? adminFormHTML() : "";
  const eventsHTML = events.length
    ? events.map(eventCardHTML).join("")
    : `<p class="events-empty">No upcoming events right now — check back soon.</p>`;

  list.innerHTML = formHTML + eventsHTML;

  if (admin) {
    document.getElementById("add-event-form").addEventListener("submit", handleAddEvent);
  }
}

async function handleAddEvent(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("add-event-error");
  errorEl.textContent = "";

  const title = form.title.value.trim();
  const location = form.location.value.trim();
  const description = form.description.value.trim();
  const startsAt = form.starts_at.value;

  if (!title || !startsAt) {
    errorEl.textContent = "Title and date/time are required.";
    return;
  }

  const { error } = await supabase.from("events").insert({
    title,
    location: location || null,
    description: description || null,
    starts_at: new Date(startsAt).toISOString(),
  });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  form.reset();
  loadEvents();
}

list.addEventListener("click", async (e) => {
  const btn = e.target.closest('[data-action="delete"]');
  if (!btn) return;
  if (!confirm("Delete this event?")) return;

  try {
    await deleteEvent(btn.dataset.id);
    btn.closest(".event-card").remove();
  } catch (err) {
    alert(err.message || "Couldn't delete this event.");
  }
});

(async () => {
  admin = await isAdmin();
  loadEvents();
})();