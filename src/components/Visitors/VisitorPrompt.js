import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { logVisit, setVisitName } from "./visitorStore";
import { deviceInfo } from "./deviceInfo";
import { lookupGeo } from "./geo";
import { prefersReducedMotion } from "../helper/scrollToSection";

/**
 * Visitor greeter + tracker.
 *
 * On first load of a browser session it logs one visit (device, approx.
 * location, referrer, time) to the store, then — for visitors it doesn't
 * have a name for yet — shows a small corner card asking for one, right
 * away, without blocking the rest of the page. Giving a name, skipping, or
 * closing the card all dismiss it and are remembered locally so it never
 * re-prompts the same browser again.
 */
const SESSION_KEY = "pv.session.v1"; // one log per tab session
const SEEN_KEY = "pv.seen.v1"; // returning-visitor flag (persists)
const NAME_KEY = "pv.name.v1"; // remembered self-provided name
const SKIP_KEY = "pv.skip.v1"; // remembered skip/close choice — don't ask again
// Id of the last visit this browser logged. Persisted (not session-scoped) so a
// name given after a reload — or in a later session — still lands on a real
// doc; without it the name was written to nothing and silently lost.
const VISIT_ID_KEY = "pv.visitId.v1";

const readLS = (key) => {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (_) {
    return "";
  }
};
const writeLS = (key, val) => {
  try {
    window.localStorage.setItem(key, val);
  } catch (_) {
    /* ignore */
  }
};

function VisitorPrompt() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const visitIdRef = useRef(null);
  const logRef = useRef(null); // in-flight logVisit(), so save() can await it
  const inputRef = useRef(null);

  // Decide whether to show the card synchronously, so it's the first thing
  // painted rather than waiting on the visit log / geo lookup below (the
  // geo lookup alone can take up to 2.5s — see geo.js).
  useEffect(() => {
    const knownName = readLS(NAME_KEY);
    const skipped = readLS(SKIP_KEY) === "1";
    if (!knownName && !skipped) setShow(true);
  }, []);

  // Log the visit once per session — independent of the gate above.
  useEffect(() => {
    let cancelled = false;

    let loggedThisSession = false;
    try {
      loggedThisSession = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (_) {
      /* ignore */
    }
    if (loggedThisSession) return undefined;

    const knownName = readLS(NAME_KEY);
    const returning = readLS(SEEN_KEY) === "1";

    async function run() {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch (_) {
        /* ignore */
      }
      const geo = await lookupGeo();
      if (cancelled) return;
      const meta = {
        ...deviceInfo(),
        name: knownName,
        referrer: document.referrer || "direct",
        path: window.location.pathname + window.location.hash,
        returning,
        ...(geo || {}),
      };
      try {
        logRef.current = logVisit(meta);
        const id = await logRef.current;
        visitIdRef.current = id;
        writeLS(VISIT_ID_KEY, id);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.warn("Visit log failed:", err);
        }
      }
      writeLS(SEEN_KEY, "1");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Skip or close: remembered so this browser is never asked again.
  const dismiss = () => {
    writeLS(SKIP_KEY, "1");
    setShow(false);
  };

  // While the card is showing, let Escape close it too.
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Focus the name field once the card is in (skipped for reduced motion).
  useEffect(() => {
    if (!show) return undefined;
    const delay = prefersReducedMotion() ? 0 : 420;
    const timer = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, delay);
    return () => clearTimeout(timer);
  }, [show]);

  const save = async (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 60);
    // Name is optional now — an empty submit is just a skip.
    if (!clean) {
      dismiss();
      return;
    }
    writeLS(NAME_KEY, clean);
    try {
      // Resolve the doc to patch: this session's visit if we have it, else the
      // one still in flight (the geo lookup can take a moment), else the last
      // visit this browser logged — the reload case, where this render never
      // logged anything and the name used to be dropped on the floor.
      let id = visitIdRef.current;
      if (!id && logRef.current) id = await logRef.current;
      if (!id) id = readLS(VISIT_ID_KEY);
      await setVisitName(id, clean);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("Visit name save failed:", err);
      }
    }
    setSaved(true);
    setTimeout(() => setShow(false), 1500);
  };

  if (!show) return null;

  return (
    <div className="pv-prompt">
      <div
        className="pv-prompt__card"
        role="dialog"
        aria-modal="false"
        aria-live="polite"
        aria-label={t("visitors.prompt.aria")}
      >
        {!saved && (
          <button
            type="button"
            className="pv-prompt__close"
            onClick={dismiss}
            aria-label={t("visitors.prompt.close")}
          >
            <FiX />
          </button>
        )}
        {saved ? (
          <p className="pv-prompt__thanks">
            {t("visitors.prompt.thanks", { name: name.trim() })}
          </p>
        ) : (
          <>
            <span className="pv-prompt__wave" aria-hidden="true">
              👋
            </span>
            <p className="pv-prompt__title">{t("visitors.prompt.title")}</p>
            <p className="pv-prompt__hint">{t("visitors.prompt.hint")}</p>
            <form className="pv-prompt__form" onSubmit={save}>
              <input
                ref={inputRef}
                type="text"
                className="pv-prompt__input"
                placeholder={t("visitors.prompt.placeholder")}
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                aria-label={t("visitors.prompt.placeholder")}
              />
              <button type="submit" className="pv-prompt__save">
                {t("visitors.prompt.save")}
              </button>
            </form>
            <button
              type="button"
              className="pv-prompt__skip"
              onClick={dismiss}
            >
              {t("visitors.prompt.skip")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default VisitorPrompt;
