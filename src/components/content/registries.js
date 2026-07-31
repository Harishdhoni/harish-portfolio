// =============================================================
//  Content registries + defaults
// -------------------------------------------------------------
//  Firestore holds only serializable data, so a content document
//  references an asset/icon by a short *key* string (e.g.
//  imgKey: "eib", iconKey: "react"). The registries below map
//  those keys back to the imported SVG assets and react-icons
//  components that can't live in a database.
//
//  The `default*` arrays mirror the site's original hardcoded
//  content in the exact document shape Firestore uses. They are
//  the fallback whenever Firebase is unset or a fetch fails, and
//  they are what scripts/seedContent.js uploads on first run.
//
//  Resolvers turn a stored document (+ registry lookup) into the
//  render-ready object each component already expects, so the
//  components render identically whether the data came from the
//  database or from these defaults.
// =============================================================
import { FaGraduationCap } from "react-icons/fa";
import { SiJquery, SiNestjs, SiNextdotjs, SiPhp } from "react-icons/si";
import { SiUbuntu, SiXampp, SiPrisma } from "react-icons/si";

// Project cover art -----------------------------------------------------------
import eibCover from "../../Assets/project-eib.svg";
import iconnectCover from "../../Assets/project-iconnect.svg";

// Tech / tool SVG marks -------------------------------------------------------
import Javascript from "../../Assets/TechIcons/Javascript.svg";
import Node from "../../Assets/TechIcons/Node.svg";
import ReactIcon from "../../Assets/TechIcons/React.svg";
import Typescript from "../../Assets/TechIcons/Typescript.svg";
import SQL from "../../Assets/TechIcons/SQL.svg";
import codeigniter from "../../Assets/TechIcons/codeigniter.svg";
import macOs from "../../Assets/TechIcons/Apple MacOSX.svg";
import chrome from "../../Assets/TechIcons/Google Chrome.svg";
import vsCode from "../../Assets/TechIcons/vscode.svg";
import claude from "../../Assets/TechIcons/claude.svg";
import Git from "../../Assets/TechIcons/Git.svg";
import Postman from "../../Assets/TechIcons/Postman.svg";

// ---- registries: key -> asset / component ----------------------------------

// Project cover images. Unknown/empty key -> null (renders the abbr gradient).
export const PROJECT_IMAGES = {
  eib: eibCover,
  iconnect: iconnectCover,
};

// Education card icons.
export const EDU_ICONS = {
  graduationCap: FaGraduationCap,
};

// Skill/tool marks. Each entry is either a raster/vector `img` or a react-icons
// `Icon` component (with an optional default `color`). A document may override
// the color with its own `color` field.
export const SKILL_ICONS = {
  // tech
  javascript: { img: Javascript },
  jquery: { Icon: SiJquery, color: "#1a90d6" },
  typescript: { img: Typescript },
  codeigniter: { img: codeigniter },
  php: { Icon: SiPhp, color: "#8b93e6" },
  node: { img: Node },
  nestjs: { Icon: SiNestjs, color: "#e0234e" },
  react: { img: ReactIcon },
  // Next.js is a monochrome mark — use the theme text token so it stays visible
  // on both dark and light backgrounds.
  nextjs: { Icon: SiNextdotjs, color: "var(--text-primary)" },
  sql: { img: SQL },
  // tools
  macos: { img: macOs },
  ubuntu: { Icon: SiUbuntu, color: "#e95420" },
  chrome: { img: chrome },
  vscode: { img: vsCode },
  claude: { img: claude },
  xampp: { Icon: SiXampp, color: "#fb7a24" },
  git: { img: Git },
  prisma: { Icon: SiPrisma, color: "#c9c7dd" },
  postman: { img: Postman },
};

// ---- resolvers: stored document -> render-ready object ----------------------

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

// SkillMarquee expects { label, img } or { label, Icon, color }.
export function resolveSkill(doc) {
  const base = SKILL_ICONS[doc.iconKey] || {};
  return {
    label: doc.label,
    ...base,
    // A document color overrides the registry default (kept for Icon marks).
    ...(doc.color ? { color: doc.color } : {}),
  };
}

