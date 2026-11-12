// src/components/landing/LandingScene.jsx  (aqua edition)
// The landing page's 3D stage: a glass Aura "A" wrapped in a stream of liquid
// glass, floating over dark still water between rocks, under teal light.
//
// - The A (public/models/aura-logo.glb). Below the waterline the page is a
//   dive (DiveLight): caustic sunlight near the surface fading into glowing
//   plankton deeper down, lit by the cursor and the A.
// - Water: glossy black with slow moving ripples; the A and the stream show
//   in it as a glowing, rippled reflection that fades with depth.
// - Rocks: four Poly Haven scans, darkened, with a teal rim light.
// - Light: a teal glow behind the A, light shafts from the top left, a glow
//   on the water where the stream lands, drifting bubbles, bloom.
// - The page's scroll moves the A between poses (landingStore POSES); the
//   water and rocks belong to the hero and scroll away with it. Every full
//   screen of scrolling the glass takes the next colour.
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import {
    Environment, Lightformer, MeshTransmissionMaterial, PerformanceMonitor, useGLTF,
} from "@react-three/drei";
import { EffectComposer, Bloom, Noise, Vignette } from "@react-three/postprocessing";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import LiquidFooter from "@/components/world/LiquidFooter";
import { Fluid } from "@/lib/Fluid";
import { DEFAULT_CONFIG as FLUID_DEFAULTS } from "@/lib/constant";
import { landing, POSES, NARROW } from "@/components/landing/landingStore";
import DiveLight from "@/components/landing/DiveLight";   // (LightFlow.jsx kept: the earlier strand flow)
import { LIQUID_VERTEX, LIQUID_FRAGMENT } from "@/components/scene/liquidGlassShaders";

const BG = "#020608";
const FOV = 28;
const CAMERA_Z = 11;
const MARK_WIDTH = 3;              // world units across the A at size 1
const WATER_LEVEL = -1.42;         // the water line, in the A's own units (below the strands' lowest pass)

// The glass colour for each full screen of scrolling (one screen = one step)
const EDGE_COLOR = new THREE.Color("#6fdcff").multiplyScalar(2.2);   // HDR: catches the bloom
const SCROLL_TINTS = ["#5ff3ff", "#6aa8ff", "#a68cff", "#ff8fd8", "#ffc27a", "#7dffb0"].map((c) => new THREE.Color(c));

// ?debug=nowater,nobackdrop,nohaze,noglow hides parts (for tuning)
const DEBUG = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("debug") ?? "" : "";

// ── Helpers ───────────────────────────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const KEYS = ["x", "y", "z", "rx", "ry", "s", "glow"];

// The pose the page's scroll asks for: blend between the two sections whose
// centres the middle of the screen is between
function scrollPose(narrow, out) {
    const anchors = landing.anchors;
    const mid = window.scrollY + window.innerHeight / 2;
    const poseOf = (name) => {
        const p = POSES[name] ?? POSES.hero;
        if (!narrow) return p;
        return { ...p, ...(name === "hero" ? NARROW.hero : NARROW.other) };
    };
    if (!anchors.length) return Object.assign(out, poseOf("hero"));
    let i = 0;
    while (i < anchors.length - 1 && mid > anchors[i + 1].center) i++;
    const a = poseOf(anchors[i].name);
    const next = anchors[i + 1];
    if (!next || mid <= anchors[i].center) return Object.assign(out, a);
    const b = poseOf(next.name);
    const t = smooth(Math.min(Math.max((mid - anchors[i].center) / (next.center - anchors[i].center), 0), 1));
    for (const k of KEYS) out[k] = lerp(a[k], b[k], t);
    return out;
}

// Screen size in world units at depth z
function halfSize(size, z = 0) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAMERA_Z - z);
    return { halfH, halfW: halfH * (size.width / size.height) };
}
// How big the A is drawn on this screen (smaller on narrow screens)
const fitFor = (halfW) => Math.min(1.25, Math.max(0.6, (halfW * 2) / 9.5));

// How visible the water surface is: it fades out as the page scrolls the
// surface up toward the camera's eye level (from there on you only see the
// underwater layer), instead of vanishing all at once.
// The ocean (water plane out to the horizon) scrolls with the page like a
// picture: it stays put in the scene and is shifted up on screen instead
// (WATER_SHIFT, in its vertex shader). Moving the plane itself up made its
// horizon stay at eye level while everything else scrolled, and once it rose
// past the camera it vanished in one frame.
// On top of that it fades out gently as the hero scrolls away, and the fade
// eases over time (SURFACE_EASE seconds) so a quick flick still shows it fading.
const EYE_Y = 0.25;                 // the camera's height (see <Canvas camera>)
const SURFACE_FADE_FROM = 0.7;      // screens scrolled (late: while the rocks are on screen they need the sea under them)
const SURFACE_FADE_TO = 1.05;
const SURFACE_EASE = 0.9;           // seconds
const surface = { f: 1, at: -1 };
function surfaceTarget() {
    const screens = window.scrollY / Math.max(window.innerHeight, 1);
    return 1 - smooth(Math.min(Math.max((screens - SURFACE_FADE_FROM) / (SURFACE_FADE_TO - SURFACE_FADE_FROM), 0), 1));
}
// call once per frame (HeroSet and the A both do; the first call wins)
function stepSurface(t, dt) {
    if (surface.at === t) return surface.f;
    const want = surfaceTarget();
    surface.f = surface.at < 0 ? want : surface.f + (want - surface.f) * (1 - Math.exp(-dt / (SURFACE_EASE / 3)));
    surface.at = t;
    return surface.f;
}
// shifts a plane up the screen by uShift (clip space: 2 = one screen)
const WATER_SHIFT = "gl_Position.y += uShift * gl_Position.w;";

// Where the hero "set" (water + rocks) sits: the water line under the A in
// its hero pose, scrolled up with the page
function heroSet(size, narrow) {
    const hero = narrow ? { ...POSES.hero, ...NARROW.hero } : POSES.hero;
    const { halfH, halfW } = halfSize(size);
    const unit = (MARK_WIDTH / 1.833) * fitFor(halfW) * hero.s;        // liquid units -> world
    const waterY = hero.y * halfH + WATER_LEVEL * unit;
    const scrolled = (window.scrollY / Math.max(window.innerHeight, 1)) * halfH * 2;
    return { waterY: waterY + scrolled, halfW, halfH, unit, heroX: hero.x * halfW };
}

