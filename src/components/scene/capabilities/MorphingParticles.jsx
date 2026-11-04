// scene/capabilities/MorphingParticles.jsx
"use client";

/**
 * MorphingParticles
 * =================
 * One particle system that (1) assembles from a scattered cloud into shape 0
 * as `formRef` goes 0 -> 1 (the particle "A" at the end of the void), then
 * (2) morphs between `shapes` whenever `activeIndexRef.current` changes.
 *
 * Morph: on a step change the current on-screen positions are recomputed on
 * the CPU with exactly the shader's maths and copied into aFrom, the new
 * shape goes into aTo, and uProgress tweens 0 -> 1 (easeInOutCubic per
 * particle, staggered by its seed). Fast scrolling retargets from wherever
 * the particles are, so nothing ever snaps. A "burst" pushes particles out
 * mid-morph (peaking at the midpoint of each particle's own transition).
 *
 * Idle: twinkle, per-particle shimmer, slow y-axis sway and float.
 * Mouse: particles near the cursor are nudged away and drift back.
 * Reduced motion: no burst, no stagger. The mouse nudge stays on: it is
 * small and only happens in response to the user's own pointer.
 *
 * Everything per frame goes through refs and uniforms: no React re-renders.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { seeded } from "./shapes";

const VERTEX = /* glsl */ `
  uniform float uForm;       // 0 scattered cloud .. 1 assembled
  uniform float uProgress;   // 0 .. 1 morph aFrom -> aTo (linear; eased per particle)
  uniform float uStagger;    // morph stagger spread
  uniform float uBurst;      // burst distance at the midpoint (model units)
  uniform float uTime;
  uniform float uSize;       // point size, world units
  uniform float uScale;      // drawing-buffer height / 2
  uniform float uShimmer;    // formed-state jitter amplitude
  uniform vec3  uMouse;      // cursor on the shape plane, model space
  uniform float uMouseR;     // nudge radius
  uniform float uMouseS;     // nudge strength
  attribute vec3  aFrom;
  attribute vec3  aTo;
  attribute vec3  aScatter;
  attribute vec3  aBurstDir; // random unit vector per particle
  attribute float aSeed;
  varying float vSeed;
  varying float vLand;
  varying float vTwinkle;
  varying float vHeight;

  float smoother(float x) { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }
  float easeInOutCubic(float x) {
    return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
  }

  void main() {
    // 1. Morph between shapes, staggered by seed, with a mid-flight burst
    //    outward (mostly radial, plus a random component). Mirrored exactly
    //    on the CPU when retargeting, so interruptions are seamless.
    float lp = clamp(uProgress * (1.0 + uStagger) - aSeed * uStagger, 0.0, 1.0);
    float em = easeInOutCubic(lp);
    vec3 mid = (aFrom + aTo) * 0.5;
    float midLen = length(mid);
    vec3 radial = midLen > 1e-4 ? mid / midLen : aBurstDir;
    vec3 burstDir = normalize(radial * 0.6 + aBurstDir * 0.4);
    vec3 shape = mix(aFrom, aTo, em) + burstDir * sin(3.14159265 * lp) * uBurst;

    // 2. Assembly from the scattered cloud (the void-ending formation)
    float lf = clamp(uForm * 1.35 - aSeed * 0.35, 0.0, 1.0);
    float ef = smoother(lf);
    float a = uTime * 0.12 + aSeed * 6.2831;
    vec3 drift = vec3(sin(a) * 0.15, cos(a * 1.3) * 0.12, cos(a) * 0.15);
    vec3 from = aScatter + drift * (1.0 - ef);
    float swirl = (1.0 - ef) * (1.5 + aSeed * 1.5);
    float cs = cos(swirl), sn = sin(swirl);
    from.xz = mat2(cs, -sn, sn, cs) * from.xz;

    // 3. Idle shimmer once assembled
    vec3 jitter = vec3(
      sin(uTime * 1.7 + aSeed * 41.0),
      sin(uTime * 2.1 + aSeed * 23.0),
      sin(uTime * 1.3 + aSeed * 57.0)
    ) * uShimmer * ef;

    vec3 pos = mix(from, shape + jitter, ef);

    // 4. Mouse nudge (gentle: strength well below the radius, no hole)
    vec2 away = pos.xy - uMouse.xy;
    float dist = length(away);
    float fall = 1.0 - smoothstep(0.0, uMouseR, dist);
    fall *= fall;
    vec2 dir = dist > 1e-4 ? away / dist : vec2(0.0);
    pos.xy += dir * fall * uMouseS * ef;
    pos.z  += fall * uMouseS * 0.8 * ef;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(uSize * uScale / -mv.z * mix(0.7, 1.0, ef), 6.0);

    vSeed = aSeed;
    vLand = lf;
    vHeight = pos.y;
    vTwinkle = 0.6 + 0.4 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 90.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3  uColA;       // bottom
  uniform vec3  uColM;       // middle
  uniform vec3  uColB;       // top
  uniform float uForm;
  uniform float uBright;
  uniform float uHeightMin;
  uniform float uHeightMax;
  varying float vSeed;
  varying float vLand;
  varying float vTwinkle;
  varying float vHeight;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.0, 0.5, d);

    // Three-stop vertical gradient with a little per-particle variation
    float h = clamp((vHeight - uHeightMin) / max(uHeightMax - uHeightMin, 1e-4), 0.0, 1.0);
    h = clamp(h + (vSeed - 0.5) * 0.25, 0.0, 1.0);
    vec3 col = h < 0.5 ? mix(uColA, uColM, h * 2.0) : mix(uColM, uColB, (h - 0.5) * 2.0);

    float appear = smoothstep(0.0, 0.12, uForm);
    float landed = mix(0.55, 1.0, vLand);
    gl_FragColor = vec4(col * uBright * vTwinkle * landed, soft * appear);
  }
`;

