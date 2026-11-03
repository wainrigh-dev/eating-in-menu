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

Plain static HTML/CSS/vanilla JS — no framework, no build step. Chosen over Next.js/Vite because
the whole site is three pages reading one JSON file; a build step would add tooling for no real
benefit, and "no build step" means Paul (or any future Claude Code session) can edit a file and
push, with Vercel serving it as-is. Each page fetches `data/snapshot.json` client-side at load
time (not a true static-generate, but equivalent in practice since the file only changes on
publish) and renders into the DOM with small page-specific scripts in `js/`.

## Pages

- `index.html` — "This week" plus a week-picker strip across every week in the snapshot (doubles
  as "Look ahead"); a Print button builds a one-page, black-and-white-friendly fridge sheet for
  the currently selected week via `@media print` (see `#print-sheet` in `css/style.css`) — no
  separate print route.
- `meal.html?id=<mealId>` — ingredients, prep tasks, recipe link. No cook-steps section (Batch 5,
  not yet in the schema).
- `requests.html` — requests Alex submitted and their status, plus a link to the Google Form.
  Always empty today (the Sheet→snapshot sync doesn't exist yet) — the empty state is the one
  that matters for now.

## Data

- `data/snapshot.json` is the file the site reads. A Claude Code session working in the private
  `eating-in` repo replaces this file with a real published snapshot and pushes; Vercel
  redeploys (~1 min). Until a real snapshot exists, it's seeded from `fixtures/sample-snapshot.json`
  (copy, not a symlink — keep `fixtures/` as the untouched reference copy for development, and
  treat `data/snapshot.json` as the one that gets overwritten on every publish).
- `fixtures/sample-snapshot.json` — covers a plain meal, a multi-day split meal, a meal with no
  recipe, a meal with no cook, a recipe with no `sourceUrl`, and non-null request statuses (the
  Requests "confirmed" UI state, which no real snapshot produces yet).

## Privacy

- `robots.txt` disallows everything; every page has a `noindex, nofollow` meta tag. This is
  obscurity (an unlisted link), not real security — don't describe it as secure in any UI copy.

## iPhone / Add to Home Screen

`manifest.json` + `icons/` + `apple-touch-icon` meta tag so "Add to Home Screen" gives Alex an
app-like icon and standalone window. Icons are a plain placeholder "E" mark — swap
`icons/*.png` for a real one anytime, no code change needed.

## Local dev

No build step — just serve the directory and open it:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000/index.html`.

## Testing

`test/smoke.mjs` — a Playwright smoke test over the static files (served locally), checking the
menu renders from the fixture data, the week picker switches weeks, meal detail renders
ingredients/prep/no-recipe/no-sourceUrl cases, the requests page shows both statuses, and the
print sheet builds without crashing. Run after serving the site locally:

```bash
node test/smoke.mjs
```
