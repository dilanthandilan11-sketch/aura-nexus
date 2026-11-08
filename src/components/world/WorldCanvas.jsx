// src/components/world/WorldCanvas.jsx
// The shared 3D world behind every page except Home. It stays mounted while
// the visitor moves between pages; each page only changes the station it
// eases toward (see worldStore.js).
//
// Built from Home's own pieces: the nebula, the aurora, the stars, the teal
// grid floor and the liquid-marble logo, plus the white smoke cursor trail.
// The nebula is a 4K JPEG made from Home's own 69 MB HDR (same framing and
// colour as Home, drawn the same way: no tone mapping), so these pages open
// quickly but show the same sky.
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { EffectComposer, Noise } from "@react-three/postprocessing";
import { BloomEffect, BlendFunction } from "postprocessing";
import * as THREE from "three";
import AuroraStreaksFlowing from "@/components/scene/AuroraStreaksFlowing";
import StarfieldWithHands from "@/components/scene/StarfieldWithHands";
import GridFloor from "@/components/scene/GridFloor";
import { holdState } from "@/components/scene/molten/holdState";
import { Fluid } from "@/lib/Fluid";
import { DEFAULT_CONFIG } from "@/lib/constant";
import WorldLogo from "@/components/world/WorldLogo";
import { world } from "@/components/world/worldStore";

// Same trail as Home (Scene.jsx: FLUID_COLOR / FLUID_RADIUS)
const FLUID_COLOR  = "#ffffff";
const FLUID_RADIUS = 0.035;

function Nebula() {
    const texture = useLoader(THREE.TextureLoader, "/hdri/Nebula_N0_4k.jpg");
    useMemo(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
    }, [texture]);
    return (
        <mesh>
            <sphereGeometry args={[500, 48, 32]} />
            <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} depthWrite={false} />
        </mesh>
    );
}

// Moves the space around toward the station, drives the travel / transmit
// warp, and feeds the floor its visibility.
function WorldDriver({ yawRef, tiltRef, floorRef, reducedMotion }) {
    useEffect(() => () => {
        // leave the shared hold state clean for Home
        holdState.held = false; holdState.value = 0; holdState.press = 0; holdState.gate = 1;
    }, []);

    useFrame((state, rawDelta) => {
        const dt = Math.min(rawDelta, 1 / 20);
        const t = world.target;

        // Space turns toward the station (sells the "travel")
        if (yawRef.current) {
            const k = 1 - Math.exp(-1.8 * dt);
            yawRef.current.rotation.y += (t.yaw - yawRef.current.rotation.y) * k;
        }
        // Gentle mouse tilt of the whole world (the floor reads this group)
        if (tiltRef.current) {
            const k = 1 - Math.exp(-3 * dt);
            tiltRef.current.rotation.x += (-state.pointer.y * 0.05 - tiltRef.current.rotation.x) * k;
            tiltRef.current.rotation.y += (state.pointer.x * 0.08 - tiltRef.current.rotation.y) * k;
        }
        // Floor: GridFloor fades out as its "scroll" goes 0.02 -> 0.08
        const fGoal = t.floor > 0.5 ? 0 : 0.1;
        floorRef.current += (fGoal - floorRef.current) * (1 - Math.exp(-2.5 * dt));

        // Travel / transmit: a short burst of the press-and-hold warp, which
        // the aurora, the stars and the floor already respond to
        world.pulse = reducedMotion ? 0 : Math.max(0, world.pulse - dt * 0.9);
        const p = Math.min(world.pulse, 1);
        const shaped = p * p * (3 - 2 * p);
        holdState.value = shaped;
        holdState.press = shaped * 0.6;
        holdState.gate = 1;
        holdState.flow += shaped * dt;
    });
    return null;
}

function Effects({ fluid }) {
    const bloom = useMemo(() => new BloomEffect({
        blendFunction: BlendFunction.ADD,
        luminanceThreshold: 0.85,
        intensity: 0.15,
    }), []);
    useEffect(() => () => bloom.dispose(), [bloom]);
    return (
        <EffectComposer>
            {fluid ? (
                <Fluid
                    {...DEFAULT_CONFIG}
                    showBackground={true}
                    rainbow={false}
                    fluidColor={FLUID_COLOR}
                    radius={FLUID_RADIUS}
                />
            ) : null}
            <primitive object={bloom} dispose={null} />
            <Noise opacity={0.025} />
        </EffectComposer>
    );
}

export default function WorldCanvas() {
    const yawRef   = useRef();
    const tiltRef  = useRef();
    const logoRef  = useRef();
    const floorRef = useRef(0.1);          // start with the floor hidden; it fades in
    const [env, setEnv] = useState({ touch: false, reduced: false, small: false });

    useEffect(() => {
        const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const small = window.innerWidth < 768;
        setEnv({ touch, reduced, small });
    }, []);

    return (
        <Canvas
            camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 1000 }}
            gl={{ antialias: false, powerPreference: "high-performance" }}
            dpr={env.small ? 1 : [1, 1.75]}
            eventSource={typeof document !== "undefined" ? document.body : undefined}
            eventPrefix="client"
            style={{ position: "fixed", inset: 0, zIndex: 0, background: "#020204" }}
            aria-hidden="true"
        >
            <Suspense fallback={null}>
                <WorldDriver yawRef={yawRef} tiltRef={tiltRef} floorRef={floorRef} reducedMotion={env.reduced} />

                <GridFloor scrollRef={floorRef} rotationRef={tiltRef} />

                <group ref={tiltRef}>
                    <group ref={yawRef}>
                        <Nebula />
                        <StarfieldWithHands targetRef={logoRef} count={env.small ? 1500 : 3000} />
                    </group>

                    <group position={[0, 0, -20]}>
                        <AuroraStreaksFlowing count={1} opacity={0.30} intensity={0.80} speed={0.25} colorScheme={0} offset={0} />
                        <AuroraStreaksFlowing count={1} opacity={0.25} intensity={0.70} speed={0.20} colorScheme={1} offset={1.5} />
                    </group>

                    <WorldLogo ref={logoRef} reducedMotion={env.reduced} />
                </group>

                <Effects fluid={!env.touch && !env.reduced} />
            </Suspense>
        </Canvas>
    );
}
