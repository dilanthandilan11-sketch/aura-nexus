//scene/Starfield.jsx
"use client"

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Pre-allocated objects to avoid GC pressure in hot path
const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

export default function Starfield({ count = 5000, targetRef }) {
    const meshRef = useRef();
    const { camera, pointer, raycaster } = useThree();

    // Data arrays
    const [data] = useState(() => ({
        positions: new Float32Array(count * 3),
        velocities: new Float32Array(count * 3),
        targets: new Float32Array(count * 3),
        originals: new Float32Array(count * 3), // Store original positions for pull-back
    }));

    // Helpers
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const mouse3D = useRef(new THREE.Vector3());
    const sphereCenter = useRef(new THREE.Vector3());
    const sphereFormed = useRef(false);
    const progress = useRef(0);
    const mouseDown = useRef(false);

    // Initialize positions
    useEffect(() => {
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            // Random scatter in a large volume
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = (Math.random() - 0.5) * 100;

            data.positions[i3] = x;
            data.positions[i3+1] = y;
            data.positions[i3+2] = z;

            // Store original positions for pull-back
            data.originals[i3] = x;
            data.originals[i3+1] = y;
            data.originals[i3+2] = z;

            // Sphere targets (Fibonacci Sphere)
            const phi = Math.acos(1 - 2 * (i + 0.5) / count);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            data.targets[i3] = Math.cos(theta) * Math.sin(phi) * 3.5;
            data.targets[i3+1] = Math.sin(theta) * Math.sin(phi) * 3.5;
            data.targets[i3+2] = Math.cos(phi) * 3.5;

            // Small initial velocity
            data.velocities[i3] = (Math.random() - 0.5) * 0.02;
            data.velocities[i3+1] = (Math.random() - 0.5) * 0.02;
            data.velocities[i3+2] = (Math.random() - 0.5) * 0.02;
        }
    }, []);

    // Mouse events
    useEffect(() => {
        const onDown = (e) => {
            if (e.button === 0) mouseDown.current = true;
        };
        const onUp = () => {
            mouseDown.current = false;
        };

        // Double-click to break sphere - GENTLER explosion
        const onDblClick = () => {
            if (sphereFormed.current) {
                sphereFormed.current = false;
                progress.current = 0;

                const { positions, velocities } = data;
                const cx = sphereCenter.current.x;
                const cy = sphereCenter.current.y;
                const cz = sphereCenter.current.z;

                for (let i = 0; i < count; i++) {
                    const i3 = i * 3;

                    const px = positions[i3];
                    const py = positions[i3+1];
                    const pz = positions[i3+2];

                    const dx = px - cx;
                    const dy = py - cy;
                    const dz = pz - cz;

                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.001;

                    // REDUCED explosion strength (was 2.5, now 0.6)
                    const explosionStrength = 0.6;
                    velocities[i3] = (dx / dist) * explosionStrength + (Math.random() - 0.5) * 0.2;
                    velocities[i3+1] = (dy / dist) * explosionStrength + (Math.random() - 0.5) * 0.2;
                    velocities[i3+2] = (dz / dist) * explosionStrength + (Math.random() - 0.5) * 0.2;
                }
            }
        };

        window.addEventListener('pointerdown', onDown);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        window.addEventListener('dblclick', onDblClick);

        return () => {
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            window.removeEventListener('dblclick', onDblClick);
        };
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        // Get sphere center from target ref (logo position)
        if (targetRef?.current) {
            targetRef.current.getWorldPosition(sphereCenter.current);
        } else {
            sphereCenter.current.set(0, 0, 0);
        }

        // Raycast for 3D mouse position (reuse pre-allocated plane)
        raycaster.setFromCamera(pointer, camera);
        raycastPlane.constant = -sphereCenter.current.z;
        raycaster.ray.intersectPlane(raycastPlane, mouse3D.current);

        const { positions, velocities, targets, originals } = data;

        // Formation progress
        if (mouseDown.current && !sphereFormed.current) {
            progress.current = Math.min(1, progress.current + delta * 0.15);
            if (progress.current > 0.95) {
                sphereFormed.current = true;
            }
        } else if (!mouseDown.current && !sphereFormed.current) {
            progress.current = Math.max(0, progress.current - delta * 0.3);
        }

        const formationStrength = progress.current * progress.current * progress.current; // Ease curve

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            let px = positions[i3];
            let py = positions[i3+1];
            let pz = positions[i3+2];

            let vx = velocities[i3];
            let vy = velocities[i3+1];
            let vz = velocities[i3+2];

            if (sphereFormed.current || formationStrength > 0.01) {
                // === SPHERE FORMATION MODE ===

                // Target position on sphere (relative to center)
                const tx = sphereCenter.current.x + targets[i3];
                const ty = sphereCenter.current.y + targets[i3+1];
                const tz = sphereCenter.current.z + targets[i3+2];

                // Direction to target
                const dx = tx - px;
                const dy = ty - py;
                const dz = tz - pz;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                if (dist > 0.01) {
                    // Attraction to sphere position
                    const strength = sphereFormed.current
                        ? THREE.MathUtils.lerp(12.0, 18.0, 1 - Math.min(1, dist / 2.0))
                        : THREE.MathUtils.lerp(5.0, 20.0, formationStrength);

                    vx += (dx / dist) * strength * delta;
                    vy += (dy / dist) * strength * delta;
                    vz += (dz / dist) * strength * delta;
                }

                // Mouse attraction when sphere is formed
                if (sphereFormed.current && mouse3D.current) {
                    const mdx = mouse3D.current.x - px;
                    const mdy = mouse3D.current.y - py;
                    const mdz = mouse3D.current.z - pz;
                    const mDist = Math.sqrt(mdx*mdx + mdy*mdy + mdz*mdz);

                    const attractRadius = 3.0;
                    if (mDist < attractRadius && mDist > 0.01) {
                        const falloff = (1 - mDist / attractRadius);
                        const smoothFalloff = falloff * falloff * falloff;
                        const attractStrength = smoothFalloff * 8.0;

                        vx += (mdx / mDist) * attractStrength * delta;
                        vy += (mdy / mDist) * attractStrength * delta;
                        vz += (mdz / mDist) * attractStrength * delta;
                    }
                }

                // Damping
                const dampFactor = sphereFormed.current ? 0.94 : 0.92;
                vx *= dampFactor;
                vy *= dampFactor;
                vz *= dampFactor;

                // Jitter when stable
                if (sphereFormed.current && dist < 0.15) {
                    vx += (Math.random() - 0.5) * 0.0005;
                    vy += (Math.random() - 0.5) * 0.0005;
                    vz += (Math.random() - 0.5) * 0.0005;
                }

            } else {
                // === IDLE DRIFT MODE ===

                // Gentle damping
                vx *= 0.997;
                vy *= 0.997;
                vz *= 0.997;

                // Pull back if too far from visible area
                const distFromCenter = Math.sqrt(px*px + py*py + pz*pz);
                const maxDist = 60;

                if (distFromCenter > maxDist) {
                    // Pull toward center
                    const pullStrength = (distFromCenter - maxDist) * 0.015;
                    vx -= (px / distFromCenter) * pullStrength * delta;
                    vy -= (py / distFromCenter) * pullStrength * delta;
                    vz -= (pz / distFromCenter) * pullStrength * delta;
                }

                // Gentle pull toward original scattered position
                const ox = originals[i3];
                const oy = originals[i3+1];
                const oz = originals[i3+2];

                const odx = ox - px;
                const ody = oy - py;
                const odz = oz - pz;
                const oDist = Math.sqrt(odx*odx + ody*ody + odz*odz);

                if (oDist > 1) {
                    const pullStrength = 0.3;
                    vx += (odx / oDist) * pullStrength * delta;
                    vy += (ody / oDist) * pullStrength * delta;
                    vz += (odz / oDist) * pullStrength * delta;
                }
            }

            // Integrate velocity
            px += vx * delta * 50;
            py += vy * delta * 50;
            pz += vz * delta * 50;

            // Write back
            positions[i3] = px;
            positions[i3+1] = py;
            positions[i3+2] = pz;

            velocities[i3] = vx;
            velocities[i3+1] = vy;
            velocities[i3+2] = vz;

            // Update instance matrix
            dummy.position.set(px, py, pz);

            // Scale based on speed for visual feedback
            const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
            const scale = Math.min(1.2, Math.max(0.3, 0.5 + speed * 3));
            dummy.scale.setScalar(scale);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[null, null, count]} frustumCulled={false}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </instancedMesh>
    );
}