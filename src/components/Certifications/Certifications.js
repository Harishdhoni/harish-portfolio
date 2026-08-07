// =============================================================
//  Certifications — verified credentials
// -------------------------------------------------------------
//  Reads the `certifications` collection (owner-entered through
//  the admin panel's Certs tab). Title, issuer, dates and the
//  credential id render exactly as typed — they're proper nouns
//  in every language; only the optional description is translated
//  (certifications.items.<id>.description, with the stored English
//  as its fallback).
//
//  A card is badged "Verified" only when it carries a link to the
//  issuer's verification page — the badge labels the link, it is
//  never a claim on its own.
//
//  NOTE: nothing here uses [data-reveal]. The whole section mounts
//  only once Firestore resolves, and helper/Reveal.jsx builds its
//  IntersectionObserver once at startup — a tagged element added
//  later would keep the observer's opacity:0 start state forever.
//  The cards animate themselves in from CSS instead (.cert-card).
//  `data-spotlight` is fine: it runs off a delegated pointermove
//  listener, so late-added cards are picked up.
// =============================================================
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { FiCheckCircle, FiExternalLink } from "react-icons/fi";
import { useContent } from "../content/ContentProvider";
import CardCarousel from "../helper/CardCarousel";

// From this many cards on, the grid becomes a swipeable carousel — matches the
// education section.
const CAROUSEL_FROM = 3;

function Certifications() {
  const { t } = useTranslation();
  const { certifications } = useContent();

  // No credentials (or no backend) → the section stays out of the page
  // entirely. Navbar hides its entry on the same condition.
  if (!certifications.length) return null;

  const isCarousel = certifications.length >= CAROUSEL_FROM;

  return (
    <section className="section section--page" id="certifications">
      <div className="container-x" style={{ textAlign: "center" }}>
        <span className="eyebrow eyebrow--center">
          {t("certifications.eyebrow")}
        </span>
        <h1 className="section-heading">
          <Trans i18nKey="certifications.heading">
            Verified <span className="accent">certifications</span>
          </Trans>
        </h1>
        <p className="cert-lead">{t("certifications.lead")}</p>

        {(() => {
          const cards = certifications.map((cert, i) => {
            const { id, icon: Icon, url } = cert;
            const description = t(`certifications.items.${id}.description`, {
              defaultValue: cert.description,
            });
            return (
              <article
                key={id}
                className="glass glass--hover cert-card"
                data-spotlight
                // Staggers the entrance animation; capped so a long list
                // doesn't leave the last cards waiting seconds to appear.
                style={{ "--i": Math.min(i, 7) }}
              >
                <div className="cert-card__head">
                  <span className="cert-card__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  {url && (
                    <span className="cert-card__verified">
                      <FiCheckCircle aria-hidden="true" />
                      {t("certifications.verified")}
                    </span>
                  )}
                </div>

                <div className="cert-card__body">
                  <h3 className="cert-card__title">{cert.title}</h3>
                  {cert.issuer && (
                    <p className="cert-card__issuer">{cert.issuer}</p>
                  )}
                  {description && (
                    <p className="cert-card__desc">{description}</p>
                  )}

                  {cert.skills.length > 0 && (
                    <ul className="cert-card__skills">
                      {cert.skills.map((skill) => (
                        <li className="cert-card__skill" key={skill}>
                          {skill}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="cert-card__meta">
                    {cert.issued && (
                      <span className="cert-card__metaItem">
                        {t("certifications.issued", { date: cert.issued })}
                      </span>
                    )}
                    {cert.expires && (
                      <span className="cert-card__metaItem">
                        {t("certifications.expires", { date: cert.expires })}
                      </span>
                    )}
                    {cert.credentialId && (
                      <span className="cert-card__metaItem">
                        {t("certifications.credentialId")}:{" "}
                        <code className="cert-card__cred">
                          {cert.credentialId}
                        </code>
                      </span>
                    )}
                  </div>
                </div>

                {url && (
                  <a
                    className="btn btn-outline cert-card__verify"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("certifications.verifyAria", {
                      title: cert.title,
                    })}
                  >
                    <FiExternalLink aria-hidden="true" />
                    {t("certifications.verify")}
                  </a>
                )}
              </article>
            );
          });

          // No revealChildren: this section mounts after Firestore resolves,
          // long after Reveal.jsx has scanned the DOM (see the note above).
          return isCarousel ? (
            <CardCarousel className="cert-carousel">{cards}</CardCarousel>
          ) : (
            <div className="cert-grid">{cards}</div>
          );
        })()}
      </div>
    </section>
  );
}

export default Certifications;
