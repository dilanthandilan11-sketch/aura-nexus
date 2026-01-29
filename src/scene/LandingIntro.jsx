// src/scene/LandingIntro.jsx
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Html, useGLTF, useProgress } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette, ShockWave } from "@react-three/postprocessing";
import * as THREE from "three";
import gsap from "gsap";

/**
 * INTRO FLOW (matches your 4 frames)
 * Frame 1: outline visible + initializing text
 * Frame 2: glass logo fades in (when assets ready)
 * Frame 3: center shockwave ripple
 * Frame 4: fade out intro overlay -> App crossfades Scene in
 */

function InitializingOverlay({ show, progress }) {
    if (!show) return null;

    return (
        <Html center style={{ pointerEvents: "none" }}>
            <div
                style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.92)",
                    fontFamily: "'Sora', sans-serif",
                    letterSpacing: "0.22em",
                    transform: "translateY(90px)",
                    userSelect: "none",
                }}
            >
                <div style={{ fontSize: 12, opacity: 0.9 }}>INITIALIZING AURA CORE</div>
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 10, letterSpacing: "0.12em" }}>
                    Synchronizing systems… {Math.floor(progress)}%
                </div>
            </div>
        </Html>
    );
}

function LogoOutlineAndGlass({ phase, setPhase, onReadyForOutro }) {
    // Load the same GLB your main scene uses
    const { scene } = useGLTF("/models/aura-logo.glb");
    const groupRef = useRef();

    // Phase-driven visibility/opacity
    const [glassOpacity, setGlassOpacity] = useState(0);
    const [outlineOpacity, setOutlineOpacity] = useState(1);
    const [shockActive, setShockActive] = useState(false);

    // Extract meshes (similar to what you do in Artifact.jsx) :contentReference[oaicite:5]{index=5}
    const meshes = useMemo(() => {
        const arr = [];
        scene.updateMatrixWorld(true);
        scene.traverse((obj) => {
            if (!obj.isMesh) return;
            arr.push({
                geometry: obj.geometry,
                matrix: obj.matrixWorld.clone(),
            });
        });
        return arr;
    }, [scene]);

    // Materials
    const lineMat = useMemo(() => {
        const m = new THREE.LineBasicMaterial({
            color: new THREE.Color("#ffffff"),
            transparent: true,
            opacity: 1,
        });
        return m;
    }, []);

    const glassMatProps = useMemo(
        () => ({
            transparent: true,
            roughness: 0.08,
            metalness: 0.0,
            transmission: 1,
            thickness: 0.9,
            ior: 1.45,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            envMapIntensity: 1.25,
            color: new THREE.Color("#cfffff"),
        }),
        []
    );

    // Build outline as edges lines (fast + clean)
    const edgeLines = useMemo(() => {
        // Merge multiple meshes into a single group of line segments
        return meshes.map((m, i) => {
            const edges = new THREE.EdgesGeometry(m.geometry, 15);
            const line = new THREE.LineSegments(edges, lineMat);
            // Apply original world matrix so the outline matches your GLB
            line.applyMatrix4(m.matrix);
            line.frustumCulled = false;
            return { id: i, line };
        });
    }, [meshes, lineMat]);

    // Keep the intro logo slightly alive
    useFrame((state) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;

        // Gentle float + tiny rotation (very controlled)
        groupRef.current.rotation.y = Math.sin(t * 0.35) * 0.08;
        groupRef.current.rotation.x = Math.sin(t * 0.25) * 0.05;
        groupRef.current.position.y = Math.sin(t * 0.5) * 0.03;

        // Apply outline opacity live
        lineMat.opacity = outlineOpacity;
    });

    // Timeline triggered by phase
    useEffect(() => {
        if (phase !== "ACTIVATE") return;

        const tl = gsap.timeline({
            defaults: { ease: "power2.out" },
        });

        // Frame 2: glass fades in, outline fades out slightly after
        tl.to(
            { v: 0 },
            {
                v: 1,
                duration: 0.9,
                onUpdate() {
                    setGlassOpacity(this.targets()[0].v);
                },
            },
            0
        ).to(
            { v: 1 },
            {
                v: 0.0,
                duration: 0.55,
                onUpdate() {
                    setOutlineOpacity(this.targets()[0].v);
                },
            },
            0.25
        );

        // Frame 3: shockwave pulse (your “wave shake”)
        tl.add(() => {
            setShockActive(true);
            setTimeout(() => setShockActive(false), 650);
        }, 0.95);

        // Frame 4: signal outro (LandingIntro fades out, then App crossfade shows Scene)
        tl.add(() => {
            onReadyForOutro?.();
            setPhase("OUTRO");
        }, 1.35);

        return () => tl.kill();
    }, [phase, onReadyForOutro, setPhase]);

    return (
        <>
            {/* The logo group */}
            <group ref={groupRef} position={[0, 0, 0]}>
                <Center>
                    {/* Outline: add line segments as primitives */}
                    <group>
                        {edgeLines.map(({ id, line }) => (
                            <primitive key={`line-${id}`} object={line} />
                        ))}
                    </group>

                    {/* Glass logo: draw the same meshes with a glass material */}
                    <group visible={glassOpacity > 0.001}>
                        {meshes.map((m, i) => (
                            <mesh
                                key={`glass-${i}`}
                                geometry={m.geometry}
                                matrix={m.matrix}
                                matrixAutoUpdate={false}
                                frustumCulled={false}
                            >
                                <meshPhysicalMaterial {...glassMatProps} opacity={glassOpacity} />
                            </mesh>
                        ))}
                    </group>
                </Center>
            </group>

            {/* Cinematic post FX */}
            <EffectComposer>
                <Bloom intensity={0.65} mipmapBlur />
                <ChromaticAberration offset={new THREE.Vector2(0.0006, 0.0006)} />
                <Noise opacity={0.03} />
                <Vignette eskil={false} offset={0.15} darkness={0.8} />

                {/* Frame 3 pulse */}
                {shockActive && (
                    <ShockWave
                        center={new THREE.Vector3(0, 0, 0)}
                        maxRadius={1.8}
                        waveSize={0.22}
                        amplitude={0.085} // this is your “wave shake” but premium (distortion, not camera jitter)
                        speed={0.95}
                    />
                )}
            </EffectComposer>
        </>
    );
}

