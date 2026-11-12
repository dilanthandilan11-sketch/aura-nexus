// src/components/landing/LightFlow.jsx
// One endless flow of light strands down the whole landing page, from above
// the header to below the footer (it has no visible start or end).
//
// - The flow belongs to the PAGE, not to the A: it is laid out in page
//   coordinates and scrolls with the content, like everything else on the
//   page. It never moves on its own.
// - Its path winds through the spot the A takes in every section (the same
//   poses the A eases to), so as you scroll the A travels along the stream,
//   which gathers into a tight bundle where the A sits and loosens between
//   sections. Around the A it passes well behind it (never through it);
//   between sections it swings forward.
// - What moves is only the light: pulses run down each strand toward the
//   footer, each at its own pace, and the strands sway like silk in a current.
//   While the page is scrolling the light runs faster (up to SCROLL_BOOST
//   times), easing back to its normal pace when scrolling stops.
// - Rebuilt whenever the page's layout changes (resize, fonts loading).
// - Reduced motion: the light holds still.
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { landing, POSES, NARROW } from "@/components/landing/landingStore";

const FOV = 28;
const CAMERA_Z = 11;
const SAMPLES_PER_UNIT = 15;      // points per world unit of path
const FROZEN_TIME = 6;
const BEHIND = 2.4;               // how far behind the A the flow passes (world units)
const FLOW_WIDTH = 1.5;           // half-width of the whole flow, world units (tighter where the A sits)
const SCROLL_BOOST = 18;          // how much faster the light runs while scrolling (at a brisk scroll)
const BOOST_EASE = 5;             // how quickly it speeds up / settles back (higher = quicker)

const smooth = (x) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };
function seeded(seed) {
    let n = seed;
    return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
}

// The control points of the flow, in world units (page top at y = halfH,
// one screen height = 2 * halfH)
function flowPoints(anchors, size, docHeight) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z;
    const halfW = halfH * (size.width / size.height);
    const vh = size.height;
    const narrow = size.width / size.height < 0.9;
    const wy = (pageY) => halfH - (pageY / vh) * 2 * halfH;
    const poseOf = (name) => {
        const p = POSES[name] ?? POSES.hero;
        return narrow ? { ...p, ...(name === "hero" ? NARROW.hero : NARROW.other) } : p;
    };
    const clampX = (x) => Math.max(-0.92, Math.min(0.92, x)) * halfW;
    const stops = anchors.map((a) => ({ ...poseOf(a.name), page: a.center }));
    const pts = [];
    const knots = [];
    // in from above the header, off to the right
    const first = stops[0];
    pts.push(new THREE.Vector3(clampX(first.x + 0.45), wy(-vh * 0.7), -1.2));
    pts.push(new THREE.Vector3(clampX(first.x + 0.3), wy(-vh * 0.15), -1.0));
    stops.forEach((s, i) => {
        // where the A sits in this section; the stream passes just behind it
        // well behind it: the A is about 1.2 deep and the sheaf has depth too
        const z = Math.max(-2.5, Math.min(0, s.z * 0.3)) - BEHIND;
        const p = new THREE.Vector3(s.x * halfW, wy(s.page) + s.y * halfH, z);
        pts.push(p);
        knots.push(p.clone());
        const next = stops[i + 1];
        if (next) {
            // between sections: an S that swings forward and out to the side
            const sway = i % 2 === 0 ? 0.32 : -0.32;
            const midX = (s.x + next.x) / 2 + sway;
            const page = (s.page + next.page) / 2;
            pts.push(new THREE.Vector3(clampX(midX), wy(page - vh * 0.12), -0.2));
            pts.push(new THREE.Vector3(clampX(midX - sway * 0.6), wy(page + vh * 0.12), -0.5));
        }
    });
    // out below the footer
    const last = stops[stops.length - 1];
    pts.push(new THREE.Vector3(clampX(last.x - 0.3), wy(docHeight + vh * 0.2), -1.0));
    pts.push(new THREE.Vector3(clampX(last.x - 0.45), wy(docHeight + vh * 0.8), -1.2));
    return { pts, knots, halfH };
}

