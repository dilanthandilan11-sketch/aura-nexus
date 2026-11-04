"use client"

import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ============================================
// UNIFIED TIMELINE - 12 seconds total
// ============================================
const TIMELINE = {
    BOOT: { start: 0.0, end: 0.45 },
    COMPLETE: { start: 0.45, end: 0.55 },
    PORTAL: { start: 0.5, end: 0.9 },
    FADE: { start: 0.85, end: 1.0 },
};

const TOTAL_DURATION = 12000; // 12 seconds

// ============================================
// EASING FUNCTIONS
// ============================================
const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
    smoothStep: (t) => t * t * (3 - 2 * t),
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    // Smooth start - very gentle at the beginning
    smoothStart: (t) => t * t * t * t, // Quartic ease-in for ultra-smooth start
};

// ============================================
// TIMELINE HELPER
// ============================================
const getProgress = (time, phase) => {
    if (time < phase.start) return 0;
    if (time > phase.end) return 1;
    return (time - phase.start) / (phase.end - phase.start);
};

// ============================================
// PHASE 1 & 2: BOOT SCREEN OVERLAY
// ============================================
function BootScreen({ progress }) {
    const bootProgress = getProgress(progress, TIMELINE.BOOT);
    const fadeOutProgress = getProgress(progress, TIMELINE.FADE);

    // Keep text consistent throughout
    const mainText = "INITIALIZING AURA CORE";
    const subText = "Synchronizing systems...";

    const logoOpacity = ease.outExpo(bootProgress);
    const glow = 0.75 + Math.sin(bootProgress * Math.PI * 4) * 0.1;

    const draw1 = ease.outCubic(bootProgress);
    const draw2 = ease.outCubic(Math.max(0, (bootProgress - 0.18) / 0.82));

    const mainReveal = bootProgress > 0.22 ? (bootProgress - 0.22) / 0.78 : 0;
    const subReveal = bootProgress > 0.55 ? (bootProgress - 0.55) / 0.45 : 0;

    // Keep colors consistent (cyan) throughout
    const strokeMain = "#00d4ff";
    const strokeInner = "rgba(0,212,255,0.65)";

    const dashOuter = 530;
    const dashInner = 360;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                opacity: 1 - fadeOutProgress,
                pointerEvents: "none",
                background: "transparent",
            }}
        >
            <svg
                width="550"
                height="550"
                viewBox="0 0 106.6844 85.728577"
                style={{
                    opacity: logoOpacity,
                    transform: `scale(${1.1 + logoOpacity * 0.05})`,
                    filter: `drop-shadow(0 0 ${26 * glow}px rgba(0, 212, 255, ${0.65 * glow}))
                             drop-shadow(0 0 ${66 * glow}px rgba(124, 58, 237, ${0.22 * glow}))`,
                }}
            >
                <path
                    d="M 51.657799,191.13823 105,105.63571 l 53.3422,85.63168 -31.03018,0.0969 -22.19569,-37.25821 -22.375455,37.0565 -31.083076,-0.0243"
                    transform="translate(-51.657799,-105.63571)"
                    fill="none"
                    stroke={strokeMain}
                    strokeWidth="0.3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                        strokeDasharray: dashOuter,
                        strokeDashoffset: dashOuter * (1 - draw1),
                    }}
                />
                <path
                    d="M 71.324825,181.48174 105,127.39882 l 33.95351,54.10575 -7.16928,-1.73524 -26.65507,-42.2962 -26.635054,42.22771 z"
                    transform="translate(-51.657799,-105.63571)"
                    fill="none"
                    stroke={strokeInner}
                    strokeWidth="0.3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                        strokeDasharray: dashInner,
                        strokeDashoffset: dashInner * (1 - draw2),
                    }}
                />
            </svg>

            <div
                style={{
                    position: "absolute",
                    right: "clamp(16px, 6vw, 60px)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                    fontSize: "clamp(11px, 3.2vw, 24px)",
                    fontWeight: 500,
                    letterSpacing: "clamp(0.08em, 0.9vw, 0.35em)",
                    color: "#00d4ff",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    textShadow: `0 0 14px rgba(0,212,255,${0.35 * bootProgress})`,
                }}
            >
                {mainText.split("").map((char, i) => {
                    const shown = mainReveal > i / mainText.length;
                    return (
                        <span
                            key={i}
                            style={{
                                display: "inline-block",
                                opacity: shown ? 1 : 0,
                                filter: shown ? "blur(0px)" : "blur(6px)",
                                transform: shown ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
                                transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                            }}
                        >
                            {char === " " ? "\u00A0" : char}
                        </span>
                    );
                })}
            </div>

            <div
                style={{
                    position: "absolute",
                    right: "clamp(16px, 6vw, 60px)",
                    top: "calc(50% + 40px)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "clamp(9px, 2.4vw, 14px)",
                    fontWeight: 400,
                    letterSpacing: "clamp(0.08em, 0.6vw, 0.2em)",
                    color: "rgba(0,212,255,0.55)",
                    opacity: subReveal,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                }}
            >
                {subText}
            </div>

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    bottom: "80px",
                    transform: "translateX(-50%)",
                    width: "280px",
                    height: "2px",
                    background: "rgba(0, 212, 255, 0.12)",
                    borderRadius: "1px",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${bootProgress * 100}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #00d4ff, #7c3aed, #00d4ff)",
                        backgroundSize: "200% 100%",
                        boxShadow: "0 0 10px rgba(0,212,255,0.45)",
                        animation: "shimmer 2s linear infinite",
                        transition: "width 0.05s linear",
                    }}
                />
            </div>

            <div style={{ position: "absolute", left: "50%", bottom: "50px", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        style={{
                            width: "4px",
                            height: "4px",
                            borderRadius: "50%",
                            background: "#00d4ff",
                            opacity: bootProgress > 0.3 ? 0.6 : 0,
                            animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                            boxShadow: "0 0 8px rgba(0, 212, 255, 0.5)",
                        }}
                    />
                ))}
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(0.6); opacity: 0.3; }
                    50% { transform: scale(1); opacity: 0.8; }
                }
            `}</style>
        </div>
    );
}

// ============================================
// PHASE 3: DIMENSIONAL PORTAL REVEAL
// ============================================
function DimensionalPortal({ progress, holeVisibility }) {
    const materialRef = useRef();

    const portalProgress = getProgress(progress, TIMELINE.PORTAL);
    const fadeProgress = getProgress(progress, TIMELINE.FADE);

    // Dissolve phase for portal exit
    const dissolvePhase = portalProgress > 0.5 ? (portalProgress - 0.5) / 0.5 : 0;

    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uProgress: { value: 0 },
            uDissolve: { value: 0 },
            uFade: { value: 0 },
            uColorCore: { value: new THREE.Color("#0a1a3a") },
            uColorEdge: { value: new THREE.Color("#00d4ff") },
            uColorHighlight: { value: new THREE.Color("#7c3aed") },
        }),
        []
    );

    useFrame((state) => {
        if (!materialRef.current) return;
        materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        // Portal radius matches the visible hole visibility
        materialRef.current.uniforms.uProgress.value = holeVisibility;
        materialRef.current.uniforms.uDissolve.value = dissolvePhase;
        materialRef.current.uniforms.uFade.value = fadeProgress;
    });

    // Don't render if portal hasn't started or is fully faded
    if (holeVisibility <= 0.001 || fadeProgress >= 0.98) return null;

    return (
        <mesh position={[0, 0, -2]} scale={15}>
            <planeGeometry args={[1, 1, 1, 1]} />
            <shaderMaterial
                ref={materialRef}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                uniforms={uniforms}
                vertexShader={`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    uniform float uTime;
                    uniform float uProgress;
                    uniform float uDissolve;
                    uniform float uFade;
                    uniform vec3 uColorCore;
                    uniform vec3 uColorEdge;
                    uniform vec3 uColorHighlight;
                    varying vec2 vUv;

                    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

                    float snoise(vec3 v) {
                        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                        vec3 i  = floor(v + dot(v, C.yyy));
                        vec3 x0 = v - i + dot(i, C.xxx);
                        vec3 g = step(x0.yzx, x0.xyz);
                        vec3 l = 1.0 - g;
                        vec3 i1 = min(g.xyz, l.zxy);
                        vec3 i2 = max(g.xyz, l.zxy);
                        vec3 x1 = x0 - i1 + C.xxx;
                        vec3 x2 = x0 - i2 + C.yyy;
                        vec3 x3 = x0 - D.yyy;
                        i = mod289(i);
                        vec4 p = permute(permute(permute(
                            i.z + vec4(0.0, i1.z, i2.z, 1.0))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                        float n_ = 0.142857142857;
                        vec3 ns = n_ * D.wyz - D.xzx;
                        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                        vec4 x_ = floor(j * ns.z);
                        vec4 y_ = floor(j - 7.0 * x_);
                        vec4 x = x_ *ns.x + ns.yyyy;
                        vec4 y = y_ *ns.x + ns.yyyy;
                        vec4 h = 1.0 - abs(x) - abs(y);
                        vec4 b0 = vec4(x.xy, y.xy);
                        vec4 b1 = vec4(x.zw, y.zw);
                        vec4 s0 = floor(b0)*2.0 + 1.0;
                        vec4 s1 = floor(b1)*2.0 + 1.0;
                        vec4 sh = -step(h, vec4(0.0));
                        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                        vec3 p0 = vec3(a0.xy, h.x);
                        vec3 p1 = vec3(a0.zw, h.y);
                        vec3 p2 = vec3(a1.xy, h.z);
                        vec3 p3 = vec3(a1.zw, h.w);
                        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                        p0 *= norm.x;
                        p1 *= norm.y;
                        p2 *= norm.z;
                        p3 *= norm.w;
                        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                        m = m * m;
                        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
                    }

                    float fbm(vec3 p) {
                        float value = 0.0;
                        float amplitude = 0.5;
                        float frequency = 1.0;
                        for (int i = 0; i < 5; i++) {
                            value += amplitude * snoise(p * frequency);
                            amplitude *= 0.5;
                            frequency *= 2.0;
                        }
                        return value;
                    }

                    void main() {
                        vec2 center = vUv - 0.5;
                        float dist = length(center);
                        float angle = atan(center.y, center.x);

                        // Portal radius synced with mask
                        float portalRadius = uProgress * 0.95;

                        vec3 noisePos = vec3(
                            center.x * 3.0 + uTime * 0.15,
                            center.y * 3.0 + uTime * 0.1,
                            uTime * 0.2
                        );
                        float noise = fbm(noisePos);

                        float swirl = sin(angle * 3.0 + uTime * 0.5 + noise * 2.0) * 0.1;
                        float warpedDist = dist + swirl * uProgress;

                        float edgeWidth = 0.08 * (1.0 - uProgress * 0.3);
                        float edgeGlow = smoothstep(portalRadius + edgeWidth, portalRadius, warpedDist)
                                       * smoothstep(portalRadius - edgeWidth * 2.0, portalRadius, warpedDist);

                        float innerPortal = smoothstep(portalRadius, portalRadius - edgeWidth, warpedDist);

                        float sparkle = pow(max(0.0, snoise(vec3(center * 10.0, uTime * 2.0))), 20.0) * 3.0;
                        sparkle *= edgeGlow;

                        vec3 coreColor = uColorCore * (0.5 + noise * 0.3);
                        vec3 edgeColor = mix(uColorEdge, uColorHighlight, sin(angle * 2.0 + uTime) * 0.5 + 0.5);

                        vec3 finalColor = coreColor * innerPortal * 0.3;
                        finalColor += edgeColor * edgeGlow * (1.5 + sparkle);
                        finalColor += vec3(1.0) * sparkle * 0.8;

                        float alpha = (edgeGlow * 0.9 + innerPortal * 0.2) * (1.0 - uDissolve * 0.8);
                        alpha *= smoothstep(1.0, 0.3, dist);
                        alpha *= (1.0 - uFade);

                        gl_FragColor = vec4(finalColor, alpha);
                    }
                `}
            />
        </mesh>
    );
}

// ============================================
// MAIN LANDING INTRO COMPONENT
// ============================================
export default function LandingIntro({ children, onComplete }) {
    const [progress, setProgress] = useState(0);
    const [introDone, setIntroDone] = useState(false);

    const rafRef = useRef(null);
    const startRef = useRef(null);
    const doneRef = useRef(false);

    useEffect(() => {
        startRef.current = performance.now();

        const tick = () => {
            const elapsed = performance.now() - startRef.current;
            const p = Math.min(elapsed / TOTAL_DURATION, 1);
            setProgress(p);

            // End immediately when fade completes, no delay
            if (p >= 0.995 && !doneRef.current) {
                doneRef.current = true;
                setIntroDone(true);
                onComplete?.();
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    }, [onComplete]);

    // Calculate portal progress (0 to 1 during portal phase)
    const portalP = getProgress(progress, TIMELINE.PORTAL);

    // FIX: Single continuous curve - no phases, no stops
    // Start slightly before portal phase (0.48) for smooth handoff from boot
    // Use a curve that starts very gently and accelerates
    const holeStartProgress = 0.48;

    let holeVisibility = 0;
    if (progress < holeStartProgress) {
        // No hole during boot phase
        holeVisibility = 0;
    } else {
        // Single smooth curve from 0 to 1
        // Map progress to 0-1 range for the curve
        const t = (progress - holeStartProgress) / (TIMELINE.PORTAL.end - holeStartProgress);
        const clampedT = Math.min(Math.max(t, 0), 1);

        // Use smoothStep for continuous acceleration - no stops, no speed changes
        // This gives: slow start → gradual acceleration → smooth end
        holeVisibility = ease.smoothStep(clampedT);
    }

    // Hole radius grows continuously from 0 to 75vmax
    const holeRadius = holeVisibility * 75;
    const feather = 8 + holeVisibility * 4;

    // Show hole when we start the curve
    const showHole = progress >= holeStartProgress;

    // Calculate overlay opacity for final fade out
    const fadeP = getProgress(progress, TIMELINE.FADE);
    const overlayOpacity = 1 - fadeP;

    return (
        <div style={{ position: "fixed", inset: 0 }}>
            {/* Scene behind - always visible */}
            <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
                {children}
            </div>

            {/* Overlay with mask */}
            {!introDone && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 2,
                        // Fade out the entire overlay during fade phase
                        opacity: overlayOpacity,
                        background: "radial-gradient(ellipse at center, rgba(8,12,24,0.95) 0%, rgba(2,4,10,0.98) 70%)",
                        // Apply mask with smooth continuous expansion
                        ...(showHole ? {
                            WebkitMaskImage: `radial-gradient(circle at 50% 50%,
                                transparent 0,
                                transparent ${holeRadius}vmax,
                                rgba(0,0,0,1) ${holeRadius + feather}vmax,
                                rgba(0,0,0,1) 220vmax)`,
                            maskImage: `radial-gradient(circle at 50% 50%,
                                transparent 0,
                                transparent ${holeRadius}vmax,
                                rgba(0,0,0,1) ${holeRadius + feather}vmax,
                                rgba(0,0,0,1) 220vmax)`,
                            WebkitMaskRepeat: "no-repeat",
                            maskRepeat: "no-repeat",
                            WebkitMaskSize: "100% 100%",
                            maskSize: "100% 100%",
                            WebkitMaskPosition: "center",
                            maskPosition: "center",
                        } : {
                            // No mask = fully opaque overlay during boot
                        }),
                    }}
                >
                    {/* Portal glow effect - only render when hole is visible */}
                    {showHole && (
                        <Canvas
                            camera={{ position: [0, 0, 7], fov: 42 }}
                            gl={{
                                alpha: true,
                                premultipliedAlpha: false,
                                antialias: true,
                                powerPreference: "high-performance",
                            }}
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "transparent",
                                pointerEvents: "none",
                                zIndex: 2,
                            }}
                        >
                            <DimensionalPortal
                                progress={progress}
                                holeVisibility={holeVisibility}
                            />
                        </Canvas>
                    )}

                    {/* Boot UI */}
                    <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
                        <BootScreen progress={progress} />
                    </div>
                </div>
            )}
        </div>
    );
}