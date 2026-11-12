// src/components/landing/LightStrands.jsx
// The flow around the glass A: a sheaf of fine strands of light that weave
// around it. The strands hold their place; what moves is the light running
// along them, and a slow silky undulation, like strands in a current.
//
// - Path: the same open S as before, in the A's own units (the A spans
//   x ±0.92, y ±0.74, z ±0.31; +z toward the viewer): in from the top right,
//   BEHIND the A, out on the left, FORWARD below the A's base (never across
//   its face) and out low on the right.
// - The sheaf gathers into a tight, bright bundle where it swings round on
//   the left and fans out toward both ends.
// - Each strand is a camera-facing ribbon a few pixels wide, built once; the
//   vertex shader makes it undulate and the fragment shader runs pulses of
//   light down it, each strand at its own pace. Additive, so it glows with
//   the bloom.
// - A handful of wider, fainter strands give the sheaf some volume.
// - Reduced motion: everything holds still.
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Tuning ──────────────────────────────────────────────────────────────────
const PATH = [
    [2.05, 1.85, -1.10],
    [1.30, 1.10, -1.00],
    [0.62, 0.56, -1.05],
    [-0.25, 0.20, -1.10],
    [-1.02, 0.02, -0.58],
    [-1.40, -0.38, 0.12],
    [-1.16, -0.92, 0.74],
    [-0.42, -1.05, 0.95],
    [0.40, -1.04, 0.86],
    [1.10, -1.08, 1.05],
    [1.85, -1.24, 1.45],
];
const STRANDS = 72;            // fine strands
const SOFT = 8;                // wide, faint strands (volume)
const SAMPLES = 180;           // points along each strand
const KNOT = 0.52;             // where along the path the sheaf is tightest
const FROZEN_TIME = 6;

const smooth = (x) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

// A fixed, seeded random sequence: the same sheaf on every load
function seeded(seed) {
    let n = seed;
    return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
}

