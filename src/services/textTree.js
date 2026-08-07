// =============================================================
//  i18n text-tree helpers (pure logic)
// -------------------------------------------------------------
//  The admin panel publishes copy as a per-language document in
//  Firestore (content/{lang}) that the site deep-merges over the
//  bundled locale JSON. These helpers keep that overlay an
//  *overlay* — only the leaves the owner actually changed —
//  instead of a full snapshot of the tree.
//
//  Why it matters: a snapshot freezes every string at publish
//  time, so a later copy change in src/locales/*.json paints
//  correctly and is then overwritten by the stale database copy
//  a moment after load. Storing just the diff means untouched
//  keys always come from the code.
//
//  Arrays (typewriter roles, project modules) are compared and
//  merged as single values — a partial array overlay would be
//  ambiguous, and every array here is an ordered whole.
// =============================================================

// Namespaces that belong to the code, not to the owner's content: UI chrome
// whose English lives in src/locales/en.json and whose Hindi/Tamil come from
// the same files. The admin panel has no fields for them, so anything the
// overlay holds here can only be a stale snapshot — ignored on read, never
// written. Content namespaces (home, about, education, skills) stay editable.
export const CODE_OWNED_NAMESPACES = [
  "nav",
  "carousel",
  "visitors",
  "assistant",
  "guild",
  "contact",
  "connect",
  "footer",
  "resume",
];

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Deep-merge an overlay tree over a base tree (overlay wins, arrays atomic).
 * Returns a new object; neither input is mutated.
 */
export function mergeTrees(base, overlay) {
  if (!isPlain(overlay)) return overlay === undefined ? base : overlay;
  const out = isPlain(base) ? { ...base } : {};
  Object.keys(overlay).forEach((k) => {
    const v = overlay[k];
    out[k] = isPlain(v) ? mergeTrees(out[k], v) : v;
  });
  return out;
}

/**
 * Keep only the leaves of `tree` that differ from `base`, pruning branches that
 * end up empty. Leaves missing from `base` (genuinely new keys) are kept.
 * Deletions aren't expressible — an overlay can override copy, not remove it.
 */
export function diffTree(tree, base) {
  if (!isPlain(tree)) return tree;
  const out = {};
  Object.keys(tree).forEach((k) => {
    const v = tree[k];
    const b = isPlain(base) ? base[k] : undefined;
    if (isPlain(v)) {
      const sub = diffTree(v, b);
      if (Object.keys(sub).length) out[k] = sub;
    } else if (!same(v, b)) {
      out[k] = v;
    }
  });
  return out;
}

/**
 * Drop the code-owned namespaces from an overlay tree, so bundled UI chrome
 * copy can never be shadowed by an older published snapshot.
 */
export function pruneCodeOwned(tree) {
  if (!isPlain(tree)) return tree;
  const out = {};
  Object.keys(tree).forEach((k) => {
    if (!CODE_OWNED_NAMESPACES.includes(k)) out[k] = tree[k];
  });
  return out;
}
