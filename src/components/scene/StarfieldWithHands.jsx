// scene/StarfieldWithHands.jsx
// Landing dust: slowly drifting stars.
//
// Press and hold: the stars fall into a point just behind the logo, like
// matter into a gravity well. Each star starts slowly, speeds up as it gets
// closer (gravity-style ease), curls slightly around the logo and fades out
// as it slips behind it. Stars have staggered speeds, so the stream builds
// gradually instead of everything moving at once. Swallowed stars fade back
// in at their original spot, so the stream keeps flowing while you hold.
// Release and every star glides back to where it came from.
//
// The hold itself lives in molten/holdState.js and also drives the
// environment warp.
"use client"

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { holdState } from "@/components/scene/molten/holdState";

// ── Tuning ──────────────────────────────────────────────────────────────────
const SINK_BEHIND  = 3.0;   // how far behind the logo the stars vanish (world units)
const FALL_TIME    = 2.6;   // seconds a typical star takes to fall in at full hold
const SPEED_SPREAD = 0.55;  // 0 = all stars fall together, 1 = very staggered
const SWIRL        = 0.55;  // radians of curl around the logo on the way in
const RETURN_RATE  = 2.2;   // how quickly stars glide home after release
const FADE_IN_TIME = 0.8;   // seconds for a recycled star to fade back in
const STAR_SIZE    = 0.035; // soft round stars read a bit smaller than squares

const _sink = new THREE.Vector3();

const vertexShader = /* glsl */ `
    attribute float aAlpha;
    uniform float uSize;
    uniform float uScale;
    varying float vAlpha;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // same size attenuation as THREE.PointsMaterial
        gl_PointSize = max(uSize * uScale / -mv.z, 1.0);
        vAlpha = aAlpha;
    }
`;

const fragmentShader = /* glsl */ `
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
        // soft round star instead of a hard square
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d);
        gl_FragColor = vec4(vec3(1.0), a * vAlpha * uOpacity);
        #include <colorspace_fragment>
    }
`;

