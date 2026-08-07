// =============================================================
//  CardCarousel — horizontal scroll-snap track with arrows + dots
// -------------------------------------------------------------
//  Generalised from the projects showcase so the education and
//  certification grids can switch to a slider once they hold more
//  cards than fit comfortably side by side.
//
//  Scrolling is native (scroll-snap + overflow-x), so touch drag,
//  trackpad swipe and keyboard scrolling all work for free; the
//  arrows and dots just drive scrollTo(). They render only when the
//  track actually overflows, so a wide screen that fits every card
//  shows no idle controls.
//
//  Cell width comes from the --cell-w custom property, which each
//  section sets in CSS — that's what decides how many cards are
//  visible at once.
// =============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function CardCarousel({
  children,
  className = "",
  // Passed straight through to the track: sections whose cards exist at
  // startup stagger them in ("pop"); sections that mount late must leave this
  // off or Reveal.jsx's observer never sees them (see Certifications.js).
  revealChildren,
}) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [active, setActive] = useState(0);

  const cells = React.Children.toArray(children);

  // Recompute which arrows/dots are usable from the track's scroll position.
  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setHasOverflow(scrollWidth > clientWidth + 4);
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft + clientWidth < scrollWidth - 4);

    const cell = el.querySelector(".card-carousel__cell");
    const step = cell ? cell.offsetWidth : clientWidth;
    setActive(step ? Math.round(scrollLeft / step) : 0);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update, cells.length]);

  const scrollToIndex = (index) => {
    const el = trackRef.current;
    if (!el) return;
    const cell = el.querySelector(".card-carousel__cell");
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    const step = cell ? cell.offsetWidth + gap : el.clientWidth;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    el.scrollTo({ left: step * index, behavior });
  };

  // Controls appear only when there's somewhere to scroll to.
  const showControls = cells.length > 1 && hasOverflow;

  return (
    <>
      <div
        className={`card-carousel${showControls ? " is-carousel" : ""}${
          className ? ` ${className}` : ""
        }`}
      >
        {showControls && (
          <button
            type="button"
            className="carousel-btn carousel-btn--prev"
            onClick={() => scrollToIndex(active - 1)}
            disabled={!canPrev}
            aria-label={t("carousel.prev")}
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
        )}

        <div
          className="card-carousel__track"
          ref={trackRef}
          data-reveal-children={revealChildren}
          // Deliberately no data-lenis-prevent: Lenis only intercepts vertical
          // gestures, so horizontal swipes reach the track natively anyway —
          // and preventing it would drop smooth page scrolling to hard native
          // scrolling whenever the pointer is over the carousel. The projects
          // showcase track omits it for the same reason.
        >
          {cells.map((cell, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="card-carousel__cell" key={i}>
              {cell}
            </div>
          ))}
        </div>

        {showControls && (
          <button
            type="button"
            className="carousel-btn carousel-btn--next"
            onClick={() => scrollToIndex(active + 1)}
            disabled={!canNext}
            aria-label={t("carousel.next")}
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        )}
      </div>

      {showControls && (
        <div className="carousel-dots" role="tablist">
          {cells.map((cell, i) => (
            <button
              type="button"
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={`carousel-dot${i === active ? " is-active" : ""}`}
              onClick={() => scrollToIndex(i)}
              aria-label={t("carousel.goTo", { number: i + 1 })}
              aria-selected={i === active}
              role="tab"
            />
          ))}
        </div>
      )}
    </>
  );
}
