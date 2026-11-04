"use client";

/**
 * AuraScrollPage.jsx
 * ==================
 * Scroll orchestrator for the Aura Infotech hero narrative.
 * The 3D particle animation (StarfieldWithHands) and artifact scale/material
 * animations live in Scene.jsx / Artifact.jsx / StarfieldWithHands.jsx and
 * are driven by the scrollProgress prop passed here from page.js.
 *
 * This file owns:
 *   - The scroll spacer (sets page height to totalHeight vh)
 *   - The fixed viewport wrapper that keeps Scene pinned while scrolling
 *   - UI chrome: AuroraOverlay, SectionLabel, ProgressDots, ScrollIndicator
 *
 * Scrolling stops at the Capabilities section (sp caps at 0.82 in page.js) —
 * there is no further content after it.
 */

import React, { useEffect } from "react";
import CapabilitiesSection from "@/components/scene/capabilities/CapabilitiesSection";
import { PHASE_STOPS, capabilityIndex } from "@/lib/scrollPhases";

// ─────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────
const clamp       = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const invLerp     = (a, b, v)   => clamp((v - a) / (b - a), 0, 1);
const lerp        = (a, b, t)   => a + (b - a) * t;
const easeOutCubic    = (t) => 1 - Math.pow(1 - t, 3);


// ─────────────────────────────────────────────────
// SCROLL INDICATOR
// ─────────────────────────────────────────────────
function ScrollIndicator({ visible }) {
  return (
    <div
      className="aura-scroll-indicator"
      style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.25em",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
        }}
      >
        Scroll
      </div>
      <div
        style={{
          width: "1px",
          height: "40px",
          background: "linear-gradient(180deg, rgba(0,212,255,0.6), transparent)",
          animation: "scrollPulse 2s ease-in-out infinite",
        }}
      />
      <style>{`
        @media (max-width: 768px) {
          .aura-scroll-indicator { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────
// AURORA OVERLAY — CSS atmospheric color layer
// ─────────────────────────────────────────────────
function AuroraOverlay({ scrollProgress }) {
  const intensity =
    scrollProgress < 0.10 ? 0
    : scrollProgress < 0.35
      ? easeOutCubic(invLerp(0.10, 0.35, scrollProgress)) * 0.35
    : scrollProgress < 0.50
      ? lerp(0.35, 0.1, invLerp(0.35, 0.50, scrollProgress))
    : 0.1;

  if (intensity < 0.005) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
        opacity: intensity,
        background: `
          radial-gradient(ellipse 80% 50% at 20% 30%, rgba(0,212,255,0.15), transparent),
          radial-gradient(ellipse 60% 40% at 80% 20%, rgba(124,58,237,0.12), transparent),
          radial-gradient(ellipse 70% 60% at 50% 80%, rgba(0,212,255,0.08), transparent)
        `,
        mixBlendMode: "screen",
      }}
    />
  );
}

// ─────────────────────────────────────────────────
// PROGRESS DOTS — phase indicator on right edge
// ─────────────────────────────────────────────────
function ProgressDots({ scrollProgress }) {
  // One dot per phase boundary
  const phases = PHASE_STOPS; // one dot per snap stop (src/lib/scrollPhases.js)
  const currentPhase = phases.findIndex((p, i) => {
    const next = phases[i + 1] ?? 1.1;
    return scrollProgress >= p && scrollProgress < next;
  });

  return (
    <div
      style={{
        position: "fixed",
        right: "24px",
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 100,
        pointerEvents: "none",
        opacity: scrollProgress > 0.05 ? 0.6 : 0,
        transition: "opacity 0.5s ease",
      }}
    >
      {phases.map((p, i) => (
        <div
          key={i}
          style={{
            width:  i === currentPhase ? "8px" : "4px",
            height: i === currentPhase ? "8px" : "4px",
            borderRadius: "50%",
            background: i === currentPhase ? "#00d4ff" : "rgba(255,255,255,0.25)",
            boxShadow: i === currentPhase ? "0 0 8px #00d4ff" : "none",
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────
// SECTION LABEL — phase name at top center
// ─────────────────────────────────────────────────
function SectionLabel({ scrollProgress }) {
  const label =
    scrollProgress < 0.10 ? ""
    : scrollProgress < 0.25 ? "AWAKENING"
    : scrollProgress < 0.40 ? "DECONSTRUCTING"
    : "";

  return (
    <div
      style={{
        position: "fixed",
        top: "28px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        pointerEvents: "none",
        opacity: scrollProgress > 0.12 ? 0.45 : 0,
        transition: "opacity 0.5s ease",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "10px",
        letterSpacing: "0.35em",
        color: "#00d4ff",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────
function GlobalStyles() {
  useEffect(() => {
    const id = "aura-scroll-styles";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@300;400;600;800;900&family=Raleway:wght@100;200;300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');

      @keyframes scrollPulse {
        0%, 100% { opacity: 0.6; transform: scaleY(1); }
        50%       { opacity: 1;   transform: scaleY(1.1); }
      }


      html { scroll-behavior: smooth; }
      body { overflow-x: hidden; }
    `;
    document.head.appendChild(style);
    return () => document.getElementById(id)?.remove();
  }, []);

  return null;
}

// ─────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────
export default function AuraScrollPage({
  SceneComponent,
  scrollProgress = 0,
  freeze         = false,
  showOfferings  = false,
  totalHeight    = 450,
}) {
  const sp = scrollProgress;

  return (
    <>
      <GlobalStyles />

      {/* Scroll spacer — sets total page height */}
      <div style={{ height: `${totalHeight}vh`, position: "relative" }} />

      {/* Fixed viewport — all layers stack here */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        {/* 3D hero scene (Scene.jsx owns all 3D animation) */}
        {SceneComponent && (
          <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
            <SceneComponent
              scrollProgress={sp}
              freeze={freeze}
              showOfferings={showOfferings}
            />
          </div>
        )}

        {/* Fallback background when no SceneComponent */}
        {!SceneComponent && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              background: "radial-gradient(ellipse at 50% 50%, #0a1628 0%, #020408 100%)",
            }}
          />
        )}

        {/* CSS aurora colour overlay */}
        <AuroraOverlay scrollProgress={sp} />

        {/* CAPABILITIES (sp 0.50+): left-column text over the void; the
            particle morph is in the canvas. Re-renders only on step change. */}
        <div style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none" }}>
          <CapabilitiesSection activeIndex={capabilityIndex(sp)} />
        </div>

        {/* UI chrome */}
        <SectionLabel  scrollProgress={sp} />
        <ProgressDots  scrollProgress={sp} />
        <ScrollIndicator visible={sp < 0.08} />
      </div>
    </>
  );
}
