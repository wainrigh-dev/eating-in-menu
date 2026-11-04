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
