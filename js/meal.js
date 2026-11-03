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

  let recipeHtml;
  if (!meal.recipe) {
    recipeHtml = '<div class="card no-recipe">No recipe linked to this meal.</div>';
  } else {
    const r = meal.recipe;
    const ingredients = (r.ingredients || []).length
      ? `<ul class="plain">${r.ingredients.map((i) =>
          `<li>${escapeHtml(i.qty ? i.qty + " " : "")}${escapeHtml(i.name)}</li>`).join("")}</ul>`
      : '<div class="no-recipe">No ingredients listed.</div>';
    const prep = (r.prepTasks || []).length
      ? `<ul class="plain">${r.prepTasks.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
      : '<div class="no-recipe">No prep steps listed.</div>';
    const link = r.sourceUrl
      ? `<a class="recipe-link" href="${encodeURI(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open full recipe &rarr;</a>`
      : "";

    recipeHtml = `
      <div class="section-title">Ingredients</div>
      <div class="card">${ingredients}</div>
      <div class="section-title">Prep</div>
      <div class="card">${prep}</div>
      ${link ? `<div class="card">${link}</div>` : ""}
    `;
  }

  bodyEl.innerHTML = cookLine + recipeHtml;
})();
