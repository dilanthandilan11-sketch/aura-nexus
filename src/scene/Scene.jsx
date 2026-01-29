// src/scene/Scene.jsx
import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, Noise } from "@react-three/postprocessing";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

import Artifact from "./Artifact.jsx";
import StarfieldWithHands from "./StarfieldWithHands.jsx";
import AuroraStreaksFlowing from "./AuroraStreaksFlowing.jsx";
import HandTracking from "./HandTracking.jsx";
import SceneText from "./SceneText.jsx";

// Nebula Background
function NebulaBackground() {
    const texture = useLoader(RGBELoader, '/hdri/Nebula_N0.hdr');
    texture.mapping = THREE.EquirectangularReflectionMapping;

    return (
        <mesh>
            <sphereGeometry args={[500, 64, 64]} />
            <meshBasicMaterial
                map={texture}
                side={THREE.BackSide}
                toneMapped={false}
            />
        </mesh>
    );
}

// 3D Scene Content
function SceneContent({ handData, useHandControl, rotation }) {
    const groupRef = useRef();
    const logoCenterRef = useRef(null);

    useFrame(() => {
        if (!groupRef.current) return;
        groupRef.current.rotation.x = rotation.x;
        groupRef.current.rotation.y = rotation.y;
        groupRef.current.rotation.z = rotation.z;
    });

    return (
        <group ref={groupRef}>
            <NebulaBackground />

            <group position={[0, 0, -20]}>
                <AuroraStreaksFlowing count={1} opacity={0.3} intensity={0.8} speed={0.25} colorScheme={0} offset={0} />
                <AuroraStreaksFlowing count={1} opacity={0.25} intensity={0.7} speed={0.2} colorScheme={1} offset={1.5} />
            </group>

            <StarfieldWithHands
                targetRef={logoCenterRef}
                handData={handData}
                useHandControl={useHandControl}
                count={4000}
            />

            <Artifact ref={logoCenterRef} mood={null} freeze={false} />

            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={1.0} color="#00cfff" />
            <pointLight position={[-10, -10, -5]} intensity={0.8} color="#4B0082" />
        </group>
    );
}

// Main Scene
export default function Scene() {
    const [useHandControl, setUseHandControl] = useState(false);
    const [handData, setHandData] = useState(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

    // Handle rotation updates from both mouse and hand
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (useHandControl) return;

            const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            const mouseY = (e.clientY / window.innerHeight) * 2 - 1;

            setRotation(prev => ({
                x: THREE.MathUtils.lerp(prev.x, -mouseY * Math.PI * 0.2, 0.05),
                y: THREE.MathUtils.lerp(prev.y, mouseX * Math.PI * 0.3, 0.05),
                z: prev.z
            }));
        };

        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (key === "h") setUseHandControl(prev => !prev);
            if (key === "r") setRotation({ x: 0, y: 0, z: 0 });
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [useHandControl]);

    // Update rotation based on hand data
    useEffect(() => {
        if (!useHandControl || !handData) return;

        const { palmPos } = handData;
        const handX = (1 - palmPos.x) * 2 - 1;
        const handY = palmPos.y * 2 - 1;

        setRotation(prev => ({
            x: THREE.MathUtils.lerp(prev.x, -handY * Math.PI * 0.3, 0.08),
            y: THREE.MathUtils.lerp(prev.y, handX * Math.PI * 0.4, 0.08),
            z: prev.z
        }));
    }, [handData, useHandControl]);

    return (
        <div style={{
            width: "100vw",
            height: "100vh",
            backgroundColor: "#020204",
            overflow: "hidden",
            position: "relative"
        }}>
            <HandTracking enabled={useHandControl} onHandData={setHandData} />

            {/* 3D Scene */}
            <Canvas
                camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 1000 }}
                gl={{ antialias: false, powerPreference: "high-performance" }}
                dpr={[1, 2]}
                style={{ position: 'absolute', inset: 0, zIndex: 1 }}
            >
                <Suspense fallback={null}>
                    <SceneContent
                        handData={handData}
                        useHandControl={useHandControl}
                        rotation={rotation}
                    />
                    <EffectComposer>
                        <Bloom intensity={0.2} luminanceThreshold={0.9} />
                        <ChromaticAberration offset={[0.0005, 0.0005]} />
                        <Noise opacity={0.03} />
                    </EffectComposer>
                </Suspense>
            </Canvas>

            {/* Text Overlay */}
            <SceneText />

            {/* Controls Info */}
            <div style={{
                position: 'fixed',
                bottom: '30px',
                right: '20px',
                color: 'rgba(255,255,255,0.3)',
                fontSize: '11px',
                fontFamily: "'Sora', monospace",
                pointerEvents: 'none',
                zIndex: 200,
                textAlign: 'right',
                lineHeight: 1.6
            }}>
                <div>[H] Hand Control: {useHandControl ? 'ON' : 'OFF'}</div>
                <div>[R] Reset View</div>
                {useHandControl && handData && (
                    <div style={{ marginTop: '5px', color: 'rgba(0,174,239,0.6)' }}>
                        ✋ Hand detected
                    </div>
                )}
            </div>
        </div>
    );
}