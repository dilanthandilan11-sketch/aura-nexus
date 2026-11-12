// src/components/landing/LiquidRibbon.jsx
// The liquid around the glass A: one open stream of liquid chrome / cyan
// glass, rebuilt every frame so it really flows.
//
// - Path: an open S-curve (never a loop) through 11 control points, in the
//   A's own units (the A spans x ±0.92, y ±0.74, z ±0.31; +z is toward the
//   viewer). It enters top right, runs BEHIND the A, swings out on the left,
//   comes FORWARD below the A's base (never across its face) and runs out
//   low and toward the viewer on the right, so it reads as an S, not a ring.
// - The shape holds (it only breathes slightly); the LIQUID flows: swells
//   and fine fibres of light stream down its length, like light running
//   along strands.
// - Body: a flattened lens-shaped section whose width swells in bulges that
//   travel along the stream (the flow), twists slowly, thins at the ends, and
//   has a fine rippled surface.
// - Look: refracting cyan glass with strong studio reflections (drei
//   MeshTransmissionMaterial), plus a thin additive layer of light fibres
//   whose pulses stream along the length.
// - Droplets: now and then a single drop breaks off an edge, arcs and fades.
// - The cursor nudges the stream gently. Reduced motion: it holds still.
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

// ── Tuning ──────────────────────────────────────────────────────────────────
const ALONG = 200;          // rings along the stream
const AROUND = 18;          // points around each ring
const PATH = [              // control points, A units (see header)
    [2.05, 1.85, -1.10],
    [1.30, 1.10, -1.00],
    [0.62, 0.56, -1.05],
    [-0.25, 0.20, -1.10],
    [-1.02, 0.02, -0.58],
    [-1.40, -0.38, 0.12],
    [-1.16, -0.86, 0.74],
    [-0.42, -1.03, 0.95],
    [0.40, -1.02, 0.86],
    [1.10, -1.06, 1.05],
    [1.85, -1.22, 1.45],
];
const DRIFT = 0.016;        // how far control points wander (barely: the shape holds, the liquid flows)
const MOUSE = 0.035;        // how far the cursor pushes the stream
const FROZEN_TIME = 8;      // the moment shown with reduced motion
const DROPS = 4;            // droplets alive at once, at most

const smooth = (x) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

// The stream's half-width at u (0..1 along it) and time t: a base profile,
// bulges that travel toward the end (the flow), and thinning at both ends
// (the far end's thinning breathes, so the tail stretches and draws back)
function widthAt(u, t) {
    const base = 0.05 + 0.036 * Math.sin(u * Math.PI);
    const b1 = Math.pow(0.5 + 0.5 * Math.sin(u * 13.0 - t * 1.1), 3) * 0.045;
    const b2 = Math.pow(0.5 + 0.5 * Math.sin(u * 6.5 + 1.3 - t * 0.7), 2) * 0.026;
    const tail = 0.12 + 0.015 * Math.sin(t * 0.37);
    return (base + b1 + b2) * smooth(u / 0.07) * smooth((1 - u) / tail);
}
const twistAt = (u, t) => 0.9 * Math.sin(u * 4.2 + t * 0.04) + 0.35 * Math.sin(u * 9.5 - t * 0.06);

// Static parts of the mesh: indices and UVs (u along, v around)
export function createRibbonGeometry() {
    const rows = ALONG + 1, cols = AROUND + 1;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(rows * cols * 2);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        uv[(i * cols + j) * 2] = i / ALONG;
        uv[(i * cols + j) * 2 + 1] = j / AROUND;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < ALONG; i++) for (let j = 0; j < AROUND; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);   // it moves; never cull it
    return g;
}

// The highlights that slide along the stream (additive, very light)
const FLOW_VERTEX = /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
    }
