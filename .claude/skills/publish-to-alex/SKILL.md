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

1. **Locate the file Paul attached, and tell which shape it is.** It's one of two things:
   - **A plain snapshot** (`alex-snapshot-<timestamp>.json`, the app's own download name for a
     publish with no photos) — the file itself *is* the snapshot. Skip straight to step 2.
   - **A publish bundle** (`alex-publish-bundle-<timestamp>.json`, app v2.23+, a publish that
     included recipe photos) — the file's top level looks like `{"snapshot": {...}, "photos":
     {...}}`, not the plain snapshot shape directly. **Before v2.23, a photo publish instead saved
     the snapshot plus two separate JPEG files per recipe** — don't try to hand-assemble those;
     if Paul hands you several loose files like that from an old publish, tell him to re-publish
     from the app instead (that path silently dropped files on a real phone and was replaced).
   - The filename is a hint, not the rule — if unsure, open the file and check for a top-level
     `snapshot` key.

1b. **For a bundle, unpack it first:**
   ```
   node scripts/unpack-publish-bundle.mjs <bundle-file> --out-snapshot /tmp/unpacked-snapshot.json
   ```
   This writes every referenced photo straight to its real `images/<dated folder>/...` path
   (read from the snapshot's own `photos` fields, never re-derived) and writes the plain
   snapshot to the `--out-snapshot` path you gave it. Its own output tells you plainly about
   anything off — a photo path the snapshot references with no matching bytes in the bundle (left
   unwritten; the site just shows no photo for that one, same as any recipe with none — mention it
   in step 6, don't treat it as a failure) or bundle bytes nothing in the snapshot pointed at
   (ignored). From here on, treat that `--out-snapshot` file exactly like a plain snapshot Paul
   handed you directly — continue at step 2.

2. **Validate the snapshot** with the repo's own guard, don't re-implement the checks:
   ```
   node scripts/build-snapshot.mjs --check-only <path-to-the-snapshot>
   ```
   (for a bundle, that's the `--out-snapshot` file from step 1b, not the original bundle file —
   the guard only understands the plain snapshot shape)
   - If this exits non-zero, **stop here**. Tell Paul plainly what failed (the script prints the
     specific problem — e.g. a forbidden field, invalid JSON, a missing required field) and do
     not commit anything. Don't try to patch the file by hand — if it looks wrong, report it;
     the app side (snapshot schema, allowlist) is explicitly out of scope for this skill. If you
     already unpacked a bundle's photo files in step 1b before this fails, leave them — they're
     harmless, untracked-by-git files sitting under `images/` until a later successful publish's
     prune step (step 4) cleans them up; don't hand-delete them.

3. **If it passed**, copy it into `snapshots/` under a dated name matching the existing
   convention (`snapshot-YYYY-MM-DD-HHMM.json`, UTC, from the current time — see any existing
   file in `snapshots/` for the exact format). Don't overwrite an existing file; each publish is
   a new file. (Photo files, if any, are already sitting in place under `images/` from step 1b —
   nothing more to do with them here.)

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
   - Any photo the snapshot referenced but the bundle had no bytes for (see step 1b).
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
