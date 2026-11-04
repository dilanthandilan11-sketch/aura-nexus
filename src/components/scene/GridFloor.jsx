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
    }), []);
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
