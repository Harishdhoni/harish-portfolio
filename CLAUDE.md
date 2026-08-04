# CLAUDE.md

Guidance for Claude (or any AI assistant) working in this repository.

## Project Overview

This is **Harish Siva's personal portfolio website** — a single-page, scroll-driven React app with an aurora / glassmorphism visual style. It showcases the owner's background, education, skills, projects, and resume, and includes a shared visitor "Guild Board" and a client-side AI assistant. Every section stacks vertically on one page; the navbar smooth-scrolls between them (there are no separate routed pages).

Most of the content is **Firestore-backed** and editable in the browser by the owner (`?admin`), with bundled fallbacks so the site works with no backend. Two owner-only overlays sit on top of the page rather than in the section stack: the **Admin panel** (content + Guild moderation) and the **Visitor dashboard** (`?visitors`, a private visit log).

- **Live site:** https://harishportfolio.lovestoblog.com/
- **Based on:** open-source template by [Soumyajit Behera](https://github.com/soumyajit4419/Portfolio), heavily customized.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 17 (Create React App) |
| Layout | Single-page vertical scroll — sections stacked in `App.js`. Navbar anchors + Lenis smooth-scroll (`helper/smoothScroll.js`, `helper/scrollToSection.js`); `DeepLinkScroll.js` handles `#anchor` deep links. React Router v6 only wraps the app for those anchors — no routed pages. |
| UI | React Bootstrap 2 + custom CSS |
| i18n | i18next + react-i18next — English / Hindi / Tamil, strings in `src/locales/*.json`, config in `src/i18n.js` |
| Theming | Light/dark toggle (`helper/useTheme.js`) + accent palette switcher (`helper/AccentSwitcher.js`); tokens in `style.css` |
| Animation | typewriter-effect, react-parallax-tilt, Lenis smooth scroll, custom canvas aurora / constellation backdrop |
| PDF Viewer | react-pdf |
| Contact form | @emailjs/browser (client-side email, no server) |
| GitHub calendar | react-github-calendar |
| Icons | react-icons |
| Backend / DB | Firebase (Firestore + Auth) — powers dynamic site content, the Guild Board shared wall, and the private visitor log; config in `src/services/firebase.js`, access rules in `firestore.rules`. Every consumer falls back to bundled defaults / per-browser localStorage when env keys are unset |
| Auth | Firebase email+password, a single owner account. One UID (`REACT_APP_GUILD_OWNER_UID`, also hardcoded in `firestore.rules`) gates all writes; sign-in lives in `Guild/OwnerLogin.js` + `guildStore.js` and is reused by the Admin panel and Visitor dashboard |
| Translation | `src/services/translate.js` — machine-translates admin-authored English into Hindi/Tamil on save (provider chain, glossary masking) |
| Testing | Jest via `react-scripts test` — pure-logic unit tests only (`matchIntent.test.js`, `translate.test.js`, `textTree.test.js`); component rendering in jsdom is blocked by ESM-only deps (Lenis) |
| Deploy | `scripts/deploy.js` FTP-publishes `build/` via `basic-ftp` (creds in `.env.deploy`); Firestore rules ship separately via `npm run deploy:rules` |

No TypeScript, no CSS-in-JS, no Redux-style state library — state lives in component hooks and React context (i18next, theme). Keep additions consistent with this lightweight setup unless asked to introduce something new.

## Project Structure

```
Portfolio-master/
├── public/                  # Static assets, favicons, manifest, index.html
├── src/
│   ├── Assets/              # SVG tech/tool icons, avatar & photo, project covers, resume PDF
│   ├── locales/             # i18n strings: en.json, hi.json, ta.json
│   ├── components/
│   │   ├── Home/            # Hero, intro, typewriter (Type.js), code terminal
│   │   ├── About/           # About card, tech/tool stack (Techstack/Toolstack), GitHub calendar
│   │   ├── Education/       # Education timeline cards (list from content store)
│   │   ├── Projects/        # Skills + project grid (Projects.js, ProjectCards.js)
│   │   │                    #   plus the featured ProjectShowcase.js
│   │   ├── content/         # Dynamic content: ContentProvider (Firestore loader +
│   │   │                    #   useContent hook), registries.js (icon/image keys +
│   │   │                    #   bundled fallback content). See CONTENT.md.
│   │   ├── Admin/           # Owner-only in-site content editor: AdminPanel.js
│   │   │                    #   (tabbed editor, gated on Guild owner auth) +
│   │   │                    #   adminStore.js (Firestore writes)
│   │   ├── Resume/          # PDF resume viewer — ResumeNew + lazy ResumePdf (reveals on request)
│   │   ├── Guild/           # Guild Board — shared visitor wall (Firestore + localStorage
│   │   │                    #   fallback): Guild.js, guildStore.js, PinModal.js,
│   │   │                    #   OwnerLogin.js, guildData.js. Owner moderation
│   │   │                    #   (edit/delete/love pins) lives in the Admin panel's
│   │   │                    #   Guild tab; guildStore also handles owner auth.
│   │   ├── Contact/         # EmailJS contact form + WhatsApp CTA
│   │   ├── Connect/         # Social links section
│   │   ├── Assistant/       # Client-side AI assistant (knowledgeBase.js, matchIntent.js
│   │   │                    #   + matchIntent.test.js)
│   │   ├── Visitors/        # Private visit log: VisitorPrompt.js (asks a first-time
│   │   │                    #   visitor for a name), VisitorDashboard.js (owner-only,
│   │   │                    #   ?visitors), visitorStore.js (Firestore + localStorage),
│   │   │                    #   deviceInfo.js, geo.js. Not a page section — an overlay.
│   │   ├── helper/          # Aurora + Constellation/DotGrid canvas, cursor, reveal,
│   │   │                    #   smooth-scroll, theme/accent/language switchers,
│   │   │                    #   back-to-top, CountUp, SkillMarquee, useFullscreen
│   │   ├── Navbar.js        # Fixed nav: anchors, scrollspy, theme/lang/accent controls
│   │   ├── DeepLinkScroll.js# Scrolls to the #anchor section on load
│   │   ├── Footer.js        # Footer with social links
│   │   └── Pre.js           # Preloader
│   ├── services/            # firebase.js (`firebaseReady` + lazy `getDb()`/`getAuthApi()`),
│   │                        #   content.js (Firestore content loader),
│   │                        #   translate.js (+ translate.test.js),
│   │                        #   textTree.js (overlay merge/diff/prune
│   │                        #   + textTree.test.js)
│   ├── i18n.js              # i18next initialization
│   ├── App.js               # Single-page shell: stacks all sections + overlays
│   ├── style.css            # Design system (aurora, glass, layout, theme tokens)
│   └── index.js             # Entry point
├── scripts/                 # deploy.js (FTP publish), seedContent.js (`npm run seed`)
├── docs/                    # brd/ prd/ design/ — artifacts written by the cascade commands
├── .claude/commands/        # /full-cascade and /audit-cascade workflow definitions
├── firestore.rules          # Access rules — SOURCE OF TRUTH, but only once published
├── firebase.json,           # firebase-tools config + target project for
│   .firebaserc              #   `npm run deploy:rules`
├── CONTENT.md               # Firestore content schema, seeding, auto-translation
├── PRODUCT.md               # Product intent, audience, non-goals
└── package.json
```

## Commands

```bash
npm install       # install dependencies
npm start         # dev server at http://localhost:3000
npm run build     # production build to build/
npm test          # Jest watch mode — logic unit tests only (see Testing & Verification)
npm run seed      # upsert current bundled content into Firestore (scripts/seedContent.js)
npm run deploy    # build, then FTP-publish build/ via scripts/deploy.js (basic-ftp; creds in .env.deploy)
npm run deploy:rules  # publish firestore.rules to the project in .firebaserc (firebase-tools via npx)
npm run deploy:storage # publish storage.rules (resume uploads) — same one-time login
```

**Editing `firestore.rules` is only half the change** — Firestore denies every
path its *published* rules don't match, so an unpublished rule reads as
"Missing or insufficient permissions" in the admin panel even for the owner.
Always follow a rules edit with `npm run deploy:rules`. The same applies to
`storage.rules` and `npm run deploy:storage`.

## Where to Make Changes

Most user-facing **text is now translated** — it lives in `src/locales/{en,hi,ta}.json`, not in JSX. Edit the string in **all three** files (English is the source of truth) and it's resolved at render via `t("key")`. Structural/visual and non-text data still live in components.

| Task | File(s) |
|---|---|
| Hero greeting, tagline, value copy | `src/locales/*.json` → `home.hero.*` |
| Typewriter roles | `src/locales/*.json` → `home.roles` |
| About text & interests | `src/locales/*.json` → `about.*` |
| Skills / projects section copy | `src/locales/*.json` → `skills.*` |
| Contact / connect / footer copy | `src/locales/*.json` → `contact.*`, `connect.*`, `footer.*` |
| Add / edit a UI language | add `src/locales/<lang>.json`, register in `src/i18n.js`, add to `helper/LanguageSwitcher.js` |
| Hero social links | `src/components/Home/Home.js` |
| GitHub account (calendar + profile links) | Three places, keep in sync: `GITHUB_USERNAME` in `About/Github.js` (contribution calendar) plus the `github.com/...` hrefs in `Home/Home.js` and `Connect/Connect.js` |
| "Book a call" scheduling link | `REACT_APP_BOOKING_URL` in `.env.local` (or the `BOOKING_URL` constant in `src/components/Contact/Contact.js`); falls back to a pre-filled WhatsApp message when unset |
| Tech stack icons | Firestore `techstack` collection (icon-key registry + fallback in `src/components/content/registries.js`) |
| Tools icons | Firestore `toolstack` collection (icon-key registry + fallback in `src/components/content/registries.js`) |
| Project cards / entries | Firestore `projects` collection (fallback: `DEFAULT_PROJECTS` in `src/components/content/registries.js`) — see `CONTENT.md` |
| Featured showcase section | `src/components/Projects/ProjectShowcase.js` |
| Education timeline entries | Firestore `education` collection (fallback: `DEFAULT_EDUCATION` in `registries.js`) — see `CONTENT.md` |
| Dynamic content (DB + fallback, icon/image keys) | `src/components/content/` — `ContentProvider.js`, `registries.js`; loader in `src/services/content.js`; seed via `npm run seed` (`scripts/seedContent.js`). Full schema in `CONTENT.md` |
| In-site content editor (owner-only) | `src/components/Admin/` — `AdminPanel.js` (gated on Guild owner auth; `?admin` to sign in; includes a **Guild** tab to edit/delete/love pins) + `adminStore.js` (Firestore writes). Styles: `.admin-*` in `style.css` |
| Auto-translation (English → Hindi/Tamil) | `src/services/translate.js` — masking rules, `GLOSSARY` of protected proper nouns, provider chain. Driven by `publishText()` in `AdminPanel.js`. See **Automatic translation** in `CONTENT.md` |
| Guild Board behaviour / storage | `src/components/Guild/guildStore.js` (Firestore + localStorage fallback) |
| Visitor log / greeter prompt | `src/components/Visitors/` — `visitorStore.js` (storage), `VisitorPrompt.js` (name prompt + what's captured), `VisitorDashboard.js` (owner view), `deviceInfo.js`, `geo.js`. Copy: `visitors.*` in the locale files |
| AI assistant answers / intents | `src/components/Assistant/knowledgeBase.js` |
| Resume PDF | Upload it in the admin panel's **Resume** tab (Cloud Storage `resume/resume.pdf`, pointer in `meta/site.resume`) — see `CONTENT.md`. `src/Assets/harish_resume_new.pdf` is the bundled fallback used when nothing is uploaded; upload code in `Admin/adminStore.js`, rules in `storage.rules` (publish with `npm run deploy:storage`) |
| Firebase / Guild env config | `.env.local` (`REACT_APP_FIREBASE_*`, `REACT_APP_GUILD_OWNER_UID`) — see `.env.example`; init in `src/services/firebase.js`, access rules in `firestore.rules` (publish with `npm run deploy:rules`; project in `.firebaserc`) |
| Colors, accent palettes & design tokens | `src/style.css` |

## Sections (single-page)

The site is one page; the navbar scrolls between sections by `id`. Order and ids are defined in `App.js` (render order) and `src/components/helper/scrollToSection.js` (`SECTION_IDS`).

| Section id | Description |
|---|---|
| `home` | Hero, intro, typewriter, social links |
| `about` | Background, interests, GitHub contribution calendar |
| `education` | Education timeline / cards (Firestore `education`; fallback `DEFAULT_EDUCATION` in `content/registries.js`) |
| `skills` | Professional skillset and tools |
| `projects` | Skills + project grid, followed by the featured `ProjectShowcase` block |
| `resume` | Embedded resume viewer (hidden until requested) with download |
| `guild` | Guild Board — shared visitor wall (Firestore + localStorage fallback; owner edits/deletes pins from the Admin panel's Guild tab) |
| `contact` | EmailJS contact form + WhatsApp CTA + "Book a call" link |
| _connect_ | Social links (below contact; not a navbar item) |

**Overlays** (rendered after `<main>` in `App.js`, no section id, never in `SECTION_IDS`):
`AiAssistant`, `BackToTop`, `AdminPanel` (`?admin`), `VisitorPrompt`, `VisitorDashboard`
(`?visitors`). The two owner-only ones render nothing at all for a visitor who isn't
signed in — keep it that way when touching them.

## Conventions & Constraints

- **Component style:** functional components, plain CSS (no CSS modules/Tailwind). Match existing patterns in `src/components/` rather than introducing new styling systems.
- **Internationalization:** never hardcode user-facing text in JSX. Add a key under the right namespace in **all three** locale files and render with `useTranslation()`'s `t()`. Keep the three files structurally in sync. Copy edited through the admin panel is written in English only — the panel machine-translates it into Hindi/Tamil on save (`src/services/translate.js`), so any new content-bearing key must be a real i18n key for that to reach the other languages.
- **Theming:** support both light and dark via the CSS custom properties in `style.css` — don't hardcode colors; use the `--accent`/token variables so the accent switcher keeps working.
- **Accessibility:** respect `prefers-reduced-motion` (the smooth-scroll and animations already branch on it); keep ARIA labels on interactive elements (nav, buttons, social links, the assistant, form fields).
- **Performance:** the aurora background is GPU-friendly and fixed-position — avoid changes that force repaints on scroll. Scrolling is driven by Lenis; route section navigation through `scrollToSection.js` rather than fighting it with manual `scrollTo`. Nothing below the fold belongs on the critical path: the overlays are `React.lazy` in `App.js`, the GitHub calendar is split into `GithubCalendar.jsx`, and `will-change` is applied only for the duration of a transition (see `Reveal.jsx`), never parked in CSS.
- **Never import the Firebase SDK statically.** `firebase/firestore` alone is ~410 KB. `services/firebase.js` exports the sync flag `firebaseReady` plus `await getDb()` / `await getAuthApi()`, each of which returns the instance *and* the SDK namespace (`const { db, fs } = await getDb()` → `fs.collection(...)`). Branch on `firebaseReady` first so the no-backend path never loads a chunk at all.
- **Content vs. code:** translated copy lives in `src/locales/*.json`; non-text data (icons, project entries, assistant knowledge) lives in the component/data files listed above. Prefer editing those over hardcoding elsewhere.
- **Text overlays are diffs, never snapshots.** `content/{en,hi,ta}` carries only the leaves that differ from the bundled locale JSON, deep-merged over it at load (`services/textTree.js`). The panel publishes the diff, and UI-chrome namespaces (`CODE_OWNED_NAMESPACES`: `nav`, `visitors`, `assistant`, `guild`, `contact`, `connect`, `footer`, `resume`) are stripped on read and never written — that copy is code-owned, so edit the locale files. If you ever store the full tree again, every later copy edit in `src/locales` gets painted and then overwritten by the stale DB copy a moment after load. See **Text overlays** in `CONTENT.md`.
- **Resume:** the PDF is rendered in-browser via `react-pdf`; if replacing it, keep the filename convention or update the import in `src/components/Resume/`.
- **Firebase / no-backend fallback:** every Firestore consumer (content, Guild Board, visitor log) reads its config from `REACT_APP_FIREBASE_*`; when they're absent, `firebaseReady` is `false` and each falls back to bundled defaults or per-browser localStorage — keep that path working so the site runs with no backend, and never let a missing/failed Firestore read blank out a section.
- **Owner-only writes:** all writes (content, pin moderation, visit deletion) are gated on the single owner UID in `firestore.rules`. Never relax the rules to allow anonymous writes or deletes, and don't add a second privileged path in client code — the client check is a UI convenience; the rules are the actual boundary. Any rules edit needs `npm run deploy:rules` to take effect.
- **Visitor privacy:** the visit log is deliberately coarse — device class, OS/browser, screen, timezone, referrer, approximate city/country and network org from `geo.js`, plus a self-provided name. The raw IP is never stored and the log is owner-read-only in the rules. The name prompt is a small, non-blocking bottom-left card that appears right on load (not gated behind the visit log / geo lookup) for anyone we don't have a name for yet; giving a name, hitting **Skip**, closing it (✕ / Escape) all dismiss it and are remembered locally (`pv.name.v1` / `pv.skip.v1`) so the same browser is never prompted again — a name is not required, and the rest of the page stays usable the whole time. Don't widen what's captured, and don't surface any of it in the public UI.
- **New sections:** add the component to the stack in `App.js`, give it an `id`, and — if it should be reachable from the nav — add its id to `SECTION_IDS` in `scrollToSection.js` and to `NAV_ITEMS` in `Navbar.js`. Overlays (assistant, admin, visitor widgets) go *after* `</main>` and get no id.

## Testing & Verification

`npm test` runs Jest over **pure-logic unit tests only** — `Assistant/matchIntent.test.js`,
`services/translate.test.js` and `services/textTree.test.js`. Rendering components in jsdom is blocked by ESM-only
dependencies (Lenis), so there is no component/DOM suite; a UI change is verified manually.
New logic that's dependency-free (matchers, masking, formatting) should get a unit test —
new UI should not chase one.

Before committing changes:
1. Run `npm start` and scroll through every affected section; confirm navbar anchors and scrollspy still land correctly.
2. Verify responsiveness at desktop, tablet, and mobile widths.
3. If text changed, switch languages (English / Hindi / Tamil) and confirm all three render.
4. If styling changed, check both light and dark themes.
5. If Firestore-backed content or the Guild/visitor stores changed, check it **both** with Firebase configured and with the env keys unset (fallback path).
6. If an owner-only surface changed, confirm it's invisible signed out, then re-check it signed in via `?admin` / `?visitors`.
7. If `firestore.rules` changed, run `npm run deploy:rules` — an unpublished rule reads as "Missing or insufficient permissions".
8. Run `npm test` if any pure logic changed, and confirm `npm run build` completes without errors/warnings introduced by the change.
