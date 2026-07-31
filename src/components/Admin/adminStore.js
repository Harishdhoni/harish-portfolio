// =============================================================
//  Admin store — owner-only content writes
// -------------------------------------------------------------
//  Thin Firestore write layer used by the in-site admin panel.
//  Every write here is gated by firestore.rules (owner-only), so
//  a non-owner request is rejected server-side even if it reached
//  this module. Reads reuse the app's normal content loaders.
// =============================================================
import { getDb, getStorageApi } from "../../services/firebase";
import {
  loadStructuralContent,
  loadTextOverlays,
} from "../../services/content";

export { loadStructuralContent, loadTextOverlays };

// Owner auth + Guild pin management are shared with the Guild Board (one
// Firebase account / collection).
export {
  firebaseReady,
  subscribeOwner,
  ownerSignIn,
  ownerSignOut,
  subscribePins,
  updatePin,
  deletePin,
} from "../Guild/guildStore";

/**
 * Turn a Firestore write failure into something the owner can act on.
 *
 * "Missing or insufficient permissions" almost always means the rules in
 * firestore.rules haven't been published to the live project (Firestore denies
 * every path it doesn't match), not that the sign-in is wrong — so say that
 * instead of echoing the SDK's message.
 */
export function describeWriteError(err) {
  const code = err && err.code;
  if (code === "permission-denied")
    return (
      "Denied by Firestore rules — an edit to firestore.rules does nothing " +
      "until it's published: run npm run deploy:rules (see CONTENT.md)."
    );
  if (code === "unauthenticated")
    return "Signed out — sign in again as the owner and retry.";
  if (code === "unavailable")
    return "Can't reach Firestore. Check your connection and retry.";

  // Storage errors carry their own prefix and need different advice: the
  // usual cause isn't the rules but Storage never having been switched on.
  if (code === "storage/unauthorized")
    return (
      "Denied by Storage rules — publish them with npm run deploy:storage, " +
      "and check the owner UID in storage.rules matches your account."
    );
  if (code === "storage/unauthenticated")
    return "Signed out — sign in again as the owner and retry the upload.";
  if (code === "storage/quota-exceeded")
    return "The Storage bucket is out of quota. Check the Firebase console.";
  if (code === "storage/canceled") return "Upload cancelled.";
  if (
    code === "storage/unknown" ||
    code === "storage/retry-limit-exceeded" ||
    code === "storage/no-default-bucket"
  )
    return (
      "Couldn't reach Cloud Storage. If this is the first upload, enable " +
      "Storage in the Firebase console (Build > Storage > Get started), then " +
      "run npm run deploy:storage. See CONTENT.md."
    );

  return (err && err.message) || "Save failed.";
}

// Upsert a document in a content collection (full overwrite by id).
export async function saveItem(collectionName, id, data) {
  const { db, fs } = await getDb();
  return fs.setDoc(fs.doc(db, collectionName, id), data);
}

// Remove a document from a content collection.
export async function deleteItem(collectionName, id) {
  const { db, fs } = await getDb();
  return fs.deleteDoc(fs.doc(db, collectionName, id));
}

// Skill stats live on a single settings doc. Merge, don't overwrite — the same
// doc also carries the resume pointer, and a plain setDoc would drop it.
export async function saveStats(stats) {
  const { db, fs } = await getDb();
  return fs.setDoc(fs.doc(db, "meta", "site"), { stats }, { merge: true });
}

// ---- Resume PDF -------------------------------------------------------------
// The file itself lives in Cloud Storage at a fixed path (each upload replaces
// the last, so nothing accumulates); meta/site.resume holds the download URL
// the public site reads. Overwriting an object mints a fresh download token, so
// the URL changes on every upload and no stale copy can be served from cache.

const RESUME_PATH = "resume/resume.pdf";
export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

/** Human-readable size, for the panel and for error messages. */
export function formatBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Client-side pre-flight. Storage rules enforce the same limits server-side —
 * this exists so the owner gets a useful message instead of a failed upload.
 * @returns {string|null} an error message, or null when the file is fine.
 */
export function validateResumeFile(file) {
  if (!file) return "Choose a PDF first.";
  const looksPdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  if (!looksPdf) return "That isn't a PDF — the resume viewer can only render PDFs.";
  if (!file.size) return "That file is empty.";
  if (file.size > RESUME_MAX_BYTES)
    return `Too large (${formatBytes(file.size)}). The limit is ${formatBytes(
      RESUME_MAX_BYTES
    )}.`;
  return null;
}

// Strip anything that would break the Content-Disposition header, and keep a
// .pdf extension so the saved file opens in the right app.
function downloadName(name) {
  const base = (name || "resume.pdf")
    .replace(/\.pdf$/i, "")
    .replace(/[^\w \-.]/g, "")
    .trim()
    .slice(0, 80);
  return `${base || "resume"}.pdf`;
}

/**
 * Upload a new resume and point the site at it.
 * @param {File} file the chosen PDF
 * @param {(pct: number) => void} [onProgress] 0-100 as bytes transfer
 * @returns {Promise<{url: string, name: string, size: number, updatedAt: string}>}
 */
export async function uploadResume(file, onProgress) {
  const problem = validateResumeFile(file);
  if (problem) throw new Error(problem);

  const { storage, sdk } = await getStorageApi();
  const task = sdk.uploadBytesResumable(sdk.ref(storage, RESUME_PATH), file, {
    contentType: "application/pdf",
    // The download URL is cross-origin, where an <a download> attribute is
    // ignored — this is what makes "Download CV" save the file rather than
    // navigate to it.
    contentDisposition: `attachment; filename="${downloadName(file.name)}"`,
    cacheControl: "public, max-age=300",
  });

  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress && snap.totalBytes)
          onProgress(
            Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          );
      },
      reject,
      resolve
    );
  });

  const url = await sdk.getDownloadURL(task.snapshot.ref);
  const meta = {
    url,
    name: file.name || "resume.pdf",
    size: file.size,
    updatedAt: new Date().toISOString(),
  };

  const { db, fs } = await getDb();
  await fs.setDoc(fs.doc(db, "meta", "site"), { resume: meta }, { merge: true });
  return meta;
}

/**
 * Drop the uploaded resume so the site falls back to the PDF bundled in
 * src/Assets. The pointer goes first: if the object delete fails the site is
 * already back on the bundled copy, which is the state that matters.
 */
export async function clearResume() {
  const { db, fs } = await getDb();
  await fs.setDoc(
    fs.doc(db, "meta", "site"),
    { resume: fs.deleteField() },
    { merge: true }
  );
  try {
    const { storage, sdk } = await getStorageApi();
    await sdk.deleteObject(sdk.ref(storage, RESUME_PATH));
  } catch (_) {
    // Already gone, or Storage unreachable — the pointer is what the site reads.
  }
}

// Per-language text overlay (the full i18next tree for that language).
export async function saveText(lang, tree) {
  const { db, fs } = await getDb();
  return fs.setDoc(fs.doc(db, "content", lang), tree);
}
