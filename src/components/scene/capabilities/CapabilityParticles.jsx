// scene/capabilities/CapabilityParticles.jsx
"use client";

/**
 * Glue between the scroll and MorphingParticles, rendered inside Scene's
 * canvas in place of the old LogoParticles:
 *   - samples the logo (identical to the void-ending particle "A") and the
 *     five service shapes once per particle count
 *   - maps scroll progress to the active step (ref) and to the layout:
 *     screen centre at the void ending -> right column (desktop) or a top
 *     band (below 900px) as the Capabilities section arrives
 * Scroll values arrive through refs; nothing here re-renders per frame.
 */

import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import MorphingParticles from "./MorphingParticles";
import { sampleLogo, buildCapabilityShapes } from "./shapes";
import { STEP_COLORS } from "./capabilitiesContent";
import { frameViewport } from "@/components/scene/servicesData";
import { CAPABILITY_LAYOUT, capabilityIndex } from "@/lib/scrollPhases";

const GLB = "/models/aura-logo.glb";

// Layout targets (fractions of the viewport)
const DESKTOP_COLUMN_X = 0.45;  // NDC x of the right column's centre (45% / 55% split)
const DESKTOP_SCALE    = 0.8;   // shape scale inside the column
const MOBILE_BAND_Y    = 0.55;  // NDC y of the top band's centre (band = top 45vh)
const MOBILE_BAND_FILL = 0.78;  // shape height as a share of the band
const STACK_BELOW      = 900;   // px: stacked layout below this width

export default function CapabilityParticles({ scrollRef, formRef, reducedMotion = false, rotationRef = null }) {
  const size = useThree((s) => s.size);
  const { scene } = useGLTF(GLB);

  // Same count and responsive scale as the original particle "A"
  const count = size.width < 768 ? 8000 : 20000;
  const baseScale = Math.min(1.5, Math.max(0.65, frameViewport(size).width * 0.22));

  const data = useMemo(() => {
    const logo = sampleLogo(scene, count);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < logo.target.length; i += 3) {
      if (logo.target[i] < minY) minY = logo.target[i];
      if (logo.target[i] > maxY) maxY = logo.target[i];
    }
    return {
      shapes: buildCapabilityShapes(logo, count),
      scatter: logo.scatter,
      seeds: logo.seeds,
      logoSize: logo.logoSize,
      heightRange: [minY, maxY],
    };
  }, [scene, count]);

  const activeIndexRef = useRef(-1);
  const layoutRef = useRef({ x: 0, y: 0, scale: 1 });

  useFrame(() => {
    const sp = scrollRef.current;
    activeIndexRef.current = capabilityIndex(sp);

    // Centre of the void -> section position, eased over the layout span
    const t = THREE.MathUtils.smootherstep(sp, CAPABILITY_LAYOUT.start, CAPABILITY_LAYOUT.end);
    const fv = frameViewport(size);
    let x = 0, y = 0, s = 1;
    if (size.width >= STACK_BELOW) {
      x = DESKTOP_COLUMN_X * fv.width / 2;
      s = DESKTOP_SCALE;
    } else {
      y = MOBILE_BAND_Y * fv.height / 2;
      const shapeHeight = data.logoSize * baseScale;
      s = Math.min(1, (0.45 * fv.height * MOBILE_BAND_FILL) / Math.max(shapeHeight, 1e-4));
    }
    const L = layoutRef.current;
    L.x = x * t;
    L.y = y * t;
    L.scale = 1 + (s - 1) * t;
  });

  return (
    <MorphingParticles
      shapes={data.shapes}
      scatter={data.scatter}
      seeds={data.seeds}
      logoSize={data.logoSize}
      heightRange={data.heightRange}
      colors={STEP_COLORS}
      activeIndexRef={activeIndexRef}
      formRef={formRef}
      layoutRef={layoutRef}
      baseScale={baseScale}
      reducedMotion={reducedMotion}
      rotationRef={rotationRef}
    />
  );
}

useGLTF.preload(GLB);
