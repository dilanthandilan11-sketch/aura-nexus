// scene/LogoParticles.jsx
"use client";

/**
 * LogoParticles
 * =============
 * The Aura "A" as a particle cloud: points sampled across the surface of the
 * same GLB the glass Artifact uses, morphing from a loose scattered cloud
 * (progress 0) into the logo (progress 1), then staying alive with a
 * twinkle, a per-particle shimmer and a slow idle sway + float.
 *
 * Hover: particles near the cursor are gently pushed away and drift back
 * when it moves on (cursor projected onto the logo plane, in model space).
 *
 * Progress comes from `progressRef.current` (read every frame, no React
 * re-renders) or, if no ref is given, from the `progress` prop.
 *
 * Shape matches the Artifact exactly: same GLB (shared useGLTF cache), same
 * per-mesh world matrices, same bounding-box centring as drei <Center>, and
 * the same responsive scale formula. Sampling runs once per particle count
 * (useMemo), never per render.
 */

import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { frameViewport } from "@/components/scene/servicesData";

const GLB = "/models/aura-logo.glb";

// Aurora palette
const TEAL   = new THREE.Color("#12e3b0");
const CYAN   = new THREE.Color("#3fb8ff");
const VIOLET = new THREE.Color("#8a3cff");

// Seeded PRNG (mulberry32): deterministic, render-pure sampling
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

const VERTEX = /* glsl */ `
  uniform float uProgress;   // 0 scattered .. 1 formed
  uniform float uStagger;    // 0 = all particles together, 1 = fully staggered
  uniform float uTime;
  uniform float uSize;       // point size in world units
  uniform float uScale;      // drawing-buffer height / 2 (size attenuation)
  uniform float uShimmer;    // formed-state jitter amplitude (model units)
  uniform vec3  uMouse;      // cursor on the logo plane, model space
  uniform float uRepelRadius;   // model units
  uniform float uRepelStrength; // max push, model units
  attribute vec3  aTarget;
  attribute vec3  aScatter;
  attribute float aSeed;
  varying float vSeed;
  varying float vLocal;
  varying float vTwinkle;
  varying float vHeight;

  // Smootherstep: zero velocity at both ends, so arrivals settle softly
  float smoother(float x) { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

  void main() {
    // 1. Staggered per-particle progress: each particle starts at a slightly
    //    different moment (by seed), so the logo assembles in a wave.
    float local = clamp(uProgress * (1.0 + uStagger) - aSeed * uStagger, 0.0, 1.0);
    float e = smoother(local);

    // 2. The scattered cloud drifts slowly (rotating about y) while waiting.
    float a = uTime * 0.12 + aSeed * 6.2831;
    vec3 drift = vec3(sin(a) * 0.15, cos(a * 1.3) * 0.12, cos(a) * 0.15);
    vec3 from = aScatter + drift * (1.0 - e);

    // 3. On the way in, particles swirl around the y axis, the swirl
    //    unwinding to zero as they land.
    float swirl = (1.0 - e) * (1.5 + aSeed * 1.5);
    float cs = cos(swirl), sn = sin(swirl);
    from.xz = mat2(cs, -sn, sn, cs) * from.xz;

    // 4. Formed: a gentle per-particle shimmer so the logo is never frozen.
    vec3 jitter = vec3(
      sin(uTime * 1.7 + aSeed * 41.0),
      sin(uTime * 2.1 + aSeed * 23.0),
      sin(uTime * 1.3 + aSeed * 57.0)
    ) * uShimmer * e;

    vec3 pos = mix(from, aTarget + jitter, e);

    // 5. Hover repulsion: within uRepelRadius of the cursor (measured in the
    //    logo plane), push the particle outward with a smooth quadratic
    //    falloff, plus a small push toward the camera for depth. Scaled by
    //    e, so only formed particles react. The cursor itself is eased on
    //    the CPU, so particles flow aside and settle back smoothly.
    vec2 away = pos.xy - uMouse.xy;
    float dist = length(away);
    float fall = 1.0 - smoothstep(0.0, uRepelRadius, dist);
    fall *= fall;
    vec2 dir = dist > 1e-4 ? away / dist : vec2(0.0);
    pos.xy += dir * fall * uRepelStrength * e;
    pos.z  += fall * uRepelStrength * 0.8 * e;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Size attenuation (like three's PointsMaterial), slightly smaller while
    // scattered; capped so nothing ever balloons near the lens.
    gl_PointSize = min(uSize * uScale / -mv.z * mix(0.7, 1.0, e), 6.0);

    vSeed = aSeed;
    vLocal = local;
    vHeight = aTarget.y;
    // Twinkle: each particle pulses at its own rate and phase
    vTwinkle = 0.6 + 0.4 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 90.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3  uTeal;
  uniform vec3  uCyan;
  uniform vec3  uViolet;
  uniform float uProgress;
  uniform float uBright;     // HDR multiplier (> 1 feeds the Bloom pass)
  uniform float uHeightMin;
  uniform float uHeightMax;
  varying float vSeed;
  varying float vLocal;
  varying float vTwinkle;
  varying float vHeight;

  void main() {
    // Soft round point: radial falloff, discard the square corners
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.0, 0.5, d);

    // Palette: teal at the base -> cyan -> violet at the apex, with a little
    // per-particle variation so it reads as light, not a flat gradient
    float h = clamp((vHeight - uHeightMin) / max(uHeightMax - uHeightMin, 1e-4), 0.0, 1.0);
    h = clamp(h + (vSeed - 0.5) * 0.25, 0.0, 1.0);
    vec3 col = h < 0.5 ? mix(uTeal, uCyan, h * 2.0) : mix(uCyan, uViolet, (h - 0.5) * 2.0);

    // Invisible at progress 0 (nothing before the hand-off), fade in fast as
    // the cloud appears; brighter once a particle has landed
    float appear = smoothstep(0.0, 0.12, uProgress);
    float landed = mix(0.55, 1.0, vLocal);

    gl_FragColor = vec4(col * uBright * vTwinkle * landed, soft * appear);
  }
`;

