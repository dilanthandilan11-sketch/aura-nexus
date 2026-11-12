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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import ScrambleText from "./ScrambleText";
import styles from "./siteNav.module.css";
import { introDelay } from "@/lib/introState";

// The same links on every page (Home and the inner pages)
const LINKS = [
  { label: "Services", href: "/services" },
  { label: "Work",     href: "/work" },
  { label: "About",    href: "/about" },
  { label: "Contact",  href: "/contact" },
];

// Home: matches SceneText's INTRO_DELAY so the nav arrives with the headline.
// Inner pages: the nav is there straight away.
const REVEAL_DELAY = 7000;

const isActive = (pathname, href) =>
  pathname === href || (pathname ?? "").startsWith(`${href}/`);

/**
 * variant "home": Home's nav, revealed after the intro (Home shows its own logo).
 * variant "inner": every other page, visible at once, with the logo top-left.
 */
export default function SiteNav({ variant = "home" }) {
  const inner = variant === "inner";
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(inner);
  const [open, setOpen]       = useState(false);

  const desktopRefs = useRef([]);
  const mobileRefs  = useRef([]);
  const menuRef     = useRef(null);
  const toggleRef   = useRef(null);
  const firstLinkRef = useRef(null);

  // Home: reveal with the landing headline
  useEffect(() => {
    if (inner) return;
    const t = setTimeout(() => setVisible(true), introDelay(REVEAL_DELAY));
    return () => clearTimeout(t);
  }, [inner]);

  // Close the mobile menu after navigating
  useEffect(() => { setOpen(false); }, [pathname]);

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
      {inner && (
        <Link href="/" className={styles.brand} aria-label="Aura Infotech home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width="90" height="90" />
        </Link>
      )}

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
              <Link
                href={link.href}
                className={styles.link}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                onPointerEnter={() => desktopRefs.current[i]?.scramble()}
                onFocus={() => desktopRefs.current[i]?.scramble()}
              >
                <ScrambleText
                  ref={(el) => { desktopRefs.current[i] = el; }}
                  text={link.label}
                />
              </Link>
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
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={link.href}
                    className={styles.overlayLink}
                    aria-current={isActive(pathname, link.href) ? "page" : undefined}
                    onPointerEnter={() => mobileRefs.current[i]?.scramble()}
                    onFocus={() => mobileRefs.current[i]?.scramble()}
                    onClick={close}
                  >
                    <ScrambleText
                      ref={(el) => { mobileRefs.current[i] = el; }}
                      text={link.label}
                      duration={800}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
