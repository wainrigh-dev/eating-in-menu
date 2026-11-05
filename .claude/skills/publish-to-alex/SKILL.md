---
name: publish-to-alex
description: Publish a snapshot file to the Alex menu site (eating-in-menu repo). Use when Paul attaches or points to a "Publish to Alex" snapshot file and wants it published, or when the one-tap iPhone Shortcut (docs/publish-shortcut.md) isn't working and he needs a laptop/Claude Code fallback.
---

# Publish to Alex (fallback publish path)

This is Plan B for publishing a menu snapshot to the Alex site — the normal path is Paul's
one-tap iPhone Shortcut (see `docs/publish-shortcut.md`). Use this skill when Paul hands you a
snapshot file directly, or when the Shortcut isn't working.

Don't guess at the snapshot schema or the never-show list — both are defined in
`scripts/build-snapshot.mjs` in this repo. If anything here goes out of sync with that script,
the script is the source of truth.

## Steps

1. **Locate the snapshot file, and any photo files Paul also handed you.** The snapshot looks
   like `alex-snapshot-<timestamp>.json` (the app's own download name) — the name doesn't matter,
   only the contents do. Since work order 2026-11-04 (Alex site photos), a publish that includes
   recipe photos also has a handful of `img-<recipeId>-small.jpg` / `img-<recipeId>-medium.jpg`
   files alongside it — the app's "Publish to Alex" screen saves these to the same Downloads
   location as the snapshot, specifically *because* the one-tap iPhone Shortcut can't carry them
   (it only ever moves the one JSON file) — this skill is the fallback that can. If Paul only
   hands you the snapshot and it references `recipe.photos` fields with no matching image files,
   say so plainly and ask him to find and attach them too — don't publish a snapshot whose photo
   paths point at files that don't exist on the site.

2. **Validate the snapshot** with the repo's own guard, don't re-implement the checks:
   ```
   node scripts/build-snapshot.mjs --check-only <path-to-the-file>
   ```
   - If this exits non-zero, **stop here**. Tell Paul plainly what failed (the script prints the
     specific problem — e.g. a forbidden field, invalid JSON, a missing required field) and do
     not commit anything. Don't try to patch the file by hand — if it looks wrong, report it;
     the app side (snapshot schema, allowlist) is explicitly out of scope for this skill.

3. **If it passed**, copy it into `snapshots/` under a dated name matching the existing
   convention (`snapshot-YYYY-MM-DD-HHMM.json`, UTC, from the current time — see any existing
   file in `snapshots/` for the exact format). Don't overwrite an existing file; each publish is
   a new file.

3b. **If the snapshot has any `recipe.photos` fields, place the matching photo files too.** Each
   `photos.small`/`photos.medium` value is a relative path already written by the app, e.g.
   `images/2026-11-05-1530/img-r1-small.jpg` — copy the photo file Paul gave you (matched by its
   `img-<recipeId>-<size>.jpg` basename) to exactly that path under the repo root, creating the
   dated folder. Don't rename or re-derive the path yourself; use the one the snapshot already
   states, so the guard's own path validation (`scripts/build-snapshot.mjs`) and what actually
   ships always agree. If a referenced photo path has no matching file, leave that one out and
   flag it to Paul in step 6 rather than guessing or inventing a placeholder — the site already
   handles a missing/broken photo gracefully (no empty box, no broken-image icon), so an
   incomplete photo set is safe to ship, just worth him knowing about.

4. **Prune old snapshots** *and* old photo folders. List `snapshots/*.json` sorted by name (the
   dated names sort chronologically) and delete all but the newest 20, *including* the one you
   just added in the count. Do the same for subfolders of `images/` — keep the newest 20 dated
   folders, delete older ones (checking first that no snapshot still being kept actually
   references one you're about to delete). This keeps the repo tidy — the iPhone Shortcut can't
   easily do this itself (it would need extra GitHub API calls just to list and delete), so the
   skill does it instead.

5. **Commit and push**, with a clear message naming the new file(s), e.g.
   `Publish snapshot snapshot-2026-11-04-1530.json` (add ", with N recipe photos" when photos
   came along). Push to `main` directly — this repo doesn't use PRs for routine publishes.

6. **Tell Paul what happened:**
   - The new file name and that it was pushed, and how many photo files (if any) went with it.
   - Any photo the snapshot referenced but you didn't have a file for (see step 3b).
   - That Vercel will redeploy in about a minute, and that this session's network policy blocks
     `*.vercel.app`, so you can't confirm the live site actually updated — he should check it
     himself.
   - If anything was pruned in step 4, say how many old snapshots and photo folders were deleted.

## Don't

- Don't touch the app repo, the snapshot schema, or the never-show list.
- Don't publish a file that failed validation, for any reason, even if Paul asks you to "just
  push it anyway" — tell him why it failed instead and let him fix the source.
- Don't claim the live site updated — that always needs Paul (or a session with unblocked
  network) to confirm.