// Education.js expects { id, icon: <Component> }.
export function resolveEducation(doc) {
  return { id: doc.id, icon: EDU_ICONS[doc.iconKey] || FaGraduationCap };
}

// ProjectShowcase/ProjectCards expect the original projectsData shape.
export function resolveProject(doc) {
  return {
    title: doc.title,
    abbr: doc.abbr,
    description: doc.description || "",
    modules: doc.modules || [],
    tags: doc.tags || [],
    ghLink: doc.ghLink || "",
    demoLink: doc.demoLink || "",
    imgPath: PROJECT_IMAGES[doc.imgKey] || "",
  };
}

// ---- default content (Firestore document shape) ----------------------------
// English copy for projects lives here as a fallback; the translated copy in
// src/locales (and its content/* overlay) still wins at render via the abbr key.

export const DEFAULT_PROJECTS = [
  {
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

export const DEFAULT_EDUCATION = [
  { order: 1, id: "be", iconKey: "graduationCap" },
  { order: 2, id: "hsc", iconKey: "graduationCap" },
];

export const DEFAULT_TECHSTACK = [
  { order: 1, label: "JavaScript", iconKey: "javascript" },
  { order: 2, label: "jQuery", iconKey: "jquery" },
  { order: 3, label: "TypeScript", iconKey: "typescript" },
  { order: 4, label: "CodeIgniter", iconKey: "codeigniter" },
  { order: 5, label: "PHP", iconKey: "php" },
  { order: 6, label: "Node.js", iconKey: "node" },
  { order: 7, label: "Nest.js", iconKey: "nestjs" },
  { order: 8, label: "React.js", iconKey: "react" },
  { order: 9, label: "Next.js", iconKey: "nextjs" },
  { order: 10, label: "SQL", iconKey: "sql" },
];

export const DEFAULT_TOOLSTACK = [
  { order: 1, label: "macOS", iconKey: "macos" },
  { order: 2, label: "Ubuntu", iconKey: "ubuntu" },
  { order: 3, label: "Chrome", iconKey: "chrome" },
  { order: 4, label: "VS Code", iconKey: "vscode" },
  { order: 5, label: "Claude", iconKey: "claude" },
  { order: 6, label: "XAMPP", iconKey: "xampp" },
  { order: 7, label: "Git", iconKey: "git" },
  { order: 8, label: "Prisma", iconKey: "prisma" },
  { order: 9, label: "Postman", iconKey: "postman" },
];

// Skill stats (numeric value + suffix). Labels are translated via
// `skills.stats.<key>` in the locale/content overlay.
export const DEFAULT_STATS = [
  { order: 1, key: "experience", value: "5", suffix: "+" },
  { order: 2, key: "technologies", value: "13", suffix: "+" },
  { order: 3, key: "focus", value: "Full-stack", suffix: "" },
];

// Sort + resolve helpers used by the provider and the fallback path.
export function resolveProjects(docs) {
  return [...docs].sort(byOrder).map(resolveProject);
}
export function resolveEducationList(docs) {
  return [...docs].sort(byOrder).map(resolveEducation);
}
export function resolveSkills(docs) {
  return [...docs].sort(byOrder).map(resolveSkill);
}
export function sortStats(docs) {
  return [...docs].sort(byOrder).map(({ key, value, suffix }) => ({
    key,
    value,
    suffix: suffix || "",
  }));
}

// The fully-resolved fallback bundle (render-ready), used before/without a fetch.
export const DEFAULT_CONTENT = {
  projects: resolveProjects(DEFAULT_PROJECTS),
  education: resolveEducationList(DEFAULT_EDUCATION),
  techstack: resolveSkills(DEFAULT_TECHSTACK),
  toolstack: resolveSkills(DEFAULT_TOOLSTACK),
  stats: sortStats(DEFAULT_STATS),
  // No uploaded resume by default — the Resume section then serves the PDF
  // bundled in src/Assets, so it works with no backend at all.
  resume: null,
};
