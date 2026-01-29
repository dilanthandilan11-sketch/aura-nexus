// src/scene/Artifact.jsx
import React, { forwardRef, useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, useGLTF, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

const Artifact = forwardRef(function Artifact(
    { pointerPos, mood = null, freeze = false },
    externalRef
) {
    const internalRef = useRef();
    const group = externalRef ?? internalRef;
    const { gl } = useThree();

    const { scene } = useGLTF("/models/aura-logo.glb");

    // Glass transmission material settings - OPTIMIZED
    const glass = useMemo(
        () => ({
            backside: true,
            samples: 16,
            resolution: 1024,
            thickness: 0.5,
            chromaticAberration: 0.05,
            anisotropy: 0.1,
            distortion: 0.2,
            ior: 1.5,
            reflectivity: 0.2,
            distortionScale: 0.5,
            temporalDistortion: 0.1,
            color: "#1a4e4d",
            transparent: true,
            transmission: 0.8,
        }),
        []
    );

    // Collect all meshes from the GLB
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

    // Force initial render
    useEffect(() => {
        gl.render(scene, { camera: { position: [0, 0, 6] } });
    }, [gl, scene]);

    useFrame((state, delta) => {
        if (!group.current) return;

        group.current.rotation.y += 0.001;

        // pointer-reactive rotation (smooth)
        if (state.pointer && !freeze) {
            const { x, y } = state.pointer;
            // Lower lerp factor (0.05) for smoother "weighty" feel
            group.current.rotation.y = THREE.MathUtils.lerp(
                group.current.rotation.y,
                x * 0.5,
                0.05
            );
            group.current.rotation.x = THREE.MathUtils.lerp(
                group.current.rotation.x,
                -y * 0.5,
                0.05
            );
        }

        // Gentle floating animation
        if (!freeze) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
        }
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
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />

            <Center scale={1.5}>
                {/* Glass Logo */}
                {meshes.map((m, i) => (
                    <mesh
                        key={`glass-${i}`}
                        geometry={m.geometry}
                        matrix={m.matrix}
                        matrixAutoUpdate={false}
                        frustumCulled={false}
                    >
                        <MeshTransmissionMaterial {...glass} />
                    </mesh>
                ))}
            </Center>
        </group>
    );
});

export default Artifact;

useGLTF.preload("/models/aura-logo.glb");