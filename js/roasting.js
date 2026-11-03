(async function () {
  const updatedEl = document.getElementById("updated");
  const bodyEl = document.getElementById("roasting-body");

  let snapshot;
  try {
    snapshot = await loadSnapshot();
  } catch (e) {
    bodyEl.innerHTML = '<div class="empty">Couldn\'t load the roasting guide. Try reloading.</div>';
    updatedEl.textContent = "";
    return;
  }

  renderUpdated(snapshot, updatedEl);

  // Batch E: `roasting` is name/temp/time/link only — notes are never included in a published
  // snapshot (Paul hasn't said to show them on the site), and the array is simply absent or empty
  // on any snapshot published before this batch, or with no rows, or with the app's "Roasting
  // table" feature off. Either way: no rows, no section.
  const rows = snapshot.roasting || [];
  if (rows.length === 0) {
    bodyEl.innerHTML = '<div class="empty">No roasting times published yet.</div>';
    return;
  }

  bodyEl.innerHTML = `
    <div class="card" style="padding:0; overflow:hidden;">
      <table class="roasting-table">
        <thead><tr><th>Name</th><th>Temp</th><th>Time</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${r.link
                ? `<a href="${encodeURI(r.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.name)} &rarr;</a>`
                : escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.temp || "")}</td>
              <td>${escapeHtml(r.time || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
})();
