# Eating In — Alex Menu Site: handoff for a new session

**Live site:** https://eating-in-menu.vercel.app/ — built and deployed (Nov 3 2026), currently
showing the first real published snapshot (see "Status" below). You do **not** need access to the
private `eating-in` app repo to do this work — everything you need is below or in
`fixtures/sample-snapshot.json` in this repo. If you want the full backstory anyway, the source
documents are `wainrigh-dev/eating-in`'s `docs/batch-4-discovery.md` and
`work-orders/2026-11-03-batch4-work-orders.md` — this doc is a self-contained summary of both plus
everything decided since.

## Status (Nov 3 2026)

- Site is built and live at the URL above: This week / Look ahead week picker, meal detail,
  Requests page, one-page print view, Add-to-Home-Screen manifest + icons, `noindex` +
  `robots.txt`. Playwright smoke test (`test/smoke.mjs`, 21 checks) passing, run against
  `fixtures/sample-snapshot.json` (decoupled from whatever's live in `data/snapshot.json` so the
  suite stays stable across real publishes).
- `data/snapshot.json` was republished 2026-11-04 (6 upcoming weeks, plus 7 roasting rows) — this
  is the deliberate second publish meant to exercise Batch 4A acceptance item 5 (a changed meal
  showing on the site after a publish + deploy) and idea-1793713840073's own item 3 (the roasting
  table reaching the site). Changed since the 2026-11-03 publish: the Wed meal in the current week
  is renamed ("...& Chicken Sausage" → "...& Chicken Sausage or Tofu"), and two more weeks each
  gained an extra meal. Every meal's `cookName` is still `null` — no cook is assigned to any
  planned meal in the app yet, not a site bug.
- The Vercel project (`eating-in-menu`) had to be created manually by Paul from the dashboard —
  the earlier "imported as a project" note below turned out not to have actually happened (no
  deploys existed when checked). If a future snapshot push doesn't show up on the live site,
  check the Vercel project still exists and is connected to this repo's `main` branch before
  assuming the site code is broken.
- **Not verified from Claude Code:** this session's outbound network policy blocks
  `*.vercel.app`, so no Claude Code session has loaded the live URL to confirm it actually
  renders — Paul provided the URL but hasn't yet confirmed what it shows. A full QC pass (iPhone,
  print view, etc.) against the acceptance criteria below is still outstanding.

## What this is

A small, read-only, iPhone-first website that shows "Alex" (a household member) the weekly
dinner menu — what's planned, who's cooking, ingredients, prep steps, and a link to the full
recipe. It also has a Requests page linking to a Google Form Alex can use to ask for things.

**It is not live data.** The site reads a JSON snapshot file committed to this repo. A human
(Paul) publishes a new snapshot from inside the private app periodically; a Claude Code session
working in the `eating-in` repo commits that file here; Vercel auto-redeploys. The site itself
never talks to the app, a database, or any API — it's a static/SSG site reading one JSON file.
"Last updated" should be shown on every page, read from the snapshot's own `publishedAt` field —
that's how Alex knows how fresh it is.

## What's already done (setup, Nov 3 2026)

- **This repo**: `https://github.com/wainrigh-dev/eating-in-menu` (public). Currently has only a
  placeholder README — nothing else has been built. Claude Code has confirmed push access to it.
- **Vercel**: project created and connected to this repo's `main` branch, auto-deploying on
  push. Live at https://eating-in-menu.vercel.app/.
- **Requests Google Form**: https://forms.gle/gYb5xSauzit6CBK88
- **Requests Google Sheet**: https://docs.google.com/spreadsheets/d/1bvbRdmz0luV3GMRe_CASLJFABV-ISIy7ncOAMlxd67k/edit?resourcekey=&gid=1399392972#gid=1399392972
  (has a manually-added "Status" column: New / Added / Not this time)
- **App-side "Publish to Alex"**: shipped in the app's v2.15, behind an Experimental feature
  switch, off by default. It already builds and lets Paul download a snapshot file matching the
  schema below. The sync that reads the *Requests sheet* back into the app (so request statuses
  show up in the published snapshot) is **not built yet** — until it is, every published
  snapshot's `requests` array is empty and every meal's `status` field is `null`. Don't build
  against that assumption changing on its own; it's separate, later work.

