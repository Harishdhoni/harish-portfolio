// =============================================================
//  Visitor log store
// -------------------------------------------------------------
//  Same shape as the Guild Board store — one API, two backends:
//   • Firebase configured → Firestore `visits` collection. Anyone
//     may add a visit; only the owner may READ the log (enforced
//     by firestore.rules), so visitor data stays private.
//   • Not configured      → per-browser localStorage fallback, so
//     the site still works (the owner then only sees their own
//     browser's visits).
//  A visit is logged once per session; the visitor is then asked for
//  their name (required by VisitorPrompt), which patches the same doc
//  (empty → name). A doc can still be nameless if they never answer.
// =============================================================
//  The Firestore SDK is loaded on demand (see services/firebase.js), so a
//  visitor who never reaches the log never downloads it.
import { firebaseReady, getDb } from "../../services/firebase";

export { firebaseReady };

const COLLECTION = "visits";
const LOCAL_KEY = "pv.visits.v1"; // local fallback log

function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    /* ignore */
  }
}

// Tiny pub/sub so the local backend can push updates like Firestore does.
const subs = new Set();
const emit = () => {
  const visits = readJSON(LOCAL_KEY, []);
  subs.forEach((cb) => cb(visits));
};

// Log a visit. Returns the doc id so a name can be attached later.
export async function logVisit(meta) {
  const base = { name: "", ...meta };
  if (firebaseReady) {
    const { db, fs } = await getDb();
    const ref = await fs.addDoc(fs.collection(db, COLLECTION), {
      ...base,
      createdClient: Date.now(), // present in the local echo → instant sort
      createdAt: fs.serverTimestamp(),
      date: new Date().toDateString(),
    });
    return ref.id;
  }
  const id = `v-${Date.now()}`;
  const rec = { id, ...base, createdClient: Date.now(), date: new Date().toDateString() };
  writeJSON(LOCAL_KEY, [rec, ...readJSON(LOCAL_KEY, [])].slice(0, 500));
  emit();
  return id;
}

// Attach a self-provided name to an existing visit (rules allow empty → name).
export async function setVisitName(id, name) {
  if (!id || !name) return;
  if (firebaseReady) {
    const { db, fs } = await getDb();
    await fs.updateDoc(fs.doc(db, COLLECTION, id), { name });
    return;
  }
  const next = readJSON(LOCAL_KEY, []).map((v) =>
    v.id === id ? { ...v, name } : v
  );
  writeJSON(LOCAL_KEY, next);
  emit();
}

// Subscribe to the visit log, newest first. Owner-only under Firebase (the
// read rule denies everyone else, so onSnapshot only succeeds for the owner).
// Returns an unsubscribe fn.
export function subscribeVisits(cb) {
  if (firebaseReady) {
    let stop = null;
    let cancelled = false;
    getDb()
      .then(({ db, fs }) => {
        if (cancelled) return;
        const q = fs.query(
          fs.collection(db, COLLECTION),
          fs.orderBy("createdClient", "desc"),
          fs.limit(500)
        );
        stop = fs.onSnapshot(
          q,
          (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          (err) => {
            // eslint-disable-next-line no-console
            console.error("Visits subscribe failed:", err);
            cb([]);
          }
        );
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Visits subscribe failed:", err);
        if (!cancelled) cb([]);
      });
    return () => {
      cancelled = true;
      if (stop) stop();
    };
  }
  subs.add(cb);
  cb(readJSON(LOCAL_KEY, []));
  return () => subs.delete(cb);
}

// Owner-only: remove a visit (Firestore rules enforce this server-side).
export async function deleteVisit(id) {
  if (firebaseReady) {
    const { db, fs } = await getDb();
    await fs.deleteDoc(fs.doc(db, COLLECTION, id));
    return;
  }
  writeJSON(LOCAL_KEY, readJSON(LOCAL_KEY, []).filter((v) => v.id !== id));
  emit();
}
