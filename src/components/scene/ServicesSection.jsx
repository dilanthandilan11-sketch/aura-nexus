"use client";

/**
 * ServicesSection.jsx
 * ===================
 * DOM layer for SCROLL PHASE 4 (0.65-0.82, holds after): section header and
 * the selected service's detail. The orbit itself is WebGL
 * (ServicesOrbit3D.jsx inside Scene); selection state is owned by
 * AuraScrollPage and shared by both.
 *
 * The headline flips in with the same letter motion as the landing hero.
 */

import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SERVICES } from "./servicesData";
import styles from "./services.module.css";

const clamp        = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const invLerp      = (a, b, v)   => clamp((v - a) / (b - a), 0, 1);
const easeOutCubic = (t)         => 1 - Math.pow(1 - t, 3);

const EASE = [0.16, 1, 0.3, 1];

// ─────────────────────────────────────────────────
// FLIP HEADLINE: same letter motion as the landing hero
// ─────────────────────────────────────────────────
function FlipHeadline({ text, reduce }) {
  const words = text.split(" ");
  const last  = words.length - 1;

  const letter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.3 } } }
    : {
        initial: { rotateX: 90, y: 20, opacity: 0, filter: "blur(8px)" },
        animate: {
          rotateX: 0,
          y: 0,
          opacity: 1,
          filter: "blur(0px)",
          transition: { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.9] },
        },
      };

  return (
    <motion.span
      className={styles.headlineInner}
      initial="initial"
      animate="animate"
      exit={{ opacity: 0, y: -12, transition: { duration: 0.25, ease: "easeIn" } }}
      variants={{
        initial: {},
        animate: { transition: { staggerChildren: reduce ? 0 : 0.035 } },
      }}
    >
      <span className={styles.srOnly}>{text}</span>
      {words.map((word, wi) => (
        <span
          key={`${word}-${wi}`}
          className={`${styles.word} ${wi === last ? styles.accentWord : ""}`}
          aria-hidden="true"
        >
          {word.split("").map((ch, ci) => (
            <motion.span key={ci} className={styles.letter} variants={letter}>
              {ch}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.span>
  );
}

// ─────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────
export default function ServicesSection({
  scrollProgress,
  active = 0,
  onSelect,
  progressMV,
  userPaused = false,
  onTogglePause,
  onHoverChange,
}) {
  const reduce = useReducedMotion();
  const sp     = scrollProgress;

  const sectionOpacity = sp < 0.40 ? 0 : sp < 0.65 ? easeOutCubic(invLerp(0.40, 0.65, sp)) : 1;

  const reveal = (start, span = 0.12) => {
    const t = easeOutCubic(invLerp(start, start + span, sp));
    return reduce ? { opacity: t } : { opacity: t, transform: `translateY(${(1 - t) * 20}px)` };
  };

  const service = SERVICES[active];

  return (
    <section
      className={styles.root}
      style={{ opacity: sectionOpacity, visibility: sectionOpacity === 0 ? "hidden" : "visible" }}
      aria-labelledby="capabilities-title"
    >
      {/* ── Header ── */}
      <div className={styles.header} style={reveal(0.46)}>
        <span className={styles.rule} aria-hidden="true" />
        <h2 id="capabilities-title" className={styles.title}>
          Our <strong>Capabilities</strong>
        </h2>
        <p className={styles.lede}>5 disciplines. 1 team.</p>
      </div>

      {/* ── Detail ── */}
      <div
        id="svc-panel"
        role="region"
        aria-label={`${service.label} details`}
        className={styles.detail}
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
      >
        <div style={reveal(0.52)}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`k-${service.id}`}
              className={styles.kicker}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {service.label}
            </motion.p>
          </AnimatePresence>
          <h3 className={styles.headline}>
            <AnimatePresence mode="wait" initial={false}>
              <FlipHeadline key={service.id} text={service.headline} reduce={reduce} />
            </AnimatePresence>
          </h3>
        </div>

        <div style={reveal(0.56)}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`d-${service.id}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.15 } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.2 } }}
            >
              <p className={styles.body}>{service.desc}</p>
              <ul className={styles.includes} aria-label={`${service.label} includes`}>
                {service.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <div className={styles.actions}>
            <a href="mailto:contact@aurainfotech.ca" className={styles.cta}>
              Start a Project
              <span className={styles.ctaArrow} aria-hidden="true">&rarr;</span>
            </a>
            {!reduce && (
              <button
                type="button"
                className={styles.pauseBtn}
                aria-pressed={userPaused}
                onClick={onTogglePause}
              >
                {userPaused ? "Resume" : "Pause"}
              </button>
            )}
          </div>

          {/* Service navigator: active segment fills with the auto-advance timer.
              Names show on mobile, where the orbit labels are hidden. */}
          <div className={styles.segments} role="group" aria-label="Choose a capability">
            {SERVICES.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={styles.segment}
                  aria-pressed={isActive}
                  aria-label={s.label}
                  onClick={() => onSelect?.(i)}
                >
                  <span className={styles.segLabel} aria-hidden="true">{s.short}</span>
                  <span className={styles.segTrack} aria-hidden="true">
                    {isActive && (
                      <motion.span
                        className={styles.segFill}
                        style={{ scaleX: progressMV ?? 1 }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
