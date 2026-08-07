import { resolveCertification, resolveCertifications } from "./registries";

// Certification documents are hand-entered in the admin panel, so most fields
// are legitimately absent on a sparse row. The resolver is what stops that
// reaching the component as `undefined` and blowing up on `.length` / `.map`.
describe("resolveCertification", () => {
  it("defaults every optional field so a sparse document still renders", () => {
    const c = resolveCertification({ id: "a" });
    expect(c).toMatchObject({
      id: "a",
      title: "",
      issuer: "",
      issued: "",
      expires: "",
      credentialId: "",
      url: "",
      skills: [],
      description: "",
    });
    // Always a component, even for an unknown/missing iconKey.
    expect(typeof c.icon).toBe("function");
  });

  it("falls back to the generic mark for an unknown issuer key", () => {
    const known = resolveCertification({ id: "a", iconKey: "aws" });
    const unknown = resolveCertification({ id: "b", iconKey: "nope" });
    const blank = resolveCertification({ id: "c" });
    expect(typeof unknown.icon).toBe("function");
    expect(unknown.icon).toBe(blank.icon);
    expect(known.icon).not.toBe(blank.icon);
  });
});

describe("resolveCertifications", () => {
  it("sorts by order and leaves the input array untouched", () => {
    const docs = [
      { id: "b", order: 2 },
      { id: "a", order: 1 },
    ];
    expect(resolveCertifications(docs).map((c) => c.id)).toEqual(["a", "b"]);
    expect(docs.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("treats a missing order as 0 rather than dropping the row", () => {
    const out = resolveCertifications([{ id: "b", order: 1 }, { id: "a" }]);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
