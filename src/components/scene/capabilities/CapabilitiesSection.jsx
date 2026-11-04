// scene/capabilities/CapabilitiesSection.jsx
"use client";

/**
 * Left-column text for "02 Our Capabilities", overlaid on the 3D void.
 * One step in focus at a time: the active item fades/slides up into view
 * (blur -> sharp), the previous one moves up and out, upcoming ones wait
 * below. State is derived purely from `activeIndex`, so scrolling back
 * reverses everything. Memoised: re-renders only when the step changes,
 * never per scroll frame. The particle morph on the right is driven
 * separately inside the canvas (CapabilityParticles).
 */

import React, { memo } from "react";
import { INTRO, SERVICES } from "./capabilitiesContent";
import styles from "./capabilities.module.css";

function stateOf(i, active) {
  if (active < 0) return "future";
  if (i === active) return "active";
  return i < active ? "past" : "future";
}

function CapabilitiesSection({ activeIndex }) {
  const inSection = activeIndex >= 0;

  return (
    <section
      id="capabilities"
      className={styles.root}
      data-visible={inSection ? "true" : "false"}
      aria-label="Our capabilities"
      aria-hidden={!inSection}
    >
      {/* Progress indicator: 01-05 for the five services */}
      <ol className={styles.progress} aria-hidden="true">
        {SERVICES.map((s, i) => {
          const step = i + 1;
          const state = activeIndex === step ? "active" : activeIndex > step ? "done" : "todo";
          return (
            <li key={s.number} className={styles.progressItem} data-state={state}>
              {s.number}
            </li>
          );
        })}
      </ol>

      <div className={styles.column}>
        <div className={styles.stack}>
          {/* Step 0: intro */}
          <article
            className={`${styles.item} ${styles.intro}`}
            data-state={stateOf(0, activeIndex)}
            aria-hidden={activeIndex !== 0}
          >
            <p className={styles.eyebrow}>{INTRO.eyebrow}</p>
            <h2 className={styles.heading}>{INTRO.heading}</h2>
            <p className={styles.body}>{INTRO.body}</p>
            <ul className={styles.tags}>
              {INTRO.tags.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </article>

          {/* Steps 1-5: services */}
          {SERVICES.map((s, i) => {
            const step = i + 1;
            return (
              <article
                key={s.number}
                className={styles.item}
                data-state={stateOf(step, activeIndex)}
                aria-hidden={activeIndex !== step}
              >
                <p className={styles.number}>{s.number}</p>
                <p className={styles.verb} aria-hidden="true">{s.verb}</p>
                <h3 className={styles.title}>{s.title}</h3>
                {s.body && <p className={styles.body}>{s.body}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default memo(CapabilitiesSection);