// ── Models ────────────────────────────────────────────────────────────────
// Every mesh in a glb, baked into the file's own space, merged into one
// geometry (one draw, and one transmission pass instead of one per piece)
function bakeAndMerge(scene, { wave = false } = {}) {
    const parts = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
        if (!o.isMesh) return;
        let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (!g.index) g = g.toNonIndexed();
        const n = g.attributes.position.count;
        const keep = new THREE.BufferGeometry();
        keep.setIndex(g.index);
        keep.setAttribute("position", g.attributes.position);
        if (!g.attributes.normal) g.computeVertexNormals();
        keep.setAttribute("normal", g.attributes.normal);
        keep.setAttribute("uv", g.attributes.uv ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        if (wave) {
            // the long streams ripple; droplets and bubbles don't (they have no UVs)
            const w = new Float32Array(n).fill(g.attributes.uv ? 1 : 0);
            keep.setAttribute("aWave", new THREE.BufferAttribute(w, 1));
        }
        parts.push(keep);
    });
    return mergeGeometries(parts, false);
}

function useMark() {
    const { scene } = useGLTF("/models/aura-logo.glb");
    return useMemo(() => {
        const g = bakeAndMerge(scene);
        g.computeBoundingBox();
        const c = g.boundingBox.getCenter(new THREE.Vector3());
        g.translate(-c.x, -c.y, -c.z);                     // centred, as in make_liquid.py
        const width = g.boundingBox.max.x - g.boundingBox.min.x;
        const sz = g.boundingBox.getSize(new THREE.Vector3());
        return {
            geometry: g,
            fit: MARK_WIDTH / width,
            unit: 1 / Math.max(sz.x, sz.y, sz.z, 1e-6),          // marble pattern scale
            edges: new THREE.EdgesGeometry(g, 28),                 // the bevels, for the edge glints
        };
    }, [scene]);
}

// The A's reflection in the water, done like a real planar mirror: the A is
// drawn mirrored about the water line (same marble shader) into an offscreen
// picture each frame, and the water surface shows that picture, dimmed,
// smeared downward and broken up by the ripples. Only on the water: the rocks
// hide it, it stops at the horizon and at the underwater line.
const reflection = { texture: null, dim: 1 };

const REFLECT_VERTEX = /* glsl */`
    uniform float uShift;
    varying vec3 vWorld;
    void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        ${WATER_SHIFT}
    }
`;
const REFLECT_FRAGMENT = /* glsl */`
    uniform sampler2D uMap; uniform vec2 uRes; uniform float uTime; uniform float uFade; uniform float uCut;
    varying vec3 vWorld;
    void main() {
        // it melts away just under the underwater line (seen through the surface layer)
        float under = clamp((uCut - gl_FragCoord.y) / (uRes.y * 0.16), 0.0, 1.0);
        if (under >= 1.0) discard;
        vec2 uv = gl_FragCoord.xy / uRes;
        // ripples bend it: long slow swells plus fine chop, stronger nearer the viewer
        float near = clamp((vWorld.z + 4.0) / 8.0, 0.0, 1.0);
        float sw = sin(vWorld.z * 9.0 + uTime * 1.1 + sin(vWorld.x * 2.3 + uTime * 0.5) * 1.8);
        float chop = sin(vWorld.z * 27.0 - uTime * 2.2 + vWorld.x * 4.0);
        uv.x += (sw * 0.0065 + chop * 0.0025) * (0.5 + near);
        uv.y += sin(vWorld.x * 4.0 + uTime * 0.8) * 0.0015;
        // water smears reflections downward (blurrier further from the object)
        vec4 acc = vec4(0.0); float tot = 0.0;
        for (int i = 0; i <= 8; i++) {
            float k = float(i);
            float wt = exp(-k * k / 18.0);
            acc += texture2D(uMap, uv - vec2(0.0, k * 0.0035)) * wt;
            tot += wt;
        }
        vec4 r = acc / tot;
        // broken into bands where the ripples catch the light from elsewhere
        float bands = 0.72 + 0.28 * sin(vWorld.z * 38.0 + uTime * 2.4 + sin(vWorld.x * 6.0) * 2.0);
        // dark water: it reflects only part of the light, a little cooler
        if (r.a < 0.004) discard;                           // nothing reflected here: the plane adds nothing at all
        vec3 col = r.rgb * 0.5 * bands * vec3(0.8, 0.97, 1.0) * min(r.a, 1.0);
        gl_FragColor = vec4(col * uFade * (1.0 - under) * (1.0 - under), 1.0);
    }
`;

