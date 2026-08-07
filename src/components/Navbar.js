import React, { useState, useEffect, useMemo, useRef } from "react";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import Container from "react-bootstrap/Container";
import {
  AiOutlineUser,
  AiOutlineLaptop,
  AiOutlineMessage,
  AiOutlineFundProjectionScreen,
  AiOutlineRead,
  AiOutlinePushpin,
  AiOutlineSafetyCertificate,
} from "react-icons/ai";
import { CgFileDocument } from "react-icons/cg";
import { FiSun, FiMoon, FiPhoneCall, FiMaximize, FiMinimize } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import scrollToSection from "./helper/scrollToSection";
import { useContent } from "./content/ContentProvider";
import { requestResume, onResumeRequest } from "./helper/resumeReveal";
import LanguageSwitcher from "./helper/LanguageSwitcher";
import AccentSwitcher from "./helper/AccentSwitcher";
import useFullscreen from "./helper/useFullscreen";

// Labels are resolved from i18n at render time via t(`nav.${id}`).
const NAV_ITEMS = [
  { id: "about", icon: <AiOutlineUser /> },
  { id: "education", icon: <AiOutlineRead /> },
  { id: "certifications", icon: <AiOutlineSafetyCertificate /> },
  { id: "skills", icon: <AiOutlineLaptop /> },
  { id: "projects", icon: <AiOutlineFundProjectionScreen /> },
  { id: "resume", icon: <CgFileDocument /> },
  { id: "guild", icon: <AiOutlinePushpin /> },
  { id: "contact", icon: <AiOutlineMessage /> },
];

// The phone CTA opens the device dialer with the number pre-filled.
const PHONE_NUMBER = "+919551363232"; // +91 95513 63232

