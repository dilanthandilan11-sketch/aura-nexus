"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Four words with an internal letter that spells A-U-R-A
const WORDS = [
  { word: "CREATIVE",    highlightIndex: 3 }, // Cre-A-tive
  { word: "STRUCTURE",   highlightIndex: 6 }, // Struct-U-re
  { word: "ALGORITHMIC", highlightIndex: 4 }, // Algo-R-ithmic
  { word: "DATABASE",    highlightIndex: 5 }, // Datab-A-se
];

// ── HUD corner brackets ─────────────────────────────────────────────────────
const BRACKET = "2px solid rgba(34, 211, 238, 0.5)";
const BSIZE   = 32; // px — leg length of each L-shape

function HUDCorners() {
  return (
    <>
      {/* top-left */}
      <div style={{ position: "absolute", top: 8, left: 8, width: BSIZE, height: BSIZE,
                    borderTop: BRACKET, borderLeft: BRACKET }} />
      {/* top-right */}
      <div style={{ position: "absolute", top: 8, right: 8, width: BSIZE, height: BSIZE,
                    borderTop: BRACKET, borderRight: BRACKET }} />
      {/* bottom-left */}
      <div style={{ position: "absolute", bottom: 8, left: 8, width: BSIZE, height: BSIZE,
                    borderBottom: BRACKET, borderRight: "none", borderLeft: BRACKET }} />
      {/* bottom-right */}
      <div style={{ position: "absolute", bottom: 8, right: 8, width: BSIZE, height: BSIZE,
                    borderBottom: BRACKET, borderRight: BRACKET }} />
    </>
  );
}

// ── Monospace metadata labels ────────────────────────────────────────────────
const META_STYLE = {
  position:     "absolute",
  fontSize:     "0.48rem",
  fontFamily:   "monospace",
  letterSpacing: "0.12em",
  color:        "rgba(34, 211, 238, 0.38)",
  pointerEvents: "none",
  userSelect:   "none",
};