function IntroOrchestrator({ onComplete, setIntroOpacity }) {
    const { active, progress } = useProgress();
    const [phase, setPhase] = useState("BOOT"); // BOOT -> ACTIVATE -> OUTRO

    // When assets are fully loaded, trigger ACTIVATE
    useEffect(() => {
        if (!active && phase === "BOOT") {
            setPhase("ACTIVATE");
        }
    }, [active, phase]);

    // When logo finished and we're in OUTRO, fade overlay out then call onComplete
    useEffect(() => {
        if (phase !== "OUTRO") return;

        const tl = gsap.timeline();
        tl.to(
            { v: 1 },
            {
                v: 0,
                duration: 0.7,
                ease: "power2.out",
                onUpdate() {
                    setIntroOpacity(this.targets()[0].v);
                },
                onComplete: () => onComplete?.(),
            }
        );

        return () => tl.kill();
    }, [phase, onComplete, setIntroOpacity]);

    return (
        <>
            <InitializingOverlay show={phase === "BOOT"} progress={progress} />

            <LogoOutlineAndGlass
                phase={phase}
                setPhase={setPhase}
                onReadyForOutro={() => {
                    // hook if you want to do extra things before fading out
                }}
            />
        </>
    );
}

export default function LandingIntro({ onComplete }) {
    const [opacity, setOpacity] = useState(1);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 999,
                opacity,
                pointerEvents: "none",
                background: "#020204",
            }}
        >
            <Canvas
                camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 1000 }}
                dpr={[1, 2]}
                gl={{ antialias: true, powerPreference: "high-performance" }}
            >
                <color attach="background" args={["#020204"]} />
                <ambientLight intensity={0.25} />
                <pointLight position={[6, 8, 6]} intensity={1.2} color={"#bffcff"} />
                <pointLight position={[-6, -6, 2]} intensity={0.7} color={"#6a00ff"} />

                <Suspense fallback={null}>
                    <IntroOrchestrator onComplete={onComplete} setIntroOpacity={setOpacity} />
                </Suspense>
            </Canvas>
        </div>
    );
}

// Preload the same GLB your main Artifact uses :contentReference[oaicite:6]{index=6}
useGLTF.preload("/models/aura-logo.glb");
