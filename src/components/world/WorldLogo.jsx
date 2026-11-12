// src/components/world/WorldLogo.jsx
// The liquid-marble "A" for the pages outside Home. Same model and same
// marble shader as Home's logo (Artifact.jsx), without Home's scroll story:
// it eases toward the current page's station (position, size, colour, spin)
// and tilts gently with the mouse.
"use client";

import React, { forwardRef, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { LIQUID_VERTEX, LIQUID_FRAGMENT } from "@/components/scene/liquidGlassShaders";
import { world } from "@/components/world/worldStore";

const CAMERA_Z    = 6;
const FOV         = 40;
const LIQUID_SCALE = 1.2;              // same swirl size as Home
const EDGE_COLOR  = new THREE.Color("#6fdcff").multiplyScalar(2.2);
const _tint       = new THREE.Color();

const WorldLogo = forwardRef(function WorldLogo({ reducedMotion = false }, ref) {
    const group = useRef();
    const spin  = useRef();
    const size  = useThree((s) => s.size);
    const { scene } = useGLTF("/models/aura-logo.glb");

    // Each piece baked into the logo's own space, as on Home
    const liquid = useMemo(() => {
        const box = new THREE.Box3();
        const geos = [];
        scene.updateMatrixWorld(true);
        scene.traverse((obj) => {
            if (!obj.isMesh) return;
            const g = obj.geometry.clone();
            g.applyMatrix4(obj.matrixWorld);
            g.computeBoundingBox();
            box.union(g.boundingBox);
            geos.push(g);
        });
        const center = box.getCenter(new THREE.Vector3());
        const sz = box.getSize(new THREE.Vector3());
        return { geos, center, scale: 1 / Math.max(sz.x, sz.y, sz.z, 1e-6) };
    }, [scene]);

    const edges = useMemo(() => liquid.geos.map((g) => new THREE.EdgesGeometry(g, 28)), [liquid]);

    const uniforms = useMemo(() => ({
        uTime:       { value: 0 },
        uTint:       { value: new THREE.Color(world.target.tint) },
        uWarp:       { value: 0.2 },
        uFlow:       { value: 0.1 },
        uSplit:      { value: 0.05 },
        uDark:       { value: 0 },
        uCenter:     { value: liquid.center },
        uScale:      { value: liquid.scale * LIQUID_SCALE },
        uBrightness: { value: 1.0 },
    }), [liquid]);

    // Start exactly at the first page's station (no fly-in on page load)
    const started = useRef(false);

    useFrame((state, rawDelta) => {
        const g = group.current;
        if (!g) return;
        const dt = Math.min(rawDelta, 1 / 20);
        const t = world.target;

        // Station in world units at the logo's depth (z = 0)
        const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z;
        const aspect = size.width / size.height;
        const halfW = halfH * aspect;
        const narrow = aspect < 0.9;           // phones: logo sits small, top centre
        const tx = narrow ? 0 : t.x * halfW;
        const ty = narrow ? halfH * 0.58 : t.y * halfH;
        // Home's size rule, then the station's scale
        const base = Math.min(1.5, Math.max(0.65, halfW * 2 * 0.22));
        const ts = base * t.scale * (narrow ? 0.55 : 1);

        // The logo glides to each page's spot in every mode (with reduced
        // motion only the warp, blur, float and spin are left out)
        if (!started.current) {
            g.position.set(tx, ty, 0);
            g.scale.setScalar(ts);
            started.current = true;
        } else {
            const k = 1 - Math.exp(-2.6 * dt);   // ~1 s to arrive
            g.position.x += (tx - g.position.x) * k;
            g.position.y += (ty - g.position.y) * k;
            g.scale.setScalar(g.scale.x + (ts - g.scale.x) * k);
        }

        // Gentle mouse tilt and float
        const px = state.pointer.x, py = state.pointer.y;
        g.rotation.y += (px * 0.35 - g.rotation.y) * (1 - Math.exp(-3 * dt));
        g.rotation.x += (-py * 0.25 - g.rotation.x) * (1 - Math.exp(-3 * dt));
        if (!reducedMotion) g.position.y += Math.sin(state.clock.elapsedTime * 0.5) * 0.0015;

        // Slow turn on the inner group, plus a little from page scroll
        if (spin.current) {
            const scrollTurn = typeof window !== "undefined" ? window.scrollY * 0.0012 : 0;
            spin.current.userData.base = (spin.current.userData.base ?? 0) + (reducedMotion ? 0 : t.spin * dt);
            const goal = spin.current.userData.base + scrollTurn;
            spin.current.rotation.y += (goal - spin.current.rotation.y) * (1 - Math.exp(-4 * dt));
        }

        // Marble colour: hover tint wins over the station tint
        _tint.set(world.hoverTint ?? t.tint);
        uniforms.uTint.value.lerp(_tint, 1 - Math.exp(-4 * dt));
        uniforms.uTime.value = state.clock.elapsedTime;
        // A travel / transmit pulse swirls the marble harder. (uWarp, not
        // uFlow: the shader multiplies uFlow by the clock, so changing it would
        // make the pattern jump.)
        uniforms.uWarp.value = 0.2 + Math.min(world.pulse, 1) * 0.35;
    });

    return (
        <group ref={(r) => { group.current = r; if (typeof ref === "function") ref(r); else if (ref) ref.current = r; }}>
            <group ref={spin}>
                <Center>
                    {liquid.geos.map((geo, i) => (
                        <mesh key={`l-${i}`} geometry={geo} frustumCulled={false}>
                            <shaderMaterial
                                vertexShader={LIQUID_VERTEX}
                                fragmentShader={LIQUID_FRAGMENT}
                                uniforms={uniforms}
                                toneMapped={false}
                            />
                        </mesh>
                    ))}
                    {edges.map((geo, i) => (
                        <lineSegments key={`e-${i}`} geometry={geo} frustumCulled={false} renderOrder={1}>
                            <lineBasicMaterial
                                color={EDGE_COLOR}
                                transparent
                                opacity={0.25}
                                depthWrite={false}
                                blending={THREE.AdditiveBlending}
                                toneMapped={false}
                            />
                        </lineSegments>
                    ))}
                </Center>
            </group>
        </group>
    );
});

export default WorldLogo;

useGLTF.preload("/models/aura-logo.glb");
