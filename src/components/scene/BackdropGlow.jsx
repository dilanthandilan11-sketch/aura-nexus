// scene/BackdropGlow.jsx
// Something bright behind the glass "A" so its refraction shows:
//  - a faint glowing grid right behind the logo, fading out towards the edges
//  - one service name at a time, large, soft white glow, cross-fading through
//    the list on the same 4-second beat as the heading word
// Landing only: fades in after the intro, fades out as soon as you scroll.
"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

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
const DEPTH         = -1.6;  // world z of the backdrop (logo sits at 0)
const GRID_STRENGTH = 0.22;  // grid line brightness
const GRID_SPACING  = 0.45;  // world units between grid lines
const WORD_OPACITY  = 0.3;   // word brightness at full fade-in
const WORD_GLOW     = 1.25;  // >1 lets the Bloom pick it up (softly)
const WORD_WIDTH    = 6.5;   // max world width of a word (wider than the logo)
const CYCLE_SECONDS = 4;     // same beat as the heading word
const FADE_SECONDS  = 0.9;   // cross-fade between words
const FONT          = "/fonts/orbitron-medium-webfont.woff";
const SHOW_WORDS    = false; // service words behind the logo (off: listed on the right instead)

const gridVertex = /* glsl */ `
    varying vec2 vPos;
    void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const gridFragment = /* glsl */ `
    uniform float uStrength;
    uniform float uSpacing;
    uniform float uTime;
    uniform vec3  uColor;
    varying vec2 vPos;
    void main() {
        vec2 g = vPos / uSpacing;
        vec2 w = fwidth(g);
        vec2 l = abs(fract(g - 0.5) - 0.5) / w;      // distance to nearest line, in pixels
        float line = 1.0 - min(min(l.x, l.y), 1.0);   // 1px anti-aliased lines
        // brighter crosses where lines meet
        float cross = (1.0 - min(l.x, 1.0)) * (1.0 - min(l.y, 1.0));
        // soft oval falloff around the logo
        vec2 e = vPos / vec2(4.2, 2.6);
        float fade = 1.0 - smoothstep(0.25, 1.0, length(e));
        // slow shimmer travelling outward
        float pulse = 0.75 + 0.25 * sin(length(vPos) * 1.4 - uTime * 0.8);
        float a = (line * 0.8 + cross * 1.2) * fade * pulse * uStrength;
        gl_FragColor = vec4(uColor * a, 1.0);
    }
`;

export default function BackdropGlow({ scrollRef, freeze = false }) {
    const groupRef = useRef();
    const textRefs = useRef([]);
    const vis = useRef(0);

    const gridUniforms = useMemo(() => ({
        uStrength: { value: 0 },
        uSpacing:  { value: GRID_SPACING },
        uTime:     { value: 0 },
        uColor:    { value: new THREE.Color("#bff3ff") },
    }), []);

    // Long names get a smaller font so every word fits WORD_WIDTH
    const sizes = useMemo(
        () => SERVICES.map((s) => Math.min(0.6, WORD_WIDTH / (s.length * 0.95))),   // Orbitron is wide
        []
    );

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;

        // Landing only: in after the intro, out as soon as scrolling starts
        const sp = scrollRef ? scrollRef.current : 0;
        const goal = freeze ? 0 : 1 - THREE.MathUtils.smoothstep(sp, 0.02, 0.08);
        vis.current += (goal - vis.current) * (1 - Math.exp(-(goal > vis.current ? 1.2 : 6) * delta));
        const v = vis.current;
        groupRef.current.visible = v > 0.002;
        if (!groupRef.current.visible) return;

        gridUniforms.uStrength.value = GRID_STRENGTH * v;
        gridUniforms.uTime.value = t;

        // Which word is showing, and the cross-fade between neighbours
        const phase = t / CYCLE_SECONDS;
        const idx = Math.floor(phase) % SERVICES.length;
        const into = (phase % 1) * CYCLE_SECONDS;              // seconds into this word
        const fadeIn  = THREE.MathUtils.smoothstep(into, 0, FADE_SECONDS);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(into, CYCLE_SECONDS - FADE_SECONDS, CYCLE_SECONDS);

        textRefs.current.forEach((txt, i) => {
            if (!txt) return;
            const a = i === idx ? fadeIn * fadeOut : 0;
            txt.visible = a > 0.001;
            if (txt.material) txt.material.opacity = a * WORD_OPACITY * v;
            // drift up a touch while it shows
            txt.position.y = -0.05 + 0.1 * (into / CYCLE_SECONDS) * (i === idx ? 1 : 0);
        });
    });

    return (
        <group ref={groupRef} position={[0, 0, DEPTH]} visible={false}>
            <mesh renderOrder={-1}>
                <planeGeometry args={[12, 7]} />
                <shaderMaterial
                    vertexShader={gridVertex}
                    fragmentShader={gridFragment}
                    uniforms={gridUniforms}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                />
            </mesh>

            {/* Service words were here; the services are now listed in the
                right-hand column of the hero (SceneText.jsx) so nothing
                overlaps the heading. Set SHOW_WORDS to true to bring them back. */}
            {SHOW_WORDS && SERVICES.map((s, i) => (

                <Text
                    key={s}
                    ref={(r) => (textRefs.current[i] = r)}
                    font={FONT}
                    fontSize={sizes[i]}
                    letterSpacing={0.12}
                    anchorX="center"
                    anchorY="middle"
                    visible={false}
                >
                    {s.toUpperCase()}
                    <meshBasicMaterial
                        color={new THREE.Color(WORD_GLOW, WORD_GLOW, WORD_GLOW)}
                        transparent
                        opacity={0}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </Text>
            ))}
        </group>
    );
}
