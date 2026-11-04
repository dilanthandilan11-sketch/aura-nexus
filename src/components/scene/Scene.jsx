// src/components/scene/Scene.jsx
"use client";

import React, { Suspense, useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Noise } from "@react-three/postprocessing";
import { BloomEffect, ChromaticAberrationEffect, BlendFunction } from "postprocessing";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

import Artifact from "@/components/scene/Artifact";
import StarfieldWithHands from "@/components/scene/StarfieldWithHands";
import AuroraStreaksFlowing from "@/components/scene/AuroraStreaksFlowing";
import SceneText from "@/components/scene/SceneText";
import ServicesOrbit3D from "@/components/scene/ServicesOrbit3D";
import CapabilityParticles from "@/components/scene/capabilities/CapabilityParticles";
import GridFloor from "@/components/scene/GridFloor";
import ServiceMarquee from "@/components/scene/ServiceMarquee";
import { nebulaWarpVertex, nebulaWarpFragment } from "@/components/scene/warp/nebulaWarpShaders";
import { HoldController, holdState } from "@/components/scene/molten/holdState";
import { Fluid } from "@/lib/Fluid";
import { DEFAULT_CONFIG } from "@/lib/constant";
import { useReducedMotion } from "framer-motion";
import {
    RIFT, RIFT_DEPTH, CAMERA_START_Z, createRiftState, createRiftTimeline,
} from "@/components/scene/rift/riftTimeline";
import {
    RiftCamera, VoidSphere, RiftFissure, VoidDebris,
} from "@/components/scene/rift/QuantumRift";

// ── Nebula Background ──────────────────────────────────────────────────────
// Press-and-hold warps this environment (see warp/nebulaWarpShaders.js):
// pulled outward from the logo, stretched into streaks, pushed away from
// the cursor. At rest it renders exactly like the plain textured sphere.
const _bufSize = new THREE.Vector2();
const _mouseUv = new THREE.Vector2();

function NebulaBackground() {
    // Prefers the HDR. If /hdri/Nebula_N0.hdr is missing (it's ~69 MB and
    // easy to leave out of a copy) it falls back to the PNG instead of
    // crashing the whole Canvas with a 404.
    const [texture, setTexture] = useState(null);

    useEffect(() => {
        let cancelled = false;
        let loaded = null;
        const use = (t, isHdr) => {
            if (cancelled) { t.dispose(); return; }
            t.mapping = THREE.EquirectangularReflectionMapping;
            if (!isHdr) t.colorSpace = THREE.SRGBColorSpace;
            loaded = t;
            setTexture(t);
        };
        new RGBELoader().load(
            "/hdri/Nebula_N0.hdr",
            (t) => use(t, true),
            undefined,
            () => {
                console.warn("Nebula_N0.hdr not found in public/hdri; using Nebula_N0.PNG instead.");
                new THREE.TextureLoader().load("/hdri/Nebula_N0.PNG", (t) => use(t, false));
            }
        );
        return () => { cancelled = true; loaded?.dispose(); };
    }, []);

    const meshRef = useRef();
    const uniforms = useMemo(() => ({
        uMap:        { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uInvProj:    { value: new THREE.Matrix4() },
        uCamWorld:   { value: new THREE.Matrix4() },
        uInvModel:   { value: new THREE.Matrix4() },
        uTime:       { value: 0 },
        uHold:       { value: 0 },
        uPress:      { value: 0 },
        uFlow:       { value: 0 },
        uMouse:      { value: new THREE.Vector2(0.5, 0.5) },
    }), []);

    useFrame((state) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const { pointer, clock } = state;
        uniforms.uMap.value = texture;
        uniforms.uTime.value  = clock.elapsedTime;
        uniforms.uHold.value  = Math.max(0, holdState.value) * holdState.gate;
        uniforms.uPress.value = holdState.press * holdState.gate;
        uniforms.uFlow.value  = holdState.flow;
        uniforms.uMouse.value.lerp(_mouseUv.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5), 0.35);
    });

    // Resolution and camera are set per draw, not per frame: the scene is
    // drawn more than once a frame (the post-processing buffer, and the glass
    // logo's own refraction buffer at a different size). Using the size of the
    // target actually being drawn keeps the nebula correct seen through the glass.
    const onBeforeRender = (renderer, _scene, camera, _geometry, material) => {
        const rt = renderer.getRenderTarget();
        if (rt) uniforms.uResolution.value.set(rt.width, rt.height);
        else uniforms.uResolution.value.copy(renderer.getDrawingBufferSize(_bufSize));
        // Invert the projection here instead of reading projectionMatrixInverse:
        // the floor's reflection camera rewrites its projection without
        // updating the inverse, which made the nebula vanish from the reflection.
        uniforms.uInvProj.value.copy(camera.projectionMatrix).invert();
        uniforms.uCamWorld.value.copy(camera.matrixWorld);
        if (meshRef.current) uniforms.uInvModel.value.copy(meshRef.current.matrixWorld).invert();
        material.uniformsNeedUpdate = true;   // force upload for this draw
    };

    if (!texture) return null;
    return (
        <mesh ref={meshRef} onBeforeRender={onBeforeRender}>
            <sphereGeometry args={[500, 32, 32]} />
            <shaderMaterial
                vertexShader={nebulaWarpVertex}
                fragmentShader={nebulaWarpFragment}
                uniforms={uniforms}
                side={THREE.BackSide}
                toneMapped={false}
                depthWrite={false}
            />
        </mesh>
    );
}