function GlassMark({ quality }) {
    const mark = useMark();
    const group = useRef(null);
    const turn = useRef(null);
    const markMat = useRef(null);
    const strandsMat = useRef(null);
    // the liquid marble from the premium site (same shader, same settings)
    const marbleUniforms = useMemo(() => ({
        uTime: { value: 0 }, uTint: { value: new THREE.Color("#1a4e4d") },
        uWarp: { value: 0.2 }, uFlow: { value: 0.1 }, uSplit: { value: 0.05 }, uDark: { value: 0 },
        uCenter: { value: new THREE.Vector3() }, uScale: { value: mark.unit * 1.2 }, uBrightness: { value: 1 },
    }), [mark]);
    const coreLight = useRef(null);
    const haze = useRef(null);
    const mirror = useRef(null);         // the A + stream reflected in the water
    const mirrorTurn = useRef(null);
    // the offscreen picture of the mirrored A (the water shows it)
    const mirrorScene = useMemo(() => new THREE.Scene(), []);
    const mirrorTarget = useMemo(() => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), []);
    useEffect(() => {
        reflection.texture = mirrorTarget.texture;
        return () => { reflection.texture = null; mirrorTarget.dispose(); };
    }, [mirrorTarget]);
    const glowRef = useRef(1);
    const state = useRef(null);
    const { size } = useThree();
    const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

    useFrame((frame, raw) => {
        const g = group.current;
        const tr = turn.current;
        if (!g || !tr) return;
        if (!state.current) {
            state.current = {
                pose: { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1, glow: 1 },
                target: { ...POSES.hero },
                tint: SCROLL_TINTS[0].clone(),
                want: new THREE.Color(),
                attn: new THREE.Color(),
            };
        }
        const { pose, target, tint, want, attn } = state.current;
        const dt = Math.min(raw, 1 / 20);
        const t = frame.clock.elapsedTime;
        const aspect = size.width / size.height;
        const narrow = aspect < 0.9;
        scrollPose(narrow, target);
        if (!state.current.placed) {                 // start in place, no glide from the centre
            Object.assign(pose, target);
            state.current.placed = true;
        }
        const k = 1 - Math.exp(-3.2 * dt);
        for (const key of KEYS) pose[key] += (target[key] - pose[key]) * k;
        glowRef.current = pose.glow;

        // the reveal after the loader: rises, turns and lights up
        const since = landing.revealAt == null ? 0 : (performance.now() - landing.revealAt) / 1600;
        const r = landing.revealAt == null ? 0 : smooth(Math.min(Math.max(since, 0), 1));
        const { halfH, halfW } = halfSize(size, pose.z);
        const idle = reduced ? 0 : 1;
        g.position.set(
            pose.x * halfW,
            pose.y * halfH + Math.sin(t * 0.6) * 0.05 * idle - (1 - r) * 0.9,
            pose.z,
        );
        tr.rotation.set(
            pose.rx - frame.pointer.y * 0.1 + Math.sin(t * 0.4) * 0.025 * idle,
            pose.ry + frame.pointer.x * 0.18 + Math.sin(t * 0.25) * 0.06 * idle - (1 - r) * 1.4,
            0,
        );
        g.scale.setScalar(pose.s * fitFor(halfSize(size).halfW) * mark.fit * lerp(0.86, 1, r));

        // colour: a hovered service wins, otherwise the colour for this screen
        const step = Math.floor((window.scrollY + 1) / Math.max(window.innerHeight, 1));
        if (landing.hoverTint) want.set(landing.hoverTint); else want.copy(SCROLL_TINTS[step % SCROLL_TINTS.length]);
        tint.lerp(want, 1 - Math.exp(-3 * dt));
        attn.copy(tint).multiplyScalar(0.8);
        const mu = markMat.current?.uniforms;
        if (mu) {
            // the scroll colours are bright; the marble shader wants a dark base
            // tint that it lights up into swirls
            mu.uTint.value.copy(attn).multiplyScalar(0.4);
            mu.uTime.value = t;
            mu.uWarp.value += ((landing.hoverTint ? 0.45 : 0.2) - mu.uWarp.value) * (1 - Math.exp(-3 * dt));
            mu.uBrightness.value = lerp(0.15, 0.85 + 0.2 * Math.min(pose.glow, 1.6), r);
        }
        if (strandsMat.current) strandsMat.current.uniforms.uTint.value.copy(tint);
        const glow = pose.glow * r * (0.9 + Math.sin(t * 1.3) * 0.1 * idle);
        if (coreLight.current) {
            coreLight.current.color.copy(tint);
            coreLight.current.intensity = 14 * glow;
        }
        if (haze.current) {
            haze.current.uniforms.uGlow.value = pose.glow * r;
            haze.current.uniforms.uColor.value.copy(tint);
            haze.current.uniforms.uTime.value = t;
        }

        // its reflection: mirrored about the water line, only while the water shows
        const mg = mirror.current, mt = mirrorTurn.current;
        if (mg && mt) {
            const h = heroSet(size, narrow);
            const fadeNow = stepSurface(frame.clock.elapsedTime, Math.min(raw, 0.05));
            mg.visible = !narrow && !DEBUG.includes("nomirror") && fadeNow > 0.002;
            mg.position.set(g.position.x, 2 * h.waterY - g.position.y, g.position.z);
            mg.scale.set(g.scale.x, -g.scale.y, g.scale.z);
            mt.rotation.set(-tr.rotation.x, tr.rotation.y, 0);
            // A reflection only makes sense while the A is above the water. As the
            // page scrolls the A sinks through the surface; the mirror image would
            // then lie right over its own underwater half, so it fades out as the
            // A's base reaches the water.
            const bb = mark.geometry.boundingBox;
            const tall = (bb.max.y - bb.min.y) * g.scale.y;
            const clearance = (g.position.y - tall / 2 - h.waterY) / Math.max(tall, 1e-4);
            reflection.dim = smooth(Math.min(Math.max((clearance + 0.1) / 0.16, 0), 1));
            if (reflection.dim < 0.002) mg.visible = false;
            if (mg.visible) {
                // draw just the mirrored A into the offscreen picture
                const { gl, camera } = frame;
                const w = Math.max(4, Math.round(size.width * gl.getPixelRatio() * 0.5));
                const hh = Math.max(4, Math.round(size.height * gl.getPixelRatio() * 0.5));
                if (mirrorTarget.width !== w || mirrorTarget.height !== hh) mirrorTarget.setSize(w, hh);
                const clear = gl.getClearColor(new THREE.Color()), clearA = gl.getClearAlpha();
                gl.setRenderTarget(mirrorTarget);
                gl.setClearColor(0x000000, 0);
                gl.clear();
                gl.render(mirrorScene, camera);      // a scene of its own: nothing but the mirrored A can be in it
                gl.setRenderTarget(null);
                gl.setClearColor(clear, clearA);
            }
        }

    });

    return (
        <>
        {/* the light under the water: caustics near the surface, glowing plankton deeper down */}
        <DiveLight
            materialRef={strandsMat}
            markRef={group}
            reduced={reduced}
            surfaceFromBottom={SURFACE_FROM_BOTTOM}
            surfaceAtNarrow={SURFACE_AT_NARROW}
        />
        {/* only drawn into the offscreen reflection picture (a scene of its own) */}
        {createPortal(
        <group ref={mirror} visible={false}>
            <group ref={mirrorTurn}>
                <mesh geometry={mark.geometry}>
                    <shaderMaterial
                        vertexShader={LIQUID_VERTEX}
                        fragmentShader={LIQUID_FRAGMENT}
                        uniforms={marbleUniforms}
                        side={THREE.DoubleSide}
                        toneMapped={false}
                    />
                </mesh>
            </group>
        </group>,
        mirrorScene)}
        <group ref={group}>
            {/* (the round teal glow behind the A was removed on request; TealHaze is kept below if wanted back) */}
            <group ref={turn}>
                {/* liquid marble, as on the premium site */}
                <mesh geometry={mark.geometry}>
                    <shaderMaterial
                        ref={markMat}
                        vertexShader={LIQUID_VERTEX}
                        fragmentShader={LIQUID_FRAGMENT}
                        uniforms={marbleUniforms}
                        toneMapped={false}
                    />
                </mesh>
                <lineSegments geometry={mark.edges} renderOrder={1}>
                    <lineBasicMaterial
                        color={EDGE_COLOR}
                        transparent
                        opacity={0.35}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                        toneMapped={false}
                    />
                </lineSegments>
                <pointLight ref={coreLight} position={[0, -0.05, 0.15]} distance={2.2} decay={2} intensity={9} color="#5ff3ff" />
            </group>
        </group>
        </>
    );
}

