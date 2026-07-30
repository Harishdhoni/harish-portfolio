# PRODUCT.md

## What This Is

A personal portfolio website for **Harish Siva**, presenting his professional identity, skills, and resume to recruiters, collaborators, and visitors in a visually distinctive way.

Most of the content is stored in a database and edited by Harish directly in the browser, so keeping the site current doesn't require a code change or a redeploy. Visitors can also leave a note on a shared wall, and Harish can see who's been stopping by.

- **Live site:** https://harishportfolio.lovestoblog.com/
- **Owner location:** Chennai, India

## Purpose

The site exists to answer three questions quickly for anyone who lands on it:
1. Who is Harish, and what does he do?
2. What technologies and tools does he work with?
3. Can I see his resume and reach him?

## Target Audience

- Recruiters and hiring managers scanning for technical fit
- Potential collaborators or clients
- Anyone following a link from LinkedIn, GitHub, or a resume/CV

## Design Philosophy

- **Single-page flow** — one continuous scroll rather than separate routed pages; the navbar smooth-scrolls (Lenis) between sections so the whole story reads top to bottom.
- **Aurora / glassmorphism aesthetic** — a fixed, gradient-mesh backdrop with translucent "glass" cards, aiming for a modern, memorable first impression rather than a generic template look. A light/dark toggle and an accent-colour switcher let visitors tune the palette.
- **Motion with restraint** — Lottie animations, a typewriter role effect, and smooth scrolling add personality without overwhelming the content; `prefers-reduced-motion` is respected throughout for accessibility.
- **Speaks the visitor's language** — the interface is available in English, Hindi, and Tamil.
- **Frictionless resume access** — the resume is viewable in-page (no download required to preview) but still downloadable for those who want a copy.

## Core Features

| Feature | User Value |
|---|---|
| Animated hero with typewriter roles | Immediately communicates who Harish is and what he does |
| About section | Gives background, education, interests, and a live GitHub contribution calendar for a fuller picture |
| Skills & projects sections | Lets visitors quickly assess technical fit and see representative work |
| In-browser resume viewer | No download needed to review qualifications |
| Contact form + WhatsApp CTA | Low-friction ways to reach Harish directly (email via EmailJS, or real-time chat) |
| "Book a call" action | Skips the back-and-forth for anyone who just wants time on the calendar |
| Guild Board | A shared wall where any visitor can pin a short note — social proof, and a reason to come back |
| Multilingual UI (EN / HI / TA) | Reaches visitors in their preferred language |
| Light/dark + accent theming | Lets visitors read comfortably and adds a touch of personalization |
| AI assistant | Answers quick questions about Harish's skills, work, and how to get in touch |
| Responsive layout | Works equally well whether shared via mobile or desktop |
| Preloader & smooth scrolling | Polished, professional feel while moving through the page |

Two features exist for Harish alone and are invisible to visitors — they render nothing at all unless he's signed in:

| Owner-only feature | Value to Harish |
|---|---|
| In-site content editor | Update projects, education, skills, stats and copy from the live site, with automatic translation into Hindi and Tamil on save. Also where he moderates Guild Board pins. |
| Visitor log | A private, coarse record of who's landed on the site — device, approximate city, referrer, and a name if the visitor chose to leave one |

## Site Map

A single scrolling page; the navbar jumps between sections rather than loading separate routes.

| Section | Purpose |
|---|---|
| Home | First impression: hero, intro, social links |
| About | Background, interests, GitHub activity |
| Education | Qualifications as a timeline |
| Skills | Technical skillset and tools |
| Projects | Featured work showcase |
| Resume | View and download resume |
| Guild Board | Shared visitor wall |
| Contact | Message form, direct contact channels, and booking |
| Connect | Social links |

The AI assistant, the visitor greeting, and the two owner-only tools float above the page rather than occupying a slot in this order.

## Content That's Meant to Change Over Time

This is a living personal site — the following are expected to be updated as Harish's career progresses:
- Project entries, education entries, tech/tool icons, headline stats, and most section copy — **edited in the browser, no code change needed**, and translated into Hindi and Tamil automatically on save
- Resume PDF
- Social/contact links and the booking link
- AI assistant knowledge (the facts it answers with)

The site is designed so that routine content upkeep never requires a developer, a deploy, or a translator.

## Non-Goals

- **Not a multi-user platform.** There is exactly one account — Harish's — and it exists only so he can edit his own content. Visitors never sign up, sign in, or have profiles, and no second privileged role is planned.
- **Not a general CMS.** The admin panel edits *this* site's fixed set of content types. It is not a content platform, and content types aren't user-definable.
- **No custom server.** Data lives in hosted Firestore and mail goes through EmailJS; there is no application server, no API to maintain, and the site must keep working with bundled fallback content when the database is unreachable.
- **Not a blog or case-study site** — it's an identity/resume showcase, not a portfolio of in-depth project write-ups.
- **The AI assistant stays rule-based** — a lightweight, client-side intent matcher over a fixed knowledge base, not a live LLM integration.
- **The visitor log stays minimal.** It answers "who stopped by", not "how do I optimise conversion". No raw IP addresses, no cross-site tracking, no third-party analytics, and no visitor data surfaced publicly.
- **Not intended to support e-commerce.**

## Attribution

Based on an open-source portfolio template by [Soumyajit Behera](https://github.com/soumyajit4419/Portfolio), with a redesigned UI, custom aurora backdrop, and updated content.
