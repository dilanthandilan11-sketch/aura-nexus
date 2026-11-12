// scene/GridFloor.jsx
// Holographic perspective grid floor for the landing hero.
//
// A single screen-filling quad with a custom shader: every pixel below the
// horizon casts a ray from a virtual eye that looks perfectly level, hits a
// flat ground plane, and draws the grid at that ground position. That gives
// real perspective (lines converge on a vanishing point, rows bunch up toward
// the horizon) while letting the horizon sit at a fixed height on screen
// (HORIZON_FROM_TOP) on every viewport, without moving the 3D camera or the
// logo.
//
// Look: near-black navy surface, extremely thin muted electric-blue / cyan
// lines with occasional faint violet accents, soft blurred streaks of the
// aurora colours reflected near the horizon and under the logo, a dark
// vignette toward the bottom corners, and a soft horizon that melts into
// space (no hard line).
//
// Electric runs: every so often a bolt of light runs along the grid lines,
// zigzagging from a random intersection to another (bright head with a
// flicker, a fading tail, a small flash where it starts and where it ends).
// Up to MAX_BOLTS at once; each one waits a random gap before the next.
// The paths live in the floor's own grid coordinates, so they drift with the
// tiles, follow the warp and turn with the scene.
//
// The quad sits a fixed distance in front of the camera, so the logo (closer)
// renders in front of it and the aurora (farther) is hidden below the horizon.
// Landing only: fades out as soon as the user scrolls.
"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { holdState } from "@/components/scene/molten/holdState";

// ── Tuning ──────────────────────────────────────────────────────────────────
const HORIZON_FROM_TOP = 0.77;  // horizon height: fraction of the viewport from the top
const QUAD_DISTANCE    = 15;    // world distance of the quad (logo ~6, aurora ~26)
const EYE_HEIGHT       = 1.0;   // virtual eye height above the ground
const CELL_WIDTH       = 2.2;   // ground units between longitudinal lines
const CELL_DEPTH       = 3.0;   // ground units between horizontal lines (tiles: rectangles)
const LINE_STRENGTH    = 0.55;  // line brightness (kept below the Bloom threshold)
const REFLECTION       = 0.45;  // strength of the aurora / logo reflections

