// Smoke test for the Alex menu site. Serves the repo root as static files, then checks each
// page against fixtures/sample-snapshot.json — served in place of data/snapshot.json so this
// test stays stable no matter what's currently published to data/snapshot.json for real.
// Run: node test/smoke.mjs   (serves on an ephemeral port itself, no separate server needed)
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".txt": "text/plain" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  if (p === "/data/snapshot.json") p = "/fixtures/sample-snapshot.json";
  // The fixture's recipe.photos paths point at "images/..." like a real publish would — serve
  // those from fixtures/images/ so the test doesn't need a real dated images/ folder checked in.
  if (p.startsWith("/images/")) p = "/fixtures" + p;
  const full = path.join(ROOT, p);
  try {
    const st = await stat(full);
    if (st.isFile()) {
      const ext = path.extname(full);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(await readFile(full));
      return;
    }
  } catch {}
  res.writeHead(404);
  res.end("not found");
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://localhost:${port}`;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}`); }
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
// iPhone-first site — test at a phone viewport (iPhone SE/mini width) so tap-target and
// no-horizontal-scroll checks mean something.
const page = await browser.newPage({ viewport: { width: 375, height: 700 } });

// 1. Index page: this week's meals render from the fixture.
await page.goto(`${base}/index.html`);
await page.waitForSelector(".meal-card");
check("index shows Weeknight Fajitas", (await page.content()).includes("Weeknight Fajitas"));
check("index shows cook name Jordan", (await page.content()).includes("Jordan"));
check("index shows multi-day split meal on Sun and Wed", await page.locator(".day-label").allTextContents().then(labels => labels.includes("Sun") && labels.includes("Wed")));
check("index shows no-recipe meal with Added badge", (await page.content()).includes("Taco Night") && (await page.content()).includes("Added"));
check("updated line is populated", !(await page.locator("#updated").textContent()).includes("Loading"));

// 1b. Recipe photos (work order 2026-11-04): a meal whose recipe has a photo shows a small
// thumbnail on its card; a meal with no photo shows no empty box and no broken-image icon.
const fajitasPhoto = page.locator('.meal-card:has-text("Weeknight Fajitas") .meal-photo-small');
check("meal card with a photo shows the small thumbnail", await fajitasPhoto.count() === 1);
check("photo thumbnail uses the recipe name as its accessible description", await fajitasPhoto.getAttribute("alt") === "Weeknight Fajitas");
check("photo thumbnail loads lazily", await fajitasPhoto.getAttribute("loading") === "lazy");
await fajitasPhoto.waitFor({ state: "attached" });
check("photo thumbnail actually loaded (not broken)", await fajitasPhoto.evaluate((img) => img.complete && img.naturalWidth > 0));
const soupCard = page.locator('.meal-card:has-text("Leftover Soup Night")').first();
check("meal card with no photo shows no thumbnail at all", await soupCard.locator(".meal-photo-small").count() === 0);

// 1c. "Print this week" is the very last element on the page — nothing after it except the
// (always display:none on screen) print sheet, and nothing for it up near the top anymore.
const lastTwoIds = await page.evaluate(() =>
  Array.from(document.body.children).filter((el) => el.tagName !== "SCRIPT").slice(-2).map((el) => el.id || el.tagName));
check("print button is the second-to-last element, with only the hidden print sheet after it", lastTwoIds[0] === "print-btn" && lastTwoIds[1] === "print-sheet");
const mainChildren = await page.evaluate(() => Array.from(document.querySelector("main").children).map((el) => el.id || el.className));
check("print button is no longer inside <main> near the top", !mainChildren.some((c) => String(c).includes("print-btn")));

// 2. Week picker switches weeks.
const pickerButtons = page.locator(".week-picker button");
check("week picker has 2 weeks", await pickerButtons.count() === 2);
await pickerButtons.nth(1).click();
await page.waitForTimeout(100);
check("switching week shows week-of-Nov-8 meal", (await page.content()).includes("Weeknight Fajitas") && (await page.locator(".day-label").count()) === 1);

