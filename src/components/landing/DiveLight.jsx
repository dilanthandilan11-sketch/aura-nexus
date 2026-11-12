// src/components/landing/DiveLight.jsx
// The light under the water, from the surface down to the footer: scrolling
// the page feels like a dive.
//
// - Caustics: the wavering net of sunlight you see on the bottom of a pool,
//   playing across the deep behind the A. Strongest just under the waterline,
//   dimmer and bluer the deeper you scroll, gone by about three screens down.
//   The pattern belongs to the page (it scrolls with it, a little slower, so
//   it reads as far away).
// - Plankton: thousands of tiny specks drifting in the dark that take over as
//   the caustics fade. They glow softly on their own and light up as the
//   cursor or the A passes near them, then fade back (the cursor leaves a
//   glowing wake). Spread through depth, so they scroll with a little parallax.
// - Both take the A's colour for the current screen (via materialRef: the
//   GlassMark sets uTint on it every frame).
// - Reduced motion: everything holds still and the cursor wake is off.
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const FOV = 28;
const CAMERA_Z = 11;
const CAUSTIC_Z = -3;            // the plane the caustics play on (behind the A)
const TRAIL = 10;                // cursor wake: how many recent positions glow
const TRAIL_EVERY = 0.045;       // seconds between wake points
const TRAIL_LIFE = 1.4;          // seconds a wake point takes to fade
const FROZEN_TIME = 8;

const halfAt = (z) => Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAMERA_Z - z);

function seeded(seed) {
    let n = seed;
    return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
}

// ── Caustics ────────────────────────────────────────────────────────────────
const CAUSTIC_VERTEX = /* glsl */`
    void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const CAUSTIC_FRAGMENT = /* glsl */`
    uniform float uTime; uniform float uScroll; uniform float uLine; uniform float uVh; uniform float uDpr;
    uniform vec2 uRes; uniform vec3 uTint;
    #define TAU 6.28318530718
    // the classic tileable water caustic (iterated warping)
    float caustic(vec2 uv, float t) {
        vec2 p = mod(uv * TAU, TAU) - 250.0;
        vec2 i = p;
        float c = 1.0;
        const float inten = 0.005;
        for (int n = 0; n < 5; n++) {
            float tt = t * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
            c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
        }
        c /= 5.0;
        c = 1.17 - pow(c, 1.4);
        return pow(abs(c), 8.0);
    }
    void main() {
        // where this pixel is on the page, in CSS px, and how far below the surface
        vec2 css = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
        float pageY = uScroll + css.y;
        float depth = (pageY - uLine) / uVh;              // in screens
        if (depth <= 0.0) discard;
        // the pattern scrolls with the page, a little slower (far away)
        vec2 uv = vec2(css.x, css.y + uScroll * 0.7) / uVh;
        float t = uTime * 0.32;
        float c = caustic(uv * 1.25 + vec2(0.0, t * 0.03), t) * 0.7
                + caustic(uv * 2.1 + vec2(3.7, 1.3), t * 1.25 + 2.0) * 0.45;
        // strongest just under the surface, fading with depth
        float fall = smoothstep(0.0, 0.06, depth) * exp(-depth * 0.85);
        // a soft wash of light from above, under the netting
        float wash = exp(-depth * 1.4) * 0.05;
        // deeper water turns the light bluer
        vec3 light = mix(mix(uTint, vec3(0.75, 1.0, 1.0), 0.35), vec3(0.15, 0.4, 1.0), smoothstep(0.3, 2.5, depth));
        vec3 col = light * (min(c, 1.6) * 0.5 * fall + wash);
        gl_FragColor = vec4(col, 1.0);
    }