// ── Main component ───────────────────────────────────────────────────────────
export default function AuraDefinition() {
  const sectionRef   = useRef(null);
  const containerRef = useRef(null); // right-side HUD box — alignment anchor
  const lineRefs     = useRef([]);
  const ctxRef       = useRef(null);
  const scrolledRef  = useRef(false);
  const [hoveredLine, setHoveredLine] = useState(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const setup = () => {
      ctxRef.current?.revert();
      if (!section.isConnected) return;

      ctxRef.current = gsap.context(() => {
        // ── Local coordinate math: align to the HUD box centre, not the viewport ──
        const containerEl   = containerRef.current;
        const containerRect = containerEl?.getBoundingClientRect();
        const alignCenter   = containerRect
          ? containerRect.left + containerRect.width / 2
          : window.innerWidth / 2; // graceful fallback

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger:      section,
            start:        "top top",
            end:          "+=200%",
            pin:          true,
            scrub:        1,
            anticipatePin: 1,
            onUpdate: (self) => {
              scrolledRef.current = self.progress > 0.26;
              if (scrolledRef.current) setHoveredLine(null);
            },
          },
        });

        // Hold phase — static text, hoverable (0 → 0.3)
        const HOLD = 0.3;

        // Phase 1 — Shift each line so its highlighted letter sits at box centre
        lineRefs.current.forEach((lineEl, i) => {
          if (!lineEl) return;
          const highlightSpan = lineEl.querySelector("[data-highlight]");
          if (!highlightSpan) return;

          const rect        = highlightSpan.getBoundingClientRect();
          const letterCenter = rect.left + rect.width / 2;
          const shiftX      = alignCenter - letterCenter;

          tl.to(lineEl, { x: shiftX, duration: 1, ease: "power3.inOut" }, HOLD + i * 0.06);
        });

        // Phase 2a — Fade + blur non-highlighted letters
        const others = section.querySelectorAll("[data-letter]:not([data-highlight])");
        tl.to(
          others,
          { opacity: 0.1, filter: "blur(8px)", duration: 0.7, ease: "power2.inOut", stagger: 0.005 },
          HOLD + 0.4
        );

        // Phase 2b — Scale + intensify glow on highlighted letters
        // Note: `color` is omitted — gradient text from CSS handles colouring.
        // textShadow still renders on transparent-fill glyphs in all modern browsers.
        const highlights = section.querySelectorAll("[data-highlight]");
        tl.to(
          highlights,
          {
            scale:      1.3,
            textShadow: "0 0 28px rgba(34,211,238,0.55), 0 0 64px rgba(168,85,247,0.3)",
            duration:   0.7,
            ease:       "power2.inOut",
          },
          HOLD + 0.5
        );
      }, section);
    };

    document.fonts.ready.then(setup);

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      // Re-reading containerRef inside setup() gives fresh containerRect on resize
      resizeTimer = setTimeout(setup, 150);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
      ctxRef.current?.revert();
    };
  }, []);

  return (
    <>
      {/* ── Global styles injected once ─────────────────────────────────── */}
      <style>{`
        @keyframes auraFlow {
          0%   { background-position: 0%   50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0%   50%; }
        }

        /* Flowing cyan→purple gradient text on every highlighted letter */
        [data-highlight] {
          background:              linear-gradient(90deg, #22d3ee, #a855f7, #ec4899, #22d3ee);
          background-size:         300% auto;
          -webkit-background-clip: text;
          background-clip:         text;
          -webkit-text-fill-color: transparent;
          animation:               auraFlow 4s ease infinite;
        }
      `}</style>

      <section
        ref={sectionRef}
        style={{
          position:        "relative",
          zIndex:          10,
          marginTop:       "190vh",
          minHeight:       "100vh",
          display:         "flex",
          flexDirection:   "row",
          alignItems:      "center",
          justifyContent:  "space-between",
          padding:         "0 clamp(2rem, 5vw, 6rem)",
          gap:             "2rem",
        }}
      >
        {/* ── Left: Glass Card ─────────────────────────────────────────── */}
        <div
          style={{
            flexShrink:          0,
            maxWidth:            "36rem",
            backdropFilter:      "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            background:          "rgba(255, 255, 255, 0.05)",
            border:              "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius:        "1rem",
            padding:             "clamp(1.5rem, 3vw, 2.5rem)",
            boxShadow:           "0 25px 50px rgba(0, 0, 0, 0.4)",
          }}
        >
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.4em", color: "rgba(255,255,255,0.6)",
                      marginBottom: "1rem", fontFamily: "sora, system-ui, sans-serif" }}>
            AURA
          </p>

          <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.8rem)", fontWeight: 600, color: "#fff",
                       lineHeight: 1.25, marginBottom: "1rem", fontFamily: "sora, system-ui, sans-serif" }}>
            Engineering <br /> Digital Intelligence
          </h1>

          <div style={{ width: "5rem", height: "2px",
                        background: "linear-gradient(to right, #60a5fa, #a855f7)",
                        marginBottom: "1.5rem" }} />

          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem",
                      fontFamily: "sora, system-ui, sans-serif" }}>
            <span style={{ color: "#60a5fa", fontWeight: 500 }}>Creative.</span>{" "}
            Structured. Algorithmic. Data-driven.
          </p>

          <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "2rem",
                      fontFamily: "sora, system-ui, sans-serif", lineHeight: 1.6 }}>
            From scalable software to intelligent automation, we build systems
            that power modern businesses.
          </p>

          <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
            <button
              style={{ padding: "0.75rem 1.5rem", borderRadius: "9999px",
                       background: "linear-gradient(to right, #ec4899, #a855f7)",
                       color: "#fff", fontWeight: 500, border: "none", cursor: "pointer",
                       transition: "transform 0.2s", fontFamily: "sora, system-ui, sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              Explore Services
            </button>
            <button
              style={{ padding: "0.75rem 1.5rem", borderRadius: "9999px",
                       border: "1px solid rgba(255,255,255,0.2)", color: "#fff",
                       background: "transparent", cursor: "pointer", transition: "background 0.2s",
                       fontFamily: "sora, system-ui, sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              View Projects
            </button>
          </div>

          <div style={{ display: "flex", gap: "2rem", color: "#fff" }}>
            {[["50+", "Projects"], ["10+", "Technologies"], ["100%", "Client Focus"]].map(([v, l]) => (
              <div key={l}>
                <p style={{ fontSize: "1.2rem", fontWeight: 600, fontFamily: "sora, system-ui, sans-serif" }}>{v}</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontFamily: "sora, system-ui, sans-serif" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: HUD Word Box ───────────────────────────────────────── */}
        <div
          ref={containerRef}
          style={{
            position:       "relative",
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            gap:            "clamp(0.25rem, 1vw, 0.9rem)",
            padding:        "5rem 3.5rem",
            background:     "rgba(255, 255, 255, 0.02)",
          }}
        >
          {/* L-shaped corner brackets */}
          <HUDCorners />

          {/* Metadata labels */}
          <span style={{ ...META_STYLE, top: 8, left: 32 }}>SYSTEM // ACTIVE</span>
          <span style={{ ...META_STYLE, bottom: 8, right: 32 }}>CORE_v2.1</span>

          {/* Word rows */}
          {WORDS.map(({ word, highlightIndex }, lineIdx) => {
            const isHovered = hoveredLine === lineIdx;

            return (
              <div
                key={word}
                ref={(el) => { lineRefs.current[lineIdx] = el; }}
                aria-label={word}
                onMouseEnter={() => { if (!scrolledRef.current) setHoveredLine(lineIdx); }}
                onMouseLeave={() => setHoveredLine(null)}
                style={{
                  position:    "relative", // needed so the guide line is contained
                  fontSize:    "clamp(1.5rem, 4.5vw, 6.5rem)",
                  fontFamily:  "sora, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                  fontWeight:  600,
                  letterSpacing: "0.1em",
                  color:       "rgba(255, 255, 255, 0.85)",
                  whiteSpace:  "nowrap",
                  cursor:      "default",
                  willChange:  "transform",
                }}
              >
                {/* Guide line — dashed, spans from left padding edge to right padding edge */}
                <div
                  style={{
                    position:     "absolute",
                    left:         "-2.5rem",  // cancels container's 2.5rem horizontal padding
                    right:        "-2.5rem",
                    top:          "50%",
                    height:       0,
                    borderTop:    "1px dashed rgba(34, 211, 238, 0.08)",
                    pointerEvents: "none",
                    zIndex:       -1,
                  }}
                />

                {/* Individual character spans */}
                {word.split("").map((char, charIdx) => {
                  const isHighlight = charIdx === highlightIndex;

                  return (
                    <span
                      key={charIdx}
                      data-letter=""
                      {...(isHighlight ? { "data-highlight": "" } : {})}
                      aria-hidden="true"
                      style={{
                        display:    "inline-block",
                        filter:     isHovered && !isHighlight ? "blur(7px)" : "blur(0px)",
                        // color omitted for highlights — CSS gradient handles it
                        textShadow: isHovered && isHighlight
                          ? "0 0 15px rgba(34,211,238,0.4), 0 0 40px rgba(168,85,247,0.22)"
                          : "none",
                        transition:
                          "opacity 0.35s cubic-bezier(0.16,1,0.3,1), " +
                          "filter 0.35s cubic-bezier(0.16,1,0.3,1), " +
                          "text-shadow 0.35s ease",
                      }}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