// ── Void HDRI (multi-nebulae) ─────────────────────────────────────────────
// Loaded imperatively after the landing
// intro so it never blocks or blanks the landing. Hands the texture to the
// VoidSphere through a ref (no React state, no re-render).
// 6144x3072 copy of HDR_multi_nebulae_1.hdr (the 10000x5000 original needs
// ~400 MB of GPU memory and corrupted rendering when it ran out)
const VOID_HDRI = "/hdri/HDR_multi_nebulae_1_6k.hdr";

// Optional: if the file is missing the void keeps its procedural look
// instead of throwing (useLoader would crash the whole Canvas on a 404).
function VoidHdri({ targetRef }) {
    useEffect(() => {
        let cancelled = false;
        let loaded = null;
        new RGBELoader().load(
            VOID_HDRI,
            (texture) => {
                if (cancelled) { texture.dispose(); return; }
                loaded = texture;
                targetRef.current = texture;
            },
            undefined,
            () => console.warn(`Void HDRI not found at ${VOID_HDRI}; using procedural void.`)
        );
        return () => {
            cancelled = true;
            if (loaded && targetRef.current === loaded) targetRef.current = null;
            loaded?.dispose();
        };
    }, [targetRef]);
    return null;
}

// ── Dynamic Post-Processing ────────────────────────────────────────────────
function DynamicEffects({ scrollProgress }) {
    const sp = scrollProgress;

    // SCROLL PHASE 0 (0.00-0.10): bloom 0.15 — dormant
    // SCROLL PHASE 1 (0.10-0.25): bloom 0.15→0.35 — activating
    // SCROLL PHASE 2 (0.25-0.45): bloom 0.35→0.50 — deconstruction flash
    // SCROLL PHASE 3 (0.45-0.65): bloom 0.15      — clean stream lines
    // SCROLL PHASE 4 (0.65-0.82): bloom 0.20      — card glow
    // SCROLL PHASE 5 (0.82-1.00): bloom 0.20→0.15 — return to idle
    let bloomIntensity;
    if (sp < 0.10) {
        bloomIntensity = 0.15;
    } else if (sp < 0.25) {
        bloomIntensity = THREE.MathUtils.lerp(0.15, 0.35, (sp - 0.10) / 0.15);
    } else if (sp < 0.45) {
        bloomIntensity = THREE.MathUtils.lerp(0.35, 0.50, (sp - 0.25) / 0.20);
    } else if (sp < 0.65) {
        bloomIntensity = 0.15;
    } else if (sp < 0.82) {
        bloomIntensity = 0.20;
    } else {
        bloomIntensity = THREE.MathUtils.lerp(0.20, 0.15, (sp - 0.82) / 0.18);
    }

    // No colour split at rest on the landing: it put orange/blue fringes on the
    // glowing white service text. (Press-and-hold still adds its own below.)
    const caBase = sp < 0.10 ? 0 : 0.0005;
    const caPeak = sp > 0.10 && sp < 0.55 ? 0.001 : caBase;

    // ENVIRONMENT WARP: press-and-hold energises the frame — stronger bloom and a
    // touch of chromatic aberration on top of the scroll-phase values.
    // The effects are created here and mounted as <primitive>s so they can be
    // animated every frame. (Passing a `ref` to the <Bloom>/<ChromaticAberration>
    // wrappers breaks under React 19: refs are props there, and the wrapper
    // JSON.stringifies its props -> "Converting circular structure to JSON".)
    const bloom = useMemo(() => new BloomEffect({
        blendFunction: BlendFunction.ADD,   // same as the <Bloom> wrapper's default
        luminanceThreshold: 0.85,
        intensity: 0.15,
    }), []);
    const ca = useMemo(() => new ChromaticAberrationEffect({
        offset: new THREE.Vector2(caBase, caBase),
    }), []);
    useEffect(() => () => { bloom.dispose(); ca.dispose(); }, [bloom, ca]);

    const base = useRef({ bloom: bloomIntensity, ca: caPeak });
    base.current.bloom = bloomIntensity;
    base.current.ca    = caPeak;

    useFrame(() => {
        const h = Math.max(0, holdState.value) * holdState.gate;
        bloom.intensity = base.current.bloom + h * 0.35 + holdState.press * holdState.gate * 0.1;
        ca.offset.set(base.current.ca + h * 0.0022, base.current.ca + h * 0.0012);
    });

    return (
        <EffectComposer>
            {/* Mouse trail: soft white smoke everywhere (was rainbow on the
                landing and electric blue in the rift). FLUID_RADIUS sets how
                thick the trail is (default config 0.2). */}
            <Fluid
                {...DEFAULT_CONFIG}
                showBackground={true}
                rainbow={false}
                fluidColor={FLUID_COLOR}
                radius={FLUID_RADIUS}
            />
            <primitive object={bloom} dispose={null} />
            <primitive object={ca} dispose={null} />
            <Noise opacity={0.025} />
        </EffectComposer>
    );
}

