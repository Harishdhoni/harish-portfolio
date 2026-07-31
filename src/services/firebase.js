// =============================================================
//  Firebase — shared Guild Board backend (Firestore + Auth)
// -------------------------------------------------------------
//  Config comes from env vars (see .env.example). When the keys
//  aren't set, `firebaseReady` is false and the Guild Board falls
//  back to per-browser localStorage, so the site always works.
//
//  These keys are safe to expose in the client bundle — Firebase
//  access is governed by Firestore Security Rules, not by hiding
//  the config. See firestore.rules.
//
//  LOADING: the SDK is imported *dynamically*, never at module
//  scope. Firestore alone is ~410 KB minified (it bundles re2js)
//  and Auth another ~90 KB — statically importing them put half
//  the main bundle on the critical path for a page whose hero
//  needs no backend at all. Callers await getDb()/getAuthApi(),
//  which webpack emits as separate chunks fetched on first use.
//  Each returns the SDK namespace alongside the instance, so
//  consumers get `fs.collection(...)` instead of a static import.
// =============================================================

const config = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// The owner's Auth UID — only this user may delete pins (enforced by rules).
// Optional in the client; used to decide when to show delete controls.
export const OWNER_UID = process.env.REACT_APP_GUILD_OWNER_UID || "";

// Sync flag: a plain env check, so callers can branch on it without loading
// anything. Everything below is async and only ever runs when it's true.
export const firebaseReady = Boolean(
  config.apiKey && config.projectId && config.appId
);

const notConfigured = () =>
  Promise.reject(new Error("Firebase is not configured"));

// ---- app (shared by both SDKs, initialised once) ---------------------------
let appPromise = null;
function getApp() {
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ initializeApp }) =>
      initializeApp(config)
    );
  }
  return appPromise;
}

// ---- Firestore -------------------------------------------------------------
let dbPromise = null;
/**
 * Load Firestore on demand.
 * @returns {Promise<{db: object, fs: object}>} the instance plus the SDK
 *   namespace (`fs.collection`, `fs.doc`, `fs.onSnapshot`, …).
 */
export function getDb() {
  if (!firebaseReady) return notConfigured();
  if (!dbPromise) {
    dbPromise = Promise.all([getApp(), import("firebase/firestore")]).then(
      ([app, fs]) => ({ db: fs.getFirestore(app), fs })
    );
  }
  return dbPromise;
}

// ---- Auth ------------------------------------------------------------------
let authPromise = null;
/**
 * Load Auth on demand. Kept in its own chunk from Firestore: a visitor who
 * never signs in should never pay for it.
 * @returns {Promise<{auth: object, authApi: object}>}
 */
export function getAuthApi() {
  if (!firebaseReady) return notConfigured();
  if (!authPromise) {
    authPromise = Promise.all([getApp(), import("firebase/auth")]).then(
      ([app, authApi]) => ({ auth: authApi.getAuth(app), authApi })
    );
  }
  return authPromise;
}

// ---- Storage ---------------------------------------------------------------
let storagePromise = null;
/**
 * Load Cloud Storage on demand. Only the admin panel writes to it (the resume
 * upload); visitors read the resulting download URL straight over HTTP and
 * never load this chunk at all.
 * @returns {Promise<{storage: object, sdk: object}>}
 */
export function getStorageApi() {
  if (!firebaseReady) return notConfigured();
  if (!storagePromise) {
    storagePromise = Promise.all([getApp(), import("firebase/storage")]).then(
      ([app, sdk]) => ({ storage: sdk.getStorage(app), sdk })
    );
  }
  return storagePromise;
}
