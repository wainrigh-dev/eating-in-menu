(async function () {
  const titleEl = document.getElementById("meal-title");
  const metaEl = document.getElementById("meal-meta");
  const bodyEl = document.getElementById("meal-body");

  const id = new URLSearchParams(location.search).get("id");

  let snapshot;
  try {
    snapshot = await loadSnapshot();
  } catch (e) {
    titleEl.textContent = "Couldn't load";
    bodyEl.innerHTML = '<div class="empty">Couldn\'t load the menu. Try reloading.</div>';
    return;
  }

  const found = id ? findMealById(snapshot, id) : null;
  if (!found) {
    titleEl.textContent = "Meal not found";
    metaEl.textContent = "";
    bodyEl.innerHTML = '<div class="empty">This meal isn\'t in the current menu anymore.</div>';
    return;
  }

  const { meal, week } = found;
  titleEl.innerHTML = escapeHtml(meal.name) + statusBadge(meal.status);
  const dayPart = meal.day ? meal.day + ", " : "";
  metaEl.textContent = `${dayPart}${formatWeekLabel(week.weekId, week.weekId === todaySunday())} · Last updated ${formatPublishedAt(snapshot.publishedAt)}`;

  const cookLine = meal.cookName
    ? `<div class="card">👤 Cooking: <strong>${escapeHtml(meal.cookName)}</strong></div>`
    : `<div class="card">No cook assigned yet.</div>`;

  if (!meal.recipe) {
    bodyEl.innerHTML = cookLine + '<div class="card no-recipe">No recipe linked to this meal.</div>';
    return;
  }

  const r = meal.recipe;
  const photoSrc = r.photos && r.photos.medium;
  const photoHtml = photoSrc
    ? `<img class="meal-photo-medium" src="${encodeURI(photoSrc)}" alt="${escapeHtml(meal.name)}" loading="lazy" onerror="this.remove()" />`
    : "";
  const ingredients = r.ingredients || [];
  const prepTasks = r.prepTasks || [];
  const steps = r.steps || [];
  // A recipe with its own sources[] (Batch C1+) uses that; an older/flag-off snapshot only ever
  // had the single legacy sourceUrl — fall back to it so the link still shows either way.
  const sources = Array.isArray(r.sources) && r.sources.length
    ? r.sources
    : (r.sourceUrl ? [{ url: r.sourceUrl, label: "" }] : []);

  // Checked state persists per device, keyed by week + meal, so it survives a refresh and a
  // later visit but never collides with the same recipe cooked in a different week/meal slot.
  const storageKey = "alex-checks:" + week.weekId + ":" + meal.id;
  function loadChecks() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveChecks(checks) {
    try { localStorage.setItem(storageKey, JSON.stringify(checks)); } catch (e) { /* storage blocked — still usable, just not remembered */ }
  }
  const checks = loadChecks();

  function checkRow(key, labelHtml, number) {
    const isChecked = !!checks[key];
    const numHtml = number != null ? `<span class="step-num">${number}.</span> ` : "";
    return `<button type="button" class="check-row${isChecked ? " checked" : ""}" data-key="${key}">
      <span class="checkbox" aria-hidden="true"></span>
      <span class="check-label">${numHtml}${labelHtml}</span>
    </button>`;
  }

  const ingredientsHtml = ingredients.length
    ? `<div class="check-list">${ingredients.map((i, idx) =>
        checkRow("ing-" + idx, escapeHtml(i.qty ? i.qty + " " : "") + escapeHtml(i.name))).join("")}</div>`
    : '<div class="card no-recipe">No ingredients listed.</div>';

  // Prep and Cook sections are left out entirely (no header at all) when the recipe has none —
  // never an empty section with nothing under it.
  const prepHtml = prepTasks.length
    ? `<div class="section-title">Prep</div><div class="check-list">${prepTasks.map((t, idx) =>
        checkRow("prep-" + idx, escapeHtml(t))).join("")}</div>`
    : "";

  const cookHtml = steps.length
    ? `<div class="section-title">Cook</div><div class="check-list">${steps.map((t, idx) =>
        checkRow("cook-" + idx, escapeHtml(t), idx + 1)).join("")}</div>`
    : "";

  const linksHtml = sources.length
    ? `<div class="card recipe-links">${sources.map((s, i) =>
        `<a class="recipe-link" href="${encodeURI(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.label || (i === 0 ? "Open full recipe" : "Source"))} &rarr;</a>`).join("")}</div>`
    : "";

  bodyEl.innerHTML = photoHtml + cookLine +
    '<div class="section-title">Ingredients</div>' + ingredientsHtml +
    prepHtml +
    cookHtml +
    linksHtml +
    '<button type="button" class="clear-checks" id="clear-checks">Clear checks</button>';

  bodyEl.querySelectorAll(".check-row").forEach((row) => {
    row.addEventListener("click", () => {
      const key = row.dataset.key;
      if (checks[key]) delete checks[key];
      else checks[key] = true;
      saveChecks(checks);
      row.classList.toggle("checked", !!checks[key]);
    });
  });

  const clearBtn = document.getElementById("clear-checks");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!confirm("Clear all checked items for this meal?")) return;
      Object.keys(checks).forEach((k) => delete checks[k]);
      try { localStorage.removeItem(storageKey); } catch (e) { /* storage blocked — nothing to clear */ }
      bodyEl.querySelectorAll(".check-row.checked").forEach((row) => row.classList.remove("checked"));
    });
  }
})();
