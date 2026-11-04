// scene/Artifact.jsx
"use client"

import React, { forwardRef, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
    frameViewport, CORE_REFORM, CORE_SCALE,
} from "@/components/scene/servicesData";
import { RIM_VERTEX, RIM_FRAGMENT } from "@/components/scene/rift/riftShaders";
import { LIQUID_VERTEX, LIQUID_FRAGMENT } from "@/components/scene/liquidGlassShaders";

// ── Liquid marble look ──────────────────────────────────────────────────────
// The logo no longer refracts the scene behind it (that re-drew the whole
// scene several times per frame and looked different on every GPU). Instead
// it has its own slowly flowing teal marble inside, so it looks the same
// everywhere and is much lighter to run.
const LIQUID_SCALE      = 1.2;   // size of the marble swirls (higher = smaller swirls)
const LIQUID_BRIGHTNESS = 1.0;   // overall brightness of the marble
const LANDING_EDGES     = 0.45;  // thin cyan edge lines on the landing (void mode goes to 1)

// Glass at rest (matches the `glass` props below)
const BASE_GLASS = {
    distortion: 0.2, temporalDistortion: 0.1, chromaticAberration: 0.05,
    thickness: 0.5, ior: 1.5, color: new THREE.Color("#1a4e4d"),
};

// Subtle per-service variation while the logo acts as the orbit core,
// indexed like SERVICES: ai, software, web, marketing, design
const SERVICE_GLASS = [
    // AI: restless shimmer, like data moving through it
    { distortion: 0.35, temporalDistortion: 0.35, chromaticAberration: 0.08, thickness: 0.5, ior: 1.5, color: new THREE.Color("#14505a") },
    // Software: clean, structured, barely distorted
    { distortion: 0.04, temporalDistortion: 0.02, chromaticAberration: 0.03, thickness: 0.8, ior: 1.6, color: new THREE.Color("#1a4e4d") },
    // Web: liquid, flowing reflections
    { distortion: 0.7, temporalDistortion: 0.25, chromaticAberration: 0.05, thickness: 0.6, ior: 1.45, color: new THREE.Color("#145a66") },
    // Marketing: stronger colour split, like light trails
    { distortion: 0.25, temporalDistortion: 0.15, chromaticAberration: 0.16, thickness: 0.5, ior: 1.5, color: new THREE.Color("#1d4a63") },
    // Design: heavier refraction, more geometric
    { distortion: 0.15, temporalDistortion: 0.05, chromaticAberration: 0.1, thickness: 1.1, ior: 1.85, color: new THREE.Color("#1a4e5a") },
];
const tmpColor = new THREE.Color();

// Void mode (rift.dark = 1): the world goes black, so the glass catches
// light on its own. Only properties that never trigger a shader recompile
// are animated (no iridescence / clearcoat toggling = no mid-scroll hitch).
// Every value below is the material's default at dark = 0.
const VOID_EMISSIVE = new THREE.Color("#0b0f2e");   // faint inner blue-violet
const VOID_SPECULAR = new THREE.Color("#8f9bff");   // violet-tinted highlights
const WHITE         = new THREE.Color("#ffffff");
const EDGE_COLOR    = new THREE.Color("#6fdcff").multiplyScalar(2.2); // HDR: catches Bloom