// 3. Meal detail: normal meal with ingredients/prep/cook steps/links, all shown as checklists,
// Ingredients-Prep-Cook in that order, matching the app's section order.
await page.goto(`${base}/meal.html?id=m1-Tue`);
await page.waitForSelector(".card");
check("meal detail shows ingredients", (await page.content()).includes("Bell pepper"));
check("meal detail shows prep", (await page.content()).includes("Roast fajita veg"));
check("meal detail shows cook steps", (await page.content()).includes("Heat a large skillet"));
check("meal detail shows both source links (legacy + plural sources)", (await page.locator("a.recipe-link").count()) === 2);
check("second source link shows its label", (await page.content()).includes("Video version"));
const sectionTitles = await page.locator(".section-title").allTextContents();
check("sections appear in order: Ingredients, Prep, Cook", sectionTitles.join(",") === "Ingredients,Prep,Cook");
check("meal detail shows the larger medium photo at the top", await page.locator(".meal-photo-medium").count() === 1);
check("medium photo appears before the Ingredients section (top of page)",
  await page.evaluate(() => {
    const photo = document.querySelector(".meal-photo-medium");
    const firstSection = document.querySelector(".section-title");
    return !!(photo && firstSection) && photo.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING;
  }));
check("cooking steps keep their numbers and order",
  (await page.locator(".check-row .step-num").allTextContents()).join(" ") === "1. 2. 3. 4.");

// 3b. Ingredients/Prep/Cook render as tappable checkbox rows, not plain bullets. Checking one
// strikes it through; after a reload (simulating leaving and coming back) the check survives via
// localStorage, keyed by week + meal so it doesn't leak into a different meal/week.
const firstRow = page.locator(".check-row").first();
check("checklist row starts unchecked", !(await firstRow.getAttribute("class")).includes("checked"));
await firstRow.click();
check("row shows checked after tap", (await firstRow.getAttribute("class")).includes("checked"));
await page.reload();
await page.waitForSelector(".check-row");
check("check survives a reload", (await page.locator(".check-row").first().getAttribute("class")).includes("checked"));
// A different meal/week must not see this meal's checks.
await page.goto(`${base}/meal.html?id=m4-Mon`);
await page.waitForSelector(".check-row");
check("a different meal's checklist starts clean (checks are keyed per week+meal)",
  !(await page.locator(".check-row").first().getAttribute("class")).includes("checked"));
await page.goto(`${base}/meal.html?id=m1-Tue`);
await page.waitForSelector(".check-row");

// 3c. "Clear checks" asks first, then unchecks everything for this meal only.
page.once("dialog", (d) => d.dismiss());
await page.click("#clear-checks");
await page.waitForTimeout(50);
check("dismissing the confirm leaves the check in place", (await page.locator(".check-row").first().getAttribute("class")).includes("checked"));
page.once("dialog", (d) => d.accept());
await page.click("#clear-checks");
await page.waitForTimeout(50);
const anyChecked = await page.locator(".check-row.checked").count();
check("confirming \"Clear checks\" unchecks everything for this meal", anyChecked === 0);
await page.reload();
await page.waitForSelector(".check-row");
check("cleared state also survives a reload (not just in-memory)", (await page.locator(".check-row.checked").count()) === 0);