const LogoParticles = React.forwardRef(function LogoParticles(
  {
    progress = 0,          // used only when no progressRef is given
    progressRef = null,    // { current: 0..1 }, read every frame
    count,                 // override; default 20k desktop / 8k mobile
    pointSize = 0.022,     // world units
    scatterRadius = 1.6,   // x logo size: how loose the starting cloud is
    stagger = 0.35,        // 0..1 how much the arrival is spread out
    idleSpeed = 0.25,      // idle sway speed
    idleSway = 0.45,       // idle sway angle (radians)
    floatAmp = 0.05,       // idle vertical float (world units)
    shimmer = 0.006,       // formed-state jitter (x logo size)
    brightness = 1.6,      // > 1 so the formed logo catches the Bloom
    renderOrder = 2,       // after the void sphere (0.5) so it stays visible
    repel = true,          // hover repulsion on/off
    repelRadius = 0.28,    // x logo size: how close the cursor must be
    repelStrength = 0.022, // x logo size: how far particles get pushed (kept
                           // well below the radius: a gentle nudge, no hole)
    repelEase = 10,        // how quickly the push follows the cursor
  },
  ref
) {
  const size = useThree((s) => s.size);
  const gl   = useThree((s) => s.gl);
  const { scene } = useGLTF(GLB);

  const isMobile = size.width < 768;
  const particleCount = count ?? (isMobile ? 8000 : 20000);

  // Same responsive scale as Artifact.jsx
  const responsiveScale = Math.min(1.5, Math.max(0.65, frameViewport(size).width * 0.22));

  // ── Sample the logo surface once per count ──────────────────────────────
  const data = useMemo(() => {
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse((o) => { if (o.isMesh) meshes.push(o); });

    // Bounding box exactly as drei <Center> computes it (geometry boxes in
    // world space), so the particle logo sits where the glass one did
    const box = new THREE.Box3();
    const tmpBox = new THREE.Box3();
    meshes.forEach((m) => {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      tmpBox.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      box.union(tmpBox);
    });
    const center = box.getCenter(new THREE.Vector3());
    const dims = box.getSize(new THREE.Vector3());
    const logoSize = Math.max(dims.x, dims.y, dims.z);

    // Share particles between meshes by surface area
    const areaOf = (geom) => {
      const g = geom.index ? geom.toNonIndexed() : geom;
      const p = g.attributes.position;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let area = 0;
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
        area += new THREE.Triangle(a, b, c).getArea();
      }
      return area;
    };
    const areas = meshes.map((m) => areaOf(m.geometry));
    const totalArea = areas.reduce((s, a) => s + a, 0) || 1;

    const rand = seeded(20251);
    const target  = new Float32Array(particleCount * 3);
    const scatter = new Float32Array(particleCount * 3);
    const seeds   = new Float32Array(particleCount);
    const p = new THREE.Vector3();

    let written = 0;
    meshes.forEach((m, mi) => {
      const n = mi === meshes.length - 1
        ? particleCount - written
        : Math.round((areas[mi] / totalArea) * particleCount);
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(m.geometry)).setRandomGenerator(rand).build();
      for (let i = 0; i < n && written < particleCount; i++, written++) {
        sampler.sample(p);
        p.applyMatrix4(m.matrixWorld).sub(center);
        target.set([p.x, p.y, p.z], written * 3);
      }
    });

    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < particleCount; i++) {
      // Loose spherical cloud around the centre, denser toward the middle
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const r = logoSize * scatterRadius * (0.35 + 0.65 * Math.cbrt(rand()));
      const s = Math.sqrt(1 - u * u);
      scatter[i * 3]     = Math.cos(th) * s * r;
      scatter[i * 3 + 1] = u * r * 0.8;
      scatter[i * 3 + 2] = Math.sin(th) * s * r;
      seeds[i] = rand();
      const y = target[i * 3 + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return { target, scatter, seeds, logoSize, minY, maxY };
  }, [scene, particleCount, scatterRadius]);

  const groupRef  = useRef();
  const pointsRef = useRef();
  const matRef    = useRef();
  const bufSize   = useMemo(() => new THREE.Vector2(), []);

  const uniforms = useMemo(() => ({
    uProgress:  { value: 0 },
    uStagger:   { value: stagger },
    uTime:      { value: 0 },
    uSize:      { value: pointSize },
    uScale:     { value: 1 },
    uShimmer:   { value: shimmer * data.logoSize },
    uBright:    { value: brightness },
    uTeal:      { value: TEAL },
    uCyan:      { value: CYAN },
    uViolet:    { value: VIOLET },
    uHeightMin: { value: data.minY },
    uHeightMax: { value: data.maxY },
    // Far away until the cursor is first seen, so nothing is pushed at start
    uMouse:         { value: new THREE.Vector3(1e5, 1e5, 0) },
    uRepelRadius:   { value: repelRadius * data.logoSize },
    uRepelStrength: { value: repel ? repelStrength * data.logoSize : 0 },
  }), [stagger, pointSize, shimmer, brightness, data, repel, repelRadius, repelStrength]);

  // Cursor -> logo plane helpers (allocated once)
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane     = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const hit       = useMemo(() => new THREE.Vector3(), []);
  const planePos  = useMemo(() => new THREE.Vector3(), []);
  const mouseSeen = useRef(false);

  useFrame(({ clock, pointer, camera }, delta) => {
    if (!matRef.current || !pointsRef.current) return;
    const prog = progressRef ? progressRef.current : progress;

    // Nothing to draw before the hand-off: skip the points entirely
    pointsRef.current.visible = prog > 0.0005;
    if (!pointsRef.current.visible) return;

    const t = clock.elapsedTime;
    const u = matRef.current.uniforms;
    u.uProgress.value = prog;
    u.uTime.value = t;
    gl.getDrawingBufferSize(bufSize);
    u.uScale.value = bufSize.y / 2;

    // Hover: cast the cursor onto a camera-facing plane through the logo,
    // convert to the points' model space (accounts for sway, float, scale
    // and the mouse-tilt group), and ease the uniform toward it
    if (repel) {
      pointsRef.current.getWorldPosition(planePos);
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(hit).negate(), planePos);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        pointsRef.current.worldToLocal(hit);
        if (!mouseSeen.current) {
          u.uMouse.value.copy(hit);
          mouseSeen.current = true;
        } else {
          u.uMouse.value.lerp(hit, 1 - Math.exp(-repelEase * delta));
        }
      }
    }

    // Idle life: slow sway around y + gentle float, eased in with progress
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * idleSpeed) * idleSway * prog;
      groupRef.current.position.y = Math.sin(t * idleSpeed * 2.4) * floatAmp * prog;
    }
  });

  return (
    <group ref={(g) => { groupRef.current = g; if (typeof ref === "function") ref(g); else if (ref) ref.current = g; }}>
      <group scale={responsiveScale}>
        <points ref={pointsRef} frustumCulled={false} renderOrder={renderOrder} visible={false}>
          <bufferGeometry>
            {/* position = target, so bounds are meaningful; the shader moves points */}
            <bufferAttribute attach="attributes-position" args={[data.target, 3]} />
            <bufferAttribute attach="attributes-aTarget" args={[data.target, 3]} />
            <bufferAttribute attach="attributes-aScatter" args={[data.scatter, 3]} />
            <bufferAttribute attach="attributes-aSeed" args={[data.seeds, 1]} />
          </bufferGeometry>
          <shaderMaterial
            ref={matRef}
            vertexShader={VERTEX}
            fragmentShader={FRAGMENT}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      </group>
    </group>
  );
});

export default LogoParticles;

useGLTF.preload(GLB);