export default function StarfieldWithHands({
    targetRef,       // the logo; stars fall to a point behind it
    fadeRef = null,  // optional { current: 0..1 } opacity multiplier
    count   = 4000,
    radius  = 80,
    freeze  = false,
    // handData / useHandControl are still accepted but no longer used here
}) {
    const pointsRef = useRef();

    // ── Per-star state ────────────────────────────────────────────────────
    // home: where the star drifts when nothing is pulling it
    // travel: 0 = at home .. 1 = swallowed behind the logo
    const stars = useMemo(() => {
        const home     = new Float32Array(count * 3);
        const drift    = new Float32Array(count * 3);
        const travel   = new Float32Array(count);
        const speed    = new Float32Array(count);
        const swirl    = new Float32Array(count);
        const born     = new Float32Array(count).fill(1);
        const position = new Float32Array(count * 3);
        const alpha    = new Float32Array(count).fill(1);

        for (let i = 0; i < count; i++) {
            const idx   = i * 3;
            const theta = 2 * Math.PI * Math.random();
            const phi   = Math.acos(2 * Math.random() - 1);
            const r     = radius * Math.cbrt(Math.random());
            const sinPhi = Math.sin(phi);

            home[idx]     = position[idx]     = r * sinPhi * Math.cos(theta);
            home[idx + 1] = position[idx + 1] = r * sinPhi * Math.sin(theta);
            home[idx + 2] = position[idx + 2] = r * Math.cos(phi);

            // very slow idle drift (units per second)
            drift[idx]     = (Math.random() - 0.5) * 0.4;
            drift[idx + 1] = (Math.random() - 0.5) * 0.4;
            drift[idx + 2] = (Math.random() - 0.5) * 0.4;

            speed[i] = (1 / FALL_TIME) * (1 + (Math.random() * 2 - 1) * SPEED_SPREAD);
            swirl[i] = SWIRL * (0.6 + 0.8 * Math.random()); // one shared direction = a vortex
        }
        return { home, drift, travel, speed, swirl, born, position, alpha };
    }, [count, radius]);

    const uniforms = useMemo(() => ({
        uSize:    { value: STAR_SIZE },
        uScale:   { value: 500 },
        uOpacity: { value: 0.9 },
    }), []);

    useFrame((_, rawDelta) => {
        const points = pointsRef.current;
        if (!points) return;

        // Optional fade (Quantum Rift: dust fades before the camera flies through)
        const f = fadeRef ? fadeRef.current : 1;
        points.visible = f > 0.001;
        uniforms.uOpacity.value = 0.9 * f;
        if (f <= 0.001 || freeze) return;


        const dt   = Math.min(rawDelta, 1 / 20);
        const hold = Math.max(0, holdState.value) * holdState.gate;

        // Sink point just behind the logo, in the points' local space
        // (the starfield lives inside the mouse-rotation group)
        if (targetRef?.current) targetRef.current.getWorldPosition(_sink);
        else _sink.set(0, 0, 0);
        _sink.z -= SINK_BEHIND;
        points.worldToLocal(_sink);

        const { home, drift, travel, speed, swirl, born, position, alpha } = stars;
        const back = Math.exp(-RETURN_RATE * dt);
        const driftDamp = Math.exp(-0.15 * dt);   // idle drift slowly settles, as before
        // the pull eases in with the hold, so a light press only nudges them
        const pull = hold * hold * (3 - 2 * hold);

        for (let i = 0; i < count; i++) {
            const idx = i * 3;

            // idle drift of the home position
            drift[idx] *= driftDamp; drift[idx + 1] *= driftDamp; drift[idx + 2] *= driftDamp;
            home[idx]     += drift[idx]     * dt;
            home[idx + 1] += drift[idx + 1] * dt;
            home[idx + 2] += drift[idx + 2] * dt;

            // advance / rewind along the fall
            let s = travel[i];
            if (pull > 0.01) {
                s += dt * speed[i] * pull;
                if (s >= 1) {           // swallowed: fade back in at home
                    s = 0;
                    born[i] = 0;
                }
            } else {
                s *= back;              // glide home after release
                if (s < 1e-4) s = 0;
            }
            travel[i] = s;
            born[i] = Math.min(1, born[i] + dt / FADE_IN_TIME);

            // gravity-style ease: slow start, fast finish
            const e = s * s * (1.6 - 0.6 * s);

            // offset from the sink, shrinking as the star falls,
            // and curling around the view axis
            const ox = home[idx]     - _sink.x;
            const oy = home[idx + 1] - _sink.y;
            const oz = home[idx + 2] - _sink.z;
            const k  = 1 - e;
            const a  = swirl[i] * e;
            const ca = Math.cos(a), sa = Math.sin(a);

            position[idx]     = _sink.x + (ox * ca - oy * sa) * k;
            position[idx + 1] = _sink.y + (ox * sa + oy * ca) * k;
            position[idx + 2] = _sink.z + oz * k;

            // fade out as it slips behind the logo, fade in when recycled
            const out = 1 - THREE.MathUtils.smoothstep(e, 0.7, 0.97);
            const inn = born[i] * born[i] * (3 - 2 * born[i]);
            alpha[i] = out * inn;
        }

        const geom = points.geometry;
        geom.getAttribute("position").needsUpdate = true;
        geom.getAttribute("aAlpha").needsUpdate = true;
    });

    return (
        <points
            ref={pointsRef}
            frustumCulled={false}
            // Star size follows the height of whatever it is drawn into (the
            // screen, or the glass logo's background capture), so stars seen
            // through the glass are the same size as everywhere else.
            onBeforeRender={(renderer, _s, _c, _g, material) => {
                const rt = renderer.getRenderTarget();
                uniforms.uScale.value = (rt ? rt.height : renderer.domElement.height) * 0.5;
                material.uniformsNeedUpdate = true;
            }}
        >
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    array={stars.position}
                    itemSize={3}
                    count={count}
                />
                <bufferAttribute
                    attach="attributes-aAlpha"
                    array={stars.alpha}
                    itemSize={1}
                    count={count}
                />
            </bufferGeometry>
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent
                depthWrite={false}
            />
        </points>
    );
}
