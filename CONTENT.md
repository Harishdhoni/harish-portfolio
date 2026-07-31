# Dynamic content (Firestore)

The portfolio's content is loaded from **Firebase Firestore** at runtime. Edit
it in the [Firebase console](https://console.firebase.google.com/) → *Firestore
Database* and the site picks it up on the next load — no rebuild or redeploy.

If Firebase isn't configured (`REACT_APP_FIREBASE_*` unset) **or** a read fails,
the site falls back to the bundled defaults in
[`src/components/content/registries.js`](src/components/content/registries.js),
so it always works with no backend.

## First-time setup

1. Set `REACT_APP_FIREBASE_*` in `.env.local` (see `.env.example`).
2. Publish the rules in [`firestore.rules`](firestore.rules):
   ```bash
   npx firebase-tools login   # once per machine
   npm run deploy:rules       # firebase deploy --only firestore:rules
   ```
   The target project comes from [`.firebaserc`](.firebaserc).
3. Seed the database from the current content:
   ```bash
   # .env.local also needs the owner login (writes are owner-only):
   #   SEED_OWNER_EMAIL=you@example.com
   #   SEED_OWNER_PASSWORD=••••••••
   npm run seed
   ```
   Re-running `npm run seed` is safe — it upserts by document ID. It seeds the
   structural collections only; copy stays in `src/locales/*.json` (see
   [Text overlays are diffs](#text-overlays-are-diffs-not-snapshots)).

> **Every rules change needs step 2 again.** Firestore denies any path its
> *published* rules don't match, so a rule that exists only in the repo file has
> no effect: saves fail with *“Missing or insufficient permissions”* even when
> you're signed in as the owner. If the admin panel shows that message, run
> `npm run deploy:rules`.

## Editing in the browser (owner-only admin panel)

You don't have to use the Firebase console — there's a built-in editor for the
owner.

1. Add `?admin` to the URL for the owner sign-in prompt (same Firebase account,
   enforced by `firestore.rules`).
2. A floating **✎ Content** button appears (bottom-left). Open it.
3. Tabs: **Projects · Education · Tech · Tools · Stats · Text · Resume · Guild**.
   Edit, then **Save** — changes go straight to Firestore and the site refreshes
   live (no reload). The **Guild** tab edits/deletes visitor wall notes and marks
   a note as “Loved by Harish” (this replaces the old `?guild=owner` flow). The
   **Resume** tab uploads a new PDF and has no Save button — see
   [Resume PDF](#resume-pdf) below.
4. **You only ever type English.** Hindi and Tamil are machine-translated on
   save — see [Automatic translation](#automatic-translation) below.

The panel seeds each tab from the bundled defaults when a collection is still
empty, so you can also use it to populate a fresh database instead of
`npm run seed`. The **Text** tab edits the friendly fields per section, or the
raw i18next tree via **Advanced** (must be valid JSON to save).

Regular visitors never see the button or the editor — it only mounts for the
authenticated owner.

## Resume PDF

The **Resume** tab replaces the PDF shown in the Resume section and behind every
“Download CV” button, with no rebuild and no redeploy.

- The file goes to **Cloud Storage** at the fixed path `resume/resume.pdf`, so
  each upload replaces the last and nothing accumulates. Overwriting an object
  mints a fresh download token, so the URL changes every time and no stale copy
  can be served from a cache.
- `meta/site.resume` holds `{ url, name, size, updatedAt }` — the pointer the
  public site reads. **Revert to bundled** deletes that field (and the object),
  dropping the site back to `src/Assets/harish_resume_new.pdf`.
- The bundled PDF is the fallback whenever no upload exists, Firebase is
  unconfigured, or the read fails — the Resume section never depends on the
  backend.
- PDF only, 10 MB max. The panel checks before uploading; `storage.rules`
  enforces the same limits server-side, which is the boundary that counts.

### First-time setup (once)

Cloud Storage is separate from Firestore and starts switched off:

1. Firebase console → **Build → Storage → Get started**. For projects created
   after October 2024 this requires the **Blaze** plan. A single resume is far
   inside the free allowance, but a card must be on file.
2. Publish the rules — same "only real once published" trap as Firestore:
   ```bash
   npm run deploy:storage      # firebase deploy --only storage
   ```
3. Check `REACT_APP_FIREBASE_STORAGE_BUCKET` is set in `.env.local`.

If the upload fails with *“Couldn't reach Cloud Storage”*, step 1 hasn't been
done. If it fails with *“Denied by Storage rules”*, step 2 hasn't.

### If the in-page viewer can't load an uploaded PDF

The download link and a new browser tab will work regardless, but the embedded
`react-pdf` viewer fetches the file with XHR, which is subject to CORS. If the
viewer shows an error while the download works, set a CORS policy on the bucket:

```bash
# cors.json
# [{"origin": ["https://harishportfolio.lovestoblog.com", "http://localhost:3000"],
#   "method": ["GET"], "maxAgeSeconds": 3600}]
gsutil cors set cors.json gs://my-portfolio-4dd34.firebasestorage.app
```

`gsutil` ships with the Google Cloud SDK. This is a one-time, per-bucket
setting — it isn't part of `storage.rules` and isn't deployed by
`npm run deploy:storage`.

## Text overlays are diffs, not snapshots

`content/{en,hi,ta}` is an **overlay**: it holds only the leaves that differ from
the bundled `src/locales/<lang>.json`, and the site deep-merges it over those
files at load ([`textTree.js`](src/services/textTree.js) →
`loadTextOverlays()` → `ContentProvider`). Two rules keep it that way:

- **Publishing saves the diff.** `publishText()` diffs the edited tree against
  the bundled locale and writes only what changed, replacing the doc — so a key
  that goes back to matching the code disappears from the database instead of
  lingering.
- **UI chrome is code-owned.** The namespaces in `CODE_OWNED_NAMESPACES`
  (`nav`, `visitors`, `assistant`, `guild`, `contact`, `connect`, `footer`,
  `resume`) are stripped from the overlay on read and never written. The admin
  panel has no fields for them; their copy lives in the locale files. To change
  that text, edit all three locale files. Content namespaces — `home`, `about`,
  `education`, `skills` — remain fully editable in the panel.

**Why:** a full-tree snapshot freezes every string at publish time. The site
would paint the correct bundled copy, then overwrite it with the older database
copy a moment later, once the Firestore read resolved — a visible flicker back to
text that no longer exists anywhere in the repo. `npm run seed` therefore doesn't
seed copy either; delete the three docs to reset all copy to the bundle.

## Automatic translation

English is the single source of truth. When you save the **Text** or
**Projects** tab, the panel machine-translates the English into Hindi and Tamil
and writes all three `content/{en,hi,ta}` docs (as diffs — see above). The
HI / TA sub-tabs are read-only previews of that output.

- **Only what you changed is re-translated.** The panel diffs the English tree
  against the version it loaded, so untouched copy keeps the translation it
  already has (the hand-written Hindi/Tamil in `src/locales/*.json` is not
  overwritten). Keys a language is missing entirely — a new project or education
  entry — are translated too.
- **Re-translate all from English** (bottom of the Text tab) ignores the diff and
  rebuilds every key. It overwrites hand-written translations, asks first, and
  takes a couple of minutes.
- **Never translated:** i18next placeholders (`{{count}}`), `<Trans>` markers
  (`<1>…</1>`), URLs/emails, values with no letters (`2017 – 2021`), education
  `institution`, and the proper nouns in the `GLOSSARY` in
  [`src/services/translate.js`](src/services/translate.js) (Harish Siva, iOPEX,
  React, PHP…). Add a brand name there to protect it — the list also covers
  terms a translator mangles outright (`APIs` → "शहद की मक्खी"/honey bee,
  `Postman` → "डाकिया"/mailman, `Firestore` → "நெருப்புக் கடை"/fire shop) and
  fixed English labels whose generic translation is wrong in context (`Resume` →
  "फिर शुरू करना"/start again). Matching is case-sensitive and on word
  boundaries, so `Esc` doesn't mask the start of "Escape". If a marker doesn't
  survive the round trip, that one string stays English rather than shipping
  broken markup.
- **Language-independent by design:** project `title` and `tags`, and the
  Tech/Tools `label`s, render as typed in every language — they're product and
  technology names. Stat `value`/`suffix` are numbers; their labels live in the
  Text tab (`skills.stats.<key>`) and do get translated.
- **Providers** (first success wins, all client-side from the owner's browser):
  Google Cloud Translation v2 when `REACT_APP_GOOGLE_TRANSLATE_KEY` is set →
  keyless `clients5.google.com` (`dict-chrome-ex`) → keyless
  `translate.googleapis.com` (`gtx`) → MyMemory. The keyless ones are free and
  unofficial, so they can rate-limit; results are cached in `localStorage`, so
  re-saving costs no requests. If nothing is reachable the English still saves
  and the toast says the other languages were left alone.
- **If every provider reports "Failed to fetch"** the network is the problem,
  not the services. `clients5.google.com` leads the chain because it's the only
  keyless endpoint that sends `Access-Control-Allow-Origin: *` — the other two
  need something in front of them to add it. Corporate TLS-inspecting proxies
  commonly reset `translate.googleapis.com` and return 403 for MyMemory, so on
  such a network set `REACT_APP_GOOGLE_TRANSLATE_KEY`, or save from a network
  that isn't filtered. The toast names each provider's failure.
- **Visitors never call a translation service** — they read the saved
  `content/{lang}` docs, so the public site stays fast and offline-safe.

Machine translation is a starting point, not a proofread. To correct a specific
Hindi/Tamil string by hand, edit that key in the Firebase console (or the
Advanced JSON view of that language) — the panel won't touch it again unless you
change the English or run **Re-translate all**. That works for the content
namespaces; a code-owned namespace edited there is ignored on read, so fix those
in `src/locales/<lang>.json` instead.

## Collections ("tables")

| Collection / doc | Holds | Document shape |
|---|---|---|
| `content/en`, `content/hi`, `content/ta` | **All UI text**, per language | The full i18n tree (same shape as `src/locales/<lang>.json`). Deep-merged over the bundled JSON — the DB value wins. |
| `projects/{id}` | Project cards | `order`, `abbr`, `title`, `description`, `modules[]`, `tags[]`, `ghLink`, `demoLink`, `imgKey` |
| `education/{id}` | Education timeline | `order`, `iconKey`. Card text lives in `content/*` under `education.items.<id>` |
| `techstack/{id}` | Tech marquee | `order`, `label`, `iconKey`, optional `color` |
| `toolstack/{id}` | Tools marquee | `order`, `label`, `iconKey`, optional `color` |
| `meta/site` | Skill stats | `stats: [{ order, key, value, suffix }]` |

`order` sorts each list ascending. `id` is any stable string (used only as the
document key).

### Editing text

Text is **not** stored per-component — it's the i18next tree. To change the hero
tagline, edit `content/en` (and `content/hi`, `content/ta`) → `home.hero.value`.
A `content/*` doc may contain only the keys you want to override; anything absent
falls back to the bundled `src/locales/<lang>.json`.

Project `description` / `modules` are translated via the abbr key
`skills.projects.<abbr>` in the `content/*` docs; the values on the `projects`
doc are the English fallback.

### Icon & image keys

Icons and cover images can't live in a database, so a document stores a **key**
that maps to an imported asset in
[`src/components/content/registries.js`](src/components/content/registries.js).

- `imgKey` (projects): `eib`, `iconnect`. Empty/unknown → the abbreviation
  gradient cover.
- `iconKey` (education): `graduationCap`.
- `iconKey` (tech/tools): `javascript`, `jquery`, `typescript`, `codeigniter`,
  `php`, `node`, `nestjs`, `react`, `nextjs`, `sql`, `macos`, `ubuntu`,
  `chrome`, `vscode`, `claude`, `xampp`, `git`, `prisma`, `postman`.

**To add a new icon/image:** import the asset in `registries.js`, add it to the
matching registry (`SKILL_ICONS` / `EDU_ICONS` / `PROJECT_IMAGES`) under a new
key, then reference that key from the Firestore document. Adding a project/skill
that reuses an existing key needs no code change — just a new document.
