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

1. **Locate the snapshot file.** Paul will attach it or give you a path. It should look like
   `alex-snapshot-<timestamp>.json` (the app's own download name) — but the name doesn't matter,
   only the contents do.

2. **Validate it** with the repo's own guard, don't re-implement the checks:
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

4. **Prune old snapshots.** List `snapshots/*.json` sorted by name (the dated names sort
   chronologically) and delete all but the newest 20, *including* the one you just added in the
   count. This keeps the repo tidy — the iPhone Shortcut can't easily do this itself (it would
   need extra GitHub API calls just to list and delete), so the skill does it instead.

5. **Commit and push**, with a clear message naming the new file, e.g.
   `Publish snapshot snapshot-2026-11-04-1530.json`. Push to `main` directly — this repo doesn't
   use PRs for routine publishes.

6. **Tell Paul what happened:**
   - The new file name and that it was pushed.
   - That Vercel will redeploy in about a minute, and that this session's network policy blocks
     `*.vercel.app`, so you can't confirm the live site actually updated — he should check it
     himself.
   - If anything was pruned in step 4, say how many old snapshots were deleted.

## Don't

- Don't touch the app repo, the snapshot schema, or the never-show list.
- Don't publish a file that failed validation, for any reason, even if Paul asks you to "just
  push it anyway" — tell him why it failed instead and let him fix the source.
- Don't claim the live site updated — that always needs Paul (or a session with unblocked
  network) to confirm.