// ── Mouse fluid trail ──────────────────────────────────────────────────────
const FLUID_COLOR  = "#ffffff";   // white smoke
const FLUID_RADIUS = 0.035;       // trail thickness (default 0.2); width grows with its square root

// ── Particle logo (second page) ───────────────────────────────────────────
// Seconds to form once the hand-off gate opens / to scatter when it closes
const PARTICLE_FORM_SECONDS    = 2.0;
const PARTICLE_SCATTER_SECONDS = 1.2;

// ── Scene Content ──────────────────────────────────────────────────────────
function SceneContent({ rotation, freeze, scrollProgress, services, floorReflections = true }) {
    const groupRef      = useRef();   // mouse / hand rotation, pivots on the logo
    const pivotRef      = useRef();   // cancels the pivot offset for children
    const auroraRef     = useRef();
    const ambientRef    = useRef();
    const keyLightRef   = useRef();
    const fillLightRef  = useRef();
    const starFade      = useRef(1);  // landing dust opacity multiplier
    const voidMapRef    = useRef(null); // multi-nebulae HDRI once loaded
    const [loadVoidHdri, setLoadVoidHdri] = useState(false);
    const logoCenterRef = useRef(null);
    const particleProgress = useRef(0); // 0 scattered .. 1 formed (particle "A" assembly)
    const scrollRef = useRef(0);        // latest scrollProgress for per-frame readers
    const reduceMotion  = useReducedMotion();

    // ── QUANTUM RIFT (SCROLL PHASES 1-2, sp 0.10-0.45) ─────────────────────
    // Mutable state tweened by a paused GSAP timeline, scrubbed by scroll.
    const rift     = useMemo(() => createRiftState(), []);
    const timeline = useMemo(() => createRiftTimeline(rift), [rift]);
    useEffect(() => () => timeline.kill(), [timeline]);

    // Start downloading the void HDRI shortly after the landing is live
    useEffect(() => {
        if (freeze) return;
        const t = setTimeout(() => setLoadVoidHdri(true), 1500);
        return () => clearTimeout(t);
    }, [freeze]);

    const riftP = THREE.MathUtils.clamp(
        (scrollProgress - RIFT.start) / (RIFT.end - RIFT.start), 0, 1
    );
    useEffect(() => {
        timeline.progress(riftP);
    }, [timeline, riftP]);
    useEffect(() => {
        scrollRef.current = scrollProgress;
    }, [scrollProgress]);

    useFrame((_, delta) => {
        // Particle logo: move toward the hand-off gate in real time (forms in
        // ~2s once the glass logo has vanished, scatters in ~1.2s on the way
        // back). Written to a ref: no React re-render.
        const goal = rift.form;
        const step = delta / (goal > particleProgress.current ? PARTICLE_FORM_SECONDS : PARTICLE_SCATTER_SECONDS);
        particleProgress.current = goal > particleProgress.current
            ? Math.min(goal, particleProgress.current + step)
            : Math.max(goal, particleProgress.current - step);

        if (!groupRef.current) return;

        // Rotate around the logo's current depth (not the world origin) so
        // objects deep in the void don't swing wildly with the mouse.
        // At the landing logoZ = 0: identical to the original setup.
        groupRef.current.position.z = rift.logoZ;
        if (pivotRef.current) pivotRef.current.position.z = -rift.logoZ;

        // Aurora keeps its original distance from the camera during the chase
        if (auroraRef.current) auroraRef.current.position.z = rift.camZ - (CAMERA_START_Z + 20);

        // Landing dust fades out within the first unit of camera travel, so
        // the camera never flies through it (no ballooning points)
        starFade.current = THREE.MathUtils.clamp((rift.camZ - (CAMERA_START_Z - 0.8)) / 0.8, 0, 1);

        // Scene lights dial down to empty-void mode
        const light = 1 - rift.dark;
        if (ambientRef.current)   ambientRef.current.intensity   = 0.3 * light;
        if (keyLightRef.current)  keyLightRef.current.intensity  = 1.0 * light;
        if (fillLightRef.current) fillLightRef.current.intensity = 0.8 * light;

        if (freeze) return;
        groupRef.current.rotation.x = rotation.x;
        groupRef.current.rotation.y = rotation.y;
        groupRef.current.rotation.z = rotation.z;
    });

    // ── Aurora opacity/intensity per scroll phase ──────────────────────────
    // Passed as props (AuroraStreaksFlowing.jsx also applies the press-and-hold warp itself).
    // SCROLL PHASE 0 (0.00-0.10): defaults (0.30 / 0.80)
    // SCROLL PHASE 1 (0.10-0.25): opacity 0.30→0.60, intensity 0.80→1.00
    // SCROLL PHASE 2 (0.25-0.45): opacity 0.60→0.80, intensity 1.00→1.20
    // SCROLL PHASE 3 (0.45-0.65): peak held (0.80 / 1.20)
    // SCROLL PHASE 4 (0.65-0.82): fade well below defaults so the palette
    //                             reads dark + cyan behind the services orbit
    // SCROLL PHASE 5 (0.82-1.00): hold at defaults
    const sp = scrollProgress;
    let a1o, a1i, a2o, a2i; // aurora1/2 opacity/intensity

    if (sp < 0.10) {
        a1o = 0.30; a1i = 0.80; a2o = 0.25; a2i = 0.70;
    } else if (sp < 0.25) {
        const t = (sp - 0.10) / 0.15;
        a1o = THREE.MathUtils.lerp(0.30, 0.60, t);
        a1i = THREE.MathUtils.lerp(0.80, 1.00, t);
        a2o = THREE.MathUtils.lerp(0.25, 0.50, t);
        a2i = THREE.MathUtils.lerp(0.70, 0.90, t);
    } else if (sp < 0.45) {
        const t = (sp - 0.25) / 0.20;
        a1o = THREE.MathUtils.lerp(0.60, 0.80, t);
        a1i = THREE.MathUtils.lerp(1.00, 1.20, t);
        a2o = THREE.MathUtils.lerp(0.50, 0.70, t);
        a2i = THREE.MathUtils.lerp(0.90, 1.10, t);
    } else if (sp < 0.65) {
        a1o = 0.80; a1i = 1.20; a2o = 0.70; a2i = 1.10;
    } else if (sp < 0.82) {
        const t = (sp - 0.65) / 0.17;
        a1o = THREE.MathUtils.lerp(0.80, 0.14, t);
        a1i = THREE.MathUtils.lerp(1.20, 0.70, t);
        a2o = THREE.MathUtils.lerp(0.70, 0.07, t);
        a2i = THREE.MathUtils.lerp(1.10, 0.50, t);
    } else {
        // Scroll caps at 0.82, so this only guards the end of phase 4
        a1o = 0.14; a1i = 0.70; a2o = 0.07; a2i = 0.50;
    }

    // QUANTUM RIFT: the aurora is part of the hero; inside the tear the void
    // is drawn over it (see VoidSphere draw order), so it needs no fade here.

    return (
        <>
            <RiftCamera rift={rift} />

            {/* Press-and-hold drives the environment warp (landing only) */}
            <HoldController
                enabled={!freeze && scrollProgress < 0.05}
            />

            {/* Camera-relative rift layers: outside the mouse-rotation group */}
            <VoidSphere rift={rift} mapRef={voidMapRef} />
            {loadVoidHdri && <VoidHdri targetRef={voidMapRef} />}
            <RiftFissure rift={rift} />
            <VoidDebris rift={rift} reduceMotion={reduceMotion} />

            {/* Void ending + Capabilities: the Aura "A" re-forms as particles
                once the glass logo has vanished, then moves into the right
                column and morphs per Capabilities step.
                Kept outside the mouse-rotation group: it copies that group's
                rotation but turns around its own centre, so a shape sitting in
                the right column tilts in place instead of swinging around the
                middle of the screen. */}
            {/* Landing floor: holographic perspective grid, horizon at ~77% of
                the viewport on every screen size. Drawn in screen space but it
                follows the mouse-rotation group, so it turns in 3D with the scene. */}
            <GridFloor scrollRef={scrollRef} rotationRef={groupRef} />

            <CapabilityParticles
                scrollRef={scrollRef}
                formRef={particleProgress}
                reducedMotion={!!reduceMotion}
                rotationRef={groupRef}
            />

            <group ref={groupRef}>
            <group ref={pivotRef}>
                <NebulaBackground />

                <group ref={auroraRef} position={[0, 0, -20]}>
                    <AuroraStreaksFlowing
                        count={1}
                        opacity={a1o}
                        intensity={a1i}
                        speed={0.25}
                        colorScheme={0}
                        offset={0}
                    />
                    <AuroraStreaksFlowing
                        count={1}
                        opacity={a2o}
                        intensity={a2i}
                        speed={0.2}
                        colorScheme={1}
                        offset={1.5}
                    />
                </group>

                {/* Services as three running rows of 3D text behind the logo */}
                <ServiceMarquee scrollRef={scrollRef} freeze={freeze} />

                <StarfieldWithHands
                    targetRef={logoCenterRef}
                    count={4000}
                    fadeRef={starFade}
                />


                <Artifact
                    ref={logoCenterRef}
                    mood={null}
                    freeze={freeze}
                    scrollProgress={scrollProgress}
                    activeService={services?.active ?? 0}
                    rift={rift}
                />


                {/* SCROLL PHASE 4: services orbit around the core, deep in the void */}
                {/* renderOrder 2: drawn after the void, so it stays visible in it */}
                {services && (
                    <group position-z={-RIFT_DEPTH} renderOrder={2}>
                        <ServicesOrbit3D scrollProgress={scrollProgress} {...services} />
                    </group>
                )}

                <ambientLight ref={ambientRef} intensity={0.3} />
                <pointLight ref={keyLightRef} position={[10, 10, 10]} intensity={1.0} color="#00cfff" />
                <pointLight ref={fillLightRef} position={[-10, -10, -5]} intensity={0.8} color="#4B0082" />
            </group>
            </group>
        </>
    );
}

