// Smoke test for scripts/unpack-publish-bundle.mjs (the one-file-download fix, Nov 5 2026
// follow-up to work-orders/2026-11-04-alex-site-photos-and-print-bottom.md). No browser needed.
// Run: node test/smoke-unpack-bundle.mjs
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { collectPhotoPaths, isBundleShape, unpackBundle } from "../scripts/unpack-publish-bundle.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "unpack-publish-bundle.mjs");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}`); }
}

const SNAPSHOT = {
  schemaVersion: 2,
  publishedAt: "2026-11-05T13:22:44.069Z",
  weeks: [{
    weekId: "2026-11-08",
    meals: [{
      id: "m1", name: "Test meal", day: "Tue", cookName: null, status: null,
      recipe: {
        name: "Test meal", sourceUrl: null, ingredients: [], prepTasks: [],
        photos: { small: "images/2026-11-05-13-22/img-r1-small.jpg", medium: "images/2026-11-05-13-22/img-r1-medium.jpg" },
      },
    }],
  }],
  roasting: [],
  requests: [],
};
const TINY_JPEG_B64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLFRgRDg0aHRwfGhodHyAlJiUgJCMkJigpLjMvNjc1NSA5PUM9QkZJTFJQUFBQVFVVWFhbW11eYmJmaGpramtubnBxcnJ0dnd4eXt8fYCBgoOEhIaGh4iJiYqKjI2OkJCRkpOUlZaXmJiZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAbgA/9k=";

check("isBundleShape: true for {snapshot, photos}", isBundleShape({ snapshot: SNAPSHOT, photos: {} }));
check("isBundleShape: false for a plain snapshot", !isBundleShape(SNAPSHOT));
check("isBundleShape: false for null/non-object", !isBundleShape(null) && !isBundleShape("hi") && !isBundleShape([1, 2]));

check("collectPhotoPaths finds both small and medium", (() => {
  const paths = collectPhotoPaths(SNAPSHOT);
  return paths.length === 2 && paths.includes("images/2026-11-05-13-22/img-r1-small.jpg") && paths.includes("images/2026-11-05-13-22/img-r1-medium.jpg");
})());
check("collectPhotoPaths skips a meal with recipe.photos: null", collectPhotoPaths({
  weeks: [{ meals: [{ recipe: { photos: null } }] }],
}).length === 0);

// --- unpackBundle (pure function, writes under a given root) ---
const tmp = await mkdtemp(path.join(tmpdir(), "alex-unpack-"));
try {
  const bundle = {
    snapshot: SNAPSHOT,
    photos: {
      "img-r1-small.jpg": TINY_JPEG_B64,
      "img-r1-medium.jpg": TINY_JPEG_B64,
      "img-orphan-small.jpg": TINY_JPEG_B64,
    },
  };
  const result = await unpackBundle(bundle, { root: tmp });
  check("unpackBundle writes 2 photo files (small + medium)", result.written === 2);
  check("unpackBundle flags the unreferenced bundle entry as orphaned", result.orphanedBytes.length === 1 && result.orphanedBytes[0] === "img-orphan-small.jpg");
  check("unpackBundle reports no missing bytes when both are provided", result.missingBytes.length === 0);
  const writtenSmall = await readFile(path.join(tmp, "images/2026-11-05-13-22/img-r1-small.jpg"));
  check("the written file lands at the EXACT relative path the snapshot names", writtenSmall.length > 0);
  check("the written bytes decode back to the original base64", writtenSmall.toString("base64") === TINY_JPEG_B64);

  // A snapshot referencing a photo path with no matching bytes in the bundle.
  const partialBundle = { snapshot: SNAPSHOT, photos: {} };
  const partialResult = await unpackBundle(partialBundle, { root: tmp });
  check("a photo path with no matching bytes is reported as missing, not written", partialResult.written === 0 && partialResult.missingBytes.length === 2);

  // --- End-to-end CLI ---
  const bundleFile = path.join(tmp, "bundle.json");
  await writeFile(bundleFile, JSON.stringify(bundle));
  const outSnapshot = path.join(tmp, "unpacked-snapshot.json");
  const { stdout } = await run("node", [SCRIPT, bundleFile, "--out-snapshot", outSnapshot, "--root", tmp]);
  check("CLI run reports success", stdout.includes("OK: unpacked"));
  check("CLI run reports the photo count", stdout.includes("2 photo file(s) written"));
  const unpacked = JSON.parse(await readFile(outSnapshot, "utf8"));
  check("the snapshot written by the CLI matches the one inside the bundle", JSON.stringify(unpacked) === JSON.stringify(SNAPSHOT));

  // CLI run against a plain (non-bundle) snapshot file should fail clearly, not guess.
  const plainFile = path.join(tmp, "plain.json");
  await writeFile(plainFile, JSON.stringify(SNAPSHOT));
  let threw = false, stderrText = "";
  try {
    await run("node", [SCRIPT, plainFile, "--out-snapshot", path.join(tmp, "x.json")], { cwd: tmp });
  } catch (e) { threw = true; stderrText = e.stderr || ""; }
  check("CLI refuses a plain (non-bundle) snapshot file rather than silently doing nothing useful", threw && stderrText.includes("doesn't look like a publish bundle"));
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