// 3d. Tap targets are full-width rows (not just a tiny box) and nothing causes sideways scroll
// at a phone viewport.
const rowBox = await firstRow.boundingBox();
check("checklist row is a comfortably large tap target (>= 44px tall)", rowBox.height >= 44);
check("no horizontal scrolling on meal detail at phone width",
  await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

// 4. Meal detail: meal with no recipe.
await page.goto(`${base}/meal.html?id=m3-Fri`);
await page.waitForSelector(".card");
check("no-recipe meal shows graceful message", (await page.content()).includes("No recipe linked"));

// 5. Meal detail: recipe with no sourceUrl and no cooking steps yet — ingredients still show,
// no link, and no empty Cook/Prep headers (hidden entirely, not shown empty).
await page.goto(`${base}/meal.html?id=m2-Sun`);
await page.waitForSelector(".card");
check("no-sourceUrl meal shows ingredients", (await page.content()).includes("Egg noodles"));
check("meal with no photo shows no medium-photo element at all", await page.locator(".meal-photo-medium").count() === 0);
check("no-sourceUrl meal has no recipe link", (await page.locator("a.recipe-link").count()) === 0);
check("meal with no prep tasks has no Prep section header", !(await page.locator(".section-title").allTextContents()).includes("Prep"));
check("meal with no cooking steps has no Cook section header", !(await page.locator(".section-title").allTextContents()).includes("Cook"));

// 5b. A meal whose recipe has never had steps/sources published (older/flag-off snapshot shape)
// still renders fine from the single legacy sourceUrl, with no Cook section.
await page.goto(`${base}/meal.html?id=m4-Mon`);
await page.waitForSelector(".card");
check("legacy-shape recipe (no steps/sources fields) still shows its one source link", (await page.locator("a.recipe-link").count()) === 1);
check("legacy-shape recipe has no Cook section", !(await page.locator(".section-title").allTextContents()).includes("Cook"));
// This recipe object has no "photos" field at all (an older/schemaVersion-1-shaped snapshot
// never will either) — confirms a snapshot with no photo fields still loads and just shows none.
check("a recipe with no photos field at all renders with no photo and no error", await page.locator(".meal-photo-medium").count() === 0);

// 6. Meal detail: unknown id handled gracefully.
await page.goto(`${base}/meal.html?id=does-not-exist`);
await page.waitForSelector(".empty");
check("unknown meal id shows not-found state", (await page.content()).includes("isn't in the current menu"));

// 7. Requests page: shows both New and Added statuses, plus form link.
await page.goto(`${base}/requests.html`);
await page.waitForSelector(".card");
check("requests page shows Added status", (await page.content()).includes("status-req added"));
check("requests page shows New status", (await page.content()).includes("status-req new"));
check("requests page links to the form", (await page.locator('a[href*="forms.gle"]').count()) >= 1);

// 7b. Roasting guide: rows render with names, temps, times, and a tappable link where present.
await page.goto(`${base}/roasting.html`);
await page.waitForSelector(".roasting-table");
check("roasting page shows Carrots row", (await page.content()).includes("Carrots") && (await page.content()).includes("425°F"));
check("roasting page shows a row with no link as plain text", (await page.content()).includes("Broccoli") && (await page.locator('.roasting-table a:has-text("Broccoli")').count()) === 0);
check("roasting page links Carrots to its source", (await page.locator('.roasting-table a:has-text("Carrots")').count()) === 1);
check("roasting page never shows notes (not in the snapshot schema)", !(await page.content()).toLowerCase().includes("notes"));
check("roasting nav tab is active on roasting.html", await page.locator('nav.tabs a[data-tab="roasting"]').getAttribute("class") === "active");

// 8. Privacy: no disallowed fields ever present in rendered HTML across pages checked.
const disallowed = ["allergy", "caution", "cost", "household"];
let leaked = false;
for (const url of ["/index.html", "/meal.html?id=m1-Tue", "/requests.html", "/roasting.html"]) {
  await page.goto(`${base}${url}`);
  const html = (await page.content()).toLowerCase();
  if (disallowed.some((w) => html.includes(w))) leaked = true;
}
check("no disallowed fields leak into rendered HTML", !leaked);
await page.goto(`${base}/meal.html?id=m1-Tue`);
check("meal detail's photo src is a plain relative path, never a data: URI", (await page.locator(".meal-photo-medium").getAttribute("src")).startsWith("images/"));

// 9. Print sheet builds without crashing and contains the week's meals.
await page.goto(`${base}/index.html`);
await page.waitForSelector(".meal-card");
await page.click("#print-btn");
await page.waitForTimeout(100);
check("print sheet populated", (await page.locator("#print-sheet").innerHTML()).includes("Weeknight Fajitas"));

// 9b. Everything except #print-sheet is actually removed from the print layout (display:none),
// not just invisible. Checking only #print-sheet's HTML content (9 above) missed the real bug:
// the old CSS used visibility:hidden on the rest of the page, which keeps hidden elements in the
// layout (their computed `display` stays block/flex) — so the page still grows taller than one
// sheet even though only the print-sheet content is visible, producing a second, blank page. This
// checks actual computed style, not just height, so it isn't sensitive to how much content a given
// fixture happens to have.
await page.emulateMedia({ media: "print" });
const otherDisplays = await page.evaluate(() =>
  Array.from(document.body.children)
    .filter(el => el.id !== "print-sheet" && el.tagName !== "SCRIPT")
    .map(el => getComputedStyle(el).display));
check("everything but #print-sheet is display:none when printing", otherDisplays.every(d => d === "none"));
await page.emulateMedia({ media: "screen" });

// 10. noindex + robots present.
await page.goto(`${base}/index.html`);
check("noindex meta present", (await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow");
const robotsRes = await page.goto(`${base}/robots.txt`);
check("robots.txt disallows all", (await robotsRes.text()).includes("Disallow: /"));

await browser.close();
server.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
