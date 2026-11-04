"use client";

/**
 * SiteNav
 * =======
 * Top-right text navigation with a decoder (scramble) hover effect.
 * Appears with the landing headline (after the intro), decodes once on
 * reveal, then scrambles on hover / keyboard focus.
 *
 * Desktop: inline links. Mobile (< 768px): "Menu" toggle opening a
 * full-screen list whose links decode in sequence.
 *
 * z-index scale: overlay 290 < nav bar 300 (above SceneText 100,
 * scroll chrome 100 and Scene's mobile controls 200).
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CAPABILITY_STEPS, MAX_PROGRESS } from "@/lib/scrollPhases";
import ScrambleText from "./ScrambleText";
import styles from "./siteNav.module.css";

const LINKS = [
  { label: "Home",         href: "#top",          scrollTo: "top" },
  { label: "Capabilities", href: "#capabilities", scrollTo: "capabilities" },
  { label: "Contact",      href: "mailto:contact@aurainfotech.ca" },
];

// Matches SceneText's INTRO_DELAY so the nav arrives with the headline
const REVEAL_DELAY = 7000;

function handleScrollLink(e, link, after) {
  if (!link.scrollTo) { after?.(); return; }
  e.preventDefault();
  // "capabilities": the section's intro stop (scroll progress -> pixels)
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const top = link.scrollTo === "top" ? 0
    : link.scrollTo === "capabilities" ? (CAPABILITY_STEPS[0] / MAX_PROGRESS) * maxScroll
    : document.documentElement.scrollHeight;
  window.scrollTo({ top, behavior: "smooth" });
  after?.();
}

export default function SiteNav() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [open, setOpen]       = useState(false);

  const desktopRefs = useRef([]);
  const mobileRefs  = useRef([]);
  const menuRef     = useRef(null);
  const toggleRef   = useRef(null);
  const firstLinkRef = useRef(null);

  // Reveal with the landing headline
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), REVEAL_DELAY);
    return () => clearTimeout(t);
  }, []);

  // Decode every link once on reveal, staggered left to right
  useEffect(() => {
    if (!visible) return;
    const timers = LINKS.map((_, i) =>
      setTimeout(() => desktopRefs.current[i]?.scramble(), 250 + i * 140)
    );
    timers.push(setTimeout(() => menuRef.current?.scramble(), 250));
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  // Toggle label swaps Menu <-> Close: decode the new word
  useEffect(() => {
    menuRef.current?.scramble();
  }, [open]);

  // Mobile overlay: decode links in sequence, focus first, Escape closes
  useEffect(() => {
    if (!open) return;
    const timers = LINKS.map((_, i) =>
      setTimeout(() => mobileRefs.current[i]?.scramble(), 120 + i * 110)
    );
    firstLinkRef.current?.focus({ preventScroll: true });

    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <motion.nav
        className={styles.nav}
        aria-label="Primary"
        initial={false}
        // Hidden state must not depend on `reduce`: useReducedMotion is null on
        // the server, so branching here causes a hydration mismatch. Reduced
        // motion only changes the transition, which never reaches the markup.
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        {/* Desktop links */}
        <ul className={styles.list}>
          {LINKS.map((link, i) => (
            <li key={link.label}>
              <a
                href={link.href}
                className={styles.link}
                aria-label={link.label}
                onPointerEnter={() => desktopRefs.current[i]?.scramble()}
                onFocus={() => desktopRefs.current[i]?.scramble()}
                onClick={(e) => handleScrollLink(e, link)}
              >
                <ScrambleText
                  ref={(el) => { desktopRefs.current[i] = el; }}
                  text={link.label}
                />
              </a>
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          ref={toggleRef}
          type="button"
          className={styles.menuBtn}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onPointerEnter={() => menuRef.current?.scramble()}
          onClick={() => setOpen((o) => !o)}
        >
          <ScrambleText ref={menuRef} key={open ? "close" : "menu"} text={open ? "Close" : "Menu"} />
        </button>
      </motion.nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ul className={styles.overlayList}>
              {LINKS.map((link, i) => (
                <li key={link.label}>
                  <a
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={link.href}
                    className={styles.overlayLink}
                    aria-label={link.label}
                    onPointerEnter={() => mobileRefs.current[i]?.scramble()}
                    onFocus={() => mobileRefs.current[i]?.scramble()}
                    onClick={(e) => handleScrollLink(e, link, close)}
                  >
                    <ScrambleText
                      ref={(el) => { mobileRefs.current[i] = el; }}
                      text={link.label}
                      duration={800}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