`;

// ── Plankton ────────────────────────────────────────────────────────────────
const PLANKTON_VERTEX = /* glsl */`
    uniform float uTime; uniform float uPx; uniform float uAspect;
    uniform vec3 uTrail[${TRAIL}];          // xy: screen (NDC), z: strength
    uniform vec3 uMark;                     // the A on screen (NDC) and how much it lights
    attribute vec4 aSeed;                   // three randoms and a size
    varying float vLit; varying float vSeed; varying float vTw;
    void main() {
        vec3 p = position;
        // a slow drift, each speck its own way
        p.x += sin(uTime * 0.13 + aSeed.x * 40.0) * 0.12;
        p.y += sin(uTime * 0.09 + aSeed.y * 31.0) * 0.1;
        p.z += sin(uTime * 0.07 + aSeed.z * 23.0) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vec2 ndc = gl_Position.xy / gl_Position.w;
        // lit by the cursor's wake and by the A passing by
        float lit = 0.0;
        for (int i = 0; i < ${TRAIL}; i++) {
            vec2 d = (ndc - uTrail[i].xy) * vec2(uAspect, 1.0);
            lit = max(lit, exp(-dot(d, d) * 14.0) * uTrail[i].z);
        }
        vec2 dm = (ndc - uMark.xy) * vec2(uAspect, 1.0);
        lit = max(lit, exp(-dot(dm, dm) * 1.6) * uMark.z);
        vLit = lit;
        vSeed = aSeed.x;
        vTw = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed.y * 1.6) + aSeed.z * 50.0);
        gl_PointSize = aSeed.w * uPx * (${CAMERA_Z.toFixed(1)} / -mv.z) * (1.0 + lit * 1.8);
    }
`;
const PLANKTON_FRAGMENT = /* glsl */`
    uniform float uScroll; uniform float uLine; uniform float uVh; uniform float uDpr; uniform vec2 uRes;
    uniform vec3 uTint;
    varying float vLit; varying float vSeed; varying float vTw;
    void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        float disc = smoothstep(0.5, 0.0, r);
        float core = smoothstep(0.16, 0.0, r);
        // only below the surface, and mostly deeper down (the caustics own the shallows)
        float pageY = uScroll + (uRes.y - gl_FragCoord.y) / uDpr;
        float depth = (pageY - uLine) / uVh;
        float mask = smoothstep(0.25, 1.2, depth);
        // tinted by the A's colour, some specks drifting toward sea green
        vec3 hue = mix(uTint, vec3(0.3, 1.0, 0.72), step(0.7, vSeed) * 0.6);
        vec3 col = mix(hue, vec3(0.88, 1.0, 1.0), clamp(vLit, 0.0, 1.0) * 0.55);
        float glow = disc * (0.3 * vTw + vLit * 2.2) + core * (0.5 * vTw + vLit * 2.4);
        gl_FragColor = vec4(col * glow * mask, 1.0);
    }
