(async function () {
  const updatedEl = document.getElementById("updated");
  const bodyEl = document.getElementById("menu-body");
  const pickerEl = document.getElementById("week-picker");
  const printBtn = document.getElementById("print-btn");

  let snapshot;
  try {
    snapshot = await loadSnapshot();
  } catch (e) {
    bodyEl.innerHTML = '<div class="empty">Couldn\'t load the menu. Try reloading.</div>';
    updatedEl.textContent = "";
    return;
  }

  renderUpdated(snapshot, updatedEl);

  const weeks = snapshot.weeks || [];
  const current = todaySunday();
  let selected = weeks.find((w) => w.weekId === current) ? current
    : (weeks[0] ? weeks[0].weekId : null);

  function renderPicker() {
    if (weeks.length === 0) { pickerEl.innerHTML = ""; return; }
    pickerEl.innerHTML = weeks.map((w) => {
      const isCurrent = w.weekId === current;
      const label = isCurrent ? "This week" : formatWeekLabel(w.weekId, false).replace("Week of ", "");
      const active = w.weekId === selected ? "active" : "";
      return `<button class="${active}" data-week="${w.weekId}">${escapeHtml(label)}</button>`;
    }).join("");
    pickerEl.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => { selected = b.dataset.week; renderPicker(); renderMenu(); });
    });
  }

  function renderMenu() {
    const week = weeks.find((w) => w.weekId === selected);
    if (!week) {
      bodyEl.innerHTML = '<div class="empty">No menu has been planned yet for an upcoming week.</div>';
      return;
    }
    const isCurrent = week.weekId === current;
    const groups = mealsByDay(week);
    if (groups.length === 0) {
      bodyEl.innerHTML = '<div class="empty">Nothing planned yet for this week.</div>';
      return;
    }
    bodyEl.innerHTML = `<div class="section-title">${escapeHtml(formatWeekLabel(week.weekId, isCurrent))}</div>` +
      groups.map((g) => `
        <div class="day-group">
          <div class="day-label">${escapeHtml(g.day)}</div>
          ${g.meals.map(mealCardHtml).join("")}
        </div>
      `).join("");
  }

  function mealCardHtml(m) {
    const cook = m.cookName ? `Cooking: ${escapeHtml(m.cookName)}` : "No cook assigned yet";
    return `
      <a class="meal-card" href="meal.html?id=${encodeURIComponent(m.id)}">
        <div class="meal-name">${escapeHtml(m.name)}${statusBadge(m.status)}</div>
        <div class="meal-meta">${cook}</div>
      </a>
    `;
  }

  renderPicker();
  renderMenu();

  printBtn.addEventListener("click", () => {
    const week = weeks.find((w) => w.weekId === selected);
    document.getElementById("print-sheet").innerHTML = buildPrintSheet(snapshot, week);
    window.print();
  });

  function buildPrintSheet(snapshot, week) {
    if (!week) return "";
    const groups = mealsByDay(week);
    const rows = groups.map((g) => g.meals.map((m) => `
      <tr>
        <td>${escapeHtml(g.day)}</td>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.cookName || "—")}</td>
      </tr>
    `).join("")).join("");
    return `
      <h1>Eating In — ${escapeHtml(formatWeekLabel(week.weekId, week.weekId === current))}</h1>
      <div class="pupdated">Last updated: ${escapeHtml(formatPublishedAt(snapshot.publishedAt))}</div>
      <table>
        <thead><tr><th>Day</th><th>Meal</th><th>Cook</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
})();
