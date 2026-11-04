"use client";

/**
 * ScrambleText
 * ============
 * Decoder / slot-machine effect: every letter spins through random glyphs
 * and locks into place left to right. Call `ref.current.scramble()` to run
 * it (on hover, focus, or reveal).
 *
 * Timing follows a duration model: over `duration` ms, letter i locks once
 * progress passes i / length, so the lock-in sweeps evenly across the word.
 * Glyphs only swap every `speed` ms (a readable flicker, not per frame).
 * A running decode is never restarted mid-way (`isAnimating` guard).
 *
 * No layout jitter without a monospace font: the real letter always stays
 * in the flow (transparent while spinning) and the random glyph is painted
 * centred on top of it via ::after, so every character keeps its width.
 * The real word stays in the DOM for crawlers; the parent link carries the
 * accessible name.
 *
 * Short, hover-triggered and user-initiated, so it runs even with reduced
 * motion enabled.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import styles from "./siteNav.module.css";

// Symbol pool the letters spin through before settling
const GLYPHS = "!<>-_\\/[]{}=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ScrambleText = forwardRef(function ScrambleText(
  {
    text,
    className = "",
    duration = 650, // ms for the whole word to decode
    speed = 40,     // ms between glyph swaps
  },
  ref
) {
  const charRefs  = useRef([]);
  const rafRef    = useRef(0);
  const animating = useRef(false);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const scramble = useCallback(() => {
    if (animating.current) return;
    animating.current = true;

    const chars = charRefs.current.slice(0, text.length);
    const len = text.length;
    const start = performance.now();
    let lastSwap = -Infinity;

    chars.forEach((el, i) => {
      if (el && text[i] !== " ") el.setAttribute("data-scrambling", "");
    });

    const update = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const swap = now - lastSwap >= speed;
      if (swap) lastSwap = now;

      chars.forEach((el, i) => {
        if (!el || !el.hasAttribute("data-scrambling")) return;
        if (progress > i / len) {
          el.removeAttribute("data-scrambling"); // settle on the real letter
        } else if (swap) {
          el.dataset.glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
      });

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(update);
      } else {
        chars.forEach((el) => el?.removeAttribute("data-scrambling"));
        animating.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(update);
  }, [text, duration, speed]);

  useImperativeHandle(ref, () => ({ scramble }), [scramble]);

  return (
    <span className={`${styles.scramble} ${className}`} aria-hidden="true">
      {text.split("").map((ch, i) => (
        <span
          key={i}
          ref={(el) => { charRefs.current[i] = el; }}
          className={styles.char}
          data-glyph={ch}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
});

export default ScrambleText;
