// Shared data loading + helpers used by every page. No framework, no build step —
// the site is plain static files that fetch data/snapshot.json at runtime.
const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function loadSnapshot() {
  const res = await fetch("data/snapshot.json", { cache: "no-store" });
  if (!res.ok) throw new Error("snapshot fetch failed: " + res.status);
  return res.json();
}

function sundayOf(d) {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return s.toISOString().slice(0, 10);
}

function todaySunday() {
  return sundayOf(new Date());
}

function formatWeekLabel(weekId, isCurrent) {
  const d = new Date(weekId + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const range = `${fmt(d)}–${fmt(end)}`;
  return isCurrent ? `This week (${range})` : `Week of ${range}`;
}

function formatPublishedAt(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function mealsByDay(week) {
  const groups = {};
  (week.meals || []).forEach((m) => {
    const key = m.day || "Unscheduled";
    (groups[key] = groups[key] || []).push(m);
  });
  const order = [...DAY_ORDER, "Unscheduled"];
  return order
    .filter((d) => groups[d])
    .map((d) => ({ day: d, meals: groups[d] }));
}

function findMealById(snapshot, id) {
  for (const week of snapshot.weeks || []) {
    const m = (week.meals || []).find((x) => x.id === id);
    if (m) return { meal: m, week };
  }
  return null;
}

function statusBadge(status) {
  if (!status) return "";
  const cls = status.toLowerCase().replace(/\s+/g, "");
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderUpdated(snapshot, el) {
  el.textContent = "Last updated: " + formatPublishedAt(snapshot.publishedAt);
}

function setActiveTab(name) {
  document.querySelectorAll("nav.tabs a").forEach((a) => {
    a.classList.toggle("active", a.dataset.tab === name);
  });
}
