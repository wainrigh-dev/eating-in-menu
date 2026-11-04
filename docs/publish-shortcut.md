# Publish to Alex — building the one-tap iPhone Shortcut

This is the walkthrough for Paul. It's the second half of
[`work-orders/2026-11-03-publish-shortcut.md`](../../eating-in/work-orders/2026-11-03-publish-shortcut.md)
(in the app repo) — Part 1 (the safety check and the dated drop folder) is already built and
live in this repo. This doc only covers building the Shortcut itself; nobody but Paul can do
that — Claude Code can't build or test an iOS Shortcut.

If this proves too fiddly after a couple of real tries, stop — the `/publish-to-alex` Claude
Code skill in this repo does the exact same job from a laptop, any time.

## What the Shortcut needs to do, in one sentence

Take the snapshot file the app saved, turn it into a dated file name, and hand it to GitHub's
"create a file" API so it lands in this repo's `snapshots/` folder — the build-time safety check
(`scripts/build-snapshot.mjs`) then either publishes it to the live site or rejects it.

## Part (a): create a GitHub token — once, then renew every 90 days

A token is a password-like code that lets the Shortcut act on your behalf, but only against
this one small repo. Create it once; it expires on its own after 90 days, so you'll make a new
one periodically.

1. On your iPhone (or a computer, then it'll be on your phone when you build the Shortcut), go
   to **github.com → your profile photo (top right) → Settings → Developer settings →
   Personal access tokens → Fine-grained tokens**.
2. Tap **Generate new token**.
3. **Token name:** something you'll recognize later, e.g. `publish-to-alex-shortcut`.
4. **Expiration:** 90 days.
5. **Repository access:** choose **Only select repositories**, then pick
   `wainrigh-dev/eating-in-menu`. Don't pick "All repositories" — the token should only ever be
   able to touch this one.
6. **Permissions → Repository permissions → Contents:** set to **Read and write**. Leave
   everything else as **No access**.
7. Tap **Generate token**. GitHub shows the token's value exactly once — copy it now.
8. **Don't paste it anywhere except directly into the Shortcut you're about to build** — not in
   a note, not in a text to anyone, not in a chat with Claude. If you ever think it's leaked,
   come back to this same page and delete it, then make a new one.
9. Set a calendar reminder for ~85 days from now: "Renew Publish to Alex GitHub token." When it
   expires, the Shortcut will start failing with an authorization error (see Part (d)) — that's
   the signal to make a new token and swap it into the Shortcut.

## Part (b): build the Shortcut

Open the **Shortcuts** app → **+** (new shortcut) → rename it **Publish to Alex** (tap the name
at the top). Add these actions in order:

1. **Receive input from Share Sheet** — this is automatic the moment you add any action that
   uses "Shortcut Input"; just make sure, in the shortcut's settings (the **ⓧ** icon at top),
   **"Show in Share Sheet"** is turned on, and under "Share Sheet Types" that **Files** (or
   "Documents"/"Any") is enabled. This is what lets you share a file into this Shortcut from the
   Files app.
2. **Base64 Encode** (search for it in the action library) — set its input to **Shortcut Input**.
   This turns the snapshot file's bytes into a text string GitHub's API can accept in a JSON
   body.
3. **Current Date**, then **Format Date** on it — set the format to **Custom** and enter
   `yyyy-MM-dd-HHmm`. This gives you something like `2026-11-04-1530`.
4. **Text** action — build the file name: `snapshot-` followed by the formatted date (tap into
   the Text field and insert the Format Date result as a variable), followed by `.json`. End
   result should read like `snapshot-2026-11-04-1530.json`.
5. **Text** action — build the URL:
   `https://api.github.com/repos/wainrigh-dev/eating-in-menu/contents/snapshots/` followed by the
   file name variable from step 4.
6. **Get Contents of URL** — this is the action that actually talks to GitHub:
   - **URL:** the variable from step 5.
   - Tap to expand advanced options. **Method:** `PUT`.
   - **Headers:** add two —
     - `Authorization` → `Bearer ` followed by your token from Part (a) (paste it directly here,
       with a space after "Bearer").
     - `Accept` → `application/vnd.github+json`
   - **Request Body:** set type to **JSON**, then add three fields:
     - `message` (Text) → `Publish snapshot` followed by the file name variable from step 4.
     - `content` (Text) → the Base64 Encode result from step 2.
     - `branch` (Text) → `main`
7. **If** action — condition on whether step 6's result has a key, e.g. check if
   **Get Contents of URL's "content"** dictionary value exists (a successful GitHub response
   always includes the new file's own `content` block; an error response doesn't). This tells
   success apart from failure.
   - **If true:** add **Show Notification** (or **Show Result**) with text like "Published to
     Alex ✅ — Vercel will redeploy in about a minute."
   - **Otherwise:** add **Show Result** showing step 6's raw output, so you can see GitHub's
     error message (see Part (d) for what the common ones mean).

Save the Shortcut.

## Part (c): testing it from the app's "Publish to Alex" download

1. In the app, open the drawer → **Publish to Alex** (you'll need the "Publish to Alex" and
   "Ingredient records" Experimental features on). Tap **Save snapshot**.
2. Your phone saves a file named something like `alex-snapshot-2026-11-04-1530.json`. On iPhone,
   a browser download like this lands in the **Files** app, under **On My iPhone → Downloads**
   (or iCloud Drive → Downloads, depending on your settings) — open the **Files** app and look
   there if you don't see a save prompt.
   - The Shortcut ignores this filename entirely and makes up its own dated name (Part (b),
     steps 3–4) — so it doesn't matter that this name doesn't match what lands in `snapshots/`.
3. Tap and hold the file in Files, or tap the **Share** icon on it, and look for **Publish to
   Alex** in the share sheet (scroll the icon row, or tap "More"). Tap it.
4. You should see the success notification from step 7 within a few seconds. Then:
   - Check `https://github.com/wainrigh-dev/eating-in-menu/tree/main/snapshots` — a new dated
     file should be there.
   - Check the repo's **Deployments** / **Actions** area on Vercel's dashboard (or just wait ~1
     minute and reload the live site) — a bad file fails the build and the site keeps showing
     whatever was live before; a good file goes live within about a minute.

## Part (d): if it errors

- **"Bad credentials" / 401:** the token is wrong, was mistyped, or has expired. Check Part (a)
  step 9's reminder — if it's past 90 days, make a new token (same steps) and paste it into the
  Shortcut's **Get Contents of URL** header in step 6, replacing the old one.
- **"Not Found" / 404:** usually means the token's repository access doesn't include
  `eating-in-menu`, or the repo name/path in step 5's URL is mistyped. Re-check Part (a) step 5.
- **No network / the Shortcut just spins:** you're offline, or the request timed out. Nothing was
  sent (GitHub never got the file) — just try again once you have a connection. It's safe to
  retry; a repeat creates a second dated file, which the guard happily accepts (last one wins,
  the old one just sits in history).
- **The site doesn't update after a few minutes:** check for a red ✕ on the latest deployment in
  the Vercel dashboard — that means the safety check rejected the file (it'll say why in the
  build log). If you can't tell what's wrong, use the `/publish-to-alex` Claude Code skill
  instead; it runs the exact same check and will explain the problem in plain language.
- **Two tries and it's still not working:** stop debugging it. Use the `/publish-to-alex` skill
  from a laptop instead — that's exactly what it's for — and mention it got parked so the
  one-tap route can be revisited later.
