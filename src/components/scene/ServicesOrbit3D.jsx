"use client";

/**
 * ServicesOrbit3D.jsx
 * ===================
 * WebGL orbit for SCROLL PHASE 4 (rendered inside Scene's Canvas).
 * The glass logo reforms as the core (Artifact.jsx) and the five services
 * orbit it on a tilted ring: glowing torus, particle belt, wireframe nodes.
 * The selected node rotates to the front; a beam grows from the core to it
 * and its length is the auto-advance timer.
 *
 * Labels are drei <Html> buttons, so they sit in real 3D perspective but
 * stay clickable and keyboard reachable.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import {
  SERVICES,
  ADVANCE_SECONDS,
  ORBIT_TILT,
  ORBIT_ROLL,
  getOrbitLayout,
  frameViewport,
  SERVICES_REVEAL,
  SERVICES_SETTLED,
} from "./servicesData";
import styles from "./services.module.css";

const COUNT = SERVICES.length;
const STEP  = (Math.PI * 2) / COUNT;
const FRONT = Math.PI / 2; // local +z = closest to the camera

const clamp        = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const invLerp      = (a, b, v)   => clamp((v - a) / (b - a), 0, 1);
const easeOutCubic = (t)         => 1 - Math.pow(1 - t, 3);

// HDR colours (> 1) so the scene's Bloom pass picks them up
const CYAN      = new THREE.Color("#00d4ff");
const RING_COL  = CYAN.clone().multiplyScalar(1.1);
const BEAM_COL  = CYAN.clone().multiplyScalar(1.8);
const CORE_DIM  = CYAN.clone().multiplyScalar(0.7);
const CORE_HOT  = new THREE.Color("#bff4ff").multiplyScalar(3.2);
const SHELL_DIM = CYAN.clone().multiplyScalar(0.55);
const SHELL_HOT = CYAN.clone().multiplyScalar(2.2);
const SPARK_COL = new THREE.Color("#dffaff").multiplyScalar(2.6);

// Inactive nodes stay quiet; the active one is the obvious star
const SHELL_SCALE_DIM = 0.55;
const SHELL_SCALE_HOT = 1.3;
const SPARKS = 3;

const BELT_COUNT = 520;

// Seeded PRNG (mulberry32) so the belt is deterministic and render-pure
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

function Belt({ R }) {
  const ref = useRef();

  const positions = useMemo(() => {
    const rand = seeded(1307);
    const arr = new Float32Array(BELT_COUNT * 3);
    for (let i = 0; i < BELT_COUNT; i++) {
      const a = rand() * Math.PI * 2;
      // Denser near the ring, thinning outward
      const spread = (rand() + rand() - 1) * 0.16;
      const r = R * (1 + spread);
      arr[i * 3]     = Math.cos(a) * r;
      arr[i * 3 + 1] = (rand() - 0.5) * 0.08;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, [R]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.035;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        sizeAttenuation
        color={CYAN}
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

export default function ServicesOrbit3D({
  scrollProgress: sp,
  active,
  onSelect,
  paused,
  onHoverChange,
  progressMV,
}) {
  const size = useThree((s) => s.size);
  const reduce = useReducedMotion();
  const { R, cy } = getOrbitLayout(frameViewport(size));

  const t       = easeOutCubic(invLerp(SERVICES_REVEAL.start, SERVICES_REVEAL.end, sp));
  const settled = sp > SERVICES_SETTLED;

  const rot       = useRef(FRONT - active * STEP);
  const target    = useRef(FRONT - active * STEP);
  const progress  = useRef(0);
  const nodeRefs  = useRef([]);
  const shellRefs = useRef([]);
  const coreRefs  = useRef([]);
  const labelRefs = useRef([]);
  const beamRef   = useRef();
  const sparkRef  = useRef();

  // Shortest-path target whenever the selection changes; restart the timer
  useEffect(() => {
    const desired = FRONT - active * STEP;
    let d = (desired - target.current) % (Math.PI * 2);
    if (d > Math.PI)  d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    target.current += d;
    progress.current = 0;
  }, [active]);

  // Never leave the auto-advance paused if we unmount mid-hover
  useEffect(() => () => onHoverChange?.(false), [onHoverChange]);

  useFrame((state, delta) => {
    // Rotation toward the selected node
    rot.current = reduce
      ? target.current
      : THREE.MathUtils.damp(rot.current, target.current, 3.2, delta);

    // Spiral-out while the section reveals
    const spiral = reduce ? 0 : (1 - t) * -Math.PI * 1.2;
    const base   = rot.current + spiral;

    for (let i = 0; i < COUNT; i++) {
      const node = nodeRefs.current[i];
      if (!node) continue;
      const theta = base + i * STEP;
      const depth = (Math.sin(theta) + 1) / 2; // 0 back, 1 front
      node.position.set(Math.cos(theta) * R, 0, Math.sin(theta) * R);

      const isActive = i === active;
      const shell = shellRefs.current[i];
      if (shell) {
        const s = THREE.MathUtils.damp(
          shell.scale.x, isActive ? SHELL_SCALE_HOT : SHELL_SCALE_DIM, 6, delta
        );
        shell.scale.setScalar(s);
        shell.rotation.y += delta * (isActive ? 0.9 : 0.2);
        shell.rotation.x += delta * 0.15;
        shell.material.color.lerp(isActive ? SHELL_HOT : SHELL_DIM, 1 - Math.exp(-delta * 6));
        shell.material.opacity = isActive ? 0.85 : 0.12 + depth * 0.18;
      }
      const core = coreRefs.current[i];
      if (core) {
        core.material.color.lerp(isActive ? CORE_HOT : CORE_DIM, 1 - Math.exp(-delta * 6));
        const pulse = isActive && !reduce ? 1 + Math.sin(state.clock.elapsedTime * 3) * 0.12 : 1;
        core.scale.setScalar((isActive ? 1.5 : 0.6) * pulse);
      }
      const label = labelRefs.current[i];
      if (label) {
        label.style.opacity = String((isActive ? 1 : 0.3 + depth * 0.45) * t);
        label.style.pointerEvents = t > 0.6 ? "auto" : "none";
      }
    }

    // Auto-advance timer, visualised by the beam
    if (settled && !reduce && !paused) {
      progress.current += delta / ADVANCE_SECONDS;
      if (progress.current >= 1) {
        progress.current = 0;
        onSelect((active + 1) % COUNT);
      }
    }
    // Sparks orbit the active node
    const activeNode = nodeRefs.current[active];
    if (sparkRef.current && activeNode) {
      sparkRef.current.position.copy(activeNode.position);
      if (!reduce) sparkRef.current.rotation.y += delta * 1.6;
    }

    progressMV?.set(reduce ? 1 : progress.current);

    if (beamRef.current) {
      const len = reduce ? 1 : progress.current;
      beamRef.current.visible = settled;
      beamRef.current.scale.set(1, 1, Math.max(0.0001, len * (R - 0.12)));
    }
  });

  if (t <= 0.001) return null;

  const focusNode = (i) => document.getElementById(`svc-node-${SERVICES[i].id}`)?.focus();

  const onKeyDown = (e, i) => {
    const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (e.key in map) next = (i + map[e.key] + COUNT) % COUNT;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = COUNT - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
    focusNode(next);
  };

  return (
    <group position={[0, cy, 0]} rotation={[ORBIT_TILT, 0, ORBIT_ROLL]} scale={Math.max(t, 0.001)}>
      {/* Primary ring + one very faint guide */}
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[R, 0.0035, 8, 256]} />
        <meshBasicMaterial color={RING_COL} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[R * 1.14, 0.002, 6, 256]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.07} toneMapped={false} />
      </mesh>

      {/* Sparks around the active node */}
      <group ref={sparkRef}>
        {Array.from({ length: SPARKS }, (_, k) => {
          const a = (k / SPARKS) * Math.PI * 2;
          return (
            <mesh key={k} position={[Math.cos(a) * 0.3, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.3]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshBasicMaterial color={SPARK_COL} toneMapped={false} />
            </mesh>
          );
        })}
      </group>

      <Belt R={R} />

      {/* Beam: core -> front node (local +z) */}
      <group ref={beamRef} visible={false}>
        <mesh rotation-x={Math.PI / 2} position-z={0.5}>
          <cylinderGeometry args={[0.006, 0.006, 1, 6]} />
          <meshBasicMaterial
            color={BEAM_COL}
            transparent
            opacity={reduce ? 0.4 : 0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Service nodes */}
      {SERVICES.map((s, i) => (
        <group key={s.id} ref={(el) => (nodeRefs.current[i] = el)}>
          <mesh ref={(el) => (shellRefs.current[i] = el)}>
            <icosahedronGeometry args={[0.15, 1]} />
            <meshBasicMaterial
              wireframe
              color={SHELL_DIM}
              transparent
              opacity={0.2}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={(el) => (coreRefs.current[i] = el)}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color={CORE_DIM} toneMapped={false} />
          </mesh>

          {/* Html always faces the camera; distanceFactor keeps depth scaling */}
          <Html
            center
            position={[0, -0.3, 0]}
            distanceFactor={4.4}
            zIndexRange={[40, 0]}
          >
            <button
              ref={(el) => (labelRefs.current[i] = el)}
              id={`svc-node-${s.id}`}
              type="button"
              aria-pressed={i === active}
              aria-controls="svc-panel"
              className={styles.orbitLabel}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onPointerEnter={() => onHoverChange?.(true)}
              onPointerLeave={() => onHoverChange?.(false)}
              onFocus={() => onHoverChange?.(true)}
              onBlur={() => onHoverChange?.(false)}
              style={{ opacity: 0 }}
            >
              {s.short}
            </button>
          </Html>
        </group>
      ))}
    </group>
  );
}
