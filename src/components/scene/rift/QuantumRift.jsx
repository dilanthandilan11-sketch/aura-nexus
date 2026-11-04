"use client";

/**
 * QuantumRift.jsx
 * ===============
 * WebGL pieces of the hero -> void transition. Each reads the shared mutable
 * `rift` state (tweened by riftTimeline.js) inside useFrame and writes to
 * refs / uniforms directly: no React state, no re-renders while scrolling.
 * Every piece early-outs (and hides itself) while it has nothing to show,
 * so the landing pays no extra cost.
 *
 *   RiftCamera    camera z, chasing the logo
 *   VoidSphere    the dark void behind everything, masked by the tear
 *   RiftFissure   crackling energy along the tear edges
 *   VoidDebris    stars, violet/blue dust and data matrices warping past
 */

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  VOID_VERTEX, VOID_FRAGMENT,
  RIFT_VERTEX, RIFT_FRAGMENT,
  DEBRIS_VERTEX, DEBRIS_FRAGMENT,
} from "./riftShaders";

// Seeded PRNG (mulberry32): deterministic, render-pure instance layouts
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Camera ────────────────────────────────────────────────────────────────
export function RiftCamera({ rift }) {
  useFrame(({ camera }) => {
    camera.position.z = rift.camZ;
  });
  return null;
}

// ── Void ──────────────────────────────────────────────────────────────────
// Blank 1x1 stand-in so the sampler is always bound before the HDRI arrives
const BLANK_MAP = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLANK_MAP.needsUpdate = true;