## The snapshot schema (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "publishedAt": "2026-11-03T18:42:00Z",
  "weeks": [
    {
      "weekId": "2026-11-01",
      "meals": [
        {
          "id": "m1-Tue",
          "name": "Weeknight Fajitas",
          "day": "Tue",
          "cookName": "Jordan",
          "status": null,
          "recipe": {
            "name": "Weeknight Fajitas",
            "sourceUrl": "https://example.com/fajitas",
            "ingredients": [
              { "name": "Bell pepper", "qty": "2", "category": "produce" }
            ],
            "prepTasks": ["Roast fajita veg (peppers, mushrooms, onion)"]
          }
        }
      ],
      "prep": [
        { "text": "Roast fajita veg (peppers, mushrooms, onion)", "recipe": "Weeknight Fajitas", "done": false }
      ]
    }
  ],
  "requests": [],
  "roasting": [
    { "name": "Carrots", "temp": "425°F", "time": "20-25 min", "link": "https://example.com/roasted-carrots" }
  ]
}
```

Notes on reading this shape, from the real builder's behavior (see `buildAlexSnapshot` in the
app's `src/app.tsx` if you ever do get access to that repo):

- `roasting` (added Work Order 4E / app v2.18) is name/temp/time/link only — **never** notes, and
  the array is absent or empty on any snapshot published before v2.18, with the app's "Roasting
  table" feature off, or with no rows saved yet. Render all three the same way: no section. `link`
  is `null` when that row has none — show the name as plain text, not a dead link.

- `weeks` is sorted ascending by `weekId` (the Sunday of each week, `YYYY-MM-DD`) and only includes
  the current week and weeks after it that have at least one planned meal — a far-future empty
  week, or a past week, is never in there.
- A meal that spans multiple days (e.g. a leftovers meal on "Sun,Wed") is split into **one entry
  per day** at snapshot-build time, each sharing the same `id` prefix (`<mealId>-<day>`) and the
  same `cookName`/`recipe`. There's no multi-day meal object — always one entry, one day.
  `day` is a single short weekday string ("Sun", "Mon", ...) or `null`.
  `id` is `m2-Sun` / `m2-Wed` in `fixtures/sample-snapshot.json` for exactly this case.
- `cookName` is always a resolved first name (or whatever the household calls that person) or
  `null` — **never** a raw id. If you ever see something that looks like an opaque id in a `cook`
  field, something upstream is broken; flag it, don't publish it.
- `recipe` is `null` when the meal isn't linked to a recipe in the app (a quick plan-only meal like
  "order pizza"). Render that gracefully — just the meal name/day/cook, no ingredients/prep/link
  section.
- `recipe.sourceUrl` is `null` when there's no external link — in that case there's still an
  in-app recipe to show, just no outside URL. Per the work order: meal detail should still show
  "the in-app recipe" (ingredients/prep) even with no sourceUrl.
- There are **no cook steps**, only `prepTasks` (do-ahead prep, e.g. "Dice an onion"). This is
  intentional — the app has no cook-steps field yet; it arrives with a later batch ("Batch 5:
  cook mode"). Don't add a cook-steps UI section expecting data that will never show up until
  that lands; design the meal detail page so adding one later is easy, but build for its absence
  now.
- `status` on a meal and the `requests` array are reserved for the Requests confirmation flow.
  Build the Requests page's UI to handle them (a request shows "New" until Paul sets a status in
  the Sheet, then shows "Added"/"Not this time" after the next publish) — but know that **every
  snapshot published today has `requests: []` and every `status: null`**, because the Sheet-sync
  half isn't built. `fixtures/sample-snapshot.json` includes a couple of non-null examples
  (`"status": "Added"`) specifically so you have something to design the "confirmed" state
  against — that part of the fixture is aspirational, not a sample of real current output.
- A real snapshot never contains: ingredient allergy/caution/notes/cost, a meal or week note, the
  household member roster, person ids, or recipe PDFs/photos. If a published snapshot file you're
  given ever contains any of those, something regressed upstream — don't build around their
  presence, and flag it back rather than rendering them.

## What to build (Work Order 4A)

### Pages (iPhone first; large text, touch-friendly, viewport meta, "Add to Home Screen" manifest + icon)

1. **This week** — menu by day, who's cooking, status if known from the snapshot (e.g. "prepped",
   a thaw reminder — these aren't in the schema today beyond the bare fields above; if you want a
   derived "needs thawing" type hint, that'd be a `recipe`/`prepTasks` text match at render time,
   not a new schema field — ask before inventing new schema).
2. **Look ahead** — a week selector across every week present in the snapshot's `weeks` array.
3. **Meal detail** — ingredients, prep tasks, the recipe link (`sourceUrl`) when present, and the
   in-app recipe info when not. No cook steps (see above).
4. **Requests** — shows requests Alex submitted (from `requests[]`) and their status, plus a link
   to the Google Form above. Today this will always render an empty list — build the empty state
   well, it's the common case for a while.
5. **Print view** — a "Print" button producing one clean page, US Letter, black-and-white
   friendly, no nav chrome — week/day/meal/cook, compact. Print CSS only (a `@media print`
   stylesheet hiding everything else), not a separate route. **Test this from an actual iPhone
   Safari** (Share → Print) before calling it done — the acceptance criteria specifically call
   this out.

### Data loading

- The snapshot lives as a committed JSON file in this repo (pick a path, e.g.
  `data/snapshot.json`, and say so clearly in this repo's README once decided) — read it at
  build time (SSG) is simplest and matches "the site is only as fresh as the last publish." A
  Claude Code session updates that file and pushes; Vercel redeploys (~1 min).
- Show `publishedAt` (formatted nicely) on every page as "Last updated."

### Privacy and safety

- This repo holds only the site's code and the published snapshot — never the private app's
  source or any unfiltered data.
- Unlisted link: no sign-in yet (planned later), so add a `noindex` meta tag site-wide and a
  `robots.txt` disallowing everything. This is obscurity, not real security — don't describe it
  as secure anywhere in the UI or copy.

### Explicitly out of scope for 4A (don't build)

- Sign-in/auth
- Live database (snapshots only, until app data moves out of Claude — unrelated, later)
- Custom domain
- Cook steps (Batch 5)
- The Requests sheet→snapshot sync (separate work, not site code anyway)

## Acceptance criteria (Paul QCs each, pass/fail — don't mark anything done yourself)

1. Site loads on iPhone from the link; this week's menu is correct.
2. Look-ahead shows the next published weeks.
3. Meal detail shows ingredients, prep tasks, and the recipe link (no cook steps — intentional).
4. Print view fits exactly one page and is readable on the fridge.
5. After a new snapshot is published and Vercel redeploys, a changed meal shows on the site.
6. Form submission lands in the Sheet; a status change appears after the next publish (hard to
   fully verify until the sync exists — at minimum, confirm the Requests page would render a
   populated/status-changed example correctly, using the fixture).
7. No allergies, costs, household details, or recipe PDFs/photos appear anywhere on the site, ever
   — this is the one most worth being paranoid about. If you add any new field to what the site
   reads from a snapshot, check it against the exclusion list above first.

## Standing build rules (same as the app repo)

- New features ship behind a feature switch — less applicable to a fresh public site with no
  existing users, but still: don't ship something half-working as if it's done.
- Smoke-test before calling anything ready (Playwright is fine, same spirit as the app repo's
  `test/smoke-*.mjs` — but there's no existing harness here, you're starting fresh).
- **Never mark a card/task "Done" yourself** — Paul does that after his own QC pass. If there's a
  natural "needs-qc" equivalent here (a PR, a tracking issue), use that instead of claiming
  completion.
- Confirm before anything hard-to-reverse (force-push, deleting the placeholder commit's history,
  etc.) — same git safety norms as any other repo.

## Starting point

- `fixtures/sample-snapshot.json` in this repo — develop against it before you have a real
  published snapshot to test with. It covers: a plain meal, a multi-day split meal, a meal with no
  recipe, a meal with no cook, a recipe with no `sourceUrl`, and (aspirationally — see the note
  above) non-null request statuses so you can build the "confirmed" UI state too.
- No site code exists yet. No framework has been chosen — Next.js (static export) or a plain
  Vite/vanilla static site both fit "Vercel, reads one JSON file, no backend"; pick whichever you
  can move fastest in and say which you picked and why in this repo's README.