// A teal glow behind the A (travels with it), so the glass always has light
// to bend
function TealHaze({ matRef }) {
    const uniforms = useMemo(() => ({
        uTime: { value: 0 }, uGlow: { value: 1 }, uColor: { value: new THREE.Color("#5ff3ff") },
    }), []);
    return (
        <mesh position={[0, 0.05, -1.2]} scale={[5.2, 4.2, 1]} renderOrder={-1} visible={!DEBUG.includes("nohaze")}>
            <planeGeometry />
            <shaderMaterial
                ref={matRef}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                uniforms={uniforms}
                vertexShader={/* glsl */`
                    varying vec2 vUv;
                    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
                `}
                fragmentShader={/* glsl */`
                    uniform float uTime; uniform float uGlow; uniform vec3 uColor; varying vec2 vUv;
                    void main() {
                        vec2 p = (vUv - 0.5) * 2.0;
                        float d = length(p * vec2(1.0, 1.15));
                        float wide = smoothstep(1.0, 0.0, d);
                        float core = smoothstep(0.45, 0.0, d);
                        float breathe = 0.9 + 0.1 * sin(uTime * 0.5);
                        vec3 col = uColor * (wide * wide * 0.07 + core * 0.36);
                        gl_FragColor = vec4(col * breathe * clamp(uGlow, 0.3, 1.6), 1.0);
                    }
                `}
            />
        </mesh>
    );
}

// ── The backdrop: near-black, with smoky teal light falling from the top
// left and a soft glow on the horizon
function Backdrop() {
    const mat = useRef(null);
    const uniforms = useMemo(() => ({ uTime: { value: 0 }, uScroll: { value: 0 } }), []);
    useFrame((frame) => {
        const u = mat.current?.uniforms;
        if (!u) return;
        u.uTime.value = frame.clock.elapsedTime;
        u.uScroll.value = window.scrollY / Math.max(window.innerHeight, 1);
    });
    return (
        <mesh position={[0, 2, -45]} scale={[150, 80, 1]} renderOrder={-3} visible={!DEBUG.includes("nobackdrop")}>
            <planeGeometry />
            <shaderMaterial
                ref={mat}
                depthWrite={false}
                uniforms={uniforms}
                vertexShader={/* glsl */`
                    varying vec2 vUv;
                    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
                `}
                fragmentShader={/* glsl */`
                    uniform float uTime; uniform float uScroll; varying vec2 vUv;
                    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                    float vnoise(vec2 p) {
                        vec2 i = floor(p), f = fract(p);
                        vec2 u = f * f * (3.0 - 2.0 * f);
                        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
                    }
                    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
                    void main() {
                        vec2 uv = vUv;
                        uv.y += uScroll * 0.08;                         // the sky drifts a little as the page scrolls
                        vec3 col = vec3(0.002, 0.008, 0.011);
                        // smoke: slow, layered, teal
                        float smoke = fbm(uv * vec2(3.0, 2.0) + vec2(uTime * 0.012, -uTime * 0.008));
                        smoke = smoothstep(0.35, 0.95, smoke);
                        // a broad shaft of light from the top left, sweeping down to the right
                        vec2 q = uv - vec2(0.36, 1.05);
                        float ang = atan(q.x, -q.y);
                        float shaft = smoothstep(0.32, 0.0, abs(ang - 0.22)) * smoothstep(1.1, 0.1, length(q));
                        float shaft2 = smoothstep(0.08, 0.0, abs(ang - 0.05)) * smoothstep(0.9, 0.05, length(q)) * 0.6;
                        vec3 teal = vec3(0.05, 0.55, 0.62);
                        col += teal * (shaft * 0.2 + shaft2 * 0.18) * (0.45 + 0.75 * smoke);
                        col += teal * smoke * 0.008;
                        // darker toward the horizon, so the water melts into the sky
                        col *= mix(0.2, 1.0, smoothstep(0.3, 0.75, uv.y));
                        gl_FragColor = vec4(col, 1.0);
                    }
                `}
            />
        </mesh>
    );
}

// ── The water: a dark mirror with slow ripples, and the rocks on it ───────
// A tileable noise texture for the ripples (fixed seed, same every load)
function useRippleTexture() {
    return useMemo(() => {
        const N = 256;
        const data = new Uint8Array(N * N * 4);
        let s = 7;
        const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
        const grid = 16;
        const g = Array.from({ length: grid * grid }, () => rnd());
        const at = (x, y) => g[((y % grid + grid) % grid) * grid + ((x % grid + grid) % grid)];
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const fx = (x / N) * grid, fy = (y / N) * grid;
                const ix = Math.floor(fx), iy = Math.floor(fy);
                const tx = smooth(fx - ix), ty = smooth(fy - iy);
                const v = lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
                const i = (y * N + x) * 4;
                data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
                data[i + 3] = 255;
            }
        }
        const tex = new THREE.DataTexture(data, N, N);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(6, 3);
        tex.needsUpdate = true;
        return tex;
    }, []);
}