`;
const FLOW_FRAGMENT = /* glsl */`
    uniform float uTime; uniform vec3 uTint;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
    void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0);
        // fine fibres running the length of the stream
        float fib = vUv.y * 30.0;
        float id = floor(fib);
        float line = pow(1.0 - abs(fract(fib) - 0.5) * 2.0, 6.0);
        // light pulses travelling down each fibre, each at its own pace
        float speed = 0.05 + hash(id) * 0.09;
        float ph = hash(id + 7.3);
        float p1 = pow(fract(vUv.x * 2.2 - uTime * speed + ph), 14.0);
        float p2 = pow(fract(vUv.x * 5.0 - uTime * speed * 1.7 + ph * 3.1), 22.0) * 0.6;
        float pulse = p1 + p2;
        // a soft sheen that slides along the whole stream
        float sheen = 0.5 + 0.5 * sin(vUv.x * 9.0 - uTime * 0.6);
        float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        vec3 fibres = mix(uTint, vec3(0.9, 1.0, 1.0), pulse) * line * (0.06 + pulse * 0.9);
        vec3 col = fibres + uTint * fres * (0.18 + 0.14 * sheen);
        gl_FragColor = vec4(col * ends, 1.0);
    }
`;

export default function LiquidRibbon({ geometry, materialRef, quality, reduced }) {
    const body = useRef(null);
    const flowMat = useRef(null);
    const drops = useRef(null);
    const work = useRef(null);
    const flowUniforms = useMemo(() => ({ uTime: { value: 0 }, uTint: { value: new THREE.Color("#5ff3ff") } }), []);

    useFrame((frame, raw) => {
        if (!work.current) {
            work.current = {
                pts: PATH.map((p) => new THREE.Vector3(...p)),
                curve: null,
                mouse: new THREE.Vector2(),
                ring: Array.from({ length: ALONG + 1 }, () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), w: new THREE.Vector3(), n: new THREE.Vector3(), width: 0 })),
                drops: Array.from({ length: DROPS }, (_, i) => ({ alive: false, next: 2 + i * 2.7, born: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0.02 })),
                tmp: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), s: new THREE.Vector3(),
            };
            work.current.curve = new THREE.CatmullRomCurve3(work.current.pts, false, "centripetal", 0.5);
        }
        const W = work.current;
        const dt = Math.min(raw, 1 / 20);
        const t = reduced ? FROZEN_TIME : frame.clock.elapsedTime;

        // 1. the path drifts (each point on its own slow waves) and leans away
        //    from the cursor
        if (!reduced) W.mouse.lerp(frame.pointer, 1 - Math.exp(-2.2 * dt));
        const last = PATH.length - 1;
        PATH.forEach((b, i) => {
            const endAmp = 1 + 0.7 * (i === 0 || i === last ? 1 : i === 1 || i === last - 1 ? 0.4 : 0);
            const side = i % 2 === 0 ? 1 : -0.6;
            W.pts[i].set(
                b[0] + (Math.sin(t * 0.31 + i * 1.7) * 0.6 + Math.sin(t * 0.53 + i * 0.9) * 0.4) * DRIFT * endAmp + W.mouse.x * MOUSE * side,
                b[1] + Math.sin(t * 0.27 + i * 2.3) * DRIFT * 0.8 * endAmp + W.mouse.y * MOUSE * 0.7 * side,
                b[2] + Math.sin(t * 0.22 + i * 1.1) * DRIFT * 1.1 * endAmp,
            );
        });
        // keep the forward passage below the A's base (it never crosses its face)
        for (let i = 6; i <= 8; i++) W.pts[i].y = Math.min(W.pts[i].y, -0.9);
        W.curve.updateArcLengths();

        // 2. a frame along the stream (parallel transport: no sudden flips)
        const frames = W.curve.computeFrenetFrames(ALONG, false);
        for (let i = 0; i <= ALONG; i++) {
            const u = i / ALONG;
            const R = W.ring[i];
            W.curve.getPointAt(u, R.p);
            R.t.copy(frames.tangents[i]);
            const tw = twistAt(u, t);
            const c = Math.cos(tw), s = Math.sin(tw);
            // width direction and thickness direction, twisted about the tangent
            R.w.copy(frames.normals[i]).multiplyScalar(c).addScaledVector(frames.binormals[i], s);
            R.n.copy(frames.binormals[i]).multiplyScalar(c).addScaledVector(frames.normals[i], -s);
            R.width = widthAt(u, t);
        }

        // 3. the surface: a lens-shaped section with a fine moving ripple
        const geo = body.current?.geometry;
        if (!geo) return;
        const pos = geo.attributes.position.array;
        const cols = AROUND + 1;
        for (let i = 0; i <= ALONG; i++) {
            const u = i / ALONG;
            const R = W.ring[i];
            const w = R.width, th = w * 0.5;
            for (let j = 0; j <= AROUND; j++) {
                const a = (j / AROUND) * Math.PI * 2;
                const ca = Math.cos(a), sa = Math.sin(a);
                const ripple = 1 + 0.06 * Math.sin(a * 3 + u * 64 - t * 2.4) + 0.05 * Math.sin(u * 29 - t * 1.6 + ca * 2);
                const x = Math.sign(ca) * Math.pow(Math.abs(ca), 0.85) * w * ripple;
                const y = sa * th * (0.55 + 0.45 * (1 - Math.pow(Math.abs(ca), 3))) * ripple;
                const k = (i * cols + j) * 3;
                pos[k] = R.p.x + R.w.x * x + R.n.x * y;
                pos[k + 1] = R.p.y + R.w.y * x + R.n.y * y;
                pos[k + 2] = R.p.z + R.w.z * x + R.n.z * y;
            }
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();

        // 4. the highlights slide along; tint follows the glass colour
        const fu = flowMat.current?.uniforms;
        if (fu) {
            fu.uTime.value = t;
            if (materialRef.current) fu.uTint.value.copy(materialRef.current.attenuationColor).multiplyScalar(1.4);
        }

        // 5. droplets: now and then one breaks off an edge, arcs, shrinks away
        const im = drops.current;
        if (im) {
            const now = frame.clock.elapsedTime;
            W.drops.forEach((d, idx) => {
                if (reduced) { d.alive = false; }
                else if (!d.alive && now > d.next) {
                    const i = Math.floor(ALONG * (0.2 + Math.random() * 0.7));
                    const R = W.ring[i];
                    const side = Math.random() < 0.5 ? -1 : 1;
                    d.p.copy(R.p).addScaledVector(R.w, R.width * side);
                    d.v.copy(R.t).multiplyScalar(0.18).addScaledVector(R.w, side * 0.22).add(W.tmp.set(0, 0.12, 0));
                    d.r = 0.012 + Math.random() * 0.016;
                    d.born = now;
                    d.alive = true;
                }
                let scale = 0;
                if (d.alive) {
                    const age = now - d.born;
                    if (age > 1.8) { d.alive = false; d.next = now + 2.5 + Math.random() * 4; }
                    else {
                        d.v.y -= 0.35 * dt;
                        d.p.addScaledVector(d.v, dt);
                        scale = d.r * Math.min(1, age * 6) * (1 - smooth((age - 1.1) / 0.7));
                    }
                }
                W.m.compose(d.p, W.q, W.s.setScalar(Math.max(scale, 1e-5)));
                im.setMatrixAt(idx, W.m);
            });
            im.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <group>
            <mesh ref={body} geometry={geometry} frustumCulled={false}>
                <MeshTransmissionMaterial
                    ref={materialRef}
                    samples={quality.liquidSamples}
                    resolution={quality.liquidResolution}
                    transmission={1}
                    thickness={0.25}
                    roughness={0}
                    ior={1.45}
                    chromaticAberration={0.06}
                    anisotropicBlur={0.05}
                    distortion={0.12}
                    distortionScale={0.6}
                    temporalDistortion={0.06}
                    clearcoat={1}
                    clearcoatRoughness={0.02}
                    specularIntensity={1}
                    attenuationDistance={2}
                    attenuationColor="#1aa8b8"
                    color="#e6fdff"
                    emissive="#078a98"
                    emissiveIntensity={0.1}
                    envMapIntensity={3.2}
                />
            </mesh>
            <mesh geometry={geometry} frustumCulled={false} renderOrder={3}>
                <shaderMaterial
                    ref={flowMat}
                    uniforms={flowUniforms}
                    vertexShader={FLOW_VERTEX}
                    fragmentShader={FLOW_FRAGMENT}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
            <instancedMesh ref={drops} args={[null, null, DROPS]} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 12]} />
                <meshPhysicalMaterial color="#c8fbff" metalness={0.85} roughness={0.04} clearcoat={1} envMapIntensity={2.6} />
            </instancedMesh>
        </group>
    );
}
