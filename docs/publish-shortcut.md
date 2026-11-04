# Publish to Alex — building the one-tap iPhone Shortcut

This is the walkthrough for Paul. It's the second half of
[`work-orders/2026-11-03-publish-shortcut.md`](../../eating-in/work-orders/2026-11-03-publish-shortcut.md)
(in the app repo) — Part 1 (the safety check and the dated drop folder) is already built and
live in this repo. This doc only covers building the Shortcut itself; nobody but Paul can do
that — Claude Code can't build or test an iOS Shortcut.

If this proves too fiddly after a couple of real tries, stop — the `/publish-to-alex` Claude
Code skill in this repo does the exact same job from a laptop, any time.

**Confirmed working end to end on Paul's iPhone, Nov 4 2026** — Part (b) below reflects the
exact sequence that worked, including the fixes for the errors actually hit while building it
(Format Date, URL wiring, a malformed path, and invalid Base64 — see Part (d)).

## What the Shortcut needs to do, in one sentence

Pick the snapshot file the app saved, turn it into a dated file name, and hand it to GitHub's
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

This is the exact sequence that worked, confirmed end to end on a real iPhone (Nov 4 2026) — it
includes two gotchas that aren't obvious from the action names, called out inline where they
bite. Open the **Shortcuts** app → **+** (new shortcut) → rename it **Publish to Alex** (tap the
name at the top). Add these actions in order:

1. **Select File** (search the action library). Open its options and turn **"Select Multiple"
   off** — it defaults to on, and leaving it on makes every later step work with a list of files
   instead of one file, which breaks the Base64 step. When you run this Shortcut, this action
   pops up the Files browser so you can pick the snapshot yourself; it's one extra tap over a
   true Share Sheet hand-off, but it works identically on every iOS version, which a Share Sheet
   toggle doesn't (its wording moves around between iOS releases — if you want to try it anyway,
   see the optional note at the end of this section, but don't spend long on it).
2. **Base64 Encode** — set its input to the **Select File** result from step 1 (tap the input
   field and pick that action's output as the variable — don't leave it on "Shortcut Input").
   **Then open the action's own options and set "Line Breaks" to "None."** It defaults to "Every
   76 Characters," which inserts real line-break characters into the encoded text every 76
   characters — GitHub's API rejects that with `"content is not valid Base64"`. This is the one
   easiest to miss, because the default looks like a reasonable setting, not an obviously wrong
   one.
3. **Current Date**, then **Format Date** on it — set the format to **Custom** and enter exactly
   `yyyy-MM-dd-HHmm` in the Format String field (no colon, no slash, no extra characters — a
   leftover default character here, or a stray `/` or `:`, breaks the file path in step 5). This
   gives you something like `2026-11-04-1530`.
4. **Text** action — build the file name. Type `snapshot-`, then **tap the Formatted Date
   variable to insert it inline — don't press Return first**, then type `.json` right after it,
   also with no Return in between. (Pressing Return before or after inserting a variable embeds
   an actual line-break character into the text, invisibly — it looks identical to normal text
   when you glance at it, but GitHub's API will reject the resulting path or content. This bit us
   during testing and cost several rounds of debugging before we traced it back to this.) End
   result should read like `snapshot-2026-11-04-1530.json`.
5. **Text** action — build the URL the same careful way: type
   `https://api.github.com/repos/wainrigh-dev/eating-in-menu/contents/snapshots/`, then insert
   the filename variable from step 4 inline with no Return before or after it.