const ROCKS = [
    // file, x (fraction of half width), depth z, size, turn, how far it sinks into the water
    { file: "moon_rock_01", x: -0.30, z: -0.8, s: 17, ry: 0.4, sink: 0.25 },
    { file: "rock_09", x: 0.92, z: -0.2, s: 26, ry: -0.9, sink: 0.2 },
    { file: "moon_rock_05", x: 0.78, z: -3.6, s: 20, ry: 1.2, sink: 0.4 },
    { file: "moon_rock_04", x: -0.9, z: 2.2, s: 24, ry: 2.2, sink: 0.05 },
];

function Rock({ file }) {
    const { scene } = useGLTF(`/models/rocks/${file}.glb`);
    // the rock's own node scale is part of its size: bake it into the geometry
    const rock = useMemo(() => {
        let found = null;
        scene.updateMatrixWorld(true);
        scene.traverse((o) => { if (o.isMesh && (!found || o.geometry.attributes.position.count > found.geometry.attributes.position.count)) found = o; });
        if (!found) return null;
        const geometry = found.geometry.clone().applyMatrix4(found.matrixWorld);
        geometry.computeBoundingBox();
        geometry.translate(0, -geometry.boundingBox.min.y, 0);     // sits on the water
        return { geometry, material: found.material };
    }, [scene]);
    if (!rock) return null;
    return (
        <mesh geometry={rock.geometry}>
            <meshStandardMaterial
                map={rock.material.map}
                normalMap={rock.material.normalMap}
                roughnessMap={rock.material.roughnessMap}
                color="#28363b"
                roughness={0.85}
                metalness={0}
                envMapIntensity={0.35}
            />
        </mesh>
    );
}

function HeroSet() {
    const set = useRef(null);
    const rocks = useRef([]);
    const water = useRef(null);
    const mirrorRef = useRef(null);
    const ripples = useRippleTexture();
    const { size, gl } = useThree();
    const reflectUniforms = useMemo(() => ({
        uMap: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uFade: { value: 1 }, uCut: { value: 0 },
        uShift: { value: 0 },
    }), []);
    // the water's own shift (shared with its material through onBeforeCompile)
    const waterShift = useRef({ value: 0 });
    const waterCut = useRef({ value: 0 });       // the underwater line, px from the bottom
    const waterSoft = useRef({ value: 45 });     // px over which the water fades out under that line
    const shiftWater = useMemo(() => (shader) => {
        shader.uniforms.uShift = waterShift.current;
        shader.uniforms.uCutW = waterCut.current;
        shader.uniforms.uSoftW = waterSoft.current;
        shader.vertexShader = "uniform float uShift;\nvarying float vWaterDepth;\n" + shader.vertexShader.replace(
            "#include <project_vertex>",
            "#include <project_vertex>\nvWaterDepth = -mvPosition.z;\n" + WATER_SHIFT,
        );
        // no straight edges: the sea melts into the sky toward the horizon, and
        // ends softly just under the underwater line (not at the plane's own edge)
        shader.fragmentShader = "uniform float uCutW; uniform float uSoftW;\nvarying float vWaterDepth;\n" + shader.fragmentShader.replace(
            "#include <dithering_fragment>",
            "gl_FragColor.a *= (1.0 - smoothstep(26.0, 44.0, vWaterDepth)) * smoothstep(uCutW - uSoftW, uCutW, gl_FragCoord.y);\n#include <dithering_fragment>",
        );
    }, []);
    useFrame((frame, raw) => {
        const s = set.current;
        if (!s) return;
        const narrow = size.width / size.height < 0.9;
        const h = heroSet(size, narrow);
        s.position.y = h.waterY;
        // phones: no water or rocks (they would sit behind the headline);
        // elsewhere gone once it has scrolled well off screen
        s.visible = !narrow && h.waterY < h.halfH * 3;
        // The set scrolls at the speed of things at depth 0; a rock nearer the
        // camera (or further away) has to move a little less (more) so it keeps
        // pace with the page, or it would drift up out of the water.
        const screens = window.scrollY / Math.max(size.height, 1);
        const halfAt = (z) => Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAMERA_Z - z);
        rocks.current.forEach((r, i) => {
            if (!r) return;
            const def = ROCKS[i];
            const keepPace = screens * 2 * (halfAt(def.z) - halfAt(0));
            r.position.set(def.x * h.halfW * (narrow ? 1.35 : 1), -def.sink + keepPace, def.z);
        });
        // the ocean stays where it is in the scene (undo the set's scroll) and
        // is moved up the screen instead, like the page
        const screensUp = window.scrollY / Math.max(window.innerHeight, 1);
        const scrolledWorld = screensUp * h.halfH * 2;
        waterShift.current.value = screensUp * 2;
        if (water.current) water.current.position.y = -scrolledWorld;
        {
            const dpr = gl.getPixelRatio();
            const vh = Math.max(size.height, 1);
            const line = narrow ? SURFACE_AT_NARROW * vh : vh - SURFACE_FROM_BOTTOM;
            waterCut.current.value = DEBUG.includes("nounder") ? -1e4 : (vh - (line - window.scrollY)) * dpr;
            waterSoft.current.value = 45 * dpr;
        }
        // (the A's reflection stays on the moving set: the mirrored A it shows is
        // placed against that water line, so it has to move the same way)
        if (water.current) {
            const f = stepSurface(frame.clock.elapsedTime, Math.min(raw, 0.05));
            water.current.material.opacity = f;
            water.current.visible = f > 0.002 && !DEBUG.includes("nowater");
            const rm = mirrorRef.current;
            if (rm) {
                const u = rm.material.uniforms;
                const dpr = gl.getPixelRatio();
                const vh = Math.max(size.height, 1);
                u.uMap.value = reflection.texture;
                u.uRes.value.set(size.width * dpr, vh * dpr);
                u.uTime.value = frame.clock.elapsedTime;
                u.uFade.value = f * reflection.dim;
                // the underwater line, in pixels from the bottom of the screen
                const line = narrow ? SURFACE_AT_NARROW * vh : vh - SURFACE_FROM_BOTTOM;
                u.uCut.value = DEBUG.includes("mirrorall") ? 0 : (vh - (line - window.scrollY)) * dpr;
                rm.visible = water.current.visible && !!reflection.texture && reflection.dim > 0.002 && !DEBUG.includes("nomirror");
            }
        }
        const dmap = water.current?.material.bumpMap;
        if (dmap) {
            dmap.offset.x += Math.min(raw, 0.05) * 0.006;
            dmap.offset.y += Math.min(raw, 0.05) * 0.003;
        }
    });
    return (
        <group ref={set}>
            <mesh ref={water} rotation-x={-Math.PI / 2} renderOrder={1} visible={!DEBUG.includes("nowater")}>
                <planeGeometry args={[120, 70]} />
                <meshPhysicalMaterial
                    color="#000000"
                    roughness={0.28}
                    metalness={0}
                    specularIntensity={0.18}
                    bumpMap={ripples}
                    bumpScale={0.6}
                    envMapIntensity={0.07}
                    depthWrite={false}
                    transparent
                    onBeforeCompile={shiftWater}
                />
            </mesh>
            {/* the A mirrored in the water (see REFLECT_FRAGMENT) */}
            <mesh ref={mirrorRef} rotation-x={-Math.PI / 2} position-y={0.003} renderOrder={2} visible={false}>
                <planeGeometry args={[120, 70]} />
                <shaderMaterial
                    uniforms={reflectUniforms}
                    vertexShader={REFLECT_VERTEX}
                    fragmentShader={REFLECT_FRAGMENT}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
            {/* WaterGlow (light where the old strand flow met the water) is off: no flow lands there now */}
            {!DEBUG.includes("norocks") && ROCKS.map((r, i) => (
                <group key={r.file} ref={(el) => { rocks.current[i] = el; }} rotation-y={r.ry} scale={r.s}>
                    <Rock file={r.file} />
                </group>
            ))}
            {/* teal rim lights skimming the rocks from behind */}
            {!DEBUG.includes("nolights") && <>
            <pointLight position={[-1.8, 1.6, -3.2]} color="#22d8e6" intensity={40} distance={10} decay={2} />
            <pointLight position={[5.4, 2.0, -2.6]} color="#22d8e6" intensity={34} distance={9} decay={2} />
            <pointLight position={[-4.2, 1.6, 1.2]} color="#1bb6c8" intensity={26} distance={8} decay={2} />
            </>}
        </group>
    );
}