const Artifact = forwardRef(function Artifact(
    { mood = null, freeze = false, scrollProgress = 0, activeService = 0, rift = null },
    externalRef
) {
    const internalRef = useRef();
    const group = externalRef ?? internalRef;

    const spinRef = useRef(null); // inner group: slow spin while acting as core
    const rimRefs    = useRef([]);
    const edgeRefs   = useRef([]);
    const ambientRef = useRef();
    const spotRef    = useRef();

    // frameViewport: identical to `viewport` at the landing camera, and still
    // correct while the camera chases the logo during the rift
    const size = useThree((s) => s.size);
    const responsiveScale = Math.min(1.5, Math.max(0.65, frameViewport(size).width * 0.22));

    const { scene } = useGLTF("/models/aura-logo.glb");

    const meshes = useMemo(() => {
        const arr = [];
        scene.updateMatrixWorld(true);
        scene.traverse((obj) => {
            if (!obj.isMesh) return;
            arr.push({ geometry: obj.geometry, matrix: obj.matrixWorld.clone() });
        });
        return arr;
    }, [scene]);

    // Marble geometry: each piece baked into the logo's own space, so the
    // marble pattern flows continuously across all pieces and stays stuck to
    // the logo when it turns.
    const liquid = useMemo(() => {
        const box = new THREE.Box3();
        const geos = meshes.map((m) => {
            const g = m.geometry.clone();
            g.applyMatrix4(m.matrix);
            g.computeBoundingBox();
            box.union(g.boundingBox);
            return g;
        });
        const center = box.getCenter(new THREE.Vector3());
        const sz = box.getSize(new THREE.Vector3());
        return { geos, center, scale: 1 / Math.max(sz.x, sz.y, sz.z, 1e-6) };
    }, [meshes]);

    // One uniforms object shared by every piece
    const liquidUniforms = useMemo(() => ({
        uTime:       { value: 0 },
        uTint:       { value: BASE_GLASS.color.clone() },
        uWarp:       { value: BASE_GLASS.distortion },
        uFlow:       { value: BASE_GLASS.temporalDistortion },
        uSplit:      { value: BASE_GLASS.chromaticAberration },
        uDark:       { value: 0 },
        uCenter:     { value: liquid.center },
        uScale:      { value: liquid.scale * LIQUID_SCALE },
        uBrightness: { value: LIQUID_BRIGHTNESS },
    }), [liquid]);

    // Hard edges of the logo for the void-mode glints (bevels, not every
    // triangle seam)
    const edges = useMemo(
        () => meshes.map((m) => new THREE.EdgesGeometry(m.geometry, 28)),
        [meshes]
    );

    const rimUniforms = useMemo(() => ({
        uDark: { value: 0 },
        uTime: { value: 0 },
    }), []);

    useFrame((state, delta) => {
        if (!group.current) return;

        const sp = scrollProgress;

        // SCROLL PHASE 4 (0.55-0.70): logo reforms as the orbit core
        const coreT = THREE.MathUtils.smoothstep(sp, CORE_REFORM.start, CORE_REFORM.end);
        // Spin lives on the inner group. Before the core phase it eases back to
        // the nearest full turn (the logo stays visible through the rift now),
        // so the landing always shows it face-on.
        if (spinRef.current) {
            const spin = spinRef.current;
            if (sp < CORE_REFORM.start) {
                const rest = Math.round(spin.rotation.y / (Math.PI * 2)) * Math.PI * 2;
                spin.rotation.y = THREE.MathUtils.damp(spin.rotation.y, rest, 3, delta);
            } else if (!freeze) {
                spin.rotation.y += delta * 0.35 * coreT;
            }
        }

        // QUANTUM RIFT pull: the rift grips the logo (smooth tremble, two
        // detuned sines, not random jitter) and tips it back into the void.
        // Both are 0 on the landing.
        if (spinRef.current && rift) {
            const t = state.clock.elapsedTime;
            const g = rift.pull * 0.022;
            spinRef.current.position.set(
                (Math.sin(t * 23.1) * 0.6 + Math.sin(t * 37.7 + 1.3) * 0.4) * g,
                (Math.sin(t * 29.3 + 0.7) * 0.6 + Math.sin(t * 41.9 + 2.1) * 0.4) * g,
                0
            );
            spinRef.current.rotation.x = -0.45 * rift.tilt;
            spinRef.current.rotation.z = 0.12 * rift.tilt;
        }

        // SCROLL PHASE 1 (0.10-0.25): pointer sensitivity ramps up 0.5 → 0.8
        // SCROLL PHASE 2 (0.25-0.45): sensitivity returns 0.8 → 0.5
        const sensitivity =
            sp < 0.10 ? 0.5
            : sp < 0.25 ? THREE.MathUtils.lerp(0.5, 0.8, (sp - 0.10) / 0.15)
            : sp < 0.45 ? THREE.MathUtils.lerp(0.8, 0.5, (sp - 0.25) / 0.20)
            : 0.5;

        // Pointer-reactive rotation
        if (state.pointer && !freeze) {
            const { x, y } = state.pointer;
            group.current.rotation.y = THREE.MathUtils.lerp(
                group.current.rotation.y,
                x * sensitivity,
                0.05
            );
            group.current.rotation.x = THREE.MathUtils.lerp(
                group.current.rotation.x,
                -y * sensitivity,
                0.05
            );
        }

        // Gentle floating animation
        if (!freeze) {
            const targetY = Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
            group.current.position.y = THREE.MathUtils.lerp(
                group.current.position.y,
                targetY,
                0.02
            );
        }

        // SCROLL PHASE 1 (0.10-0.25): chromaticAberration pulses 0.05 → 0.12
        // SCROLL PHASE 2 (0.25-0.45): fades back 0.12 → 0.05 as artifact collapses
        const ca =
            sp < 0.10 ? 0.05
            : sp < 0.25 ? THREE.MathUtils.lerp(0.05, 0.12, (sp - 0.10) / 0.15)
            : sp < 0.45 ? THREE.MathUtils.lerp(0.12, 0.05, (sp - 0.25) / 0.20)
            : 0.05;

        // SCROLL PHASE 4: blend toward the selected service's glass preset
        const preset = SERVICE_GLASS[activeService] ?? SERVICE_GLASS[0];
        const k = 1 - Math.exp(-delta * 2.5);
        const mix = (key) => BASE_GLASS[key] + (preset[key] - BASE_GLASS[key]) * coreT;
        tmpColor.copy(BASE_GLASS.color).lerp(preset.color, coreT);

        // Same scroll / service values as before, now driving the marble:
        // distortion -> how swirly, temporalDistortion -> how fast it flows,
        // chromaticAberration -> faint colour split, color -> tint
        const lu = liquidUniforms;
        lu.uTime.value  = state.clock.elapsedTime;
        lu.uSplit.value = ca + (preset.chromaticAberration - BASE_GLASS.chromaticAberration) * coreT;
        lu.uWarp.value  = THREE.MathUtils.lerp(lu.uWarp.value, mix("distortion"), k);
        lu.uFlow.value  = THREE.MathUtils.lerp(lu.uFlow.value, mix("temporalDistortion"), k);
        lu.uTint.value.lerp(tmpColor, k);

        // QUANTUM RIFT void mode: dark = 0 on the landing, 1 once the camera
        // has crossed into the void
        const dark = rift ? rift.dark : 0;
        lu.uDark.value = dark;

        // Fresnel rim + edge glints fade in with the darkness
        // (all rim meshes share one uniforms object, so set it via the first)
        const rimU = rimRefs.current[0]?.material.uniforms;
        if (rimU) {
            rimU.uDark.value = dark;
            rimU.uTime.value = state.clock.elapsedTime;
        }
        rimRefs.current.forEach((m) => { if (m) m.visible = dark > 0.001; });
        const edgeGlow = Math.max(dark, LANDING_EDGES);
        edgeRefs.current.forEach((l) => {
            if (!l) return;
            l.visible = edgeGlow > 0.001;
            l.material.opacity = 0.55 * edgeGlow;
        });

        // Ambient + spot dial down to empty-void lighting
        if (ambientRef.current) ambientRef.current.intensity = 0.5 * (1 - dark);
        if (spotRef.current)    spotRef.current.intensity = 1 - dark;

        // QUANTUM RIFT: the logo stays where it is (no pull into the portal)
        // and vanishes in place as the plunge plays (rift.logoScale 1 -> 0).
        let targetScale;
        if (rift) {
            targetScale = rift.logoScale;
            group.current.position.z = rift.logoZ;
        } else {
            targetScale =
                sp < 0.25 ? 1.0
                : sp < 0.45 ? THREE.MathUtils.lerp(1.0, 0.0, (sp - 0.25) / 0.20)
                : CORE_SCALE * coreT;
        }

        group.current.scale.setScalar(
            THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.08)
        );
    });

    return (
        <group ref={group} position={[0, 0, 0]}>
            <Environment
                preset="night"
                background={false}
                rotation={[Math.PI / 2, 0, 0]}
                environmentIntensity={0.01}
                resolution={256}
            />

            <ambientLight ref={ambientRef} intensity={0.5} />
            <spotLight ref={spotRef} position={[10, 10, 10]} angle={0.15} penumbra={1} />

            <group ref={spinRef}>
                <Center scale={responsiveScale}>
                    {liquid.geos.map((g, i) => (
                        <mesh
                            key={`liquid-${i}`}
                            geometry={g}
                            frustumCulled={false}
                        >
                            <shaderMaterial
                                vertexShader={LIQUID_VERTEX}
                                fragmentShader={LIQUID_FRAGMENT}
                                uniforms={liquidUniforms}
                                toneMapped={false}
                            />
                        </mesh>
                    ))}

                    {/* Void mode only: Fresnel rim over the glass (additive) */}
                    {meshes.map((m, i) => (
                        <mesh
                            key={`rim-${i}`}
                            ref={(r) => (rimRefs.current[i] = r)}
                            geometry={m.geometry}
                            matrix={m.matrix}
                            matrixAutoUpdate={false}
                            frustumCulled={false}
                            visible={false}
                            renderOrder={1}
                        >
                            <shaderMaterial
                                vertexShader={RIM_VERTEX}
                                fragmentShader={RIM_FRAGMENT}
                                uniforms={rimUniforms}
                                transparent
                                depthWrite={false}
                                blending={THREE.AdditiveBlending}
                                toneMapped={false}
                            />
                        </mesh>
                    ))}

                    {/* Edge glints along the logo's bevels (faint on the landing, full in the void) */}
                    {edges.map((g, i) => (
                        <lineSegments
                            key={`edge-${i}`}
                            ref={(r) => (edgeRefs.current[i] = r)}
                            geometry={g}
                            matrix={meshes[i].matrix}
                            matrixAutoUpdate={false}
                            frustumCulled={false}
                            visible={false}
                            renderOrder={1}
                        >
                            <lineBasicMaterial
                                color={EDGE_COLOR}
                                transparent
                                opacity={0}
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

export default Artifact;

useGLTF.preload("/models/aura-logo.glb");
