(async function () {
  const updatedEl = document.getElementById("updated");
  const bodyEl = document.getElementById("requests-body");

  let snapshot;
  try {
    snapshot = await loadSnapshot();
  } catch (e) {
    bodyEl.innerHTML = '<div class="empty">Couldn\'t load requests. Try reloading.</div>';
    updatedEl.textContent = "";
    return;
  }

  renderUpdated(snapshot, updatedEl);

  const requests = snapshot.requests || [];
  if (requests.length === 0) {
    bodyEl.innerHTML = '<div class="empty">No requests yet. Anything you submit on the form will show up here after the next update.</div>';
    return;
  }

  bodyEl.innerHTML = requests.map((r) => {
    const kindLabel = r.kind === "ingredient" ? "Ingredient" : "Meal";
    const weekLine = r.week ? `<div class="meal-meta">For the week of ${escapeHtml(r.week)}</div>` : "";
    const statusCls = (r.status || "new").toLowerCase().replace(/\s+/g, "");
    return `
      <div class="card">
        <div class="meal-name">${kindLabel}: ${escapeHtml(r.note || "")}
          <span class="status-req ${statusCls}">${escapeHtml(r.status || "New")}</span>
        </div>
        ${weekLine}
      </div>
    `;
  }).join("");
})();
