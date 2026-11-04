# Eating In — Alex Menu Site

**Live:** https://eating-in-menu.vercel.app/

The public-facing menu site for Alex, built from a snapshot published by the (private)
`eating-in` app. See `HANDOFF.md` for the full spec (schema, pages, what's in/out of scope) and
that repo's `docs/batch-4-discovery.md` / `work-orders/2026-11-03-batch4-work-orders.md` for the
original design discussion.

This repo holds only:
- The site's code
- The latest published snapshot file(s)

It never contains any of the private app's source, recipes, or household data beyond what's
explicitly allowlisted into the snapshot (no allergies, costs, household member details, or
personal notes).

## Stack

Plain static HTML/CSS/vanilla JS — no framework. Chosen over Next.js/Vite because the whole site
is a handful of pages reading one JSON file; a framework would add tooling for no real benefit.
Each page fetches `data/snapshot.json` client-side at load time and renders into the DOM with
small page-specific scripts in `js/`.

There **is** a build step as of Nov 4 2026 (`scripts/build-snapshot.mjs`, run via `vercel.json`'s
`buildCommand`) — but it's a safety gate, not a framework compile step: it validates the newest
file in `snapshots/` and writes it to `data/snapshot.json`, never touching the HTML/CSS/JS. See
"Publishing a new snapshot" below.

## Pages

- `index.html` — "This week" plus a week-picker strip across every week in the snapshot (doubles
  as "Look ahead"); a Print button builds a one-page, black-and-white-friendly fridge sheet for
  the currently selected week via `@media print` (see `#print-sheet` in `css/style.css`) — no
  separate print route.
- `meal.html?id=<mealId>` — ingredients, prep tasks, recipe link. No cook-steps section (Batch 5,
  not yet in the schema).
- `roasting.html` (Work Order 4E) — a read-only "Roasting" table (name, temp, time, and a
  tappable link when the row has one) from the snapshot's `roasting` array. Absent or empty
  `roasting` shows a plain empty state, same pattern as Requests. Notes are never in the
  snapshot, so the page never has any to show (see HANDOFF.md).
- `requests.html` — requests Alex submitted and their status, plus a link to the Google Form.
  Always empty today (the Sheet→snapshot sync doesn't exist yet) — the empty state is the one
  that matters for now.

## Data

- `data/snapshot.json` is the file the site reads client-side. It's a **build output**, not
  something anyone edits or commits directly — `scripts/build-snapshot.mjs` regenerates it from
  the newest file in `snapshots/` on every build.
- `snapshots/` holds one dated file per publish (`snapshot-YYYY-MM-DD-HHMM.json`), oldest to
  newest by filename, never overwritten. The `/publish-to-alex` Claude Code skill prunes this to
  the newest 20 each time it publishes; the iPhone Shortcut doesn't prune (not worth the extra
  GitHub API calls for a Shortcut), so it's fine for this folder to grow when only the Shortcut
  is used — nothing reads anything but the newest file.
- `fixtures/sample-snapshot.json` — untouched reference fixture for the smoke test, covers a
  plain meal, a multi-day split meal, a meal with no recipe, a meal with no cook, a recipe with
  no `sourceUrl`, and non-null request statuses (the Requests "confirmed" UI state, which no
  real snapshot produces yet). Never used as live data.

## Publishing a new snapshot

See `docs/publish-shortcut.md` for the full walkthrough (building Paul's one-tap iPhone
Shortcut) and `.claude/skills/publish-to-alex/` for the Claude Code fallback skill. Either path
drops a new dated file into `snapshots/`; `scripts/build-snapshot.mjs` does the actual validation
and gate at build time — a bad file fails the Vercel build and the site keeps serving the
previous good snapshot.

## Privacy

- `robots.txt` disallows everything; every page has a `noindex, nofollow` meta tag. This is
  obscurity (an unlisted link), not real security — don't describe it as secure in any UI copy.

## iPhone / Add to Home Screen

`manifest.json` + `icons/` + `apple-touch-icon` meta tag so "Add to Home Screen" gives Alex an
app-like icon and standalone window. Icons are a plain placeholder "E" mark — swap
`icons/*.png` for a real one anytime, no code change needed.

## Local dev

The pages themselves still need no build step — just serve the directory and open it:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000/index.html`. To test a snapshot going through the publish
guard before it reaches `data/snapshot.json`, run `npm run build` (runs
`scripts/build-snapshot.mjs` against whatever's newest in `snapshots/`).

## Testing

- `test/smoke.mjs` — a Playwright smoke test over the static files (serves itself on an
  ephemeral port), checking the menu renders from the fixture data, the week picker switches
  weeks, meal detail renders ingredients/prep/no-recipe/no-sourceUrl cases, the requests page
  shows both statuses, the roasting page, and the print sheet builds without crashing.
- `test/smoke-publish-guard.mjs` — tests the build-time safety check itself: a snapshot with any
  never-show field (notes, allergy, caution, cost, household, photo, pdf, cookLog) or invalid
  JSON fails; a clean one passes and the newest-by-filename selection picks the right file.

```bash
npm test
```
