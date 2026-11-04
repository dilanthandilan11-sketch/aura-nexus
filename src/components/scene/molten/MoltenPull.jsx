// src/components/scene/molten/MoltenPull.jsx
// Molten liquid-metal splash behind the logo. Press and hold anywhere:
//  - the splash is pulled outward from the logo and bows toward the camera
//    (3D), stretching into long glossy ribbons that stream outward
//  - a heat glow appears under the cursor and the liquid is pushed away from it
//  - the burst behind the logo flares up (bloom/CA boost lives in Scene.jsx)
// Release and it springs back.
"use client";

import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { moltenVertex, moltenFragment } from "./moltenShaders";
import { holdState } from "./holdState";

const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _hit   = new THREE.Vector3();
const _uv    = new THREE.Vector2();

export default function MoltenPull({
    z = -2.5,             // world depth of the splash (logo sits at 0)
    overscan = 1.15,      // plane size relative to the visible area
    visibleRef,           // { current: 0..1 } overall visibility (landing fade)
    colors = {
        deep: "#2a0400",
        mid:  "#ff4d00",
        hot:  "#ffa21a",
        core: "#fff1c4",
    },
}) {
    const meshRef = useRef();
    const { camera, pointer, raycaster } = useThree();

    const uniforms = useMemo(() => ({
        uTime:    { value: 0 },
        uHold:    { value: 0 },
        uPress:   { value: 0 },
        uFlow:    { value: 0 },
        uOpacity: { value: 0 },
        uAspect:  { value: 16 / 9 },
        uMouse:   { value: new THREE.Vector2(0.5, 0.5) },
        uDeep:    { value: new THREE.Color(colors.deep) },
        uMid:     { value: new THREE.Color(colors.mid) },
        uHot:     { value: new THREE.Color(colors.hot) },
        uCore:    { value: new THREE.Color(colors.core) },
    // colors are read once; pass a new key to remount if you change them live
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    useFrame((state) => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const vis = (visibleRef?.current ?? 1) * holdState.gate;
        mesh.visible = vis > 0.002;
        uniforms.uOpacity.value = vis;
        if (!mesh.visible) return;

        // Fill the view at this depth (camera can move / aspect can change)
        const dist = Math.max(0.5, camera.position.z - z);
        const vh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const vw = vh * camera.aspect;
        mesh.position.set(camera.position.x, camera.position.y, z);
        mesh.scale.set(vw * overscan, vh * overscan, 1);
        uniforms.uAspect.value = vw / vh;

        uniforms.uTime.value  = state.clock.elapsedTime;
        uniforms.uHold.value  = holdState.value * holdState.gate;
        uniforms.uPress.value = holdState.press * holdState.gate;
        uniforms.uFlow.value  = holdState.flow;

        // Cursor -> plane UV
        raycaster.setFromCamera(pointer, camera);
        _plane.constant = -z;
        if (raycaster.ray.intersectPlane(_plane, _hit)) {
            const u = (_hit.x - mesh.position.x) / mesh.scale.x + 0.5;
            const v = (_hit.y - mesh.position.y) / mesh.scale.y + 0.5;
            uniforms.uMouse.value.lerp(_uv.set(u, v), 0.35);
        }
    });

    return (
        <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
            <planeGeometry args={[1, 1, 96, 64]} />
            <shaderMaterial
                vertexShader={moltenVertex}
                fragmentShader={moltenFragment}
                uniforms={uniforms}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
            />
        </mesh>
    );
}
