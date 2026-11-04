"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./navbar.module.css";

const LINKS = [
  { label: "Home", href: "#home" },
  { label: "Projects", href: "#projects" },
  { label: "Company", href: "#company" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

function customEase(t) {
  return t < 0.5 ? 2 * t * t * (1.5 - t) : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function ElementReveal({
  children,
  isVisible = false,
  startDelay = 0,
  duration = 650,
  style = {},
  className = "",
}) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      return;
    }

    const timeout = setTimeout(() => {
      const start = performance.now();

      const animate = () => {
        const elapsed = performance.now() - start;
        const raw = Math.min(1, elapsed / duration);
        setProgress(customEase(raw));
        if (raw < 1) rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible, startDelay, duration]);

  const rotateX = 45 * (1 - progress);
  const y = 15 * (1 - progress);
  const blur = 6 * (1 - progress);
  const opacity = progress;

  return (
    <div
      className={className}
      style={{
        ...style,
        transformStyle: "preserve-3d",
        transform: `perspective(1000px) rotateX(${rotateX}deg) translateY(${y}px)`,
        filter: blur > 0.1 ? `blur(${blur}px)` : "none",
        opacity,
        willChange: progress > 0 && progress < 1 ? "transform, opacity, filter" : "auto",
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

export default function Navbar({ visible = false }) {
  const [activeHref, setActiveHref] = useState("#home");
  const navRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, velocity: 0 });
  const rafRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Mouse tracking with velocity calculation
  const handleMouseMove = useCallback((e) => {
    if (!navRef.current) return;

    const rect = navRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Calculate velocity
    const dx = x - lastPosRef.current.x;
    const dy = y - lastPosRef.current.y;
    const velocity = Math.sqrt(dx * dx + dy * dy);

    lastPosRef.current = { x, y };
    mouseRef.current = { x, y, velocity };

    // Update CSS custom properties
    navRef.current.style.setProperty("--mouse-x", `${x}%`);
    navRef.current.style.setProperty("--mouse-y", `${y}%`);
    navRef.current.style.setProperty("--mouse-velocity", velocity);

    // Ripple effect on high velocity
    if (velocity > 2) {
      navRef.current.style.setProperty("--ripple-scale", "1");
      setTimeout(() => {
        if (navRef.current) {
          navRef.current.style.setProperty("--ripple-scale", "0");
        }
      }, 300);
    }
  }, []);

  // Smooth animation loop for continuous displacement
  useEffect(() => {
    if (!visible) return;

    let targetX = 50;
    let targetY = 50;
    let currentX = 50;
    let currentY = 50;

    const animate = () => {
      // Smooth lerp to target
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      if (navRef.current) {
        navRef.current.style.setProperty("--smooth-x", `${currentX}%`);
        navRef.current.style.setProperty("--smooth-y", `${currentY}%`);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  useEffect(() => {
    const hash = window.location.hash || "#home";
    setActiveHref(hash);

    const onHashChange = () => setActiveHref(window.location.hash || "#home");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <ElementReveal isVisible={visible} startDelay={0} duration={700} className={styles.navReveal}>
      <nav 
        ref={navRef}
        className={styles.nav} 
        aria-label="Primary"
        onMouseMove={handleMouseMove}
      >
        <div className={styles.ripple} aria-hidden="true" />

        {LINKS.map(({ label, href }) => {
          const isActive = href === activeHref;

          return (
            <a
              key={href}
              href={href}
              className={`${styles.link} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setActiveHref(href)}
            >
              <span className={styles.text3d}>
                <span className={styles.face} data-text={label}>{label}</span>
              </span>

              <span className={styles.underline} aria-hidden="true" />

              <span className={styles.orbitWrap} aria-hidden="true">
                <span className={styles.orbitDot} />
                <span className={styles.orbitDot2} />
                <span className={styles.orbitDot3} />
                <span className={styles.orbitDot4} />
                <span className={styles.orbitDot5} />
              </span>
            </a>
          );
        })}
      </nav>
    </ElementReveal>
  );
}