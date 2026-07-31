// =============================================================
//  AdminPanel — owner-only in-site content editor
// -------------------------------------------------------------
//  Mounted once in App. Renders nothing for regular visitors.
//
//  Access:
//   • Sign in via the Guild Board owner login, OR visit any page
//     with ?admin in the URL to get a sign-in prompt.
//   • Once the signed-in account matches the owner (Firebase
//     Auth + firestore.rules), a floating "Content" button opens
//     the editor drawer.
//
//  It edits the same Firestore collections the site reads
//  (projects, education, techstack, toolstack, meta/site stats,
//  and the content/{lang} text overlays). When a collection is
//  still empty it seeds the editor from the bundled defaults, so
//  the panel also works as a first-run seeding tool. After a save
//  it calls the content context's refresh() so edits show live.
// =============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiEdit3,
  FiX,
  FiPlus,
  FiTrash2,
  FiSave,
  FiLogOut,
  FiGlobe,
  FiUploadCloud,
  FiFileText,
  FiExternalLink,
} from "react-icons/fi";
import OwnerLogin from "../Guild/OwnerLogin";
import { useContent } from "../content/ContentProvider";
import {
  firebaseReady,
  subscribeOwner,
  ownerSignOut,
  loadStructuralContent,
  loadTextOverlays,
  saveItem,
  deleteItem,
  saveStats,
  saveText,
  subscribePins,
  updatePin,
  deletePin,
  describeWriteError,
  uploadResume,
  clearResume,
  validateResumeFile,
  formatBytes,
  RESUME_MAX_BYTES,
} from "./adminStore";
import {
  SKILL_ICONS,
  EDU_ICONS,
  PROJECT_IMAGES,
  DEFAULT_PROJECTS,
  DEFAULT_EDUCATION,
  DEFAULT_TECHSTACK,
  DEFAULT_TOOLSTACK,
  DEFAULT_STATS,
} from "../content/registries";
import {
  mergeTrees,
  diffTree,
  pruneCodeOwned,
} from "../../services/textTree";
import {
  TARGET_LANGS,
  LANG_LABELS,
  collectTranslatable,
  translateEntries,
  applyTranslations,
  TranslationUnavailable,
} from "../../services/translate";
import enLocale from "../../locales/en.json";
import hiLocale from "../../locales/hi.json";
import taLocale from "../../locales/ta.json";

const SKILL_KEYS = Object.keys(SKILL_ICONS);
const EDU_KEYS = Object.keys(EDU_ICONS);
const IMG_KEYS = ["", ...Object.keys(PROJECT_IMAGES)];
const LOCALES = { en: enLocale, hi: hiLocale, ta: taLocale };

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `item-${Date.now()}`;

const clone = (obj) => JSON.parse(JSON.stringify(obj));

// ---- nested get/set by dotted path (immutable set) -------------------------
const getPath = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

const setPath = (obj, path, value) => {
  const keys = path.split(".");
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    cur[k] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return root;
};

// Trim + drop empty entries from string arrays anywhere in the tree (keeps the
// typewriter roles / project modules clean when a trailing blank line is left).
const sanitizeTree = (node) => {
  if (Array.isArray(node)) {
    const arr = node.map(sanitizeTree);
    return arr.every((x) => typeof x === "string")
      ? arr.map((s) => s.trim()).filter(Boolean)
      : arr;
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = sanitizeTree(node[k]);
    return out;
  }
  return node;
};

// Friendly, content-bearing text fields (the rest of the i18n tree — nav,
// contact, guild, footer, etc. — passes through untouched, and stays reachable
// via the Advanced (raw JSON) toggle).
const KEEP_TAGS = "Keep the <1>…</1> markers around the accented word.";
const TEXT_GROUPS = [
  {
    title: "Hero",
    fields: [
      { path: "home.hero.eyebrow", label: "Eyebrow" },
      { path: "home.hero.greeting", label: "Greeting" },
      { path: "home.hero.rolePrefix", label: "Role prefix" },
      { path: "home.hero.value", label: "Value paragraph", textarea: true },
      { path: "home.roles", label: "Typewriter roles (one per line)", lines: true },
    ],
  },
  {
    title: "Intro",
    fields: [
      { path: "home.intro.eyebrow", label: "Eyebrow" },
      { path: "home.intro.heading", label: "Heading", hint: KEEP_TAGS },
      { path: "home.intro.p1", label: "Paragraph 1", textarea: true },
      { path: "home.intro.p3", label: "Paragraph 2", textarea: true },
    ],
  },
  {
    title: "About",
    fields: [
      { path: "about.eyebrow", label: "Eyebrow" },
      { path: "about.heading", label: "Heading", hint: KEEP_TAGS },
      { path: "about.card.p1", label: "Paragraph 1", textarea: true, hint: KEEP_TAGS },
      { path: "about.card.p2", label: "Paragraph 2", textarea: true, hint: KEEP_TAGS },
      { path: "about.card.interestsIntro", label: "Interests intro" },
      { path: "about.card.sports", label: "Interest — sports" },
      { path: "about.card.travel", label: "Interest — travel" },
      { path: "about.card.music", label: "Interest — music" },
      { path: "about.card.quote", label: "Quote" },
    ],
  },
  {
    title: "Section headings",
    fields: [
      { path: "education.eyebrow", label: "Education — eyebrow" },
      { path: "education.heading", label: "Education — heading", hint: KEEP_TAGS },
      { path: "skills.eyebrow", label: "Skills — eyebrow" },
      { path: "skills.heading", label: "Skills — heading", hint: KEEP_TAGS },
      { path: "skills.showcase.eyebrow", label: "Projects — eyebrow" },
      { path: "skills.showcase.heading", label: "Projects — heading", hint: KEEP_TAGS },
      { path: "skills.showcase.lead", label: "Projects — lead", textarea: true },
    ],
  },
];