`;

function buildPlankton(count, size, docH, line) {
    const rnd = seeded(9001);
    const vh = Math.max(size.height, 1);
    const aspect = size.width / vh;
    const half0 = halfAt(0);
    // how far the page (and so this group) moves over the whole scroll
    const travel = (Math.max(docH - vh, 0) / vh) * 2 * half0;
    // the surface, in world y at the A's depth (the top of the plankton)
    const top = half0 - (line / vh) * 2 * half0;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        // depth first: more specks far away than close up
        const z = -7 + Math.pow(rnd(), 0.8) * 9.5;          // -7 .. 2.5
        const h = halfAt(z);
        const w = h * aspect * 1.1;
        // spread down to where this depth leaves the screen at the bottom of the page
        const y = top - rnd() * (travel + h * 2 + 1);
        pos[i * 3] = (rnd() * 2 - 1) * w;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        seed[i * 4] = rnd(); seed[i * 4 + 1] = rnd(); seed[i * 4 + 2] = rnd();
        seed[i * 4 + 3] = 2.6 + Math.pow(rnd(), 3) * 5.0;     // mostly tiny, a few bigger
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
}

export default function DiveLight({ materialRef, markRef, reduced, surfaceFromBottom = 50, surfaceAtNarrow = 0.6 }) {
    const { size, camera, gl } = useThree();
    const caustics = useRef(null);
    const points = useRef(null);
    const own = useRef(null);
    const planktonMat = materialRef ?? own;
    const layout = useRef("");
    const wake = useRef({ at: 0, last: new THREE.Vector2(0, 0), next: 0, mark: new THREE.Vector3() });
    const narrow = size.width / size.height < 0.9;
    const count = narrow ? 2400 : 6500;

    const causticUniforms = useMemo(() => ({
        uTime: { value: 0 }, uScroll: { value: 0 }, uLine: { value: 0 }, uVh: { value: 1 }, uDpr: { value: 1 },
        uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: new THREE.Color("#5ff3ff") },
    }), []);
    const planktonUniforms = useMemo(() => ({
        uTime: { value: 0 }, uPx: { value: 1 }, uAspect: { value: 1 },
        uTrail: { value: Array.from({ length: TRAIL }, () => new THREE.Vector3(9, 9, 0)) },
        uMark: { value: new THREE.Vector3(9, 9, 0) },
        uScroll: { value: 0 }, uLine: { value: 0 }, uVh: { value: 1 }, uDpr: { value: 1 },
        uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: new THREE.Color("#5ff3ff") },
    }), []);

    const built = useRef(null);      // the current plankton geometry (freed when leaving the page)
    useEffect(() => () => built.current?.dispose(), []);

    useFrame((frame, raw) => {
        const cm = caustics.current, pm = points.current;
        if (!cm || !pm) return;
        const vh = Math.max(size.height, 1);
        const line = narrow ? surfaceAtNarrow * vh : vh - surfaceFromBottom;
        const docH = document.documentElement.scrollHeight;
        const t = reduced ? FROZEN_TIME : frame.clock.elapsedTime;
        const dpr = gl.getPixelRatio();
        const scroll = window.scrollY;

        // (re)build the plankton when the page layout changes
        const key = `${size.width}x${size.height}|${docH}`;
        if (key !== layout.current) {
            layout.current = key;
            const old = pm.geometry;
            pm.geometry = buildPlankton(count, size, docH, line);
            built.current = pm.geometry;
            old?.dispose();
        }
        // they belong to the page and scroll with it
        pm.position.y = (scroll / vh) * 2 * halfAt(0);

        // the caustic plane fills the view behind the A
        const h = halfAt(CAUSTIC_Z);
        cm.scale.set(h * (size.width / vh) * 2.04, h * 2.04, 1);

        const cu = cm.material.uniforms;
        const pu = pm.material.uniforms;
        for (const u of [cu, pu]) {
            u.uTime.value = t;
            u.uScroll.value = scroll;
            u.uLine.value = line;
            u.uVh.value = vh;
            u.uDpr.value = dpr;
            u.uRes.value.set(size.width * dpr, size.height * dpr);
        }
        cu.uTint.value.copy(pu.uTint.value);
        pu.uPx.value = dpr * Math.min(Math.max(vh / 900, 0.8), 1.4);
        pu.uAspect.value = size.width / vh;

        // the A lights the specks around it as it passes
        const w = wake.current;
        if (markRef?.current) {
            w.mark.setFromMatrixPosition(markRef.current.matrixWorld).project(camera);
            pu.uMark.value.set(w.mark.x, w.mark.y, 0.9);
        }

        // the cursor's wake: drop a glowing point every so often while it moves,
        // and let the old ones fade
        const dt = Math.min(raw, 0.05);
        const trail = pu.uTrail.value;
        if (reduced) {
            for (const p of trail) p.z = 0;
            return;
        }
        for (const p of trail) p.z = Math.max(0, p.z - dt / TRAIL_LIFE);
        w.at += dt;
        const ptr = frame.pointer;
        if (w.at >= TRAIL_EVERY && ptr.distanceTo(w.last) > 0.004) {
            w.at = 0;
            w.last.copy(ptr);
            trail[w.next].set(ptr.x, ptr.y, 1);
            w.next = (w.next + 1) % TRAIL;
        }
    });

    return (
        <>
            <mesh ref={caustics} position={[0, 0, CAUSTIC_Z]} renderOrder={-2} frustumCulled={false}>
                <planeGeometry />
                <shaderMaterial
                    uniforms={causticUniforms}
                    vertexShader={CAUSTIC_VERTEX}
                    fragmentShader={CAUSTIC_FRAGMENT}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
            {/* drawn after the underwater tint (renderOrder 10), so the specks stay bright; the A still hides them by depth */}
            <points ref={points} frustumCulled={false} renderOrder={11}>
                <bufferGeometry />
                <shaderMaterial
                    ref={planktonMat}
                    uniforms={planktonUniforms}
                    vertexShader={PLANKTON_VERTEX}
                    fragmentShader={PLANKTON_FRAGMENT}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>
        </>
    );
}
