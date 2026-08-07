import React, { useState, useEffect, Suspense, lazy } from "react";
import Preloader from "../src/components/Pre";
import Navbar from "./components/Navbar";
import Home from "./components/Home/Home";
import About from "./components/About/About";
import Education from "./components/Education/Education";
import Certifications from "./components/Certifications/Certifications";
import Projects from "./components/Projects/Projects";
import Footer from "./components/Footer";
import Resume from "./components/Resume/ResumeNew";
import Contact from "./components/Contact/Contact";
import Connect from "./components/Connect/Connect";
import Guild from "./components/Guild/Guild";
import ProjectShowcase from "./components/Projects/ProjectShowcase";
import { BrowserRouter as Router } from "react-router-dom";
import { ContentProvider } from "./components/content/ContentProvider";
import DeepLinkScroll from "./components/DeepLinkScroll";
import Aurora from "./components/helper/Aurora";
import Cursor from "./components/helper/Cursor";
import Reveal from "./components/helper/Reveal";
import BackToTop from "./components/helper/BackToTop";
import useTheme from "./components/helper/useTheme";
import {
  startSmoothScroll,
  stopSmoothScroll,
} from "./components/helper/smoothScroll";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import "./style.css";

// Floating overlays — none of them are part of the first paint (each renders
// null or a fixed-position launcher), and the owner-only ones are dead weight
// for every visitor. Splitting them keeps the assistant's knowledge base, the
// admin editor and the translation pipeline out of the initial bundle.
const AiAssistant = lazy(() => import("./components/Assistant/AiAssistant"));
const AdminPanel = lazy(() => import("./components/Admin/AdminPanel"));
const VisitorPrompt = lazy(() => import("./components/Visitors/VisitorPrompt"));
const VisitorDashboard = lazy(() =>
  import("./components/Visitors/VisitorDashboard")
);

function App() {
  const [load, setLoad] = useState(true);
  const [theme, toggleTheme] = useTheme();

  // Lift the preloader as soon as the app has actually painted. It used to sit
  // on a fixed 1.2s timer, which pinned Largest Contentful Paint to 1.2s+ for
  // everyone: the hero starts at opacity 0 and only animates in once `load`
  // flips (see helper/Reveal.jsx). Two frames is enough to cover the first
  // paint without holding the page hostage to a stopwatch — the hero's
  // entrance animation still plays, it just starts 1.2s sooner.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setLoad(false));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, []);

  // Lenis smooth scrolling for the whole page (matches the reference site).
  useEffect(() => {
    startSmoothScroll();
    return () => stopSmoothScroll();
  }, []);

  return (
    <Router>
      <ContentProvider>
      <Preloader load={load} />
      {/* keyed on theme so the canvas layers re-read the palette tokens on switch */}
      <Aurora key={theme} />
      <Cursor />
      <Reveal ready={!load} />
      <div className="App" id={load ? "no-scroll" : "scroll"}>
        <Navbar theme={theme} onToggleTheme={toggleTheme} />
        <DeepLinkScroll ready={!load} />
        {/* Single-page layout: every section stacks in nav order and the
            navbar smooth-scrolls between them. */}
        <main>
          <Home />
          <About />
          <Education />
          <Certifications />
          <Projects />
          <ProjectShowcase />
          <Resume />
          <Guild />
          <Contact />
          <Connect />
        </main>
        <Footer />
        <BackToTop />
        {/* fallback={null}: every one of these is a fixed-position overlay, so
            arriving a beat late costs nothing and shifts nothing. */}
        <Suspense fallback={null}>
          <AiAssistant />
          <AdminPanel />
          <VisitorPrompt />
          <VisitorDashboard />
        </Suspense>
      </div>
      </ContentProvider>
    </Router>
  );
}

export default App;
