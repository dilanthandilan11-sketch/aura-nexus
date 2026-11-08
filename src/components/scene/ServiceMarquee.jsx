// scene/ServiceMarquee.jsx
// Three slow running rows of our services, in capitals, as 3D text a little
// way behind the glass logo. They sit in the band between the navbar and the
// heading on the left, and alternate direction: right-to-left,
// left-to-right, right-to-left.
// Being real 3D text, they turn with the mouse rotation and show through
// (refracted by) the glass "A". Landing only: fade in after the intro,
// fade out as soon as scrolling starts.
"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { holdState } from "@/components/scene/molten/holdState";
import { introDelay } from "@/lib/introState";

const SERVICES = [
    "Software Development",
    "Web Development",
    "Digital Marketing",
    "Graphic Designing",
    "UI/UX Designing",
    "SEO",
    "Analytics & Data Analysis",
];

// ── Tuning ──────────────────────────────────────────────────────────────────
const DEPTH       = -5;     // world z (logo at 0, camera at 6, aurora at -20)
const FONT_SIZE   = 0.2;    // world units: small, about the size of nav text on screen
const SPACING     = 0.12;   // letter spacing
const SPEED       = 0.35;   // world units per second
const OPACITY     = 1.0;    // solid white letters
const GLOW        = 2.0;    // HDR white: tone mapping dims it, so it needs this much to read pure white
const TINT        = "#ffffff";
// Soft white glow: three blurred layers behind the letters, each wider and
// fainter than the last, so the light fades gradually away from the letter
// (one layer reads as a stroke). `blur` is a percent of the font size.
const GLOW_COLOR  = "#ffffff";
const GLOW_LAYERS = [
    { blur: "8%",  opacity: 0.35 },
    { blur: "20%", opacity: 0.25 },
    { blur: "40%", opacity: 0.12 },
    { blur: "70%", opacity: 0.01 },   // wide, very faint tail
];
// Rows as a fraction of the screen height from the top (navbar ~4%,
// heading starts ~33%)
const ROWS_FROM_TOP = [0.16, 0.205, 0.25];
const DIRECTIONS    = [-1, 1, -1];          // -1 = moves right to left
const SEPARATOR     = "   •   ";
const REPEATS       = 4;                    // copies per row, so it never runs out
// Keep the navbar readable: wherever the mouse turns the scene, any part of
// the text that reaches the top of the screen fades out. Fraction of the
// screen height from the top: fully hidden above FADE_HIDDEN, fully visible
// below FADE_VISIBLE (the navbar sits at ~4-7%).
const FADE_HIDDEN   = 0.06;
const FADE_VISIBLE  = 0.20;
// Intro: the rows slide in from off-screen when the heading starts its
// animation, one after another (a chain), each from the side it travels from
// (right-to-left rows come in from the right, the middle row from the left).
const INTRO_DELAY   = 7000;                 // ms, same as SceneText's INTRO_DELAY (heading + navbar)
const ROW_DELAYS    = [200, 550, 900];      // ms after INTRO_DELAY, per row (the chain)
const ENTRY_SECONDS = 1.8;                  // slide-in time, eases out into the normal drift
const EDGE_MARGIN   = 0.5;                  // world units past the screen edge (mouse tilt, glow)
const CUT_PAD       = 0.15;                 // gap kept before the first word, so its glow isn't clipped
const easeOutQuart  = (x) => 1 - Math.pow(1 - x, 4);
const FONT          = "/fonts/orbitron-medium-webfont.woff";
const CAMERA_Z      = 6;
const FOV           = 40;
// Screen-space top fade, injected into the text material. Works in clip
// space, so it is the same on screen and in the glass logo's capture.
// Press-and-hold (same hold that warps the nebula / aurora / floor), kept
// gentle so the services stay readable:
const HOLD_SPEEDUP = 4.0;    // rows run up to 1 + 4 = 5x faster at full hold
const HOLD_BEND    = 0.22;   // outward pull, ~1/4 of the background's (0.9)
const HOLD_GLOW    = 0.6;    // glow layers up to +60% while held
const HOLD_DIM     = 0.15;   // letters dim up to 15%, so the eye goes to the logo
// shared by every row's material (one uniform object, updated per frame)
const holdUniforms = {
    uMqHold:   { value: 0 },
    uMqAspect: { value: 1 },
};