const EDU_FIELDS = [
  { key: "degree", label: "Degree" },
  { key: "field", label: "Field" },
  { key: "institution", label: "Institution" },
  { key: "location", label: "Location" },
  { key: "period", label: "Period" },
  { key: "grade", label: "Grade" },
  { key: "description", label: "Description", textarea: true },
];

// ---- (de)serialize between Firestore docs and editable form rows -----------
const initProject = (d) => ({
  id: d.id || slug(d.abbr || d.title),
  order: d.order ?? 0,
  abbr: d.abbr || "",
  title: d.title || "",
  description: d.description || "",
  modulesText: (d.modules || []).join("\n"),
  tagsText: (d.tags || []).join(", "),
  ghLink: d.ghLink || "",
  demoLink: d.demoLink || "",
  imgKey: d.imgKey || "",
});
const serializeProject = (r) => ({
  order: Number(r.order) || 0,
  abbr: r.abbr.trim(),
  title: r.title.trim(),
  description: r.description.trim(),
  modules: r.modulesText.split("\n").map((s) => s.trim()).filter(Boolean),
  tags: r.tagsText.split(",").map((s) => s.trim()).filter(Boolean),
  ghLink: r.ghLink.trim(),
  demoLink: r.demoLink.trim(),
  imgKey: r.imgKey,
});

// The site renders a project's description/modules from the i18n keys
// skills.projects.<abbr>.* (falling back to the doc fields), so the English the
// owner types on the Projects tab is mirrored into the EN text tree on save.
// The auto-translation pass then picks it up like any other English edit.
const syncProjectText = (enTree, rows) =>
  rows.reduce((tree, r) => {
    const abbr = (r.abbr || "").trim();
    if (!abbr) return tree;
    const modules = r.modulesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const withDesc = setPath(
      tree,
      `skills.projects.${abbr}.description`,
      r.description.trim()
    );
    return setPath(withDesc, `skills.projects.${abbr}.modules`, modules);
  }, enTree);

const initEdu = (d) => ({
  id: d.id || "",
  order: d.order ?? 0,
  iconKey: d.iconKey || EDU_KEYS[0],
});
const serializeEdu = (r) => ({ order: Number(r.order) || 0, iconKey: r.iconKey });

const initSkill = (d) => ({
  id: d.id || slug(d.label),
  order: d.order ?? 0,
  label: d.label || "",
  iconKey: d.iconKey || SKILL_KEYS[0],
  color: d.color || "",
});
const serializeSkill = (r) => {
  const out = { order: Number(r.order) || 0, label: r.label.trim(), iconKey: r.iconKey };
  if (r.color.trim()) out.color = r.color.trim();
  return out;
};

// ---- small building blocks --------------------------------------------------
function Field({ label, children }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      {children}
    </label>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`admin-toast admin-toast--${toast.kind}`} role="status">
      {toast.text}
    </div>
  );
}

