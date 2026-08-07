/**
 * Seed / update the portfolio's dynamic content in Firestore.
 *
 * Uploads the current site content into the collections the app reads:
 *   • projects, education, techstack, toolstack — structural lists
 *   • meta/site           — skill stats
 *
 * Copy is NOT seeded: UI text ships in src/locales/*.json and the
 * content/{en,hi,ta} overlay carries only the leaves edited in the admin panel.
 *
 * Documents use stable IDs, so re-running this UPDATES existing docs rather
 * than creating duplicates. It is safe to run repeatedly.
 *
 * Config is read from .env / .env.local (the same REACT_APP_FIREBASE_* keys the
 * app uses). Writes are owner-only (see firestore.rules) — publish those rules
 * (`npm run deploy:rules`) or every write fails with "Missing or insufficient
 * permissions". The script signs in with the owner account; provide the owner
 * credentials via env or .env.local:
 *   SEED_OWNER_EMAIL=you@example.com
 *   SEED_OWNER_PASSWORD=••••••••
 *
 * Run:  node scripts/seedContent.js
 */
const fs = require("fs");
const path = require("path");
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  writeBatch,
} = require("firebase/firestore");
const {
  getAuth,
  signInWithEmailAndPassword,
} = require("firebase/auth");

const ROOT = path.join(__dirname, "..");

// ---- tiny .env reader (mirrors scripts/deploy.js) --------------------------
function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

// ---- structural content (mirrors src/components/content/registries.js) -----
const PROJECTS = [
  {
    id: "eib",
    order: 1,
    abbr: "EIB",
    title: "Employee Information Bank (EIB)",
    description:
      "A centralized internal platform that brings an organization's employee information together in one place — from day-to-day logistics to offboarding and a complete, searchable view of every employee's data.",
    modules: [
      "Transport Management System",
      "Employee Exit Process",
      "Employee overall data & directory",
    ],
    tags: ["React", "REST API"],
    ghLink: "",
    demoLink: "https://hreib.growatiopex.com/MyProfile2.0",
    imgKey: "eib",
  },
  {
    id: "ic",
    order: 2,
    abbr: "iC",
    title: "iConnect",
    description:
      "An internal HR / employee portal (HRIS) for iOPEX — a personalized hub that brings a configurable home dashboard, a photo & video gallery, and company announcements together in one place, across web and mobile.",
    modules: [
      "Personalized dashboard & widgets",
      "Photo & video gallery",
      "Company announcements & updates",
    ],
    tags: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Capacitor"],
    ghLink: "",
    demoLink: "https://digital.growatiopex.com",
    imgKey: "iconnect",
  },
];

const EDUCATION = [
  { id: "be", order: 1, iconKey: "graduationCap" },
  { id: "hsc", order: 2, iconKey: "graduationCap" },
];

const TECHSTACK = [
  { id: "javascript", order: 1, label: "JavaScript", iconKey: "javascript" },
  { id: "jquery", order: 2, label: "jQuery", iconKey: "jquery" },
  { id: "typescript", order: 3, label: "TypeScript", iconKey: "typescript" },
  { id: "codeigniter", order: 4, label: "CodeIgniter", iconKey: "codeigniter" },
  { id: "php", order: 5, label: "PHP", iconKey: "php" },
  { id: "node", order: 6, label: "Node.js", iconKey: "node" },
  { id: "nestjs", order: 7, label: "Nest.js", iconKey: "nestjs" },
  { id: "react", order: 8, label: "React.js", iconKey: "react" },
  { id: "nextjs", order: 9, label: "Next.js", iconKey: "nextjs" },
  { id: "sql", order: 10, label: "SQL", iconKey: "sql" },
];

const TOOLSTACK = [
  { id: "macos", order: 1, label: "macOS", iconKey: "macos" },
  { id: "ubuntu", order: 2, label: "Ubuntu", iconKey: "ubuntu" },
  { id: "chrome", order: 3, label: "Chrome", iconKey: "chrome" },
  { id: "vscode", order: 4, label: "VS Code", iconKey: "vscode" },
  { id: "claude", order: 5, label: "Claude", iconKey: "claude" },
  { id: "xampp", order: 6, label: "XAMPP", iconKey: "xampp" },
  { id: "git", order: 7, label: "Git", iconKey: "git" },
  { id: "prisma", order: 8, label: "Prisma", iconKey: "prisma" },
  { id: "postman", order: 9, label: "Postman", iconKey: "postman" },
];

const STATS = [
  { order: 1, key: "experience", value: "5", suffix: "+" },
  { order: 2, key: "technologies", value: "13", suffix: "+" },
  { order: 3, key: "focus", value: "Full-stack", suffix: "" },
];

async function main() {
  // Same precedence CRA uses: .env, then .env.local overrides it, then the
  // real environment. The app's keys normally live in .env.local (gitignored).
  const env = {
    ...loadEnv(path.join(ROOT, ".env")),
    ...loadEnv(path.join(ROOT, ".env.local")),
    ...process.env,
  };

  const config = {
    apiKey: env.REACT_APP_FIREBASE_API_KEY,
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.REACT_APP_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId || !config.appId) {
    console.error(
      "\n✖ Firebase config missing. Set REACT_APP_FIREBASE_* in .env.local first.\n"
    );
    process.exit(1);
  }

  const ownerEmail = env.SEED_OWNER_EMAIL;
  const ownerPassword = env.SEED_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    console.error(
      "\n✖ Owner credentials missing.\n" +
        "  Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD (env or .env.local) —\n" +
        "  writes are owner-only per firestore.rules.\n"
    );
    process.exit(1);
  }

  const app = initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);

  console.log(`\n→ Signing in as ${ownerEmail}…`);
  await signInWithEmailAndPassword(auth, ownerEmail, ownerPassword);
  console.log("✓ Signed in.");

  const batch = writeBatch(db);

  // `certifications` is deliberately NOT seeded either: every entry asserts a
  // real credential with a verification URL, so there is nothing to bundle.
  // Add them in the admin panel's Certs tab (?admin) — until then the section
  // and its nav entry stay hidden.

  // content/{en,hi,ta} is deliberately NOT written here. The site already
  // renders the bundled src/locales/*.json; the overlay exists only to carry
  // the leaves the owner edited in the admin panel. Writing the whole tree
  // would freeze today's copy in the database and shadow later edits made in
  // the locale files. To reset copy to the bundle, delete those three docs.

  // Structural collections (stable IDs → idempotent upserts).
  for (const p of PROJECTS) {
    const { id, ...data } = p;
    batch.set(doc(db, "projects", id), data);
  }
  for (const e of EDUCATION) {
    const { id, ...data } = e;
    batch.set(doc(db, "education", id), data);
  }
  for (const t of TECHSTACK) {
    const { id, ...data } = t;
    batch.set(doc(db, "techstack", id), data);
  }
  for (const t of TOOLSTACK) {
    const { id, ...data } = t;
    batch.set(doc(db, "toolstack", id), data);
  }
  batch.set(doc(db, "meta", "site"), { stats: STATS });

  console.log("→ Writing content…");
  await batch.commit();
  console.log(
    "\n✅ Seed complete. Content is live in Firestore — edit it any time in\n" +
      "   the admin panel (?admin) or the Firebase console.\n" +
      "   Copy (content/{en,hi,ta}) was left untouched: UI text comes from\n" +
      "   src/locales/*.json, and the overlay only holds admin-panel edits.\n"
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✖ Seed failed:", err.message || err);
  process.exit(1);
});
