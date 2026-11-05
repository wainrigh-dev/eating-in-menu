// Unpacks a "Publish to Alex" photo bundle (app v2.23+) into the plain snapshot shape plus the
// individual photo files it references, so the rest of the publish flow (build-snapshot.mjs's
// guard, snapshots/, images/) never has to know bundles exist.
//
// Why this exists: a publish WITH photos used to save the snapshot plus two JPEGs per recipe as
// separate downloads from one tap -- up to 5 files from one gesture. Real phone browsers (Safari
// especially) silently drop most automatic downloads past the first one or two triggered that
// way, with no error shown -- that's exactly what happened to Paul on Nov 5 2026 (snapshot
// saved, all four photo files vanished). App v2.23 fixed this by saving exactly ONE file when
// there are photos: a bundle shaped `{ snapshot, photos: { "<basename>.jpg": "<base64>", ... } }`
// instead of the plain snapshot. A publish with NO photos still saves the plain snapshot
// directly, unaffected -- this script is only for the bundle shape.
//
// Usage: node scripts/unpack-publish-bundle.mjs <bundle-file> --out-snapshot <path>
// Writes the unwrapped snapshot to --out-snapshot, and each photo under images/<dated folder>/
// at the exact relative path its own snapshot.recipe.photos.small/medium field already names --
// never re-derived here, so what's written on disk always matches what the snapshot points at.
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function collectPhotoPaths(snapshot) {
  const paths = [];
  for (const w of snapshot.weeks || []) {
    for (const m of w.meals || []) {
      const p = m.recipe && m.recipe.photos;
      if (!p) continue;
      if (p.small) paths.push(p.small);
      if (p.medium) paths.push(p.medium);
    }
  }
  return paths;
}

export function isBundleShape(parsed) {
  return !!(parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.snapshot && typeof parsed.snapshot === "object");
}

export async function unpackBundle(bundle, { root = ROOT } = {}) {
  const { snapshot, photos = {} } = bundle;
  const referenced = collectPhotoPaths(snapshot);
  const byBasename = new Map(referenced.map((p) => [path.basename(p), p]));

  let written = 0;
  const missingBytes = [];
  for (const relPath of referenced) {
    const basename = path.basename(relPath);
    const b64 = photos[basename];
    if (!b64) { missingBytes.push(relPath); continue; }
    const full = path.join(root, relPath);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, Buffer.from(b64, "base64"));
    written++;
  }

  const orphanedBytes = Object.keys(photos).filter((k) => !byBasename.has(k));
  return { snapshot, written, missingBytes, orphanedBytes };
}

async function main() {
  const bundleFile = process.argv[2];
  const outIdx = process.argv.indexOf("--out-snapshot");
  const outSnapshot = outIdx !== -1 ? process.argv[outIdx + 1] : null;
  // --root is test-only (points photo output at a scratch dir instead of this real repo); real
  // publishes never pass it, so photos always land in this repo's own images/, as intended.
  const rootIdx = process.argv.indexOf("--root");
  const root = rootIdx !== -1 ? path.resolve(process.argv[rootIdx + 1]) : ROOT;
  if (!bundleFile || !outSnapshot) {
    console.error("Usage: node scripts/unpack-publish-bundle.mjs <bundle-file> --out-snapshot <path>");
    process.exit(1);
  }

  let raw;
  try {
    raw = await readFile(path.resolve(bundleFile), "utf8");
  } catch (e) {
    console.error(`Couldn't read ${bundleFile}: ${e.message}`);
    process.exit(1);
  }

  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch (e) {
    console.error(`${bundleFile} is not valid JSON: ${e.message}`);
    process.exit(1);
  }

  if (!isBundleShape(bundle)) {
    console.error(
      `${bundleFile} doesn't look like a publish bundle (no "snapshot" field at the top level) -- ` +
      `pass the plain snapshot file directly instead; this script is only for the bundle shape a photo publish produces.`
    );
    process.exit(1);
  }

  const { snapshot, written, missingBytes, orphanedBytes } = await unpackBundle(bundle, { root });
  await writeFile(path.resolve(outSnapshot), JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(`OK: unpacked ${bundleFile}.`);
  console.log(`  snapshot written to ${outSnapshot}`);
  console.log(`  ${written} photo file(s) written`);
  if (missingBytes.length) {
    console.log(
      `  ${missingBytes.length} photo path(s) referenced by the snapshot had no matching bytes in the bundle ` +
      `(left unwritten -- the site shows no photo for these, same as any recipe with none): ${missingBytes.join(", ")}`
    );
  }
  if (orphanedBytes.length) {
    console.log(
      `  ${orphanedBytes.length} photo byte(s) in the bundle weren't referenced by any recipe in the snapshot ` +
      `(not written anywhere): ${orphanedBytes.join(", ")}`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