// ---- collection editor (tech / tools / education share this shape) ---------
function CollectionEditor({
  rows,
  setRows,
  columns,
  makeBlank,
  keyLabel = "ID / key",
}) {
  const update = (idx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const add = () => setRows((prev) => [...prev, makeBlank()]);

  return (
    <div className="admin-list">
      {rows.map((row, idx) => (
        <div className="admin-row glass" key={idx}>
          <Field label={keyLabel}>
            <input
              className="form-input"
              value={row.id}
              onChange={(e) => update(idx, { id: e.target.value })}
            />
          </Field>
          {columns.map((col) => (
            <Field label={col.label} key={col.key}>
              {col.options ? (
                <select
                  className="form-input"
                  value={row[col.key]}
                  onChange={(e) => update(idx, { [col.key]: e.target.value })}
                >
                  {col.options.map((o) => (
                    <option key={o} value={o}>
                      {o === "" ? "— none —" : o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  type={col.type || "text"}
                  value={row[col.key]}
                  onChange={(e) => update(idx, { [col.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
          <button
            type="button"
            className="admin-row__del"
            onClick={() => remove(idx)}
            aria-label="Remove"
            title="Remove"
          >
            <FiTrash2 />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline admin-add" onClick={add}>
        <FiPlus /> Add
      </button>
    </div>
  );
}

// ---- projects editor (richer fields) ---------------------------------------
function ProjectsEditor({ rows, setRows }) {
  const update = (idx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const add = () =>
    setRows((prev) => [
      ...prev,
      initProject({ order: (prev[prev.length - 1]?.order || 0) + 1 }),
    ]);

  return (
    <div className="admin-list">
      <p className="admin-hint">
        Write description &amp; modules in <strong>English</strong> — saving also
        publishes them to <code>skills.projects.&lt;abbr&gt;</code> and
        auto-translates them into Hindi &amp; Tamil. <code>Title</code> and{" "}
        <code>tags</code> are shown as typed in every language.
      </p>
      {rows.map((row, idx) => (
        <div className="admin-row admin-row--stack glass" key={idx}>
          <div className="admin-row__grid">
            <Field label="Doc ID">
              <input
                className="form-input"
                value={row.id}
                onChange={(e) => update(idx, { id: e.target.value })}
              />
            </Field>
            <Field label="Order">
              <input
                className="form-input"
                type="number"
                value={row.order}
                onChange={(e) => update(idx, { order: e.target.value })}
              />
            </Field>
            <Field label="Abbr (translation key)">
              <input
                className="form-input"
                value={row.abbr}
                onChange={(e) => update(idx, { abbr: e.target.value })}
              />
            </Field>
            <Field label="Cover image">
              <select
                className="form-input"
                value={row.imgKey}
                onChange={(e) => update(idx, { imgKey: e.target.value })}
              >
                {IMG_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k === "" ? "— abbr gradient —" : k}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Title">
            <input
              className="form-input"
              value={row.title}
              onChange={(e) => update(idx, { title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              className="form-input form-textarea"
              rows={3}
              value={row.description}
              onChange={(e) => update(idx, { description: e.target.value })}
            />
          </Field>
          <div className="admin-row__grid">
            <Field label="Modules (one per line)">
              <textarea
                className="form-input form-textarea"
                rows={3}
                value={row.modulesText}
                onChange={(e) => update(idx, { modulesText: e.target.value })}
              />
            </Field>
            <Field label="Tags (comma separated)">
              <textarea
                className="form-input form-textarea"
                rows={3}
                value={row.tagsText}
                onChange={(e) => update(idx, { tagsText: e.target.value })}
              />
            </Field>
          </div>
          <div className="admin-row__grid">
            <Field label="Code link (ghLink)">
              <input
                className="form-input"
                value={row.ghLink}
                onChange={(e) => update(idx, { ghLink: e.target.value })}
              />
            </Field>
            <Field label="Demo link">
              <input
                className="form-input"
                value={row.demoLink}
                onChange={(e) => update(idx, { demoLink: e.target.value })}
              />
            </Field>
          </div>
          <button
            type="button"
            className="btn btn-outline admin-row__remove"
            onClick={() => remove(idx)}
          >
            <FiTrash2 /> Remove project
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline admin-add" onClick={add}>
        <FiPlus /> Add project
      </button>
    </div>
  );
}

// ---- stats editor -----------------------------------------------------------
function StatsEditor({ rows, setRows }) {
  const update = (idx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const add = () =>
    setRows((prev) => [...prev, { order: prev.length + 1, key: "", value: "", suffix: "" }]);

  return (
    <div className="admin-list">
      <p className="admin-hint">
        <code>key</code> maps to the label in <code>skills.stats.&lt;key&gt;</code>
        (Text tab). A numeric <code>value</code> animates as a count-up.
      </p>
      {rows.map((row, idx) => (
        <div className="admin-row glass" key={idx}>
          <Field label="Order">
            <input
              className="form-input"
              type="number"
              value={row.order}
              onChange={(e) => update(idx, { order: e.target.value })}
            />
          </Field>
          <Field label="Key">
            <input
              className="form-input"
              value={row.key}
              onChange={(e) => update(idx, { key: e.target.value })}
            />
          </Field>
          <Field label="Value">
            <input
              className="form-input"
              value={row.value}
              onChange={(e) => update(idx, { value: e.target.value })}
            />
          </Field>
          <Field label="Suffix">
            <input
              className="form-input"
              value={row.suffix}
              onChange={(e) => update(idx, { suffix: e.target.value })}
            />
          </Field>
          <button
            type="button"
            className="admin-row__del"
            onClick={() => remove(idx)}
            aria-label="Remove"
            title="Remove"
          >
            <FiTrash2 />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline admin-add" onClick={add}>
        <FiPlus /> Add stat
      </button>
    </div>
  );
}

// ---- text (i18n) editor: friendly fields + advanced raw-JSON escape hatch --
// English is the only editable language; the Hindi / Tamil views are read-only
// previews of what the auto-translation pass produced (see publishText).
function TextField({ trees, setTrees, lang, path, label, textarea, hint, readOnly }) {
  const value = getPath(trees[lang], path);
  const onChange = (e) =>
    setTrees((prev) => ({ ...prev, [lang]: setPath(prev[lang], path, e.target.value) }));
  const props = {
    className: "form-input",
    value: value == null ? "" : value,
    onChange,
    readOnly,
    disabled: readOnly,
  };
  return (
    <Field label={label}>
      {textarea ? (
        <textarea {...props} className="form-input form-textarea" rows={3} />
      ) : (
        <input {...props} />
      )}
      {hint && !readOnly && <span className="admin-field__hint">{hint}</span>}
    </Field>
  );
}

// Array-of-lines field: owns its textarea string so newlines type naturally;
// pushes the split array into the tree (blanks are pruned on save).
function LinesField({ trees, setTrees, lang, path, label, readOnly }) {
  const [str, setStr] = useState(() => (getPath(trees[lang], path) || []).join("\n"));
  const onChange = (e) => {
    setStr(e.target.value);
    setTrees((prev) => ({
      ...prev,
      [lang]: setPath(prev[lang], path, e.target.value.split("\n")),
    }));
  };
  return (
    <Field label={label}>
      <textarea
        className="form-input form-textarea"
        rows={3}
        value={str}
        onChange={onChange}
        readOnly={readOnly}
        disabled={readOnly}
      />
    </Field>
  );
}

function GroupSection({ title, fields, trees, setTrees, lang, readOnly }) {
  return (
    <div className="admin-group glass">
      <h3 className="admin-group__title">{title}</h3>
      <div className="admin-group__fields">
        {fields.map((f) =>
          f.lines ? (
            <LinesField
              key={lang + f.path}
              trees={trees}
              setTrees={setTrees}
              lang={lang}
              path={f.path}
              label={f.label}
              readOnly={readOnly}
            />
          ) : (
            <TextField
              key={lang + f.path}
              trees={trees}
              setTrees={setTrees}
              lang={lang}
              path={f.path}
              label={f.label}
              textarea={f.textarea}
              hint={f.hint}
              readOnly={readOnly}
            />
          )
        )}
      </div>
    </div>
  );
}

// Advanced view: raw JSON for the whole language tree. Edits sync into the tree
// only while the JSON is valid; the tree stays the source of truth for saving.
function AdvancedJson({ trees, setTrees, lang }) {
  const [str, setStr] = useState(() => JSON.stringify(trees[lang], null, 2));
  const [error, setError] = useState("");
  const onChange = (e) => {
    setStr(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      setError("");
      setTrees((prev) => ({ ...prev, [lang]: parsed }));
    } catch (_) {
      setError("Invalid JSON — fix to apply. (Other tabs still save.)");
    }
  };
  return (
    <div>
      {error && <p className="admin-field__hint admin-field__hint--err">{error}</p>}
      <textarea
        className="form-input form-textarea admin-json"
        spellCheck={false}
        value={str}
        onChange={onChange}
      />
    </div>
  );
}

function TextEditor({
  trees,
  setTrees,
  eduIds,
  projectAbbrs,
  statKeys,
  onRetranslate,
  busy,
}) {
  const [lang, setLang] = useState("en");
  const [advanced, setAdvanced] = useState(false);
  // Only English is editable — hi/ta are generated on save.
  const readOnly = lang !== "en";

  // Dynamic groups from the current education ids / project abbrs / stat keys.
  const eduGroups = eduIds.map((id) => ({
    title: `Education — ${id}`,
    fields: EDU_FIELDS.map((f) => ({
      path: `education.items.${id}.${f.key}`,
      label: f.label,
      textarea: f.textarea,
    })),
  }));
  const projectGroups = projectAbbrs.map((abbr) => ({
    title: `Project — ${abbr}`,
    fields: [
      { path: `skills.projects.${abbr}.description`, label: "Description", textarea: true },
      { path: `skills.projects.${abbr}.modules`, label: "Modules (one per line)", lines: true },
    ],
  }));
  const statGroup = statKeys.length
    ? [
        {
          title: "Stat labels",
          fields: statKeys.map((k) => ({
            path: `skills.stats.${k}`,
            label: k,
          })),
        },
      ]
    : [];
  const groups = [...TEXT_GROUPS, ...statGroup, ...eduGroups, ...projectGroups];

  return (
    <div className="admin-text">
      <p className="admin-hint">
        Write the copy in <strong>English</strong> only —{" "}
        {TARGET_LANGS.map((l) => LANG_LABELS[l]).join(" and ")} are translated
        automatically when you save, and stored alongside it. The database value
        overrides the bundled default; use <strong>Advanced</strong> to reach every
        key (nav, contact, footer…).
      </p>

      <div className="admin-text__bar">
        <div className="admin-tabs admin-tabs--sub">
          {["en", ...TARGET_LANGS].map((l) => (
            <button
              key={l}
              type="button"
              className={`admin-tab${lang === l ? " is-active" : ""}`}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
              {l !== "en" && <span className="admin-tab__badge">auto</span>}
            </button>
          ))}
        </div>
        <label className="admin-adv-toggle">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          Advanced (raw JSON)
        </label>
      </div>

      {readOnly && (
        <p className="admin-hint admin-hint--auto">
          <FiGlobe aria-hidden="true" />
          <span>
            {LANG_LABELS[lang]} is machine-translated from English. Edit the
            English and save — whatever you changed is re-translated, everything
            else keeps the translation it already has. To rebuild <em>every</em>{" "}
            key, use <strong>Re-translate all</strong>; to hand-correct a single
            string, switch on <strong>Advanced</strong> (the only place this
            language is editable).
          </span>
        </p>
      )}

      {advanced ? (
        // Raw JSON stays editable in every language: the escape hatch for
        // hand-correcting a machine translation. A key fixed here survives until
        // its English changes or "Re-translate all" runs.
        // Remount on language change so the textarea reloads that tree.
        <AdvancedJson key={lang} trees={trees} setTrees={setTrees} lang={lang} />
      ) : (
        <div className="admin-groups">
          {groups.map((g) => (
            <GroupSection
              key={g.title}
              title={g.title}
              fields={g.fields}
              trees={trees}
              setTrees={setTrees}
              lang={lang}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-outline admin-add"
        onClick={onRetranslate}
        disabled={busy}
      >
        <FiGlobe /> Re-translate all from English
      </button>
    </div>
  );
}

// ---- guild pins editor ------------------------------------------------------
function GuildEditor({ rows, setRows }) {
  const update = (idx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  if (!rows.length)
    return <p className="admin-hint">No pins on the wall yet.</p>;

  return (
    <div className="admin-list">
      <p className="admin-hint">
        Edit or remove visitor notes. Tick <strong>Loved</strong> to badge a note
        as “Loved by Harish”. Deletions apply on <strong>Save Guild</strong>.
        Curated seed notes live in code and aren’t listed here.
      </p>
      {rows.map((row, idx) => (
        <div className="admin-row admin-row--stack glass" key={row.id}>
          <div className="admin-guild__head">
            <span className="admin-guild__meta">
              {row.date} · {row.likes} likes
            </span>
            <label className="admin-adv-toggle">
              <input
                type="checkbox"
                checked={row.loved}
                onChange={(e) => update(idx, { loved: e.target.checked })}
              />
              Loved
            </label>
          </div>
          <div className="admin-row__grid">
            <Field label="Name">
              <input
                className="form-input"
                value={row.name}
                onChange={(e) => update(idx, { name: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Message">
            <textarea
              className="form-input form-textarea"
              rows={2}
              value={row.message}
              onChange={(e) => update(idx, { message: e.target.value })}
            />
          </Field>
          <button
            type="button"
            className="btn btn-outline admin-row__remove"
            onClick={() => remove(idx)}
          >
            <FiTrash2 /> Remove note
          </button>
        </div>
      ))}
    </div>
  );
}

// ---- resume upload ----------------------------------------------------------
/**
 * Replace the resume PDF the site serves.
 *
 * Unlike every other tab there is nothing to batch — a file either uploads or
 * it doesn't — so this acts on its own buttons rather than the footer's Save.
 * The uploaded file lives in Cloud Storage; meta/site.resume points at it, and
 * removing that pointer drops the site back to the PDF bundled in the build.
 */
function ResumeEditor({ current, onChanged, flash }) {
  const [file, setFile] = useState(null);
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // Validated on pick so the owner sees the problem before hitting Upload.
  const problem = file ? validateResumeFile(file) : null;

  const reset = () => {
    setFile(null);
    setPct(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const doUpload = async () => {
    if (!file || problem || busy) return;
    setBusy(true);
    setPct(0);
    try {
      const meta = await uploadResume(file, setPct);
      reset();
      await onChanged();
      flash("ok", `Resume updated — ${meta.name} is now live.`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Resume upload failed:", err);
      flash("err", describeWriteError(err));
    } finally {
      setBusy(false);
    }
  };

  const doClear = async () => {
    const ok = window.confirm(
      "Remove the uploaded resume?\n\n" +
        "The site goes back to the PDF bundled in the build until you upload another."
    );
    if (!ok) return;
    setBusy(true);
    try {
      await clearResume();
      reset();
      await onChanged();
      flash("ok", "Uploaded resume removed — back to the bundled PDF.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Resume removal failed:", err);
      flash("err", describeWriteError(err));
    } finally {
      setBusy(false);
    }
  };

  let updated = "";
  if (current && current.updatedAt) {
    const d = new Date(current.updatedAt);
    if (!Number.isNaN(d.getTime())) updated = d.toLocaleString();
  }

  return (
    <div className="admin-resume">
      <p className="admin-hint">
        Replaces the PDF shown in the Resume section and behind every “Download
        CV” button. Takes effect immediately — no rebuild, no redeploy.
      </p>

      <div className="admin-resume__current">
        <FiFileText className="admin-resume__icon" aria-hidden="true" />
        {current ? (
          <div className="admin-resume__meta">
            <strong>{current.name || "resume.pdf"}</strong>
            <span className="admin-resume__sub">
              {formatBytes(current.size)}
              {updated ? ` · uploaded ${updated}` : ""}
            </span>
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className="admin-resume__link"
            >
              <FiExternalLink aria-hidden="true" /> Open current PDF
            </a>
          </div>
        ) : (
          <div className="admin-resume__meta">
            <strong>Bundled resume</strong>
            <span className="admin-resume__sub">
              Serving src/Assets/harish_resume_new.pdf from the build — nothing
              has been uploaded yet.
            </span>
          </div>
        )}
      </div>

      <label className="admin-resume__pick">
        <span className="admin-resume__pickLabel">Choose a new PDF</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="form-input"
          onChange={(e) => {
            setFile((e.target.files && e.target.files[0]) || null);
            setPct(0);
          }}
          disabled={busy}
        />
      </label>

      {file && (
        <p className={`admin-resume__chosen${problem ? " is-bad" : ""}`}>
          {problem || `${file.name} · ${formatBytes(file.size)} — ready to upload.`}
        </p>
      )}

      {busy && pct > 0 && (
        <div
          className="admin-resume__bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="admin-resume__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={doUpload}
          disabled={!file || Boolean(problem) || busy}
        >
          <FiUploadCloud />{" "}
          {busy && pct > 0 ? `Uploading ${pct}%` : "Upload resume"}
        </button>
        {current && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={doClear}
            disabled={busy}
          >
            <FiTrash2 /> Revert to bundled
          </button>
        )}
      </div>

      <p className="admin-hint">
        PDF only, up to {formatBytes(RESUME_MAX_BYTES)}. Storage rules enforce
        the same limits, so a bad file is rejected server-side too.
      </p>
    </div>
  );
}

// ---- the drawer -------------------------------------------------------------
const TABS = [
  "Projects",
  "Education",
  "Tech",
  "Tools",
  "Stats",
  "Text",
  "Resume",
  "Guild",
];

// Tabs that manage their own writes, so the footer's batch Save doesn't apply.
const SELF_SAVING_TABS = ["Resume"];

function AdminDrawer({ onClose }) {
  const { refresh, resume } = useContent();
  const [tab, setTab] = useState("Projects");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [projects, setProjects] = useState([]);
  const [education, setEducation] = useState([]);
  const [tech, setTech] = useState([]);
  const [tools, setTools] = useState([]);
  const [stats, setStats] = useState([]);
  const [textTrees, setTextTrees] = useState({ en: {}, hi: {}, ta: {} });
  const [guild, setGuild] = useState([]);
  // English tree as last loaded/saved — the diff base that decides which keys
  // need re-translating, so untouched copy keeps its existing translation.
  const enBaseline = useRef(null);
  // Live progress for the translation pass: { lang, done, total }.
  const [mt, setMt] = useState(null);
  // Ids present when loaded, per collection — used to delete removed rows.
  const [originals, setOriginals] = useState({});
  // Guild pins as loaded, keyed by id — used to detect edits / removals.
  const [guildOriginals, setGuildOriginals] = useState({});
  const toastTimer = useRef(0);

  // Errors explain how to fix something, so they linger; confirmations don't.
  // The pending timer is cancelled first, or a long error timeout would cut a
  // later toast short.
  const flash = useCallback((kind, msg) => {
    window.clearTimeout(toastTimer.current);
    setToast({ kind, text: msg });
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      kind === "err" ? 9000 : 3200
    );
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Load current content — falling back to bundled defaults for any empty
  // collection so the panel can also seed a fresh database.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [structural, overlays] = await Promise.all([
        loadStructuralContent(),
        loadTextOverlays(),
      ]);
      if (cancelled) return;
      const or = (rows, fallback) =>
        Array.isArray(rows) && rows.length ? rows : fallback;

      const p = or(structural?.projects, DEFAULT_PROJECTS).map(initProject);
      const e = or(structural?.education, DEFAULT_EDUCATION).map(initEdu);
      const tc = or(structural?.techstack, DEFAULT_TECHSTACK).map(initSkill);
      const tl = or(structural?.toolstack, DEFAULT_TOOLSTACK).map(initSkill);
      const st = or(structural?.stats, DEFAULT_STATS).map((s) => ({
        order: s.order ?? 0,
        key: s.key || "",
        value: s.value ?? "",
        suffix: s.suffix || "",
      }));

      setProjects(p);
      setEducation(e);
      setTech(tc);
      setTools(tl);
      setStats(st);
      // The overlay holds only the leaves the owner has changed, so merge it
      // over the bundled locale (same as the site does) to get a complete tree
      // to edit — otherwise keys added in code since the last publish would be
      // missing from the editor. mergeTrees copies, so the imported locale
      // modules and the overlay docs are never mutated.
      const en = mergeTrees(LOCALES.en, (overlays && overlays.en) || {});
      setTextTrees({
        en,
        hi: mergeTrees(LOCALES.hi, (overlays && overlays.hi) || {}),
        ta: mergeTrees(LOCALES.ta, (overlays && overlays.ta) || {}),
      });
      enBaseline.current = clone(en);
      setOriginals({
        projects: p.map((r) => r.id),
        education: e.map((r) => r.id),
        techstack: tc.map((r) => r.id),
        toolstack: tl.map((r) => r.id),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load guild pins once (first live snapshot), then stop listening so local
  // edits aren't overwritten by the real-time stream while the owner types.
  useEffect(() => {
    let taken = false;
    const unsub = subscribePins((pins) => {
      if (taken) return;
      taken = true;
      const rows = pins.map((p) => ({
        id: p.id,
        name: p.name || "",
        message: p.message || "",
        loved: Boolean(p.loved),
        date: p.date || "",
        likes: p.likes || 0,
      }));
      setGuild(rows);
      setGuildOriginals(
        Object.fromEntries(
          rows.map((r) => [r.id, { name: r.name, message: r.message, loved: r.loved }])
        )
      );
      if (typeof unsub === "function") unsub();
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Persist one collection: validate ids, upsert every row, delete removed ids.
  const saveCollection = async (name, rows, serialize) => {
    const ids = rows.map((r) => (r.id || "").trim());
    if (ids.some((id) => !id)) throw new Error("Every row needs an ID / key.");
    if (new Set(ids).size !== ids.length)
      throw new Error("Duplicate IDs — each must be unique.");

    await Promise.all(rows.map((r) => saveItem(name, r.id.trim(), serialize(r))));
    const removed = (originals[name] || []).filter((id) => !ids.includes(id));
    await Promise.all(removed.map((id) => deleteItem(name, id)));
    setOriginals((prev) => ({ ...prev, [name]: ids }));
  };

  const runSave = async (fn, doRefresh = true) => {
    setSaving(true);
    try {
      // A save may hand back its own toast: a string, or { kind, text }.
      const result = await fn();
      // Guild pins update the board through their own live subscription, so
      // only the content sections need a context refresh.
      if (doRefresh) await refresh();
      if (result && typeof result === "object") flash(result.kind, result.text);
      else flash("ok", result || "Saved — changes are live.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Admin save failed:", err);
      flash("err", describeWriteError(err));
    } finally {
      setMt(null);
      setSaving(false);
    }
  };

  /**
   * Write the three content/{lang} docs from ONE English tree.
   *
   * English is the source of truth: every leaf whose English changed since the
   * last load/save (plus any leaf a target language is still missing) is machine
   * translated into Hindi and Tamil first. Untouched copy keeps the translation
   * it already has, so this never clobbers good text with a fresh machine pass.
   *
   * `all: true` ignores the diff and rebuilds every key — the explicit
   * "Re-translate all" action.
   *
   * If the translation service can't be reached the English still saves; the
   * toast says the other languages were left alone.
   */
  const publishText = async (enTree, { all = false } = {}) => {
    const en = sanitizeTree(enTree);
    const next = { ...textTrees, en };
    let translated = 0;
    let kept = 0;
    let offline = null;

    for (const lang of TARGET_LANGS) {
      const entries = collectTranslatable(en, {
        baseline: all ? null : enBaseline.current,
        existing: next[lang],
        all,
      });
      if (!entries.length) continue;
      setMt({ lang, done: 0, total: entries.length });
      try {
        const { results, skipped } = await translateEntries(entries, lang, (done, total) =>
          setMt({ lang, done, total })
        );
        next[lang] = applyTranslations(next[lang], results);
        translated += results.length;
        kept += skipped.length;
      } catch (err) {
        if (!(err instanceof TranslationUnavailable)) throw err;
        // No provider reachable: save what we have and say so. Anything this
        // language had already translated in the aborted batch is dropped — the
        // retry re-diffs it, and the translation cache makes the repeat free.
        offline = err;
        break;
      }
    }
    setMt(null);

    // Persist only what differs from the bundled locale, minus the code-owned
    // namespaces. A full-tree snapshot would freeze today's UI chrome copy in
    // the database and shadow every later edit made in src/locales/*.json.
    await Promise.all(
      ["en", ...TARGET_LANGS].map((l) =>
        saveText(l, diffTree(pruneCodeOwned(sanitizeTree(next[l])), LOCALES[l]))
      )
    );
    setTextTrees(next);
    // Advance the diff base only when the translation pass actually ran. After a
    // service outage the edited English must still look "changed" next time, or
    // Hindi/Tamil would stay stale until someone ran "Re-translate all".
    if (!offline) enBaseline.current = clone(en);

    if (offline) {
      return {
        kind: "err",
        text: `English saved. ${offline.message} Hindi/Tamil left unchanged — try again later.`,
      };
    }
    if (!translated && !kept) return "Saved — no new copy to translate.";
    const extra = kept ? `, ${kept} kept in English` : "";
    return `Saved — ${translated} translation${translated === 1 ? "" : "s"} written${extra}.`;
  };

  // "Re-translate all": rebuilds every key in both languages from the English.
  const retranslateAll = () => {
    const ok = window.confirm(
      "Re-translate every key into Hindi and Tamil from the English?\n\n" +
        "This overwrites the existing translations (including any hand-written " +
        "ones) and can take a couple of minutes."
    );
    if (!ok) return undefined;
    return runSave(() => publishText(textTrees.en, { all: true }));
  };

  const saveCurrent = () => {
    if (tab === "Projects")
      // Project copy is language-aware, so a project save also republishes the
      // text trees (English mirrored from the rows, hi/ta auto-translated).
      return runSave(async () => {
        await saveCollection("projects", projects, serializeProject);
        return publishText(syncProjectText(textTrees.en, projects));
      });
    if (tab === "Education")
      return runSave(() => saveCollection("education", education, serializeEdu));
    if (tab === "Tech")
      return runSave(() => saveCollection("techstack", tech, serializeSkill));
    if (tab === "Tools")
      return runSave(() => saveCollection("toolstack", tools, serializeSkill));
    if (tab === "Stats")
      return runSave(() =>
        saveStats(
          stats.map((s) => ({
            order: Number(s.order) || 0,
            key: s.key.trim(),
            value: String(s.value),
            suffix: s.suffix,
          }))
        )
      );
    if (tab === "Guild")
      return runSave(async () => {
        const ids = guild.map((r) => r.id);
        // Write only the pins whose editable fields actually changed.
        const edits = guild
          .filter((r) => {
            const o = guildOriginals[r.id];
            return (
              o &&
              (o.name !== r.name || o.message !== r.message || o.loved !== r.loved)
            );
          })
          .map((r) =>
            updatePin(r.id, {
              name: r.name.trim(),
              message: r.message.trim(),
              loved: r.loved,
            })
          );
        const removals = Object.keys(guildOriginals)
          .filter((id) => !ids.includes(id))
          .map((id) => deletePin(id));
        await Promise.all([...edits, ...removals]);
        setGuildOriginals(
          Object.fromEntries(
            guild.map((r) => [
              r.id,
              { name: r.name, message: r.message, loved: r.loved },
            ])
          )
        );
      }, false);
    // Text: translate whatever English changed, then write all three trees.
    return runSave(() => publishText(textTrees.en));
  };

  const skillCols = [
    { key: "order", label: "Order", type: "number" },
    { key: "label", label: "Label" },
    { key: "iconKey", label: "Icon", options: SKILL_KEYS },
    { key: "color", label: "Color (optional)" },
  ];

  return (
    <div
      className="admin-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="admin-drawer glass" role="dialog" aria-modal="true" aria-label="Content editor">
        <header className="admin-head">
          <h2 className="admin-title">
            <FiEdit3 aria-hidden="true" /> Content editor
          </h2>
          <div className="admin-head__actions">
            <button
              type="button"
              className="admin-signout"
              onClick={() => ownerSignOut()}
              title="Sign out"
            >
              <FiLogOut aria-hidden="true" /> Sign out
            </button>
            <button
              type="button"
              className="admin-close"
              onClick={onClose}
              aria-label="Close"
            >
              <FiX />
            </button>
          </div>
        </header>

        <div className="admin-tabs">
          {TABS.map((tb) => (
            <button
              key={tb}
              type="button"
              className={`admin-tab${tab === tb ? " is-active" : ""}`}
              onClick={() => setTab(tb)}
            >
              {tb}
            </button>
          ))}
        </div>

        <div className="admin-body">
          {loading ? (
            <p className="admin-hint">Loading content…</p>
          ) : (
            <>
              {tab === "Projects" && (
                <ProjectsEditor rows={projects} setRows={setProjects} />
              )}
              {tab === "Education" && (
                <CollectionEditor
                  rows={education}
                  setRows={setEducation}
                  keyLabel="ID (translation key)"
                  makeBlank={() => initEdu({ order: education.length + 1 })}
                  columns={[
                    { key: "order", label: "Order", type: "number" },
                    { key: "iconKey", label: "Icon", options: EDU_KEYS },
                  ]}
                />
              )}
              {tab === "Tech" && (
                <CollectionEditor
                  rows={tech}
                  setRows={setTech}
                  makeBlank={() => initSkill({ order: tech.length + 1 })}
                  columns={skillCols}
                />
              )}
              {tab === "Tools" && (
                <CollectionEditor
                  rows={tools}
                  setRows={setTools}
                  makeBlank={() => initSkill({ order: tools.length + 1 })}
                  columns={skillCols}
                />
              )}
              {tab === "Stats" && <StatsEditor rows={stats} setRows={setStats} />}
              {tab === "Text" && (
                <TextEditor
                  trees={textTrees}
                  setTrees={setTextTrees}
                  eduIds={education.map((r) => r.id).filter(Boolean)}
                  projectAbbrs={projects.map((r) => r.abbr).filter(Boolean)}
                  statKeys={stats.map((s) => (s.key || "").trim()).filter(Boolean)}
                  onRetranslate={retranslateAll}
                  busy={saving}
                />
              )}
              {tab === "Resume" && (
                <ResumeEditor
                  current={resume}
                  onChanged={refresh}
                  flash={flash}
                />
              )}
              {tab === "Guild" && (
                <GuildEditor rows={guild} setRows={setGuild} />
              )}
            </>
          )}
        </div>

        <footer className="admin-foot">
          <Toast toast={toast} />
          {mt && (
            <span className="admin-mt" role="status">
              <FiGlobe aria-hidden="true" /> Translating → {LANG_LABELS[mt.lang]}{" "}
              {mt.done}/{mt.total}
            </span>
          )}
          {/* The Resume tab uploads on its own button — a batch Save here
              would have nothing to write. */}
          {!SELF_SAVING_TABS.includes(tab) && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveCurrent}
              disabled={loading || saving}
            >
              <FiSave /> {saving ? "Saving…" : `Save ${tab}`}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ---- gate + launcher --------------------------------------------------------
function AdminPanel() {
  const [owner, setOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!firebaseReady) return undefined;
    return subscribeOwner(setOwner);
  }, []);

  // ?admin in the URL → prompt sign-in (if not already owner). Param stripped
  // so it isn't shared. No-op without Firebase (owner editing needs a backend).
  useEffect(() => {
    if (!firebaseReady) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") !== null) {
        setShowLogin(true);
        params.delete("admin");
        const q = params.toString();
        window.history.replaceState(
          {},
          "",
          window.location.pathname + (q ? `?${q}` : "") + window.location.hash
        );
      }
    } catch (_) {
      /* ignore */
    }
  }, []);

  if (!firebaseReady) return null;

  return (
    <>
      {owner && (
        <button
          type="button"
          className="admin-fab"
          onClick={() => setOpen(true)}
          title="Edit site content"
        >
          <FiEdit3 aria-hidden="true" /> Content
        </button>
      )}
      {showLogin && !owner && <OwnerLogin onClose={() => setShowLogin(false)} />}
      {open && owner && <AdminDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

export default AdminPanel;