function NavBar({ theme, onToggleTheme }) {
  const { t } = useTranslation();
  const { certifications } = useContent();
  const [expand, updateExpanded] = useState(false);
  const [navColour, updateNavbar] = useState(false);
  const [activeId, setActiveId] = useState("home");
  const progressRef = useRef(null);
  const barRef = useRef(null);
  // Whole-page fullscreen (documentElement). Hidden where unsupported (iOS).
  const { isFullscreen, toggle: toggleFullscreen, supported: fsSupported } =
    useFullscreen();

  // Certifications are owner-entered, so the section only exists once the
  // database has one — until then its nav entry would scroll to nothing.
  const navItems = useMemo(
    () =>
      NAV_ITEMS.filter(
        (i) => i.id !== "certifications" || certifications.length > 0
      ),
    [certifications]
  );

  // Buttery scroll-progress ring: a rAF loop eases the fill toward the current
  // scroll target (lerp) and writes stroke-dashoffset straight onto the <rect>
  // — no React re-renders per frame. Smoothness comes from three things: the
  // scroll handler only reads scrollY (never scrollHeight, which would force a
  // synchronous layout every frame); the track length is cached and refreshed
  // off the hot path via ResizeObserver; and the stroke carries no per-frame
  // filter. The loop parks itself once settled, so it's idle between scrolls.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SMOOTHING = 0.14; // lower = more languid trail, higher = snappier

    let raf = 0;
    let running = false;
    let current = 0;
    let target = 0;
    let track = 0; // cached scrollable distance; refreshed off the scroll path
    let lastPct = -1;

    const paint = () => {
      const bar = barRef.current;
      if (bar) bar.style.strokeDashoffset = String(1 - current);
      // aria only needs whole percents — skip the DOM write on identical frames
      const pct = Math.round(current * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        const el = progressRef.current;
        if (el) el.setAttribute("aria-valuenow", String(pct));
      }
    };

    // scrollHeight forces a layout flush, so it's read only here — never inside
    // the scroll handler.
    const measureTrack = () => {
      track = document.documentElement.scrollHeight - window.innerHeight;
    };

    const measure = () => {
      const scrolled = window.scrollY; // cheap read: no forced reflow
      updateNavbar(scrolled >= 20);
      target = track > 0 ? Math.min(scrolled / track, 1) : 0;
    };

    const tick = () => {
      current += (target - current) * SMOOTHING;
      const settled = Math.abs(target - current) < 0.0005;
      if (settled) current = target;
      paint();
      if (settled) {
        running = false;
        raf = 0;
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      measure();
      if (reduce) {
        current = target; // snap instantly for reduced-motion users
        paint();
      } else {
        start();
      }
    };

    const onResize = () => {
      measureTrack();
      onScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    // Refresh the cached track when the document height changes (images loading,
    // the resume section revealing, etc.). ResizeObserver fires off the scroll
    // hot loop, so recomputing here costs nothing during scrolling.
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(onResize);
      ro.observe(document.body);
    }

    measureTrack();
    onScroll();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
  }, []);

  // Build the progress line's path: only the BOTTOM edge of the pill outline.
  // Start at the left cap's widest point, arc down to the bottom, run the flat
  // bottom, then arc up to the right cap. Corner radius = half the height for
  // the stadium; a fixed 18px when the mobile menu expands the pill into a
  // rounded card. Rebuilt on size change (ResizeObserver) and on expand.
  useEffect(() => {
    const svg = progressRef.current;
    const bar = barRef.current;
    if (!svg || !bar) return undefined;

    const draw = () => {
      const W = svg.clientWidth;
      const H = svg.clientHeight;
      if (!W || !H) return;
      const rc = expand ? 18 : H / 2;
      bar.setAttribute(
        "d",
        `M 0 ${H - rc} A ${rc} ${rc} 0 0 0 ${rc} ${H} ` +
          `L ${W - rc} ${H} A ${rc} ${rc} 0 0 0 ${W} ${H - rc}`
      );
    };

    draw();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(draw);
      ro.observe(svg);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, [expand]);

  // Scrollspy: highlight the nav item for whichever section is in view.
  useEffect(() => {
    let observer;

    const attach = () => {
      if (observer) observer.disconnect();
      const sections = navItems
        .map((i) => document.getElementById(i.id))
        .filter(Boolean);
      if (!sections.length) return;

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible[0]) setActiveId(visible[0].target.id);
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
      );

      sections.forEach((s) => observer.observe(s));
    };

    attach();

    // The Resume section is hidden at mount and reveals on request, so it isn't
    // in the DOM when the observer above is first built. Highlight its nav item
    // right away, then re-attach once it has mounted so scrollspy keeps tracking it.
    const unsub = onResumeRequest(() => {
      setActiveId("resume");
      setTimeout(attach, 80);
    });

    return () => {
      if (observer) observer.disconnect();
      unsub();
    };
    // Re-attaches when the Certifications section appears (its content arrives
    // from Firestore after the first render).
  }, [navItems]);

  useEffect(() => {
    if (!expand) return;
    const clickHandler = (e) => {
      if (!e.target.closest(".nav-aurora")) updateExpanded(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [expand]);

  const close = () => updateExpanded(false);

  const go = (id) => {
    // Resume is hidden by default — clicking its nav item reveals it.
    if (id === "resume") requestResume();
    else scrollToSection(id);
    close();
  };

  return (
    <Navbar
      expanded={expand}
      fixed="top"
      expand="lg"
      className={`nav-aurora ${navColour ? "is-scrolled" : ""} ${
        expand ? "is-expanded" : ""
      }`}
    >
      <Container className="nav-shell">
        {/* Name wordmark: an "online" status dot + the owner's name. Acts as a
            home button (scrolls to the hero). Sizes down on phones via the
            .navbar-brand rules in the responsive CSS blocks; below ~360px the
            full name swaps for the "HS" monogram so the wordmark, hamburger and
            control cluster all stay on ONE line (the button keeps its aria-label
            either way, so the accessible name never changes). */}
        <Navbar.Brand
          as="button"
          type="button"
          onClick={() => go("home")}
          aria-label={t("nav.home", "Home")}
        >
          <span className="brand-dot" aria-hidden="true" />
          <span className="brand-name">Harish Siva</span>
          <span className="brand-initials" aria-hidden="true">
            HS
          </span>
        </Navbar.Brand>
        {/* Scroll progress = a single line that follows the pill OUTLINE
            along its bottom edge only: it starts at the left cap, runs the
            bottom, and curves up to the right cap, filling left->right as the
            page scrolls. The `d` is rebuilt from the pill's live size in the
            effect below; the rAF loop feeds progress via stroke-dashoffset
            (pathLength="1" normalises the segment length). */}
        <svg
          ref={progressRef}
          className="nav-progress"
          role="progressbar"
          aria-label={t("nav.scrollProgress")}
          aria-valuenow={0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <defs>
            <linearGradient id="nav-progress-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--accent)" }} />
              <stop offset="100%" style={{ stopColor: "var(--accent-2)" }} />
            </linearGradient>
          </defs>
          <path
            ref={barRef}
            className="nav-progress__bar"
            d=""
            pathLength="1"
          />
        </svg>
        <Navbar.Collapse id="responsive-navbar-nav" className="nav-menu">
          <Nav className="nav-links">
            {navItems.map((item) => (
              <Nav.Item key={item.id}>
                <Nav.Link
                  as="button"
                  type="button"
                  active={activeId === item.id}
                  aria-current={activeId === item.id ? "true" : undefined}
                  onClick={() => go(item.id)}
                >
                  <span className="nav-link__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {t(`nav.${item.id}`)}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        </Navbar.Collapse>

        <div className="nav-actions">
          <span className="nav-divider" aria-hidden="true" />
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              theme === "dark" ? t("nav.themeToLight") : t("nav.themeToDark")
            }
            aria-pressed={theme === "light"}
            title={theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
          >
            {theme === "dark" ? <FiSun /> : <FiMoon />}
          </button>
          {fsSupported && (
            <button
              type="button"
              className="theme-toggle fullscreen-toggle"
              onClick={toggleFullscreen}
              aria-label={
                isFullscreen ? t("nav.exitFullscreen") : t("nav.viewFullscreen")
              }
              aria-pressed={isFullscreen}
              title={isFullscreen ? t("nav.exitFullscreen") : t("nav.fullscreen")}
            >
              {isFullscreen ? <FiMinimize /> : <FiMaximize />}
            </button>
          )}
          <AccentSwitcher />
          <LanguageSwitcher />
          <a
            className="nav-cta"
            href={`tel:${PHONE_NUMBER}`}
            data-magnetic="0.4"
            aria-label={t("contact.callPhone")}
            title={t("contact.callPhone")}
          >
            <FiPhoneCall aria-hidden="true" />
          </a>
        </div>

        <Navbar.Toggle
          aria-controls="responsive-navbar-nav"
          onClick={() => updateExpanded(expand ? false : "expanded")}
        >
          <span></span>
          <span></span>
          <span></span>
        </Navbar.Toggle>
      </Container>
    </Navbar>
  );
}

export default NavBar;