const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const MorphingParticles = React.forwardRef(function MorphingParticles(
  {
    shapes,                // Float32Array[] (same length each)
    scatter,               // Float32Array: the scattered start cloud
    seeds,                 // Float32Array: per-particle 0..1
    logoSize,              // model units, for relative sizes
    heightRange,           // [minY, maxY] for the colour gradient
    colors,                // per shape: [bottom, middle, top] hex strings
    activeIndexRef,        // { current: int } shape to show (-1 -> 0)
    formRef,               // { current: 0..1 } assembly from the cloud
    layoutRef = null,      // { current: { x, y, scale } } world offset + scale
    rotationRef = null,    // { current: Object3D } mouse tilt to copy, applied around the shape's own centre
    baseScale = 1,         // responsive scale (same formula as the Artifact)
    morphSeconds = 1.4,    // duration of one shape change
    burst = 0.32,          // x logo size: how far particles fly out mid-morph
    stagger = 0.3,         // 0..1 spread of the morph across particles
    pointSize = 0.022,
    shimmer = 0.006,       // x logo size
    brightness = 1.6,      // > 1 feeds the Bloom
    swaySpeed = 0.25,
    swayAngle = 0.26,      // radians (~15 degrees)
    floatAmp = 0.05,
    mouseRadius = 0.32,    // x logo size
    mouseStrength = 0.05,  // x logo size (kept well below the radius: no hole)
    mouseEase = 10,
    reducedMotion = false,
    renderOrder = 2,
  },
  ref
) {
  const gl = useThree((s) => s.gl);
  const count = seeds.length;

  // ── Geometry: attributes built once per point set ────────────────────
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const from = new Float32Array(shapes[0]);
    const to = new Float32Array(shapes[0]);
    const dirs = new Float32Array(count * 3);
    const rand = seeded(99173);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      dirs.set([Math.cos(th) * s, u, Math.sin(th) * s], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(shapes[0]), 3));
    g.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    g.setAttribute("aTo", new THREE.BufferAttribute(to, 3));
    g.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
    g.setAttribute("aBurstDir", new THREE.BufferAttribute(dirs, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [shapes, scatter, seeds, count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const palette = useMemo(
    () => colors.map((c) => c.map((hex) => new THREE.Color(hex))),
    [colors]
  );

  const uniforms = useMemo(() => ({
    uForm:      { value: 0 },
    uProgress:  { value: 1 },
    uStagger:   { value: reducedMotion ? 0 : stagger },
    uBurst:     { value: reducedMotion ? 0 : burst * logoSize },
    uTime:      { value: 0 },
    uSize:      { value: pointSize },
    uScale:     { value: 1 },
    uShimmer:   { value: shimmer * logoSize },
    uMouse:     { value: new THREE.Vector3(1e5, 1e5, 0) },
    uMouseR:    { value: mouseRadius * logoSize },
    uMouseS:    { value: mouseStrength * logoSize },
    uBright:    { value: brightness },
    uColA:      { value: palette[0][0].clone() },
    uColM:      { value: palette[0][1].clone() },
    uColB:      { value: palette[0][2].clone() },
    uHeightMin: { value: heightRange[0] },
    uHeightMax: { value: heightRange[1] },
  }), [reducedMotion, stagger, burst, logoSize, pointSize, shimmer, mouseRadius,
       mouseStrength, brightness, palette, heightRange]);

  // Morph bookkeeping (refs: no re-renders)
  const morph = useRef({
    target: 0,           // shape currently in aTo
    progress: 1,         // linear 0..1
    fromCols: palette[0].map((c) => c.clone()),
    toCols: palette[0].map((c) => c.clone()),
  });

  const outerRef  = useRef();
  const swayRef   = useRef();
  const pointsRef = useRef();
  const matRef    = useRef();
  const bufSize   = useMemo(() => new THREE.Vector2(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane     = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const hit       = useMemo(() => new THREE.Vector3(), []);
  const planePos  = useMemo(() => new THREE.Vector3(), []);
  const mouseSeen = useRef(false);

  // Recompute the current on-screen shape positions (CPU mirror of the
  // shader's morph + burst) into aFrom, then aim aTo at the new shape.
  // (writes go through the rendered object's refs, not the memoised values)
  const retarget = (next) => {
    const m = morph.current;
    const geo = pointsRef.current.geometry;
    const u = matRef.current.uniforms;
    const fromA = geo.attributes.aFrom;
    const toA = geo.attributes.aTo;
    const dirA = geo.attributes.aBurstDir.array;
    const f = fromA.array, t = toA.array;
    const S = u.uStagger.value;
    const B = u.uBurst.value;
    const p = m.progress;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const lp = Math.min(1, Math.max(0, p * (1 + S) - seeds[i] * S));
      const em = easeInOutCubic(lp);
      let cx = f[j] + (t[j] - f[j]) * em;
      let cy = f[j + 1] + (t[j + 1] - f[j + 1]) * em;
      let cz = f[j + 2] + (t[j + 2] - f[j + 2]) * em;
      if (B > 0) {
        const mx = (f[j] + t[j]) * 0.5, my = (f[j + 1] + t[j + 1]) * 0.5, mz = (f[j + 2] + t[j + 2]) * 0.5;
        const ml = Math.hypot(mx, my, mz);
        let rx = dirA[j], ry = dirA[j + 1], rz = dirA[j + 2];
        if (ml > 1e-4) { rx = mx / ml; ry = my / ml; rz = mz / ml; }
        let bx = rx * 0.6 + dirA[j] * 0.4, by = ry * 0.6 + dirA[j + 1] * 0.4, bz = rz * 0.6 + dirA[j + 2] * 0.4;
        const bl = Math.hypot(bx, by, bz) || 1;
        const k = Math.sin(Math.PI * lp) * B / bl;
        cx += bx * k; cy += by * k; cz += bz * k;
      }
      f[j] = cx; f[j + 1] = cy; f[j + 2] = cz;
    }
    t.set(shapes[next]);
    fromA.needsUpdate = true;
    toA.needsUpdate = true;

    // Colours retarget from wherever the blend currently is
    m.fromCols = [u.uColA.value.clone(), u.uColM.value.clone(), u.uColB.value.clone()];
    m.toCols = palette[next];
    m.target = next;
    m.progress = 0;
  };

  useFrame(({ clock, pointer, camera }, delta) => {
    if (!matRef.current || !pointsRef.current) return;
    const form = formRef ? formRef.current : 1;
    pointsRef.current.visible = form > 0.0005;
    if (!pointsRef.current.visible) return;

    const t = clock.elapsedTime;
    const u = matRef.current.uniforms;
    const m = morph.current;

    // Shape selection (index -1 = before the section -> the logo)
    const want = Math.max(0, activeIndexRef ? activeIndexRef.current : 0);
    if (want !== m.target) retarget(want);
    if (m.progress < 1) m.progress = Math.min(1, m.progress + delta / morphSeconds);
    const ce = easeInOutCubic(m.progress);
    u.uColA.value.copy(m.fromCols[0]).lerp(m.toCols[0], ce);
    u.uColM.value.copy(m.fromCols[1]).lerp(m.toCols[1], ce);
    u.uColB.value.copy(m.fromCols[2]).lerp(m.toCols[2], ce);

    u.uForm.value = form;
    u.uProgress.value = m.progress;
    u.uTime.value = t;
    gl.getDrawingBufferSize(bufSize);
    u.uScale.value = bufSize.y / 2;

    // Layout: centre of the void -> right column (world offset + scale)
    if (outerRef.current) {
      const L = layoutRef?.current;
      outerRef.current.position.set(L ? L.x : 0, L ? L.y : 0, 0);
      outerRef.current.scale.setScalar(baseScale * (L ? L.scale : 1));
      // Mouse tilt pivots on the shape itself (outerRef sits at its centre)
      const src = rotationRef?.current;
      if (src) outerRef.current.rotation.copy(src.rotation);
    }
    // Idle: slow sway + float, eased in with the assembly
    if (swayRef.current) {
      swayRef.current.rotation.y = Math.sin(t * swaySpeed) * swayAngle * form;
      swayRef.current.position.y = Math.sin(t * swaySpeed * 2.4) * floatAmp * form;
    }

    // Mouse: cursor onto a camera-facing plane through the shape, in its
    // model space; eased so particles flow aside and back
    {
      pointsRef.current.getWorldPosition(planePos);
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(hit).negate(), planePos);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        pointsRef.current.worldToLocal(hit);
        if (!mouseSeen.current) { u.uMouse.value.copy(hit); mouseSeen.current = true; }
        else u.uMouse.value.lerp(hit, 1 - Math.exp(-mouseEase * delta));
      }
    }
  });

  return (
    <group ref={(g) => { outerRef.current = g; if (typeof ref === "function") ref(g); else if (ref) ref.current = g; }}>
      <group ref={swayRef}>
        <points ref={pointsRef} geometry={geometry} frustumCulled={false} renderOrder={renderOrder} visible={false}>
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

export default MorphingParticles;
