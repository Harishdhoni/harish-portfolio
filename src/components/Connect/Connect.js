import React from "react";
import { AiFillFacebook } from "react-icons/ai";
import { FaLinkedinIn, FaGithub, FaInstagram } from "react-icons/fa";
import { Trans, useTranslation } from "react-i18next";
import avatar from "../../Assets/connect-photo.jpg";

// Static labelled social pills (icon + word). Links come from the portfolio
// owner's own profiles.
const socials = [
  {
    icon: <FaLinkedinIn />,
    href: "https://www.linkedin.com/in/harish-s-119b5a18a/",
    label: "LinkedIn",
    brand: "linkedin",
  },
  {
    icon: <FaGithub />,
    href: "https://github.com/Harishdhoni",
    label: "GitHub",
    brand: "github",
  },
  {
    icon: <FaInstagram />,
    href: "https://www.instagram.com/harish_.siva",
    label: "Instagram",
    brand: "instagram",
  },
  {
    icon: <AiFillFacebook />,
    href: "https://www.facebook.com/harish.siva.727191",
    label: "Facebook",
    brand: "facebook",
  },
];

function Connect() {
  const { t } = useTranslation();
  return (
    <section className="section section--page" id="connect">
      <div className="container-x" style={{ textAlign: "center" }}>
        <span className="eyebrow eyebrow--center" data-reveal>
          {t("connect.eyebrow")}
        </span>
        <h2 className="section-heading" data-reveal>
          <Trans i18nKey="connect.heading">
            Find me <span className="accent">online</span>
          </Trans>
        </h2>
        <p
          className="lead"
          style={{ maxWidth: "48ch", margin: "0 auto var(--space-6)" }}
          data-reveal
        >
          {t("connect.lead")}
        </p>

        <div className="connect-orbit-card" data-reveal>
          <svg
            className="connect-orbit-card__field"
            aria-hidden="true"
            viewBox="0 0 688 416"
            preserveAspectRatio="xMidYMid slice"
          >
            <g stroke="rgba(170,195,255,0.28)" strokeWidth="1">
              <line x1="40" y1="18" x2="300" y2="20" />
              <line x1="450" y1="380" x2="630" y2="380" />
              <line x1="600" y1="140" x2="660" y2="60" />
              <line x1="18" y1="120" x2="60" y2="340" />
            </g>
            <g fill="rgba(255,255,255,0.45)">
              <circle cx="40" cy="18" r="2" />
              <circle cx="620" cy="14" r="2" />
              <circle cx="660" cy="60" r="2" />
              <circle cx="600" cy="140" r="2" />
              <circle cx="650" cy="200" r="2" />
              <circle cx="18" cy="120" r="2" />
              <circle cx="60" cy="340" r="2" />
              <circle cx="630" cy="380" r="2" />
              <circle cx="300" cy="20" r="2" />
              <circle cx="450" cy="380" r="2" />
              <circle cx="100" cy="380" r="2" />
              <circle cx="560" cy="320" r="2" />
              <circle cx="250" cy="395" r="2" />
              <circle cx="400" cy="10" r="2" />
            </g>
            <g fill="#7dd3fc">
              <circle cx="605" cy="110" r="3.5" opacity="0.8" />
              <circle cx="70" cy="215" r="3.5" opacity="0.8" />
            </g>
          </svg>
          <div className="connect-orbit-stage">
            <span className="connect-ring-base" aria-hidden="true" />
            <div className="connect-photo">
              <img
                src={avatar}
                alt="Harish Siva"
                width="240"
                height="240"
                loading="lazy"
                decoding="async"
              />
              <span className="photo-orbits" aria-hidden="true">
                <span className="orbit-ring orbit-ring--connect" />
              </span>
            </div>
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                title={s.label}
                className={`connect-node connect-node--${s.brand}`}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Connect;
