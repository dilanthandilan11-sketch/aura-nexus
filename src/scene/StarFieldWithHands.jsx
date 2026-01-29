// src/scene/StarfieldWithHands.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function StarfieldWithHands({
                                               targetRef,
                                               count = 4000, // Reduced default from 8000 for performance
                                               radius = 80,
                                               handData = null,  // Hand tracking data from HandTracking component
                                               useHandControl = false  // Toggle between mouse and hand control
                                           }) {
    const pointsRef = useRef();
    const [mouseDown, setMouseDown] = useState(false);

    // Get camera and pointer from Three.js for proper 3D mouse tracking
    const { camera, pointer, raycaster } = useThree();

    // 0 → 1 ramp value (accelerates while holding)
    const hold = useRef(0);

    // Track if sphere is formed (stays true after formation)
    const sphereFormed = useRef(false);
    const formationProgress = useRef(0); // 0 to 1 progress of formation

    // Mouse/Hand position in 3D space for attraction
    const interactionPoint = useRef(new THREE.Vector3());
    const sphereCenter = useRef(new THREE.Vector3());

    // Store target sphere positions for each particle
    const targetPositions = useMemo(() => {
        const targets = new Float32Array(count * 3);
        const sphereRadius = 2.2; // Smaller, tighter sphere

        for (let i = 0; i < count; i++) {
            const idx = i * 3;

            // Evenly distribute particles on sphere surface using Fibonacci sphere
            const phi = Math.acos(1 - 2 * (i + 0.5) / count);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            const x = Math.cos(theta) * Math.sin(phi);
            const y = Math.sin(theta) * Math.sin(phi);
            const z = Math.cos(phi);

            // Add slight randomization for more organic look
            const noise = 0.05;
            targets[idx] = x * sphereRadius * (1 + (Math.random() - 0.5) * noise);
            targets[idx + 1] = y * sphereRadius * (1 + (Math.random() - 0.5) * noise);
            targets[idx + 2] = z * sphereRadius * (1 + (Math.random() - 0.5) * noise);
        }

        return targets;
    }, [count]);

    const { positions, velocities } = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const idx = i * 3;

            // random point inside sphere volume
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const r = radius * Math.cbrt(Math.random());
            const sinPhi = Math.sin(phi);

            positions[idx] = r * sinPhi * Math.cos(theta);
            positions[idx + 1] = r * sinPhi * Math.sin(theta);
            positions[idx + 2] = r * Math.cos(phi);

            // tiny drift
            velocities[idx] = (Math.random() - 0.5) * 0.02;
            velocities[idx + 1] = (Math.random() - 0.5) * 0.02;
            velocities[idx + 2] = (Math.random() - 0.5) * 0.02;
        }

        return { positions, velocities };
    }, [count, radius]);

    useEffect(() => {
        const down = (e) => {
            if (e.button === 0 && !useHandControl) setMouseDown(true);
        };
        const up = () => setMouseDown(false);

        // Double-click to break sphere (particles drift away naturally)
        const doubleClick = () => {
            sphereFormed.current = false;
            formationProgress.current = 0;
            hold.current = 0;

            // Add outward velocity to make particles drift away
            if (pointsRef.current) {
                const posAttr = pointsRef.current.geometry.getAttribute("position");
                const arr = posAttr.array;

                for (let i = 0; i < count; i++) {
                    const idx = i * 3;

                    // Get current position
                    const px = arr[idx];
                    const py = arr[idx + 1];
                    const pz = arr[idx + 2];

                    // Calculate direction from center
                    const cx = sphereCenter.current.x;
                    const cy = sphereCenter.current.y;
                    const cz = sphereCenter.current.z;

                    const dx = px - cx;
                    const dy = py - cy;
                    const dz = pz - cz;

                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.001;

                    // Add outward velocity (explosion effect)
                    const explosionStrength = 2.5;
                    velocities[idx] = (dx / dist) * explosionStrength + (Math.random() - 0.5) * 0.5;
                    velocities[idx + 1] = (dy / dist) * explosionStrength + (Math.random() - 0.5) * 0.5;
                    velocities[idx + 2] = (dz / dist) * explosionStrength + (Math.random() - 0.5) * 0.5;
                }

                posAttr.needsUpdate = true;
            }
        };

        if (!useHandControl) {
            window.addEventListener("pointerdown", down);
            window.addEventListener("pointerup", up);
            window.addEventListener("pointercancel", up);
        }
        window.addEventListener("dblclick", doubleClick);

        return () => {
            window.removeEventListener("pointerdown", down);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            window.removeEventListener("dblclick", doubleClick);
        };
    }, [count, velocities, useHandControl]);

    // temp vectors (no allocations per star)
    const p = useMemo(() => new THREE.Vector3(), []);
    const vel = useMemo(() => new THREE.Vector3(), []);
    const dir = useMemo(() => new THREE.Vector3(), []);
    const targetPos = useMemo(() => new THREE.Vector3(), []);
    const centerTarget = useMemo(() => new THREE.Vector3(), []);

    // nice "accelerating" curve (slow -> fast)
    const accelCurve = (x) => x * x * x;

    useFrame((_, delta) => {
        const geom = pointsRef.current?.geometry;
        if (!geom) return;

        // Get logo center world position
        if (targetRef?.current) {
            targetRef.current.getWorldPosition(centerTarget);
            sphereCenter.current.copy(centerTarget);
        } else {
            centerTarget.set(0, 0, 0);
            sphereCenter.current.set(0, 0, 0);
        }

        // Update interaction point based on control mode
        if (useHandControl && handData) {
            // HAND CONTROL MODE

            // Convert normalized hand position (0-1) to 3D world space
            // Flip X for natural mirroring, invert Y because hand coords are top-down
            const handX = (1 - handData.palmPos.x) * 2 - 1; // Flip and convert to -1 to 1
            const handY = -(handData.palmPos.y * 2 - 1); // Invert Y and convert to -1 to 1

            // Map to world coordinates around the sphere
            const worldX = handX * 5;
            const worldY = handY * 5;
            const worldZ = sphereCenter.current.z + (handData.palmPos.z * 3); // Add depth

            interactionPoint.current.set(worldX, worldY, worldZ);

            // Hand tension controls formation (0 = fist/closed, 1 = open)
            // Open hand = form sphere, Closed fist = break sphere
            const targetFormation = handData.tension; // 0 to 1

            if (handData.gestures.openHand && !sphereFormed.current) {
                // Open hand gesture - start forming sphere
                hold.current = Math.min(1, hold.current + delta * 0.15);
                formationProgress.current = Math.min(1, formationProgress.current + delta * 0.15);

                if (formationProgress.current > 0.95) {
                    sphereFormed.current = true;
                }
            } else if (handData.gestures.fist && sphereFormed.current) {
                // Fist gesture - break sphere
                sphereFormed.current = false;
                formationProgress.current = 0;
                hold.current = 0;
            } else if (!sphereFormed.current && handData.tension > 0.6) {
                // Gradual formation based on hand openness
                hold.current = Math.min(1, hold.current + delta * 0.15);
                formationProgress.current = Math.min(1, formationProgress.current + delta * 0.15);

                if (formationProgress.current > 0.95) {
                    sphereFormed.current = true;
                }
            } else if (!sphereFormed.current) {
                hold.current = Math.max(0, hold.current - delta * 0.3);
                formationProgress.current = Math.max(0, formationProgress.current - delta * 0.3);
            }

        } else {
            // MOUSE CONTROL MODE

            // Update 3D mouse position using raycaster
            raycaster.setFromCamera(pointer, camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -sphereCenter.current.z);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersectPoint);
            if (intersectPoint) {
                interactionPoint.current.copy(intersectPoint);
            }

            // Mouse control - slower ramp for 6-10 second formation
            const upRate = 0.15;
            const downRate = 0.3;

            if (mouseDown && !sphereFormed.current) {
                hold.current = Math.min(1, hold.current + delta * upRate);
                formationProgress.current = Math.min(1, formationProgress.current + delta * upRate);

                if (formationProgress.current > 0.95) {
                    sphereFormed.current = true;
                }
            } else if (!mouseDown && !sphereFormed.current) {
                hold.current = Math.max(0, hold.current - delta * downRate);
                formationProgress.current = Math.max(0, formationProgress.current - delta * downRate);
            }
        }

        const a = accelCurve(hold.current); // 0..1 accelerated

        const posAttr = geom.getAttribute("position");
        const arr = posAttr.array;

        for (let i = 0; i < count; i++) {
            const idx = i * 3;

            p.set(arr[idx], arr[idx + 1], arr[idx + 2]);
            vel.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);

            if (sphereFormed.current || a > 0.01) {
                // SPHERE FORMATION OR STABLE MODE

                // Get this particle's target position on the sphere (relative to center)
                targetPos.set(
                    centerTarget.x + targetPositions[idx],
                    centerTarget.y + targetPositions[idx + 1],
                    centerTarget.z + targetPositions[idx + 2]
                );

                // INTERACTION ATTRACTION (mouse or hand) - only when sphere is formed
                if (sphereFormed.current) {
                    const distToInteraction = p.distanceTo(interactionPoint.current);
                    const attractRadius = 3.0;

                    if (distToInteraction < attractRadius) {
                        dir.copy(interactionPoint.current).sub(p);
                        if (dir.lengthSq() > 0.001) {
                            dir.normalize();
                            const falloff = (1 - distToInteraction / attractRadius);
                            const smoothFalloff = falloff * falloff * falloff;

                            // Stronger attraction in hand mode
                            const baseStrength = useHandControl ? 10.0 : 8.0;
                            const attractStrength = smoothFalloff * baseStrength;
                            vel.addScaledVector(dir, attractStrength * delta);
                        }
                    }
                }

                // Direction to target sphere position
                dir.copy(targetPos).sub(p);
                const dist = dir.length();

                if (dist > 0.01) {
                    dir.normalize();

                    const attractionStrength = sphereFormed.current
                        ? THREE.MathUtils.lerp(12.0, 18.0, 1 - (dist / 2.0))
                        : THREE.MathUtils.lerp(5.0, 20.0, a);

                    vel.addScaledVector(dir, attractionStrength * delta);

                    const dampFactor = sphereFormed.current ? 0.94 : 0.92;
                    vel.multiplyScalar(dampFactor);
                } else {
                    vel.multiplyScalar(0.88);
                }

                if (sphereFormed.current && dist < 0.15) {
                    const jitter = 0.0005;
                    vel.x += (Math.random() - 0.5) * jitter;
                    vel.y += (Math.random() - 0.5) * jitter;
                    vel.z += (Math.random() - 0.5) * jitter;
                }

            } else {
                // IDLE DRIFT MODE
                const driftDamp = 0.997;
                vel.multiplyScalar(driftDamp);
            }

            // Integrate
            p.addScaledVector(vel, delta * 50);

            // write back
            arr[idx] = p.x;
            arr[idx + 1] = p.y;
            arr[idx + 2] = p.z;

            velocities[idx] = vel.x;
            velocities[idx + 1] = vel.y;
            velocities[idx + 2] = vel.z;
        }

        posAttr.needsUpdate = true;
    });

    return (
        <points ref={pointsRef} frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" array={positions} itemSize={3} count={count} />
            </bufferGeometry>

            <pointsMaterial
                size={0.025}
                color="#ffffff"
                transparent
                opacity={0.9}
                depthWrite={false}
                sizeAttenuation={true}
            />
        </points>
    );
}