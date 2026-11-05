// The guard. Runs as this site's Vercel build command (see vercel.json) before every deploy.
// Picks the newest file in snapshots/ (by filename, which is always date-stamped — see
// docs/publish-shortcut.md), checks it's valid and clean, and writes it to data/snapshot.json,
// the file every page actually fetches. Exits non-zero on any problem, which fails the Vercel
// build and leaves the previous deployment live — a bad publish can never reach Alex.
//
// Also runnable directly for a dry run: node scripts/build-snapshot.mjs --check-only <file>
import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOTS_DIR = path.join(ROOT, "snapshots");
const OUT_FILE = path.join(ROOT, "data", "snapshot.json");

// Never allowed anywhere in a snapshot, at any depth. Checked by key name, case-insensitive,
// substring match, so "cookNotes" or "allergyList" are caught too, not just exact names.
const NEVER_SHOW_KEY_SUBSTRINGS = [
  "allerg", "caution", "cost", "note", "household", "people", "person",
  "pdf", "photo", "image", "cooklog",
];

// Work order 2026-11-04 (Alex site photos): one narrow, deliberate exception to the "photo"
// substring block above — a recipe's `photos` field, but *only* when its value is exactly
// `{small, medium}` (or either/both null) and each present value is a plain relative path
// starting with "images/", with no "..", no ":" (rules out "data:"/"http:"/absolute URLs) and
// no backslash. This still lets the file-path strings travel; it never lets an actual photo,
// a data: URI, or an external image URL through. Every other "photo"/"image"-named key (an
// embedded photo object, a raw PDF, anything else on the list above) is still blocked exactly
// as before — this function is checked before the general key-substring scan ever sees the
// `photos` key, so matching here is the only way a "photo"-named key can pass at all.
const SAFE_RELATIVE_IMAGE_PATH = /^images\/[^:\\]+$/;
function isAllowedPhotosField(value) {
  if (value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.some((k) => k !== "small" && k !== "medium")) return false;
  return ["small", "medium"].every((k) => {
    const v = value[k];
    if (v === undefined || v === null) return true;
    return typeof v === "string" && SAFE_RELATIVE_IMAGE_PATH.test(v) && !v.includes("..");
  });
}

const REQUIRED_TOP_LEVEL = ["schemaVersion", "publishedAt", "weeks"];

export function findForbiddenKeys(value, pathSoFar = "") {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findForbiddenKeys(v, `${pathSoFar}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key === "photos") {
        if (!isAllowedPhotosField(v)) hits.push(`${pathSoFar}.${key} (not an allowed {small, medium} relative-path shape)`);
        continue; // never recurse into an allowed photos object — nothing else to check inside it
      }
      const lower = key.toLowerCase();
      if (NEVER_SHOW_KEY_SUBSTRINGS.some((bad) => lower.includes(bad))) {
        hits.push(`${pathSoFar}.${key}`);
      }
      hits.push(...findForbiddenKeys(v, `${pathSoFar}.${key}`));
    }
  }
  return hits;
}

export function validateSnapshot(snapshot) {
  const problems = [];
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in snapshot)) problems.push(`missing required field "${field}"`);
  }
  if (snapshot.weeks && !Array.isArray(snapshot.weeks)) {
    problems.push(`"weeks" must be an array`);
  }
  const forbidden = findForbiddenKeys(snapshot);
  if (forbidden.length) {
    problems.push(
      `contains fields that must never reach the Alex site: ${forbidden.join(", ")}`
    );
  }
  return problems;
}

export function newestSnapshotFile(filenames) {
  // Filenames are snapshot-YYYY-MM-DD-HHMM.json — sorting the strings sorts the dates.
  const candidates = filenames.filter((f) => f.endsWith(".json")).sort();
  return candidates.length ? candidates[candidates.length - 1] : null;
}

async function main() {
  const checkOnlyIdx = process.argv.indexOf("--check-only");
  const checkOnlyFile = checkOnlyIdx !== -1 ? process.argv[checkOnlyIdx + 1] : null;

  let targetPath, label;
  if (checkOnlyFile) {
    targetPath = path.resolve(checkOnlyFile);
    label = checkOnlyFile;
  } else {
    const files = await readdir(SNAPSHOTS_DIR).catch(() => []);
    const newest = newestSnapshotFile(files);
    if (!newest) {
      console.error(
        `BUILD FAILED: no snapshot files found in snapshots/. Nothing to publish — the previous deploy stays live.`
      );
      process.exit(1);
    }
    targetPath = path.join(SNAPSHOTS_DIR, newest);
    label = newest;
  }

  let raw;
  try {
    raw = await readFile(targetPath, "utf8");
  } catch (e) {
    console.error(`BUILD FAILED: couldn't read ${label}: ${e.message}`);
    process.exit(1);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (e) {
    console.error(`BUILD FAILED: ${label} is not valid JSON (${e.message}). Fix the file and republish.`);
    process.exit(1);
  }

  const problems = validateSnapshot(snapshot);
  if (problems.length) {
    console.error(`BUILD FAILED: ${label} did not pass the safety check:`);
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error(`Nothing was published. The site keeps showing the previous good snapshot.`);
    process.exit(1);
  }

  if (!checkOnlyFile) {
    await writeFile(OUT_FILE, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    console.log(`OK: ${label} passed the safety check and is now data/snapshot.json.`);
  } else {
    console.log(`OK: ${label} passed the safety check.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
