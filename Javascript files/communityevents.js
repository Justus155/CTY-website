import "./site.js";
import { supabase } from "./supabase-client.js";

const list = document.getElementById("events-list");

const DUMMY_EVENTS = [
  {
    title: "Youth Fellowship Night",
    description: "Worship, games, and an open conversation on identity and faith.",
    location: "CTY Main Hall",
    starts_at: "2026-08-22T17:00:00",
  },
  {
    title: "Children's Family Day",
    description: "A day of games, cake, and stories for our youngest CTY members and their families.",
    location: "Church Grounds",
    starts_at: "2026-08-30T10:00:00",
  },
  {
    title: "College & Career Meetup",
    description: "A relaxed evening for our College and University group — food, testimonies, and connection.",
    location: "CTY Annex",
    starts_at: "2026-09-05T18:30:00",
  },
];

function eventCardHTML(ev) {
  const date = new Date(ev.starts_at);
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: "short" });
  const timeStr = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dateStr = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return `
    <article class="event-card">
      <div class="event-date-badge">
        <span class="day">${day}</span>
        <span class="mon">${month}</span>
      </div>
      <div class="event-info">
        <p class="event-meta">${dateStr} · ${timeStr}${ev.location ? " · " + escapeHtml(ev.location) : ""}</p>
        <h3>${escapeHtml(ev.title)}</h3>
        <p>${escapeHtml(ev.description || "")}</p>
      </div>
      <a href="#" class="event-rsvp">RSVP →</a>
    </article>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadEvents() {
  let events = DUMMY_EVENTS;

  try {
    const { data, error } = await supabase
      .from("events")
      .select("title, description, location, starts_at")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (!error && data && data.length) events = data;
  } catch {
    // Supabase not connected yet, or no `events` table — dummy content stays.
  }

  if (!events.length) {
    list.innerHTML = `<p class="events-empty">No upcoming events right now — check back soon.</p>`;
    return;
  }

  list.innerHTML = events.map(eventCardHTML).join("");
}

loadEvents();