// Electric runs
const MAX_BOLTS   = 3;           // at most this many at once
const MAX_POINTS  = 8;           // corners per path (start + up to 7 turns)
const RUN_SECONDS = [1.0, 2.0];  // how long the head takes to run the path
const GAP_SECONDS = [0.4, 2.4];  // pause before a slot sends its next bolt
const NEAR_FAR    = [9, 26];     // where bolts start: ground distance ahead of the eye

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    precision highp float;
    varying vec2 vUv;

    uniform float uAspect;
    uniform float uHorizon;      // horizon height from the bottom (0..1), for the vignette
    uniform float uFocal;        // 1 / tan(fov/2)
    uniform float uEye;          // eye height above the ground
    uniform float uPitch;        // base upward pitch that puts the horizon at uHorizon
    uniform mat3  uInvRot;       // inverse of the scene's mouse rotation
    uniform float uPivot;        // camera distance to the rotation pivot (the logo)
    uniform vec2  uCell;
    uniform float uLine;
    uniform float uRefl;
    uniform float uTime;
    uniform float uOpacity;
    // press-and-hold warp (same values that drive the nebula / aurora warp)
    uniform float uHold;
    uniform float uPress;
    uniform float uFlow;
    uniform vec2  uMouse;        // cursor, screen uv 0..1

    // electric runs (see Bolts in the component)
    #define MAX_BOLTS ${MAX_BOLTS}
    #define MAX_POINTS ${MAX_POINTS}
    uniform vec2 uBoltPts[MAX_BOLTS * MAX_POINTS];  // path corners, grid units
    uniform vec4 uBoltInfo[MAX_BOLTS];  // x: corners, y: head (along path), z: tail length, w: path length
    uniform vec4 uBoltFx[MAX_BOLTS];    // x: start flash, y: end flash, z: head flicker, w: alive
    uniform vec2 uBoltHead[MAX_BOLTS];  // where the head is, grid units

    const vec3 BASE    = vec3(0.010, 0.010, 0.010);  // black floor
    // grid lines in the logo's marble teal (same hue the marble shader
    // derives from its tint #1a4e4d): mid tone, every 6th line the bright tone
    const vec3 LINE    = vec3(0.006, 0.80, 0.77);
    const vec3 LINE_HI = vec3(0.20, 1.00, 0.97);
    const vec3 BLUE    = vec3(0.10, 0.28, 0.85);     // muted electric blue
    const vec3 CYAN    = vec3(0.00, 0.83, 1.00);     // #00D4FF
    const vec3 VIOLET  = vec3(0.45, 0.22, 0.95);
    const vec3 MAGENTA = vec3(0.85, 0.15, 0.65);

    float hash(float n) { return fract(sin(n) * 43758.5453); }
    float noise1(float x) {
        float i = floor(x), f = fract(x);
        return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
    }

    // Electric runs. g: grid position of this pixel; fw: grid units per pixel.
    // Distances are measured in pixels so the bolt stays thin at any depth.
    vec3 bolts(vec2 g, vec2 fw) {
        vec3 acc = vec3(0.0);
        for (int b = 0; b < MAX_BOLTS; b++) {
            vec4 info = uBoltInfo[b];
            vec4 fx = uBoltFx[b];
            if (fx.w < 0.5) continue;

            // nearest point of the path, and how far along the path it is
            float best = 1e9, bestS = 0.0, s0 = 0.0;
            for (int i = 0; i < MAX_POINTS - 1; i++) {
                if (float(i) >= info.x - 1.0) break;
                vec2 a = uBoltPts[b * MAX_POINTS + i];
                vec2 c = uBoltPts[b * MAX_POINTS + i + 1];
                vec2 ab = c - a;
                float L = max(length(ab), 1e-4);
                float h = clamp(dot(g - a, ab) / (L * L), 0.0, 1.0);
                float dp = length((g - a - ab * h) / fw);
                if (dp < best) { best = dp; bestS = s0 + h * L; }
                s0 += L;
            }

            // lit between the head and the end of its tail
            float behind = info.y - bestS;
            float lit = step(0.0, behind) * (1.0 - smoothstep(0.0, info.z, behind));
            lit *= lit;
            float core = exp(-best * best / 0.9);          // ~1 px bright core
            float glow = exp(-best / 2.2);                 // tight glow around it
            acc += (vec3(0.80, 1.00, 0.98) * core * 1.25 + LINE_HI * glow * 0.22) * lit;

            // the head: a flickering spark (only while it is still on the path)
            float onPath = step(info.y, info.w);
            float dh = length((g - uBoltHead[b]) / fw);
            acc += vec3(0.90, 1.00, 1.00) * exp(-dh * dh / 7.0) * 1.3 * fx.z * onPath;

            // a small flash where it starts and where it ends
            float ds = length((g - uBoltPts[b * MAX_POINTS]) / fw);
            int last = int(info.x) - 1;
            vec2 endP = uBoltPts[b * MAX_POINTS];
            for (int i = 1; i < MAX_POINTS; i++) { if (i == last) endP = uBoltPts[b * MAX_POINTS + i]; }
            float de = length((g - endP) / fw);
            acc += LINE_HI * exp(-ds * ds / 60.0) * 0.9 * fx.x;
            acc += LINE_HI * exp(-de * de / 60.0) * 0.9 * fx.y;
        }
        return acc;
    }

    // thin anti-aliased line at every integer of v; w = width in pixels
    float gridLine(float v, float w) {
        float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-5);
        return 1.0 - smoothstep(0.0, w, d);
    }

    void main() {
        // view ray through this pixel
        // ── press-and-hold pull: same screen-space mapping as the nebula
        // warp, so the floor bends outward from the logo together with the
        // background (mostly sideways, long streaks along the pull)
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        {
            float h = uHold;
            vec2 m  = (uMouse - 0.5) * vec2(uAspect, 1.0);
            vec2 dm = p - m;
            float mInf = exp(-dot(dm, dm) / 0.03);
            p -= normalize(dm + 1e-5) * mInf * 0.06 * (uPress * 0.6 + h);

            // floor version: pulled sideways like the nebula, but only a
            // light vertical squeeze so the floor never collapses into the horizon
            float ax = abs(p.x);
            p.x /= 1.0 + h * 0.9 * smoothstep(0.0, 0.9, ax);
            p.x /= 1.0 + h * 0.6 * smoothstep(0.02, 0.35, ax);
            p.y /= 1.0 + h * 0.12;
        }
        float nx = p.x * 2.0;
        float ny = p.y * 2.0;
        vec3 dir = normalize(vec3(nx / uFocal, ny / uFocal, -1.0));

        // tilt the floor's eye up a little so the horizon sits low on screen
        float cp = cos(uPitch), sp = sin(uPitch);
        dir = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);

        // the whole scene turns with the mouse around the logo: turning the
        // world by R is the same as turning the eye by R^-1, so the floor
        // rotates in 3D together with everything else
        vec3 eye = uInvRot * vec3(0.0, 0.0, uPivot);
        dir = uInvRot * dir;

        // above the horizon: nothing
        if (dir.y >= -1e-4) discard;
        float t = (-uEye - (eye.y)) / dir.y;            // hit the ground plane y = -uEye
        if (t <= 0.0) discard;
        vec3 hit = eye + dir * t;
        float dist = t;
        float below = -dir.y * uFocal;                  // ~screen distance below the horizon

        // grid coordinates on the ground (tiles slowly drift toward the viewer)
        // while held, the floor rushes toward the viewer (warp speed)
        vec2 g = vec2(hit.x / uCell.x, (hit.z + uTime * 0.35 + uFlow * 9.0) / uCell.y);

        // thin lines; fade them out where they bunch up near the horizon
        float lx = gridLine(g.x, 1.0);
        float lz = gridLine(g.y, 1.0);
        float crowdX = 1.0 - smoothstep(0.25, 0.6, fwidth(g.x));
        float crowdZ = 1.0 - smoothstep(0.25, 0.6, fwidth(g.y));
        lx *= crowdX; lz *= crowdZ;

        // every 6th line slightly brighter (black & white floor)
        float vx = step(5.5, mod(floor(g.x + 0.5), 6.0));
        float vz = step(5.5, mod(floor(g.y + 0.5), 6.0));

        vec3 col = BASE;
        float lineBoost = 1.0 + uHold * 0.6;            // lines energise a little while held
        col += mix(LINE, LINE_HI, vx * 0.6) * lx * uLine * lineBoost;
        col += mix(LINE, LINE_HI, vz * 0.6) * lz * uLine * 0.85 * lineBoost;

        // distance haze: lines and floor dim as they recede
        float haze = exp(-dist * 0.045);
        col = mix(BASE * 0.6, col, haze);

        // electric runs, dimming with distance like the lines
        col += bolts(g, max(fwidth(g), vec2(1e-5))) * mix(0.35, 1.0, haze) * min(crowdX, crowdZ) * uLine * 1.6;

        // ── soft blurred reflections of the aurora ──────────────────────
        // vertical streaks of colour (reflections stretch toward the viewer),
        // brightest right under the horizon, fading toward the camera
        float sx = atan(dir.x, -dir.z) * 3.0;          // world direction: streaks turn with the scene
        float b1 = noise1(sx * 3.2 + uTime * 0.05);
        float b2 = noise1(sx * 5.1 - uTime * 0.04 + 7.0);
        float b3 = noise1(sx * 2.3 + 13.0);
        vec3 aur = CYAN * smoothstep(0.55, 0.95, b1)
                 + VIOLET * smoothstep(0.5, 0.95, b2) * 0.9
                 + MAGENTA * smoothstep(0.62, 0.98, b3) * 0.6
                 + vec3(0.06);                  // faint neutral sheen (was a flat blue wash)
        float nearHorizon = exp(-below * 6.0);          // strongest at the horizon
        col += aur * nearHorizon * uRefl * 0.55 * (1.0 + uHold * 0.8);

        // glow pool directly under the logo (centre), stretched downward
        float ang = atan(dir.x, -dir.z);               // 0 = straight toward the logo
        float pool = exp(-ang * ang / 0.012) * exp(-below * 2.2);
        col += vec3(0.85, 0.90, 0.95) * pool * uRefl * 0.5 * (1.0 + uHold * 1.2);   // soft white reflection of the logo

        // soft vignette: darker toward the bottom corners (and a touch at the
        // very bottom edge)
        float corner = smoothstep(0.22, 0.62, abs(vUv.x - 0.5)) * smoothstep(uHorizon * 0.8, 0.0, vUv.y);
        col *= 1.0 - 0.7 * corner;
        col *= mix(0.65, 1.0, smoothstep(0.0, uHorizon * 0.6, vUv.y));

        // horizon: melt into space instead of a hard edge (floor fades in
        // just below the horizon, with a faint blue haze)
        float edge = smoothstep(0.0, 0.07, below);
        col += vec3(0.10) * exp(-below * 18.0) * 0.6;   // neutral grey haze

        gl_FragColor = vec4(col, edge * uOpacity);
        #include <colorspace_fragment>
    }