// ── Under the water ───────────────────────────────────────────────────────
// Everything below the water surface reads as underwater: one layer fixed to
// the page (its surface sits level with "Scroll to explore" and scrolls up
// with the content), drawn in front of the scene so the A, the flow and the
// rocks are seen through the water. Bright wavy waterline, light shafts
// falling from the surface, caustic shimmer near it, bubbles drifting up, and
// a teal that deepens into a dark abyss further down the page.
const SURFACE_FROM_BOTTOM = 50;        // px: the waterline sits level with the "Scroll to explore" line (44px up)
const SURFACE_AT_NARROW = 0.6;
const CURTAIN_Z = 4;                    // between the camera (z 11) and the A (z 0)
const CURTAIN_H = 80;                   // world units: enough to reach below the footer

function Underwater() {
    const mesh = useRef(null);
    const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
    const { size } = useThree();
    const uniforms = useMemo(() => ({
        uTime: { value: 0 }, uHeight: { value: CURTAIN_H }, uScreen: { value: 1 }, uWidth: { value: 30 },
    }), []);
    useFrame((frame) => {
        const m = mesh.current;
        if (!m) return;
        const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAMERA_Z - CURTAIN_Z);
        const halfW = halfH * (size.width / size.height);
        const vh = Math.max(size.height, 1);
        const narrow = size.width / size.height < 0.9;
        const linePage = narrow ? SURFACE_AT_NARROW * vh : vh - SURFACE_FROM_BOTTOM;
        const f = (linePage - window.scrollY) / vh;                 // where the waterline is on screen (0 top .. 1 bottom)
        const top = (1 - 2 * f) * halfH + 0.25 * (CURTAIN_Z / CAMERA_Z);
        m.position.set(0, top - CURTAIN_H / 2, CURTAIN_Z);
        m.scale.set(halfW * 2.2, 1, 1);
        const u = m.material.uniforms;
        u.uTime.value = reduced ? 4 : frame.clock.elapsedTime;
        u.uScreen.value = halfH * 2;                                  // one screen, in this layer's units
        u.uWidth.value = halfW * 2.2;
    });
    return (
        <mesh ref={mesh} renderOrder={10} frustumCulled={false}>
            <planeGeometry args={[1, CURTAIN_H, 1, 1]} />
            <shaderMaterial
                uniforms={uniforms}
                transparent
                depthWrite={false}
                depthTest={false}
                vertexShader={/* glsl */`
                    varying vec2 vUv;
                    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
                `}
                fragmentShader={/* glsl */`
                    uniform float uTime; uniform float uHeight; uniform float uScreen; uniform float uWidth;
                    varying vec2 vUv;
                    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                    void main() {
                        float x = (vUv.x - 0.5) * uWidth;             // world units across
                        float y = (1.0 - vUv.y) * uHeight;            // world units below the surface
                        float depth = y / uScreen;                    // in screens
                        // the waterline: a gently rolling surface
                        float wave = 0.035 * sin(x * 2.3 + uTime * 0.9) + 0.022 * sin(x * 5.1 - uTime * 1.4) + 0.012 * sin(x * 11.0 + uTime * 2.1);
                        float below = y - wave;
                        if (below < 0.0) discard;
                        // the water itself: teal near the surface, deep blue-black lower down
                        vec3 shallow = vec3(0.008, 0.11, 0.14);
                        vec3 deep = vec3(0.001, 0.012, 0.022);
                        vec3 col = mix(shallow, deep, smoothstep(0.0, 2.0, depth));
                        float alpha = mix(0.4, 0.7, smoothstep(0.0, 2.5, depth));
                        // the underside of the surface: a bright line and a glow just below it
                        float line = exp(-below * 55.0);
                        float under = exp(-below * 5.0);
                        // caustics: light netting near the surface
                        vec2 c = vec2(x, y) * 3.2;
                        float ca = abs(sin(c.x + sin(c.y * 1.3 + uTime * 0.7) * 1.6) * sin(c.y * 1.1 + sin(c.x * 0.9 - uTime * 0.6) * 1.6));
                        float caustic = pow(1.0 - ca, 8.0) * exp(-depth * 4.0);
                        // light shafts slanting down from the surface, slowly shifting
                        float sx = x + y * 0.28;
                        float rays = 0.0;
                        rays += smoothstep(0.55, 1.0, sin(sx * 1.3 + uTime * 0.15)) * 0.6;
                        rays += smoothstep(0.7, 1.0, sin(sx * 2.9 - uTime * 0.11 + 1.7)) * 0.5;
                        rays += smoothstep(0.8, 1.0, sin(sx * 5.3 + uTime * 0.07 + 4.0)) * 0.35;
                        rays *= exp(-depth * 1.1) * smoothstep(0.0, 0.25, below);
                        // bubbles drifting up
                        float bub = 0.0;
                        for (int k = 0; k < 2; k++) {
                            float sc = k == 0 ? 2.2 : 4.0;
                            vec2 g = vec2(x, y + uTime * (k == 0 ? 0.35 : 0.22)) * sc;
                            vec2 id = floor(g);
                            vec2 fp = fract(g) - 0.5;
                            float h = hash(id + float(k) * 13.0);
                            if (h > 0.94) {
                                fp.x += sin(uTime * 1.5 + h * 30.0) * 0.12;
                                float r = 0.06 + 0.08 * hash(id + 7.0);
                                float d = length(fp);
                                bub += smoothstep(r, r * 0.7, d) * smoothstep(r * 0.45, r * 0.8, d) * 0.9;   // a ring
                            }
                        }
                        bub *= smoothstep(0.05, 0.3, below);
                        vec3 light = vec3(0.35, 0.9, 1.0);
                        col += light * (line * 1.3 + under * 0.08 + caustic * 0.1 + rays * 0.2 + bub * 0.22);
                        alpha = clamp(alpha + line * 0.4 + rays * 0.06 + bub * 0.2, 0.0, 1.0);
                        gl_FragColor = vec4(col, alpha);
                    }
                `}
            />
        </mesh>
    );
}

