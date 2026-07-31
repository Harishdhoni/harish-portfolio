import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { logVisit, setVisitName } from "./visitorStore";
import { deviceInfo } from "./deviceInfo";
import { lookupGeo } from "./geo";
import { prefersReducedMotion } from "../helper/scrollToSection";

/**
 * Visitor greeter + tracker.
 *
 * On first load of a browser session it logs one visit (device, approx.
 * location, referrer, time) to the store, then — for first-time visitors who
 * haven't introduced themselves — shows a small card asking for a name. The
 * name is required: the card has no dismiss control and stays until one is
 * given, at which point it patches the same visit doc and is remembered
 * locally so returning visits arrive already named.
 */
const SESSION_KEY = "pv.session.v1"; // one log per tab session
const SEEN_KEY = "pv.seen.v1"; // returning-visitor flag (persists)
const NAME_KEY = "pv.name.v1"; // remembered self-provided name
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
  const [error, setError] = useState(false);
  const visitIdRef = useRef(null);
  const logRef = useRef(null); // in-flight logVisit(), so save() can await it
  const inputRef = useRef(null);

  // Log the visit once per session, then decide whether to greet.
  useEffect(() => {
    let cancelled = false;

    let loggedThisSession = false;
    try {
      loggedThisSession = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (_) {
      /* ignore */
    }

    const knownName = readLS(NAME_KEY);
    const returning = readLS(SEEN_KEY) === "1";

    async function run() {
      if (!loggedThisSession) {
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

      // Ask anyone we don't have a name for yet — including a visitor who
      // dismissed the old optional version of this card, since the name is
      // now required.
      if (!cancelled && !knownName) setShow(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

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
    // Required field: an empty (or whitespace-only) name keeps the card open.
    if (!clean) {
      setError(true);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    setError(false);
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
    <div
      className={`pv-prompt${saved ? " is-saved" : ""}`}
      role="dialog"
      aria-live="polite"
      aria-label={t("visitors.prompt.aria")}
    >
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
          {/* noValidate: we show our own required message instead of the
              browser bubble, and it also has to catch whitespace-only names. */}
          <form className="pv-prompt__form" onSubmit={save} noValidate>
            <input
              ref={inputRef}
              type="text"
              className="pv-prompt__input"
              placeholder={t("visitors.prompt.placeholder")}
              value={name}
              maxLength={60}
              required
              aria-required="true"
              aria-invalid={error}
              aria-describedby={error ? "pv-prompt-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(false);
              }}
              aria-label={t("visitors.prompt.placeholder")}
            />
            <button type="submit" className="pv-prompt__save">
              {t("visitors.prompt.save")}
            </button>
          </form>
          {error && (
            <p className="pv-prompt__error" id="pv-prompt-error" role="alert">
              {t("visitors.prompt.error")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default VisitorPrompt;