const fadeOnBeforeCompile = (shader) => {
    shader.uniforms.uMqHold   = holdUniforms.uMqHold;
    shader.uniforms.uMqAspect = holdUniforms.uMqAspect;
    shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec4 vFadeClip;\nuniform float uMqHold;\nuniform float uMqAspect;\nvoid main() {")
        .replace(
            "#include <project_vertex>",
            `#include <project_vertex>
\t{
\t\t// hold: bend outward from the centre of the screen, mostly sideways
\t\t// (same shape as the background pull, much weaker)
\t\tvec2 hs = vec2(uMqAspect, 1.0) * 0.5;
\t\tvec2 hp = gl_Position.xy / gl_Position.w * hs;
\t\tfloat hk = 1.0 + uMqHold * ${HOLD_BEND.toFixed(3)} * smoothstep(0.0, 0.9, length(hp));
\t\thp *= vec2(hk, 1.0 + (hk - 1.0) * 0.35);
\t\tgl_Position.xy = hp / hs * gl_Position.w;
\t}
\tvFadeClip = gl_Position;`
        );
    shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying vec4 vFadeClip;\nvoid main() {")
        .replace(
            "#include <dithering_fragment>",
            `#include <dithering_fragment>
\tfloat fadeFromTop = (1.0 - vFadeClip.y / vFadeClip.w) * 0.5;
\tgl_FragColor.a *= smoothstep(${FADE_HIDDEN.toFixed(4)}, ${FADE_VISIBLE.toFixed(4)}, fadeFromTop);`
        );
};
const fadeCacheKey = () => "service-marquee-top-fade";


export default function ServiceMarquee({ scrollRef, freeze = false }) {
    const groupRef = useRef();
    const rowRefs  = useRef([]);          // one moving group per row
    const textRefs = useRef([]);          // letters + glow layers, per row
    const unitW    = useRef([0, 0, 0]);   // width of one copy of each row
    const offset   = useRef([0, 0, 0]);
    const vis      = useRef(0);
    const carets   = useRef([null, null, null]);   // troika caret x positions, per row
    const entry    = useRef([null, null, null]);   // slide-in plan per row, null = not planned
    const entered  = useRef([false, false, false]);
    const mountedAt = useRef(0);
    // On a return visit to Home the chain starts as soon as the headline does
    const introDelayMs = useRef(introDelay(INTRO_DELAY));
    useEffect(() => { mountedAt.current = performance.now(); }, []);

    // Each row starts at a different service so the rows don't line up
    const rows = useMemo(
        () => ROWS_FROM_TOP.map((_, r) => {
            const list = SERVICES.map((_, i) => SERVICES[(i + r * 2) % SERVICES.length]);
            const unit = list.map((s) => s.toUpperCase()).join(SEPARATOR) + SEPARATOR;
            return unit.repeat(REPEATS);
        }),
        []
    );

    // Character ranges [first, last] of every service name in each row, so the
    // slide-in can start on a whole word instead of cutting through letters
    const words = useMemo(
        () => rows.map((text) => {
            const out = [];
            const re = /[^ •]+(?: [^ •]+)*/g;
            let m;
            while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length - 1]);
            return out;
        }),
        [rows]
    );

    // World y of each row at DEPTH, from its place on screen
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAMERA_Z - DEPTH);
    const rowY = ROWS_FROM_TOP.map((f) => (1 - 2 * f) * halfH);

    const color = useMemo(() => new THREE.Color(TINT).multiplyScalar(GLOW), []);

    useFrame((state, rawDelta) => {
        const g = groupRef.current;
        if (!g) return;
        const dt = Math.min(rawDelta, 1 / 20);

        // Landing only: out as soon as scrolling starts. (The intro is the
        // slide-in below, so no fade-in here.)
        const sp = scrollRef ? scrollRef.current : 0;
        const goal = 1 - THREE.MathUtils.smoothstep(sp, 0.02, 0.08);
        vis.current += (goal - vis.current) * (1 - Math.exp(-(goal > vis.current ? 3 : 6) * dt));
        g.visible = vis.current > 0.002;
        if (!g.visible) return;

        // press-and-hold amount (spring-driven, 0 when scrolled away)
        const hold = Math.max(0, holdState.value) * holdState.gate;
        holdUniforms.uMqHold.value = hold;
        holdUniforms.uMqAspect.value = state.size.width / state.size.height;

        // fade via troika's own opacities (with an outline, txt.material is an
        // array, so setting material.opacity would not reach it)
        textRefs.current.forEach((txt, k) => {
            if (!txt) return;
            const layer = k % (GLOW_LAYERS.length + 1);   // 0 = letters, 1.. = glow
            if (layer === 0) txt.fillOpacity = OPACITY * vis.current * (1 - HOLD_DIM * hold);
            else txt.outlineOpacity = GLOW_LAYERS[layer - 1].opacity * vis.current * (1 + HOLD_GLOW * hold);
        });

        // half the visible width at the rows' depth
        const halfW = halfH * (state.size.width / state.size.height) + EDGE_MARGIN;
        const introT = (performance.now() - mountedAt.current - introDelayMs.current) / 1000;
        const nPer = GLOW_LAYERS.length + 1;

        rowRefs.current.forEach((row, r) => {
            const w = unitW.current[r];
            const caret = carets.current[r];
            if (!row || !w || !caret) { if (row) row.visible = false; return; }
            const d = DIRECTIONS[r];
            const base = -w * (REPEATS / 2) + (d < 0 ? w : 0);   // strip position at offset 0
            const rowTexts = textRefs.current.slice(r * nPer, r * nPer + nPer);

            if (!entered.current[r]) {
                // Plan once: where the first word must end up, and how far
                // off-screen it starts
                if (!entry.current[r]) {
                    const endX = base + d * SPEED * ENTRY_SECONDS;   // strip x when the slide ends
                    let cut, shift;
                    if (d < 0) {
                        // enters from the right; hide everything left of `cut`
                        // (local x), which ends just past the left edge
                        const target = -halfW - endX;
                        cut = -Infinity;
                        for (const [a] of words[r]) {
                            const c = caret[a * 4] - CUT_PAD;
                            if (c <= target && c > cut) cut = c;
                        }
                        if (cut === -Infinity) cut = target;
                        shift = halfW - base - cut;                  // first word starts past the right edge
                    } else {
                        // enters from the left; hide everything right of `cut`
                        const target = halfW - endX;
                        cut = Infinity;
                        for (const [, b] of words[r]) {
                            const c = caret[b * 4 + 1] + CUT_PAD;
                            if (c >= target && c < cut) cut = c;
                        }
                        if (cut === Infinity) cut = target;
                        shift = base + cut + halfW;                  // last word starts past the left edge
                    }
                    entry.current[r] = { cut, shift };
                }
                const { cut, shift } = entry.current[r];
                const tau = Math.max(0, introT - ROW_DELAYS[r] / 1000);
                const k = easeOutQuart(Math.min(1, tau / ENTRY_SECONDS));
                // normal drift + a shrinking push from off-screen
                row.position.x = base + d * SPEED * tau + (-d) * shift * (1 - k);
                row.visible = true;
                const rect = d < 0 ? [cut, -1e3, 1e5, 1e3] : [-1e5, -1e3, cut, 1e3];
                rowTexts.forEach((t) => { if (t) t.clipRect = rect; });

                if (tau >= ENTRY_SECONDS) {
                    // the cut edge has just left the screen: switch to the
                    // endless loop (same picture, offset wrapped by whole copies)
                    entered.current[r] = true;
                    offset.current[r] = (d * SPEED * tau) % w;
                    rowTexts.forEach((t) => { if (t) t.clipRect = null; });
                }
                return;
            }

            // move, and wrap by exactly one copy so the loop is seamless
            offset.current[r] = (offset.current[r] + d * SPEED * (1 + HOLD_SPEEDUP * hold) * dt) % w;
            // centre the long strip, then slide it within one copy's width
            row.position.x = base + offset.current[r];
        });
    });

    const common = {
        font: FONT,
        fontSize: FONT_SIZE,
        letterSpacing: SPACING,
        anchorX: "left",
        anchorY: "middle",
        whiteSpace: "nowrap",
    };
    const nPer = GLOW_LAYERS.length + 1;

    return (
        <group ref={groupRef} position={[0, 0, DEPTH]} visible={false}>
            {rows.map((text, r) => (
                <group key={r} ref={(g) => (rowRefs.current[r] = g)} position={[0, rowY[r], 0]}>
                    {/* glow layers first (behind), widest first */}
                    {GLOW_LAYERS.map((L, li) => ({ L, li })).reverse().map(({ L, li }) => (
                        <Text
                            key={`glow-${li}`}
                            ref={(t) => (textRefs.current[r * nPer + li + 1] = t)}
                            {...common}
                            outlineColor={GLOW_COLOR}
                            outlineWidth={0}
                            outlineBlur={L.blur}
                            outlineOpacity={0}
                            fillOpacity={0}
                            renderOrder={-2 - li}
                        >
                            {text}
                            <meshBasicMaterial
                                color={color}
                                transparent
                                depthWrite={false}
                                toneMapped={false}
                                onBeforeCompile={fadeOnBeforeCompile}
                                customProgramCacheKey={fadeCacheKey}
                            />
                        </Text>
                    ))}
                    {/* the letters */}
                    <Text
                        ref={(t) => (textRefs.current[r * nPer] = t)}
                        {...common}
                        fillOpacity={0}
                        onSync={(t) => {
                            const b = t.textRenderInfo?.blockBounds;
                            if (b) unitW.current[r] = (b[2] - b[0]) / REPEATS;
                            carets.current[r] = t.textRenderInfo?.caretPositions ?? null;
                        }}
                    >
                        {text}
                        <meshBasicMaterial
                            color={color}
                            transparent
                            depthWrite={false}
                            toneMapped={false}
                            onBeforeCompile={fadeOnBeforeCompile}
                            customProgramCacheKey={fadeCacheKey}
                        />
                    </Text>
                </group>
            ))}
        </group>
    );
}
