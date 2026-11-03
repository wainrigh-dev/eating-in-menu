// Smoke test for the Alex menu site. Serves the repo root as static files, then checks each
// page against fixtures/sample-snapshot.json (copied to data/snapshot.json for local dev).
// Run: node test/smoke.mjs   (serves on an ephemeral port itself, no separate server needed)
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".txt": "text/plain" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
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
const page = await browser.newPage();

// 1. Index page: this week's meals render from the fixture.
await page.goto(`${base}/index.html`);
await page.waitForSelector(".meal-card");
check("index shows Weeknight Fajitas", (await page.content()).includes("Weeknight Fajitas"));
check("index shows cook name Jordan", (await page.content()).includes("Jordan"));
check("index shows multi-day split meal on Sun and Wed", await page.locator(".day-label").allTextContents().then(labels => labels.includes("Sun") && labels.includes("Wed")));
check("index shows no-recipe meal with Added badge", (await page.content()).includes("Taco Night") && (await page.content()).includes("Added"));
check("updated line is populated", !(await page.locator("#updated").textContent()).includes("Loading"));

// 2. Week picker switches weeks.
const pickerButtons = page.locator(".week-picker button");
check("week picker has 2 weeks", await pickerButtons.count() === 2);
await pickerButtons.nth(1).click();
await page.waitForTimeout(100);
check("switching week shows week-of-Nov-8 meal", (await page.content()).includes("Weeknight Fajitas") && (await page.locator(".day-label").count()) === 1);

// 3. Meal detail: normal meal with ingredients/prep/link.
await page.goto(`${base}/meal.html?id=m1-Tue`);
await page.waitForSelector(".card");
check("meal detail shows ingredients", (await page.content()).includes("Bell pepper"));
check("meal detail shows prep", (await page.content()).includes("Roast fajita veg"));
check("meal detail shows recipe link", (await page.locator("a.recipe-link").count()) === 1);

// 4. Meal detail: meal with no recipe.
await page.goto(`${base}/meal.html?id=m3-Fri`);
await page.waitForSelector(".card");
check("no-recipe meal shows graceful message", (await page.content()).includes("No recipe linked"));

// 5. Meal detail: recipe with no sourceUrl still shows ingredients/prep, no link.
await page.goto(`${base}/meal.html?id=m2-Sun`);
await page.waitForSelector(".card");
check("no-sourceUrl meal shows ingredients", (await page.content()).includes("Egg noodles"));
check("no-sourceUrl meal has no recipe link", (await page.locator("a.recipe-link").count()) === 0);

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

// 8. Privacy: no disallowed fields ever present in rendered HTML across pages checked.
const disallowed = ["allergy", "caution", "cost", "household"];
let leaked = false;
for (const url of ["/index.html", "/meal.html?id=m1-Tue", "/requests.html"]) {
  await page.goto(`${base}${url}`);
  const html = (await page.content()).toLowerCase();
  if (disallowed.some((w) => html.includes(w))) leaked = true;
}
check("no disallowed fields leak into rendered HTML", !leaked);

// 9. Print sheet builds without crashing and contains the week's meals.
await page.goto(`${base}/index.html`);
await page.waitForSelector(".meal-card");
await page.click("#print-btn");
await page.waitForTimeout(100);
check("print sheet populated", (await page.locator("#print-sheet").innerHTML()).includes("Weeknight Fajitas"));

// 10. noindex + robots present.
await page.goto(`${base}/index.html`);
check("noindex meta present", (await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow");
const robotsRes = await page.goto(`${base}/robots.txt`);
check("robots.txt disallows all", (await robotsRes.text()).includes("Disallow: /"));

await browser.close();
server.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