// mapRef: { current: THREE.Texture | null }, filled once the HDRI has loaded
export function VoidSphere({ rift, mapRef = null, exposure = 1 }) {
  const meshRef = useRef();
  const matRef  = useRef();

  const uniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uAspect:   { value: 1 },
    uBreak:    { value: 0 },
    uOpen:     { value: 0 },
    uDark:     { value: 0 },
    uMap:      { value: BLANK_MAP },
    uMapMix:   { value: 0 },
    uExposure: { value: exposure },
  }), [exposure]);

  useFrame(({ camera, clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !matRef.current) return;
    mesh.visible = rift.open > 0.001;
    if (!mesh.visible) return;

    mesh.position.copy(camera.position);
    const u = matRef.current.uniforms;
    u.uTime.value   = clock.elapsedTime;
    u.uAspect.value = camera.aspect;
    u.uBreak.value  = rift.break;
    u.uOpen.value   = rift.open;
    u.uDark.value   = rift.dark;

    // HDRI: bind as soon as it has loaded, then cross-fade it in (~0.7s)
    const map = mapRef?.current;
    if (map && u.uMap.value !== map) u.uMap.value = map;
    const target = map ? 1 : 0;
    u.uMapMix.value = THREE.MathUtils.damp(u.uMapMix.value, target, 4, delta);
  });

  return (
    // Draw order (transparent pass):
    //   0    hero layers (aurora, landing dust) + the glass logo
    //   0.5  this void: covers the hero inside the tear; the glass already
    //        wrote depth, so the logo stays in front of it
    //   1    logo rim / edge glints
    //   2    void debris + services orbit
    //   999  rift edge energy
    <mesh ref={meshRef} renderOrder={0.5} frustumCulled={false} visible={false}>
      <sphereGeometry args={[300, 48, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VOID_VERTEX}
        fragmentShader={VOID_FRAGMENT}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Rift edge energy ──────────────────────────────────────────────────────
export function RiftFissure({ rift }) {
  const meshRef = useRef();
  const matRef  = useRef();

  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uAspect:  { value: 1 },
    uBreak:   { value: 0 },
    uOpen:    { value: 0 },
    uCrackle: { value: 0 },
  }), []);

  useFrame(({ camera, clock }) => {
    const mesh = meshRef.current;
    if (!mesh || !matRef.current) return;
    mesh.visible = rift.crackle > 0.002;
    if (!mesh.visible) return;

    const u = matRef.current.uniforms;
    u.uTime.value    = clock.elapsedTime;
    u.uAspect.value  = camera.aspect;
    u.uBreak.value   = rift.break;
    u.uOpen.value    = rift.open;
    u.uCrackle.value = rift.crackle;
  });

  return (
    <mesh ref={meshRef} renderOrder={999} frustumCulled={false} visible={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={RIFT_VERTEX}
        fragmentShader={RIFT_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

// ── Void debris ───────────────────────────────────────────────────────────
const TUNNEL_DEPTH = 60;

function useDebrisLayout(count, seed, minR, maxR) {
  return useMemo(() => {
    const rand = seeded(seed);
    const offsets = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Hollow tube around the flight path: nothing flies through the
      // logo or straight into the lens.
      const a = rand() * Math.PI * 2;
      const r = minR + Math.sqrt(rand()) * (maxR - minR);
      offsets[i * 3]     = Math.cos(a) * r;
      offsets[i * 3 + 1] = Math.sin(a) * r;
      offsets[i * 3 + 2] = -rand() * TUNNEL_DEPTH;
      seeds[i] = rand();
    }
    return { offsets, seeds };
  }, [count, seed, minR, maxR]);
}

function DebrisLayer({
  rift, warpRef, count, seed, minR, maxR,
  geometry, stretch, bright, colorA, colorB, matrix = false,
}) {
  const { offsets, seeds } = useDebrisLayout(count, seed, minR, maxR);
  const matRef = useRef();

  const uniforms = useMemo(() => ({
    uCamZ:    { value: 6 },
    uTravel:  { value: 0 },
    uDepth:   { value: TUNNEL_DEPTH },
    uWarp:    { value: 0 },
    uStretch: { value: stretch },
    uFade:    { value: 0 },
    uBright:  { value: bright },
    uColorA:  { value: new THREE.Color(colorA) },
    uColorB:  { value: new THREE.Color(colorB) },
    uMatrix:  { value: matrix ? 1 : 0 },
    uTime:    { value: 0 },
  }), [stretch, bright, colorA, colorB, matrix]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uCamZ.value   = rift.camZ;
    u.uTravel.value = rift.travel;
    u.uWarp.value   = warpRef.current;
    u.uFade.value = rift.warpFade;
    u.uTime.value = clock.elapsedTime;
  });

  return (
    // renderOrder 2: always after the glass logo, so sorting can't flip
    // between frames while the camera moves
    <instancedMesh args={[undefined, undefined, count]} frustumCulled={false} renderOrder={2}>
      {geometry === "plane"
        ? (
          <planeGeometry args={[0.16, 0.1]}>
            <instancedBufferAttribute attach="attributes-aOffset" args={[offsets, 3]} />
            <instancedBufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
          </planeGeometry>
        ) : (
          <boxGeometry args={geometry}>
            <instancedBufferAttribute attach="attributes-aOffset" args={[offsets, 3]} />
            <instancedBufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
          </boxGeometry>
        )}
      <shaderMaterial
        ref={matRef}
        vertexShader={DEBRIS_VERTEX}
        fragmentShader={DEBRIS_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export function VoidDebris({ rift, reduceMotion = false }) {
  const groupRef = useRef();
  const lastZ    = useRef(rift.travel);
  const warp     = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.visible = rift.warpFade > 0.001;

    // Warp from travel speed (units / s), smoothed so streaks ramp in and
    // decay naturally as the plunge slows.
    const speed = Math.abs(rift.travel - lastZ.current) / Math.max(delta, 1e-4);
    lastZ.current = rift.travel;
    const target = reduceMotion ? 0 : THREE.MathUtils.clamp(speed / 10, 0, 1);
    warp.current = THREE.MathUtils.damp(warp.current, target, 6, delta);
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Faint cosmic stars: thin slivers, long streaks at warp */}
      <DebrisLayer
        rift={rift} warpRef={warp} count={1800} seed={71} minR={0.9} maxR={14}
        geometry={[0.01, 0.01, 0.08]} stretch={24} bright={1.1}
        colorA="#bfe9ff" colorB="#7fa8ff"
      />
      {/* Dark blue / violet dust: dimmer, denser, shorter streaks */}
      <DebrisLayer
        rift={rift} warpRef={warp} count={2600} seed={233} minR={0.7} maxR={16}
        geometry={[0.008, 0.008, 0.05]} stretch={14} bright={0.45}
        colorA="#2a3cff" colorB="#6b2bd9"
      />
      {/* Cyber data matrices: small HUD-like dot grids drifting past */}
      <DebrisLayer
        rift={rift} warpRef={warp} count={140} seed={409} minR={1.8} maxR={9}
        geometry="plane" stretch={0} bright={0.9}
        colorA="#4fd8ff" colorB="#8a7bff" matrix
      />
    </group>
  );
}