6. **Get Contents of URL** — this is the action that actually talks to GitHub:
   - **URL:** insert the variable from step 5 (don't retype the URL by hand here).
   - Tap to expand advanced options. **Method:** `PUT`.
   - **Headers:** add two —
     - `Authorization` → `Bearer ` followed by your token from Part (a) (paste it directly here,
       with a space after "Bearer").
     - `Accept` → `application/vnd.github+json`
   - **Request Body:** set type to **JSON**, then tap **Add new field** three times and fill in:
     - `message` (Text) → `Publish snapshot ` followed by the **filename variable from step 4**
       (not the URL variable from step 5 — easy to grab the wrong one since both are called
       "Text" in the variable picker; double-check which one you're inserting. Getting this
       wrong doesn't break anything, it just makes the commit message on GitHub show the full
       URL instead of a short filename).
     - `content` (Text) → the Base64 Encode result from step 2.
     - `branch` (Text) → `main`
7. **Get Value for key "content" in** → insert the **Get Contents of URL** result from step 6.
   (Search for the **Get Dictionary Value** action; set it to "Get Value for" → `content`, "in"
   → the step 6 variable.) A successful GitHub response always includes the new file's own
   `content` block; an error response doesn't — this is how the next step tells success from
   failure.
8. **If** — set its condition to check the step 7 result **has any value** (tap the left side of
   the condition and make sure it's actually the step 7 output selected, not some unrelated
   variable Shortcuts may have auto-picked, like "File Size" — check this explicitly, it doesn't
   always default correctly).
   - **If true:** add **Show Notification** with text like "Published to Alex ✅."
   - **Otherwise:** add **Show Result**, set its input to the step 6 variable (the raw
     **Get Contents of URL** output), so you can read GitHub's actual error message (see Part (d)
     for what the common ones mean).
9. **End If** (Shortcuts usually adds this automatically).

Save the Shortcut.

**Optional, if you want true one-tap-from-Files instead of opening the Shortcut first:** some
iOS versions let a shortcut appear in the Files/Share Sheet "Share" row for a given file type.
Look for a settings/info icon on the shortcut (varies: a wrench, an "i," or "...") and look for
anything mentioning "Share Sheet" — turn it on and allow "Files" or "Any" as a type if asked.
If you don't see anything like that, or it doesn't work the way this paragraph describes, skip
it — the "Select File" step above is the real answer and needs no Share Sheet setup at all.

**If something still errors after following this exactly:** add a temporary **Show Result** (or
**Quick Look**) action right after step 5, feeding it that step's URL variable, and run the
Shortcut. It'll show you the literal URL about to be sent, before GitHub ever sees it — useful
for spotting anything that doesn't match what's expected. Delete it again once you're done
debugging.

## Part (c): testing it from the app's "Publish to Alex" download

1. In the app, open the drawer → **Publish to Alex** (you'll need the "Publish to Alex" and
   "Ingredient records" Experimental features on). Tap **Save snapshot**.
2. Your phone saves a file named something like `alex-snapshot-2026-11-04-1530.json`. On iPhone,
   a browser download like this lands in the **Files** app, under **On My iPhone → Downloads**
   (or iCloud Drive → Downloads, depending on your settings) — open the **Files** app and look
   there if you don't see a save prompt.
   - The Shortcut ignores this filename entirely and makes up its own dated name (Part (b),
     steps 3–4) — so it doesn't matter that this name doesn't match what lands in `snapshots/`.
3. Open the **Shortcuts** app and tap **Publish to Alex** to run it (tapping the shortcut itself
   runs it — you don't need to open it for editing). It'll show the Files browser from step 1;
   navigate to **Downloads** and pick the file from step 2.
4. You should see the success notification from step 8 within a few seconds. Then:
   - Check `https://github.com/wainrigh-dev/eating-in-menu/tree/main/snapshots` — a new dated
     file should be there.
   - Check the repo's **Deployments** / **Actions** area on Vercel's dashboard (or just wait ~1
     minute and reload the live site) — a bad file fails the build and the site keeps showing
     whatever was live before; a good file goes live within about a minute.

## Part (d): if it errors

- **"Format Date failed because Shortcuts couldn't convert from Text to Date":** the Format Date
  action's Date input got typed as plain text somewhere instead of an actual inserted variable.
  Open it, clear the Date field, and insert the **Current Date** variable properly (as a colored
  chip, not typed characters).
- **"No URL Specified":** the Get Contents of URL action's URL field is empty or not actually
  wired to the step 5 Text variable. Open it and insert that variable properly.
- **`"path contains a malformed path component"` (422):** almost always a stray line-break
  character hiding in the filename or URL text — see step 4/5's warning above about not pressing
  Return before or after inserting a variable. Rebuild those two Text actions carefully. The
  "temporary Show Result after step 5" trick above can help confirm the literal URL being sent,
  though a stray newline won't always be visible even there — if the URL *looks* fine and it
  still fails, suspect this anyway and rebuild the Text actions from scratch.
- **`"content is not valid Base64"` (422):** the Base64 Encode action's **Line Breaks** setting
  is still on "Every 76 Characters" instead of "None" — see step 2 above. This was the actual
  cause the one time this was debugged live; check it first.
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