function buildSheaf() {
    const curve = new THREE.CatmullRomCurve3(PATH.map((p) => new THREE.Vector3(...p)), false, "centripetal", 0.5);
    const frames = curve.computeFrenetFrames(SAMPLES, false);
    const centre = Array.from({ length: SAMPLES + 1 }, (_, i) => curve.getPointAt(i / SAMPLES));
    const rnd = seeded(4242);
    const total = STRANDS + SOFT;
    const verts = total * (SAMPLES + 1) * 2;
    const pos = new Float32Array(verts * 3);
    const tan = new Float32Array(verts * 3);
    const wav = new Float32Array(verts * 3);      // direction the strand sways in
    const side = new Float32Array(verts);
    const along = new Float32Array(verts);
    const info = new Float32Array(verts * 4);     // id, width, brightness, soft
    const index = [];
    const tmp = new THREE.Vector3();
    let v = 0;
    for (let s = 0; s < total; s++) {
        const soft = s >= STRANDS;
        const id = rnd();
        // where the strand sits in the sheaf's cross-section
        const a = (rnd() * 2 - 1);
        const b = (rnd() * 2 - 1) * 0.45;
        const drift = rnd() * 6.28;
        const width = soft ? 0.03 + rnd() * 0.03 : 0.0035 + Math.pow(rnd(), 2) * 0.009;
        const bright = soft ? 0.05 + rnd() * 0.04 : 0.25 + rnd() * 0.75;
        // strands start and end at slightly different points (ragged ends)
        const u0 = rnd() * 0.08, u1 = 1 - rnd() * 0.1;
        const first = v;
        for (let i = 0; i <= SAMPLES; i++) {
            const u = u0 + (u1 - u0) * (i / SAMPLES);
            const k = Math.min(SAMPLES, Math.round(u * SAMPLES));
            const spread = 0.035 + 0.24 * Math.pow(Math.abs(u - KNOT) / KNOT, 1.25);
            // each strand wanders a little across the sheaf along its length
            const aa = a + 0.28 * Math.sin(u * 5.0 + drift);
            const bb = b + 0.2 * Math.cos(u * 3.5 + drift * 1.3);
            tmp.copy(centre[k])
                .addScaledVector(frames.normals[k], aa * spread)
                .addScaledVector(frames.binormals[k], bb * spread);
            for (let e = 0; e < 2; e++) {
                pos.set([tmp.x, tmp.y, tmp.z], v * 3);
                tan.set([frames.tangents[k].x, frames.tangents[k].y, frames.tangents[k].z], v * 3);
                const w = frames.normals[k].clone().multiplyScalar(Math.cos(drift)).addScaledVector(frames.binormals[k], Math.sin(drift));
                wav.set([w.x, w.y, w.z], v * 3);
                side[v] = e === 0 ? -1 : 1;
                along[v] = u;
                info.set([id, width, bright, soft ? 1 : 0], v * 4);
                v++;
            }
        }
        for (let i = 0; i < SAMPLES; i++) {
            const a0 = first + i * 2;
            index.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aTangent", new THREE.BufferAttribute(tan, 3));
    g.setAttribute("aWave", new THREE.BufferAttribute(wav, 3));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    g.setAttribute("aU", new THREE.BufferAttribute(along, 1));
    g.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5);
    return g;
}

const VERTEX = /* glsl */`
    uniform float uTime;
    uniform vec2 uMouse;
    attribute vec3 aTangent; attribute vec3 aWave; attribute float aSide; attribute float aU; attribute vec4 aInfo;
    varying float vSide; varying float vU; varying vec4 vInfo;
    void main() {
        float id = aInfo.x;
        // a slow silky sway, a wave that travels along the strand
        float sway = sin(aU * 9.0 - uTime * 0.45 + id * 40.0) * 0.022 + sin(aU * 21.0 - uTime * 0.8 + id * 17.0) * 0.007;
        vec3 p = position + aWave * sway;
        p.xy += uMouse * 0.03 * sin(aU * 3.14159);              // the cursor nudges the middle of the sheaf
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 mv2 = modelViewMatrix * vec4(p + aTangent * 0.01, 1.0);
        vec3 t = normalize(mv2.xyz - mv.xyz);
        vec3 sideDir = normalize(cross(t, normalize(-mv.xyz)));
        // scale-aware width (the group is scaled to fit the screen)
        float scale = length(modelViewMatrix[0].xyz);
        mv.xyz += sideDir * aSide * aInfo.y * scale;
        vSide = aSide; vU = aU; vInfo = aInfo;
        gl_Position = projectionMatrix * mv;
    }
`;

const FRAGMENT = /* glsl */`
    uniform float uTime; uniform vec3 uTint; uniform float uOpacity;
    varying float vSide; varying float vU; varying vec4 vInfo;
    float hash(float n) { return fract(sin(n * 91.7) * 43758.5453); }
    void main() {
        float id = vInfo.x;
        float soft = vInfo.w;
        // bright core, soft edges
        float core = exp(-vSide * vSide * (soft > 0.5 ? 2.5 : 5.0));
        // pulses of light running down the strand, each at its own pace
        float speed = 0.06 + hash(id) * 0.1;
        float p1 = pow(fract(vU * 1.6 - uTime * speed + id * 7.0), 10.0);
        float p2 = pow(fract(vU * 4.0 - uTime * speed * 1.8 + id * 3.0), 24.0) * 0.5;
        float pulse = (p1 + p2) * (1.0 - soft);
        // fade in at the start and out at the end of each strand
        float ends = smoothstep(0.0, 0.1, vU) * smoothstep(1.0, 0.86, vU);
        // brighter where the sheaf gathers
        float knot = 0.55 + 0.6 * exp(-pow((vU - ${KNOT.toFixed(2)}) / 0.16, 2.0));
        // each strand a slightly different hue: cyan to blue to mint
        vec3 hue = mix(uTint, uTint.zyx * vec3(0.6, 0.9, 1.1), hash(id + 2.0) * 0.35);
        vec3 col = mix(hue, vec3(0.85, 1.0, 1.0), clamp(pulse, 0.0, 1.0) * 0.6);
        float a = core * ends * knot * (vInfo.z * 0.22 + pulse * 1.0) * uOpacity;
        gl_FragColor = vec4(col * a, 1.0);
    }
`;

export default function LightStrands({ materialRef, reduced, opacity = 1, renderOrder = 3 }) {
    const geometry = useMemo(() => buildSheaf(), []);
    const uniforms = useMemo(() => ({
        uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() },
        uTint: { value: new THREE.Color("#5ff3ff") }, uOpacity: { value: opacity },
    }), [opacity]);
    const own = useRef(null);
    const mat = materialRef ?? own;
    useFrame((frame, raw) => {
        const u = mat.current?.uniforms;
        if (!u) return;
        u.uTime.value = reduced ? FROZEN_TIME : frame.clock.elapsedTime;
        if (!reduced) u.uMouse.value.lerp(frame.pointer, 1 - Math.exp(-2 * Math.min(raw, 0.05)));
    });
    return (
        <mesh geometry={geometry} frustumCulled={false} renderOrder={renderOrder}>
            <shaderMaterial
                ref={mat}
                uniforms={uniforms}
                vertexShader={VERTEX}
                fragmentShader={FRAGMENT}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
            />
        </mesh>
    );
}
