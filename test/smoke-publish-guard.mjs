// Smoke test for the publish guard (scripts/build-snapshot.mjs) — change 1 and 2 of
// work-orders/2026-11-03-publish-shortcut.md. No browser needed, just the guard's own logic.
// Run: node test/smoke-publish-guard.mjs
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { findForbiddenKeys, validateSnapshot, newestSnapshotFile } from "../scripts/build-snapshot.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "build-snapshot.mjs");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}`); }
}

const GOOD = {
  schemaVersion: 1,
  publishedAt: "2026-11-04T00:00:00Z",
  weeks: [{ weekId: "2026-11-01", meals: [{ id: "m1-Tue", name: "Test", day: "Tue", cookName: null, recipe: null }] }],
  roasting: [],
  requests: [],
};

// --- Pure function checks ---
check("newestSnapshotFile picks the lexically-latest dated filename",
  newestSnapshotFile(["snapshot-2026-11-01-0900.json", "snapshot-2026-11-04-0341.json", "snapshot-2026-11-02-1200.json"])
    === "snapshot-2026-11-04-0341.json");

check("newestSnapshotFile returns null for an empty list", newestSnapshotFile([]) === null);

check("validateSnapshot passes a clean snapshot", validateSnapshot(GOOD).length === 0);

check("validateSnapshot flags a missing required field",
  validateSnapshot({ weeks: [] }).some((p) => p.includes("publishedAt")));

for (const badKey of ["notes", "allergy", "caution", "cost", "household", "photo", "pdf", "cookLog"]) {
  const bad = JSON.parse(JSON.stringify(GOOD));
  bad.weeks[0].meals[0][badKey] = "should never be here";
  check(`validateSnapshot rejects a "${badKey}" field at meal level`,
    validateSnapshot(bad).some((p) => p.includes(badKey)));
}

check("findForbiddenKeys catches a nested never-show field",
  findForbiddenKeys({ weeks: [{ meals: [{ recipe: { ingredients: [{ allergyWarning: "nuts" }] } }] }] }).length > 0);

// --- Work order 2026-11-04 (Alex site photos): the narrow recipe.photos exception ---
const withPhotos = JSON.parse(JSON.stringify(GOOD));
withPhotos.weeks[0].meals[0].recipe = {
  name: "Test", photos: { small: "images/2026-11-05-1200/img-r1-small.jpg", medium: "images/2026-11-05-1200/img-r1-medium.jpg" },
};
check("a valid recipe.photos {small, medium} relative-path pair passes", validateSnapshot(withPhotos).length === 0);

const nullPhotos = JSON.parse(JSON.stringify(GOOD));
nullPhotos.weeks[0].meals[0].recipe = { name: "Test", photos: null };
check("recipe.photos: null (no photo for this recipe) passes", validateSnapshot(nullPhotos).length === 0);

const dataUriPhoto = JSON.parse(JSON.stringify(withPhotos));
dataUriPhoto.weeks[0].meals[0].recipe.photos.small = "data:image/jpeg;base64,AAAA";
check("an embedded data: URI in recipe.photos.small is rejected", validateSnapshot(dataUriPhoto).length > 0);

const externalUrlPhoto = JSON.parse(JSON.stringify(withPhotos));
externalUrlPhoto.weeks[0].meals[0].recipe.photos.medium = "https://example.com/photo.jpg";
check("an external URL in recipe.photos.medium is rejected", validateSnapshot(externalUrlPhoto).length > 0);

const traversalPhoto = JSON.parse(JSON.stringify(withPhotos));
traversalPhoto.weeks[0].meals[0].recipe.photos.small = "images/../../etc/passwd";
check("a path-traversal attempt in recipe.photos.small is rejected", validateSnapshot(traversalPhoto).length > 0);

const extraKeyPhoto = JSON.parse(JSON.stringify(withPhotos));
extraKeyPhoto.weeks[0].meals[0].recipe.photos.large = "images/2026-11-05-1200/img-r1-large.jpg";
check("a photos object with an extra key beyond small/medium is rejected", validateSnapshot(extraKeyPhoto).length > 0);

const legacyPhotoObj = JSON.parse(JSON.stringify(GOOD));
legacyPhotoObj.weeks[0].meals[0].recipe = { name: "Test", photo: { id: "x", url: "https://internal/x" } };
check("the app's own singular recipe.photo object is still always rejected", validateSnapshot(legacyPhotoObj).length > 0);

// --- End-to-end: run the actual script against a temp snapshots/ dir ---
const tmp = await mkdtemp(path.join(tmpdir(), "alex-guard-"));
try {
  const goodFile = path.join(tmp, "good.json");
  const badFile = path.join(tmp, "bad.json");
  const invalidJsonFile = path.join(tmp, "invalid.json");
  await writeFile(goodFile, JSON.stringify(GOOD));
  const bad = JSON.parse(JSON.stringify(GOOD));
  bad.weeks[0].meals[0].notes = "leak";
  await writeFile(badFile, JSON.stringify(bad));
  await writeFile(invalidJsonFile, "{not valid");

  let threw = false;
  try { await run("node", [SCRIPT, "--check-only", goodFile]); } catch { threw = true; }
  check("script exits 0 on a good snapshot (--check-only)", !threw);

  threw = false;
  try { await run("node", [SCRIPT, "--check-only", badFile]); } catch (e) { threw = true; }
  check("script exits non-zero on a bad snapshot (--check-only)", threw);

  threw = false;
  try { await run("node", [SCRIPT, "--check-only", invalidJsonFile]); } catch (e) { threw = true; }
  check("script exits non-zero on invalid JSON (--check-only)", threw);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