// Frames that carry smoothly along the curve. Frenet frames flip over
// wherever the S changes direction, which twisted the whole sheaf there and
// made the flow look broken at every bend; these just roll along with it.
function transportFrames(curve, samples) {
    const tangents = [], normals = [], binormals = [];
    for (let i = 0; i <= samples; i++) tangents.push(curve.getTangentAt(i / samples).normalize());
    // start with the normal that points most across the screen
    const t0 = tangents[0];
    const n0 = new THREE.Vector3(0, 0, 1).cross(t0);
    if (n0.lengthSq() < 1e-6) n0.set(1, 0, 0);
    n0.normalize();
    normals.push(n0);
    binormals.push(new THREE.Vector3().crossVectors(t0, n0).normalize());
    const q = new THREE.Quaternion();
    for (let i = 1; i <= samples; i++) {
        q.setFromUnitVectors(tangents[i - 1], tangents[i]);
        const n = normals[i - 1].clone().applyQuaternion(q);
        // keep it square to the tangent
        n.addScaledVector(tangents[i], -n.dot(tangents[i])).normalize();
        normals.push(n);
        binormals.push(new THREE.Vector3().crossVectors(tangents[i], n).normalize());
    }
    return { tangents, normals, binormals };
}

function buildFlow(anchors, size, docHeight, strandCount) {
    const { pts, knots } = flowPoints(anchors, size, docHeight);
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
    const samples = Math.min(2400, Math.max(400, Math.round(curve.getLength() * SAMPLES_PER_UNIT)));
    const centre = Array.from({ length: samples + 1 }, (_, i) => curve.getPointAt(i / samples));
    const frames = transportFrames(curve, samples);
    // how loose the sheaf is at each point: tight where the A sits, loose between
    // and how strong: full around the A, a faint whisper where it crosses text
    const spreadAt = [], fadeAt = [];
    centre.forEach((c) => {
        let d = Infinity;
        for (const k of knots) d = Math.min(d, Math.hypot(c.x - k.x, c.y - k.y));
        spreadAt.push(FLOW_WIDTH * (0.3 + 0.7 * smooth(d / 3.2)));
        fadeAt.push(0.22 + 0.78 * (1 - smooth((d - 1.2) / 2.4)));
    });
    const rnd = seeded(4242);
    const verts = strandCount * (samples + 1) * 2;
    const pos = new Float32Array(verts * 3);
    const tan = new Float32Array(verts * 3);
    const wav = new Float32Array(verts * 3);
    const side = new Float32Array(verts);
    const along = new Float32Array(verts);
    const fade = new Float32Array(verts);
    const info = new Float32Array(verts * 4);      // id, width, brightness, soft
    const index = new Uint32Array(strandCount * samples * 6);
    const tmp = new THREE.Vector3(), w = new THREE.Vector3();
    let v = 0, ii = 0;
    for (let s = 0; s < strandCount; s++) {
        const soft = s >= strandCount - 10;           // the last few: wide, faint haze strands (the glow around the bundle)
        const id = rnd();
        const a = rnd() * 2 - 1;
        const b = (rnd() * 2 - 1) * 0.25;
        const drift = rnd() * 6.28;
        const width = soft ? 0.14 + rnd() * 0.12 : 0.014 + Math.pow(rnd(), 2.2) * 0.03;
        const bright = soft ? 0.06 + rnd() * 0.05 : 0.35 + Math.pow(rnd(), 1.5) * 0.65;
        const first = v;
        for (let i = 0; i <= samples; i++) {
            const u = i / samples;
            const sp = spreadAt[i];
            // each strand drifts across the sheaf only in long, gentle arcs (no little kinks)
            const aa = a + 0.22 * Math.sin(u * 9.0 + drift);
            const bb = b + 0.06 * Math.cos(u * 6.0 + drift * 1.3);
            tmp.copy(centre[i]).addScaledVector(frames.normals[i], aa * sp).addScaledVector(frames.binormals[i], bb * sp);
            w.copy(frames.normals[i]).multiplyScalar(Math.cos(drift)).addScaledVector(frames.binormals[i], Math.sin(drift));
            // sway only across the screen, never in and out of it
            w.z = 0;
            if (w.lengthSq() > 1e-6) w.normalize();
            const t = frames.tangents[i];
            for (let e = 0; e < 2; e++) {
                pos[v * 3] = tmp.x; pos[v * 3 + 1] = tmp.y; pos[v * 3 + 2] = tmp.z;
                tan[v * 3] = t.x; tan[v * 3 + 1] = t.y; tan[v * 3 + 2] = t.z;
                wav[v * 3] = w.x; wav[v * 3 + 1] = w.y; wav[v * 3 + 2] = w.z;
                side[v] = e === 0 ? -1 : 1;
                along[v] = u;
                fade[v] = fadeAt[i];
                info[v * 4] = id; info[v * 4 + 1] = width; info[v * 4 + 2] = bright; info[v * 4 + 3] = soft ? 1 : 0;
                v++;
            }
        }
        for (let i = 0; i < samples; i++) {
            const a0 = first + i * 2;
            index[ii++] = a0; index[ii++] = a0 + 1; index[ii++] = a0 + 2;
            index[ii++] = a0 + 1; index[ii++] = a0 + 3; index[ii++] = a0 + 2;
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aTangent", new THREE.BufferAttribute(tan, 3));
    g.setAttribute("aWave", new THREE.BufferAttribute(wav, 3));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    g.setAttribute("aU", new THREE.BufferAttribute(along, 1));
    g.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
    g.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    // pulses should run at the same speed in world units whatever the length
    g.userData.length = curve.getLength();
    return g;
}

const VERTEX = /* glsl */`
    uniform float uTime; uniform vec2 uMouse; uniform float uLength;
    attribute vec3 aTangent; attribute vec3 aWave; attribute float aSide; attribute float aU; attribute vec4 aInfo; attribute float aFade;
    varying float vSide; varying float vDist; varying vec4 vInfo; varying float vU; varying float vFade;
    void main() {
        vFade = aFade;
        float id = aInfo.x;
        float d = aU * uLength;                       // distance along the flow, world units
        // a slow silky sway: a wave that travels down the strand
        // one long, slow wave: smooth arcs, no little bends
        float sway = sin(d * 0.28 - uTime * 0.3 + id * 40.0) * 0.06;
        vec3 p = position + aWave * sway;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        mv.xy += uMouse * 0.06 * smoothstep(9.0, 0.0, length(mv.xy));   // the cursor nudges what is on screen
        vec4 mv2 = modelViewMatrix * vec4(p + aTangent * 0.02, 1.0);
        vec3 t = normalize(mv2.xyz - mv.xyz);
        vec3 sideDir = normalize(cross(t, normalize(-mv.xyz)));
        mv.xyz += sideDir * aSide * aInfo.y;
        vSide = aSide; vDist = d; vInfo = aInfo; vU = aU;
        gl_Position = projectionMatrix * mv;
    }
`;

const FRAGMENT = /* glsl */`
    uniform float uFlow; uniform vec3 uTint; uniform float uOpacity;
    varying float vSide; varying float vDist; varying vec4 vInfo; varying float vU; varying float vFade;
    float hash(float n) { return fract(sin(n * 91.7) * 43758.5453); }
    void main() {
        float id = vInfo.x;
        float soft = vInfo.w;
        float x2 = vSide * vSide;
        // a thin, hot core inside a soft halo (haze strands: halo only)
        float core = exp(-x2 * 16.0);
        float halo = exp(-x2 * 2.2);
        float shape = soft > 0.5 ? halo : core + halo * 0.28;
        // light gliding down the strand: long soft bands, plus a brighter
        // streak now and then (each strand at its own pace)
        float speed = 0.5 + hash(id) * 0.7;
        float band = pow(0.5 + 0.5 * sin(vDist * 0.55 - uFlow * speed * 0.9 + id * 40.0), 3.0);
        float streak = pow(fract(vDist * 0.12 - uFlow * speed * 0.12 + id * 7.0), 18.0);
        float glow = 0.45 + 0.75 * band + 1.6 * streak * (1.0 - soft);
        float ends = smoothstep(0.0, 0.03, vU) * smoothstep(1.0, 0.97, vU);
        // colour: the tint deepening toward blue on some strands, white-hot where the light is brightest
        vec3 hue = mix(uTint, vec3(0.12, 0.45, 1.0), hash(id + 2.0) * 0.45);
        vec3 col = mix(hue, vec3(0.9, 1.0, 1.0), clamp(core * (band * 0.35 + streak), 0.0, 1.0));
        float a = shape * ends * vFade * vInfo.z * glow * uOpacity;
        gl_FragColor = vec4(col * a * 1.25, 1.0);
    }
`;

export default function LightFlow({ materialRef, reduced }) {
    const { size } = useThree();
    const mesh = useRef(null);
    const layout = useRef("");
    const speed = useRef({ lastY: null, boost: 0 });   // the light's speed-up while scrolling
    const uniforms = useMemo(() => ({
        uTime: { value: 0 }, uFlow: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uLength: { value: 1 },
        uTint: { value: new THREE.Color("#5ff3ff") }, uOpacity: { value: 1 },
    }), []);
    const narrow = size.width / size.height < 0.9;
    const strands = narrow ? 60 : 110;         // a dense sheaf, like the reference

    // free the last geometry when leaving the page
    useEffect(() => () => mesh.current?.geometry?.dispose(), []);

    useFrame((frame, raw) => {
        const m = mesh.current;
        if (!m) return;
        // (re)build when the page layout changes
        const anchors = landing.anchors;
        const docH = document.documentElement.scrollHeight;
        if (anchors.length) {
            const key = `${size.width}x${size.height}|${docH}|${anchors.map((a) => Math.round(a.center)).join(",")}`;
            if (key !== layout.current) {
                layout.current = key;
                const old = m.geometry;
                m.geometry = buildFlow(anchors, size, docH, strands);
                old?.dispose();
                m.material.uniforms.uLength.value = m.geometry.userData.length;
            }
        }
        // the flow scrolls with the page (one screen = 2 * halfH)
        const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z;
        m.position.y = (window.scrollY / Math.max(size.height, 1)) * 2 * halfH;
        const u = m.material.uniforms;
        u.uTime.value = reduced ? FROZEN_TIME : frame.clock.elapsedTime;
        // the light runs faster while the page is scrolling, and settles back
        // to its normal pace once scrolling stops
        if (!reduced) {
            const dt = Math.min(raw, 0.05);
            const sp = speed.current;
            const y = window.scrollY;
            const vel = sp.lastY == null || dt === 0 ? 0 : Math.abs(y - sp.lastY) / dt / Math.max(size.height, 1);   // screens per second
            sp.lastY = y;
            const want = Math.min(vel, 1.5) / 1.5 * SCROLL_BOOST;
            sp.boost += (want - sp.boost) * (1 - Math.exp(-BOOST_EASE * dt));
            u.uFlow.value += dt * (1 + sp.boost);
        } else {
            u.uFlow.value = FROZEN_TIME;
        }
        if (!reduced) u.uMouse.value.lerp(frame.pointer, 1 - Math.exp(-2 * Math.min(raw, 0.05)));
    });

    return (
        <mesh ref={mesh} frustumCulled={false} renderOrder={3}>
            <bufferGeometry />
            <shaderMaterial
                ref={materialRef}
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