// Share of the normal mouse tilt allowed on the landing (1 = unchanged)
const LANDING_TILT = 0.45;

// ── Main Scene ─────────────────────────────────────────────────────────────
export default function Scene({ freeze = false, scrollProgress = 0, services = null }) {
    const [rotation, setRotation]             = useState({ x: 0, y: 0, z: 0 });
    const [unfreezeProgress, setUnfreezeProgress] = useState(freeze ? 0 : 1);
    const [isMobile, setIsMobile] = useState(false);
    // Low-end devices skip the floor reflection (an extra scene render per frame)
    const [isLowEnd] = useState(() =>
        typeof navigator !== "undefined" &&
        ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4)
    );

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    useEffect(() => {
        if (freeze) { setUnfreezeProgress(0); return; }

        const startTime = performance.now();
        const duration  = 2000;

        const animate = () => {
            const elapsed  = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            setUnfreezeProgress(1 - Math.pow(1 - progress, 3));
            if (progress < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }, [freeze]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (freeze) return;

            const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            const mouseY = (e.clientY / window.innerHeight) * 2 - 1;

            const lerpFactor = 0.05 * unfreezeProgress;
            // Landing gets about half the tilt (LANDING_TILT); it eases back to
            // the full amount over the first part of the scroll.
            const landingDamp = THREE.MathUtils.lerp(LANDING_TILT, 1, THREE.MathUtils.clamp(scrollProgress / 0.10, 0, 1));
            const rotScale   = THREE.MathUtils.lerp(0.15, 0.05, scrollProgress) * landingDamp;

            setRotation((prev) => ({
                x: THREE.MathUtils.lerp(prev.x, -mouseY * Math.PI * rotScale, lerpFactor),
                y: THREE.MathUtils.lerp(prev.y,  mouseX * Math.PI * (rotScale * 1.5), lerpFactor),
                z: prev.z,
            }));
        };

        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (key === "r") setRotation({ x: 0, y: 0, z: 0 });
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [freeze, unfreezeProgress, scrollProgress]);

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                backgroundColor: "#020204",
                overflow: "hidden",
                position: "relative",
            }}
        >
            <Canvas
                camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 1000 }}
                gl={{ antialias: false, powerPreference: "high-performance" }}
                dpr={[1, 2]}
                style={{ position: "absolute", inset: 0, zIndex: 1 }}
            >
                <Suspense fallback={null}>
                    <SceneContent
                        rotation={rotation}
                        freeze={freeze}
                        scrollProgress={scrollProgress}
                        services={services}
                        floorReflections={!isMobile && !isLowEnd}
                    />
                    <DynamicEffects scrollProgress={scrollProgress} />
                </Suspense>
            </Canvas>

            <SceneText scrollProgress={scrollProgress} />

            {!isMobile && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "30px",
                        right: "20px",
                        color: "rgba(255,255,255,0.3)",
                        fontSize: "11px",
                        fontFamily: "'Sora', monospace",
                        pointerEvents: "none",
                        zIndex: 200,
                        textAlign: "right",
                        lineHeight: 1.6,
                        opacity: Math.max(0, 1 - scrollProgress * 3),
                        transition: "opacity 0.3s ease",
                    }}
                >
                    <div>[R] Reset View</div>
                </div>
            )}

            {isMobile && (
                <div
                    style={{
                        position: "fixed",
                        top: "68px", // below SiteNav's Menu toggle
                        right: "16px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "8px",
                        zIndex: 200,
                        opacity: Math.max(0, 1 - scrollProgress * 3),
                        transition: "opacity 0.3s ease",
                    }}
                >
                    <button
                        onClick={() => setRotation({ x: 0, y: 0, z: 0 })}
                        style={{
                            padding: "8px 14px",
                            borderRadius: "20px",
                            border: "1px solid rgba(255,255,255,0.25)",
                            background: "rgba(0,0,0,0.45)",
                            color: "rgba(255,255,255,0.75)",
                            fontSize: "11px",
                            fontFamily: "'Sora', sans-serif",
                            letterSpacing: "0.03em",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                        }}
                    >
                        Reset View
                    </button>
                </div>
            )}
        </div>
    );
}
