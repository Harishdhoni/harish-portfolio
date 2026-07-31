// =============================================================
//  textTree — overlay merge / diff / prune
// -------------------------------------------------------------
//  These guard the bug that made a copy change in src/locales
//  paint correctly and then get overwritten by the published
//  Firestore snapshot a moment later: the overlay must carry only
//  the owner's own edits, and never UI chrome.
// =============================================================
import {
  mergeTrees,
  diffTree,
  pruneCodeOwned,
  CODE_OWNED_NAMESPACES,
} from "./textTree";

describe("mergeTrees", () => {
  it("overlays leaves without dropping untouched siblings", () => {
    const base = { home: { hero: { greeting: "Hi", value: "Long copy" } } };
    const out = mergeTrees(base, { home: { hero: { greeting: "Hello" } } });
    expect(out).toEqual({
      home: { hero: { greeting: "Hello", value: "Long copy" } },
    });
  });

  it("keeps keys the overlay has never heard of (added in code since)", () => {
    const out = mergeTrees({ a: "1", added: "new" }, { a: "2" });
    expect(out).toEqual({ a: "2", added: "new" });
  });

  it("replaces arrays whole rather than merging by index", () => {
    const out = mergeTrees({ roles: ["a", "b", "c"] }, { roles: ["x"] });
    expect(out).toEqual({ roles: ["x"] });
  });

  it("does not mutate either input", () => {
    const base = { home: { greeting: "Hi" } };
    const overlay = { home: { greeting: "Hello" } };
    mergeTrees(base, overlay);
    expect(base.home.greeting).toBe("Hi");
    expect(overlay.home.greeting).toBe("Hello");
  });
});

describe("diffTree", () => {
  const bundle = {
    home: { hero: { greeting: "Hi", value: "Long copy" }, roles: ["a", "b"] },
    about: { heading: "About" },
  };

  it("keeps only changed leaves and prunes empty branches", () => {
    const edited = {
      home: { hero: { greeting: "Hello", value: "Long copy" }, roles: ["a", "b"] },
      about: { heading: "About" },
    };
    expect(diffTree(edited, bundle)).toEqual({
      home: { hero: { greeting: "Hello" } },
    });
  });

  it("returns nothing when the tree matches the bundle", () => {
    expect(diffTree(bundle, bundle)).toEqual({});
  });

  it("keeps leaves the bundle does not have", () => {
    expect(diffTree({ about: { heading: "About", extra: "x" } }, bundle)).toEqual({
      about: { extra: "x" },
    });
  });

  it("treats a reordered array as a change", () => {
    const edited = { home: { ...bundle.home, roles: ["b", "a"] } };
    expect(diffTree(edited, bundle)).toEqual({ home: { roles: ["b", "a"] } });
  });

  it("survives a missing baseline branch", () => {
    expect(diffTree({ guild: { title: "Board" } }, bundle)).toEqual({
      guild: { title: "Board" },
    });
  });
});

describe("pruneCodeOwned", () => {
  it("drops code-owned namespaces and keeps content ones", () => {
    const tree = {
      home: { greeting: "Hi" },
      about: { heading: "About" },
      education: { heading: "Edu" },
      skills: { heading: "Skills" },
      visitors: { prompt: { hint: "stale" } },
      nav: { home: "Home" },
    };
    expect(Object.keys(pruneCodeOwned(tree)).sort()).toEqual([
      "about",
      "education",
      "home",
      "skills",
    ]);
  });

  it("covers the visitor prompt — the namespace that regressed", () => {
    expect(CODE_OWNED_NAMESPACES).toContain("visitors");
  });

  it("leaves a tree with no chrome untouched", () => {
    const tree = { home: { greeting: "Hi" } };
    expect(pruneCodeOwned(tree)).toEqual(tree);
  });
});

describe("publish round trip", () => {
  it("lets a later code copy change win over an old full-tree snapshot", () => {
    // What the database holds: everything, frozen at publish time.
    const publishedSnapshot = {
      home: { hero: { greeting: "Hey there" } },
      visitors: { prompt: { hint: "totally optional" } },
    };
    // What the code says now, after the copy edit.
    const bundleNow = {
      home: { hero: { greeting: "Hi" } },
      visitors: { prompt: { hint: "a name is required" } },
    };

    const rendered = mergeTrees(bundleNow, pruneCodeOwned(publishedSnapshot));

    expect(rendered.visitors.prompt.hint).toBe("a name is required"); // code wins
    expect(rendered.home.hero.greeting).toBe("Hey there"); // owner edit wins
  });

  it("republishing stores only the owner's edit", () => {
    const bundle = {
      home: { hero: { greeting: "Hi" } },
      visitors: { prompt: { hint: "a name is required" } },
    };
    const editedInPanel = {
      home: { hero: { greeting: "Hey there" } },
      visitors: { prompt: { hint: "a name is required" } },
    };
    expect(diffTree(pruneCodeOwned(editedInPanel), bundle)).toEqual({
      home: { hero: { greeting: "Hey there" } },
    });
  });
});