// Light pooling on the water where the stream lands and under the A
function WaterGlow() {
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
    const mat = useRef(null);
    useFrame((frame) => { if (mat.current) mat.current.uniforms.uTime.value = frame.clock.elapsedTime; });
    return (
        <mesh rotation-x={-Math.PI / 2} position={[1.4, 0.01, 0.2]} scale={[9, 3.2, 1]} visible={!DEBUG.includes("noglow")}>
            <planeGeometry />
            <shaderMaterial
                ref={mat}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                uniforms={uniforms}
                vertexShader={/* glsl */`
                    varying vec2 vUv;
                    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
                `}
                fragmentShader={/* glsl */`
                    uniform float uTime; varying vec2 vUv;
                    void main() {
                        vec2 p = (vUv - 0.5) * 2.0;
                        float d = length(p * vec2(1.0, 1.6));
                        float g = smoothstep(1.0, 0.0, d);
                        float shimmer = 0.85 + 0.15 * sin(vUv.x * 40.0 + uTime * 1.5) * sin(vUv.y * 23.0 - uTime);
                        gl_FragColor = vec4(vec3(0.05, 0.65, 0.75) * g * g * 0.55 * shimmer, 1.0);
                    }
                `}
            />
        </mesh>
    );
}

// ── Bubbles drifting up around the A (cheap: a rim-lit sphere shader) ─────
const BUBBLES = 8;
function Bubbles() {
    const ref = useRef(null);
    const seeds = useMemo(() => {
        let n = 99;
        const rnd = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
        const out = [];
        for (let i = 0; i < BUBBLES; i++) {
            out.push({ x: (rnd() - 0.2) * 9, y: rnd() * 6 - 2, z: -2.5 + rnd() * 3, r: 0.02 + rnd() ** 3 * 0.06, sp: 0.08 + rnd() * 0.15, ph: rnd() * 6.28 });
        }
        return out;
    }, []);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    useFrame((frame) => {
        const m = ref.current;
        if (!m) return;
        const t = frame.clock.elapsedTime;
        const scrolled = (window.scrollY / Math.max(window.innerHeight, 1)) * 2.7 * 2;
        seeds.forEach((b, i) => {
            const y = ((b.y + t * b.sp + 2.5) % 6.5) - 2.5 + scrolled * 0.6;
            dummy.position.set(b.x + Math.sin(t * 0.7 + b.ph) * 0.08, y, b.z);
            dummy.scale.setScalar(b.r);
            dummy.updateMatrix();
            m.setMatrixAt(i, dummy.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
    });
    return (
        <instancedMesh ref={ref} args={[null, null, BUBBLES]} frustumCulled={false}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshPhysicalMaterial
                transparent
                opacity={0.22}
                roughness={0}
                metalness={0}
                clearcoat={1}
                color="#bff8ff"
                envMapIntensity={2.4}
                depthWrite={false}
            />
        </instancedMesh>
    );
}

// ── Studio lighting for the glass (baked once) ───────────────────────────
function Studio() {
    return (
        <Environment frames={1} resolution={256}>
            <color attach="background" args={["#000000"]} />
            <Lightformer form="rect" intensity={2.4} position={[0, 5, -1]} rotation-x={Math.PI / 2} scale={[10, 1.4, 1]} />
            <Lightformer form="rect" intensity={5} color="#9ff6ff" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[7, 0.6, 1]} />
            <Lightformer form="rect" intensity={4} color="#38e1ef" position={[5, 0.5, -1]} rotation-y={-Math.PI / 2} scale={[7, 0.9, 1]} />
            <Lightformer form="rect" intensity={2.6} color="#bff8ff" position={[4, 2.5, 7]} rotation={[0, Math.PI * 0.8, 0]} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.6} color="#5ff3ff" position={[-3, -1, 7]} rotation={[0, -Math.PI * 0.85, 0]} scale={[4, 3, 1]} />
            <Lightformer form="rect" intensity={3} color="#0fb5c4" position={[0, 1, -9]} scale={[14, 5, 1]} />
            <Lightformer form="ring" color="#1CE3DA" intensity={2} position={[0, 0, -7]} scale={4} />
        </Environment>
    );
}

// Fine dust in the air: depth and parallax
const DUST_COUNT = 500;
function Dust() {
    const points = useRef(null);
    const mat = useRef(null);
    const { geometry, uniforms } = useMemo(() => {
        let n = 1234567;
        const rnd = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
        const pos = new Float32Array(DUST_COUNT * 3);
        const seed = new Float32Array(DUST_COUNT);
        for (let i = 0; i < DUST_COUNT; i++) {
            pos[i * 3] = (rnd() - 0.5) * 30;
            pos[i * 3 + 1] = (rnd() - 0.3) * 14;
            pos[i * 3 + 2] = -12 + rnd() * 18;
            seed[i] = rnd();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
        return { geometry: g, uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } } };
    }, []);
    useFrame((frame, raw) => {
        const p = points.current;
        const u = mat.current?.uniforms;
        if (!p || !u) return;
        const dt = Math.min(raw, 1 / 20);
        u.uTime.value = frame.clock.elapsedTime;
        u.uPixel.value = frame.gl.getPixelRatio();
        const k = 1 - Math.exp(-2 * dt);
        p.position.x += (-frame.pointer.x * 0.4 - p.position.x) * k;
        p.position.y += (-frame.pointer.y * 0.25 + window.scrollY * 0.001 - p.position.y) * k;
    });
    return (
        <points ref={points} geometry={geometry} frustumCulled={false}>
            <shaderMaterial
                ref={mat}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                uniforms={uniforms}
                vertexShader={/* glsl */`
                    attribute float aSeed; uniform float uTime; uniform float uPixel; varying float vA;
                    void main() {
                        vec3 p = position;
                        p.y += sin(uTime * 0.15 + aSeed * 40.0) * 0.25;
                        p.x += cos(uTime * 0.11 + aSeed * 23.0) * 0.25;
                        vec4 mv = modelViewMatrix * vec4(p, 1.0);
                        gl_Position = projectionMatrix * mv;
                        gl_PointSize = mix(1.0, 2.6, aSeed * aSeed) * uPixel * (14.0 / -mv.z);
                        vA = (0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 60.0))) * smoothstep(30.0, 6.0, -mv.z);
                    }
                `}
                fragmentShader={/* glsl */`
                    varying float vA;
                    void main() {
                        float d = length(gl_PointCoord - 0.5);
                        gl_FragColor = vec4(vec3(0.6, 0.95, 1.0) * smoothstep(0.5, 0.0, d) * vA * 0.5, 1.0);
                    }
                `}
            />
        </points>
    );
}