`;

const rand = ([a, b]) => a + Math.random() * (b - a);
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// A new path: start on a grid intersection somewhere on the visible floor,
// then run 3-7 straight stretches of 1-3 cells, turning at intersections
// (alternating sideways / along), staying roughly on screen.
function spawnBolt(s, t, drift, eyeZ, halfW) {
    const gyOf = (dist) => (eyeZ - dist + drift) / CELL_DEPTH;   // grid row at a ground distance
    const dist = rand(NEAR_FAR);
    const gx0 = Math.round(rand([-1, 1]) * dist * halfW * 0.7 / CELL_WIDTH);
    const gy0 = Math.round(gyOf(dist));
    const gyNear = gyOf(NEAR_FAR[0] - 2), gyFar = gyOf(NEAR_FAR[1] + 6);   // near has the larger row

    s.n = randInt(4, MAX_POINTS);
    s.pts[0].set(gx0, gy0);
    let sideways = Math.random() < 0.5;
    let total = 0;
    for (let i = 1; i < s.n; i++) {
        const prev = s.pts[i - 1];
        let step = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
        if (sideways) {
            const depth = eyeZ + drift - prev.y * CELL_DEPTH;            // ground distance of this row
            const limit = Math.max(1, Math.floor(depth * halfW * 0.85 / CELL_WIDTH));
            if (Math.abs(prev.x + step) > limit) step = -step;
            s.pts[i].set(prev.x + step, prev.y);
        } else {
            if (prev.y + step > gyNear || prev.y + step < gyFar) step = -step;
            s.pts[i].set(prev.x, prev.y + step);
        }
        total += Math.abs(step);
        s.lens[i] = total;
        sideways = !sideways;
    }
    s.total = total;
    const runFor = rand(RUN_SECONDS);
    s.speed = total / runFor;
    s.tail = Math.min(total * 0.5, 3.5);
    s.born = t;
    s.reachedAt = -1;
    s.alive = true;
}

// The point `d` along a bolt's path (grid units) -> out
function pointAlong(s, d, out) {
    for (let i = 1; i < s.n; i++) {
        if (d <= s.lens[i] || i === s.n - 1) {
            const segStart = s.lens[i - 1] || 0;
            const segLen = Math.max(s.lens[i] - segStart, 1e-6);
            const k = Math.min(Math.max((d - segStart) / segLen, 0), 1);
            out.copy(s.pts[i - 1]).lerp(s.pts[i], k);
            return out;
        }
    }
    return out.copy(s.pts[0]);
}

export default function GridFloor({ scrollRef = null, rotationRef = null }) {
    const meshRef = useRef();
    const { camera, scene, size } = useThree();

    // Undo anything the previous floor version left on the shared scene/camera
    // (fog, camera lift/tilt) so this floor never changes the existing framing.
    useEffect(() => {
        scene.fog = null;
        camera.position.y = 0;
        camera.rotation.set(0, 0, 0);
    }, [scene, camera]);

    const uniforms = useMemo(() => ({
        uAspect:  { value: 1 },
        uHorizon: { value: 1 - HORIZON_FROM_TOP },
        uFocal:   { value: 1 },
        uEye:     { value: EYE_HEIGHT },
        uCell:    { value: new THREE.Vector2(CELL_WIDTH, CELL_DEPTH) },
        uLine:    { value: LINE_STRENGTH },
        uRefl:    { value: REFLECTION },
        uTime:    { value: 0 },
        uOpacity: { value: 1 },
        uPitch:   { value: 0 },
        uInvRot:  { value: new THREE.Matrix3() },
        uPivot:   { value: 6 },
        uHold:    { value: 0 },
        uPress:   { value: 0 },
        uFlow:    { value: 0 },
        uMouse:   { value: new THREE.Vector2(0.5, 0.5) },
        uBoltPts:  { value: Array.from({ length: MAX_BOLTS * MAX_POINTS }, () => new THREE.Vector2()) },
        uBoltInfo: { value: Array.from({ length: MAX_BOLTS }, () => new THREE.Vector4()) },
        uBoltFx:   { value: Array.from({ length: MAX_BOLTS }, () => new THREE.Vector4()) },
        uBoltHead: { value: Array.from({ length: MAX_BOLTS }, () => new THREE.Vector2()) },
    }), []);
    // One slot per possible bolt; each starts after its own random wait
    const slots = useMemo(() => Array.from({ length: MAX_BOLTS }, (_, i) => ({
        alive: false,
        nextAt: 0.6 + i * 0.9 + Math.random() * 1.5,
        pts: Array.from({ length: MAX_POINTS }, () => new THREE.Vector2()),
        lens: new Float32Array(MAX_POINTS),
        n: 0, total: 0, born: 0, speed: 1, tail: 1, reachedAt: -1,
    })), []);
    const _m4 = useMemo(() => new THREE.Matrix4(), []);
    const _mouseUv = useMemo(() => new THREE.Vector2(), []);

    const _dir = useMemo(() => new THREE.Vector3(), []);

    useFrame((state) => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const sp = scrollRef ? scrollRef.current : 0;
        const landing = 1 - THREE.MathUtils.smoothstep(sp, 0.02, 0.08);
        mesh.visible = landing > 0.001;
        if (!mesh.visible) return;

        // Fill the view at QUAD_DISTANCE, facing the camera
        const fov = THREE.MathUtils.degToRad(camera.fov);
        const h = 2 * QUAD_DISTANCE * Math.tan(fov / 2);
        const w = h * camera.aspect;
        camera.getWorldDirection(_dir);
        mesh.position.copy(camera.position).addScaledVector(_dir, QUAD_DISTANCE);
        mesh.quaternion.copy(camera.quaternion);
        mesh.scale.set(w * 1.02, h * 1.02, 1);

        uniforms.uAspect.value  = size.width / size.height;
        uniforms.uFocal.value   = 1 / Math.tan(fov / 2);
        // base pitch that puts the (level) horizon HORIZON_FROM_TOP down the screen
        const horizonNdc = 1 - 2 * HORIZON_FROM_TOP;               // e.g. -0.54
        uniforms.uPitch.value = Math.atan(-horizonNdc / uniforms.uFocal.value);
        // follow the scene's mouse rotation (the group pivots on the logo)
        const g = rotationRef?.current;
        if (g) {
            _m4.makeRotationFromEuler(g.rotation);
            uniforms.uInvRot.value.setFromMatrix4(_m4).transpose();   // inverse of a rotation
            uniforms.uPivot.value = camera.position.z - g.position.z;
        }
        uniforms.uTime.value    = state.clock.elapsedTime;
        // press-and-hold warp (shared with the nebula / aurora / stars)
        uniforms.uHold.value  = Math.max(0, holdState.value) * holdState.gate;
        uniforms.uPress.value = holdState.press * holdState.gate;
        uniforms.uFlow.value  = holdState.flow;
        uniforms.uMouse.value.lerp(_mouseUv.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5), 0.35);
        uniforms.uOpacity.value = landing;

        // ── electric runs ────────────────────────────────────────────────
        const t = state.clock.elapsedTime;
        const drift = t * 0.35 + holdState.flow * 9.0;     // same as the shader's grid drift
        const halfW = camera.aspect * Math.tan(fov / 2);   // ground half-width per unit of distance
        for (let b = 0; b < MAX_BOLTS; b++) {
            const s = slots[b];
            if (!s.alive && t >= s.nextAt) spawnBolt(s, t, drift, uniforms.uPivot.value, halfW);
            const info = uniforms.uBoltInfo.value[b];
            const fx = uniforms.uBoltFx.value[b];
            if (!s.alive) { fx.w = 0; continue; }

            const head = (t - s.born) * s.speed;
            if (head >= s.total && s.reachedAt < 0) s.reachedAt = t;
            // done once the tail has run off the end and the end flash has faded
            if (head - s.tail > s.total && t - s.reachedAt > 0.4) {
                s.alive = false;
                s.nextAt = t + rand(GAP_SECONDS);
                fx.w = 0;
                continue;
            }
            for (let i = 0; i < s.n; i++) uniforms.uBoltPts.value[b * MAX_POINTS + i].copy(s.pts[i]);
            info.set(s.n, head, s.tail, s.total);
            fx.set(
                Math.exp(-(t - s.born) * 7),                               // start flash
                s.reachedAt < 0 ? 0 : Math.exp(-(t - s.reachedAt) * 7),    // end flash
                0.65 + 0.35 * Math.random(),                               // head flicker
                1
            );
            pointAlong(s, Math.min(head, s.total), uniforms.uBoltHead.value[b]);
        }
    });

    return (
        <mesh ref={meshRef} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent
                depthWrite={false}
                toneMapped={false}
            />
        </mesh>
    );
}
