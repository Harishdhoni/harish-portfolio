// =============================================================
//  Site content loader (Firestore)
// -------------------------------------------------------------
//  Reads the dynamic portfolio content from Firestore:
//   • structural collections: projects, education, certifications,
//     techstack, toolstack (+ the meta/site doc for skill stats)
//   • text overlays: content/{en,hi,ta} — partial i18next trees
//     that override the bundled locale JSON at render time.
//
//  Everything here is READ-ONLY from the client. Writes happen
//  from the Firebase console or scripts/seedContent.js, gated by
//  firestore.rules (owner-only). When Firebase isn't configured
//  the caller falls back to the local defaults in
//  components/content/registries.js, so the site always works.
// =============================================================
import { firebaseReady, getDb } from "./firebase";
import { pruneCodeOwned } from "./textTree";

const LANGS = ["en", "hi", "ta"];

// Fetch every doc in a collection as plain objects (id included).
async function fetchCollection(fs, db, name) {
  const snap = await fs.getDocs(fs.collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Load the structural content collections.
 * Returns null when Firebase is unset or the fetch fails — the caller then
 * keeps the local defaults. Individual empty collections are returned as
 * empty arrays so the caller can decide (per section) whether to fall back.
 */
export async function loadStructuralContent() {
  if (!firebaseReady) return null;
  try {
    const { db, fs } = await getDb();
    const [projects, education, certifications, techstack, toolstack, metaSnap] =
      await Promise.all([
        fetchCollection(fs, db, "projects"),
        fetchCollection(fs, db, "education"),
        // Isolated on purpose. Every other read here is old enough that its
        // rule is long published; `certifications` is new, and until
        // `npm run deploy:rules` runs against a given project Firestore denies
        // the path outright. Letting that reject would take the shared catch
        // below and revert projects, education and the stacks to their bundled
        // defaults too — one unpublished rule silently blanking the whole
        // site's live content. Degrading to "no certifications yet" is the
        // honest failure.
        fetchCollection(fs, db, "certifications").catch((err) => {
          // eslint-disable-next-line no-console
          console.warn(
            "Certifications unavailable — publish firestore.rules with " +
              "npm run deploy:rules. Other content is unaffected.",
            err
          );
          return [];
        }),
        fetchCollection(fs, db, "techstack"),
        fetchCollection(fs, db, "toolstack"),
        fs.getDoc(fs.doc(db, "meta", "site")),
      ]);
    const meta = metaSnap.exists() ? metaSnap.data() : {};
    return {
      projects,
      education,
      certifications,
      techstack,
      toolstack,
      stats: Array.isArray(meta.stats) ? meta.stats : [],
      // Pointer to an uploaded resume PDF in Cloud Storage; null keeps the
      // bundled asset. Requires a url — a half-written doc must not win.
      resume: meta.resume && meta.resume.url ? meta.resume : null,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Content load failed — using bundled defaults.", err);
    return null;
  }
}

/**
 * Load the per-language text overlays from content/{lang}.
 * Returns a map { en: {...}, hi: {...}, ta: {...} } of partial i18next trees,
 * skipping any language whose document is missing. Returns null on failure.
 *
 * Code-owned namespaces (UI chrome — see CODE_OWNED_NAMESPACES) are stripped:
 * older publishes stored a full snapshot of the tree, which would otherwise
 * overwrite bundled copy edits a moment after the page has already painted the
 * correct string.
 */
export async function loadTextOverlays() {
  if (!firebaseReady) return null;
  try {
    const { db, fs } = await getDb();
    const snaps = await Promise.all(
      LANGS.map((lang) => fs.getDoc(fs.doc(db, "content", lang)))
    );
    const overlays = {};
    snaps.forEach((snap, i) => {
      if (snap.exists()) overlays[LANGS[i]] = pruneCodeOwned(snap.data());
    });
    return overlays;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Text overlay load failed — using bundled locales.", err);
    return null;
  }
}