// Tells the page when the first frame is on screen (shaders compiled)
function ReadySignal() {
    const done = useRef(false);
    useFrame(() => {
        if (done.current) return;
        done.current = true;
        requestAnimationFrame(() => { landing.sceneReady = true; window.dispatchEvent(new Event("landing-scene-ready")); });
    });
    return null;
}

// The mouse fluid trail, same as the inner pages (WorldCanvas)
const FLUID_COLOR = "#ffffff";
const FLUID_RADIUS = 0.035;

export default function LandingScene() {
    // the fluid needs a mouse, and stays off with reduced motion
    const [fluidOn] = useState(() => !window.matchMedia("(hover: none), (pointer: coarse)").matches
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    // Lighter settings on phones and small GPUs
    const [quality, setQuality] = useState(() => {
        const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
        const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
        return coarse || weak
            ? { samples: 4, resolution: 384, liquidSamples: 3, liquidResolution: 256, reflector: 512, dpr: [1, 1.4] }
            : { samples: 8, resolution: 768, liquidSamples: 6, liquidResolution: 512, reflector: 1024, dpr: [1, 1.75] };
    });

    return (
        <Canvas
            dpr={quality.dpr}
            camera={{ position: [0, EYE_Y, CAMERA_Z], fov: FOV, near: 0.1, far: 80 }}
            gl={{ antialias: false, powerPreference: "high-performance" }}
            eventSource={typeof document !== "undefined" ? document.body : undefined}
            eventPrefix="client"
        >
            <color attach="background" args={[BG]} />
            <fog attach="fog" args={[BG, 18, 44]} />
            <PerformanceMonitor onDecline={() => setQuality((q) => ({ ...q, dpr: [1, 1.2], samples: Math.min(q.samples, 4), liquidSamples: Math.min(q.liquidSamples, 3) }))} />
            <Suspense fallback={null}>
                <Studio />
                <Backdrop />
                {DEBUG.includes("nodust") ? null : <Dust />}
                {DEBUG.includes("noset") ? null : <HeroSet />}
                {DEBUG.includes("nomark") ? null : <GlassMark quality={quality} />}
                {DEBUG.includes("nobubbles") ? null : <Bubbles />}
                {DEBUG.includes("nounder") ? null : <Underwater />}
                <ReadySignal />
            </Suspense>
            <EffectComposer multisampling={4}>
                {fluidOn && !DEBUG.includes("nofluid") ? (
                    <Fluid
                        {...FLUID_DEFAULTS}
                        showBackground={true}
                        rainbow={false}
                        fluidColor={FLUID_COLOR}
                        radius={FLUID_RADIUS}
                    />
                ) : null}
                <Bloom intensity={DEBUG.includes("nobloom") ? 0 : 0.7} mipmapBlur luminanceThreshold={0.82} luminanceSmoothing={0.2} radius={0.7} />
                {DEBUG.includes("nofooter") ? null : <LiquidFooter />}
                <Vignette offset={0.22} darkness={0.85} />
                <Noise opacity={0.03} />
            </EffectComposer>
        </Canvas>
    );
}

useGLTF.preload("/models/aura-logo.glb");
ROCKS.forEach((r) => useGLTF.preload(`/models/rocks/${r.file}.glb`));
