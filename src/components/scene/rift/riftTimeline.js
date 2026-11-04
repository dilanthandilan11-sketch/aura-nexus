/**
 * riftTimeline.js
 * ===============
 * Choreography for the Quantum Rift: the landing hero tears open and the
 * camera chases the glass "A" into a dark void (scroll sp 0.10 -> 0.45),
 * before the services orbit plays inside the void.
 *
 * GSAP owns timing and easing; it tweens a plain mutable `state` object.
 * The timeline is paused and scrubbed with `tl.progress(t)` from the
 * site's own scrollProgress: page.js already pins the viewport and snaps
 * between phases, so a ScrollTrigger pin would fight it. useFrame
 * consumers read `state` each frame and push it into the camera, the
 * artifact, lights and shader uniforms, so scrolling never re-renders.
 *
 * Window mapping (t = 0..1 across sp 0.10..0.45). The existing snap stop at
 * sp 0.25 lands at t ~0.43: the rift is fully open, the chase about to begin.
 *   0.00-0.15  fracture: crack grows from the centre, crackling energy
 *   0.15-0.40  tear: the two halves slide apart left / right
 *   0.40-1.00  plunge: debris streams past (virtual travel), world goes dark;
 *              the logo shrinks in place until it vanishes; the camera stays
 */

import gsap from "gsap";

export const RIFT = { start: 0.10, end: 0.45 };

// Distance the debris streams past during the plunge into the void. The logo
// and camera stay put; only this virtual travel moves (warp streaks).
export const RIFT_DEPTH     = 20;

// Timeline position (0..1) where the particle logo starts forming
export const PARTICLE_HANDOFF = 0.81;
export const CAMERA_START_Z = 6;

export function createRiftState() {
  return {
    break: 0,      // uBreak: crack length / fracture energy, 0..1
    open: 0,       // half-width of the tear, in screen-height units
    crackle: 0,    // lightning intensity on the tear edges
    warpFade: 0,   // void debris visibility
    dark: 0,       // 0 = hero lighting, 1 = empty-void mode (lights off, glass rim-lit)
    camZ: CAMERA_START_Z,
    logoZ: 0,
    logoScale: 1,
    pull: 0,       // rift's grip on the logo (tremble) - unused: logo stays put
    tilt: 0,       // logo tipping back - unused: logo stays put
    travel: 0,     // virtual distance travelled into the void (debris warp)
    form: 0,       // particle-logo gate: 1 once the glass logo has (almost) vanished
  };
}

export function createRiftTimeline(state) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });

  // Fracture: the crack shoots out from the centre, energy builds
  tl.to(state, { break: 1, duration: 0.15, ease: "power2.out" }, 0);
  tl.to(state, { crackle: 1, duration: 0.12, ease: "power1.out" }, 0);

  // Tear: halves slide apart, past the screen edges (~0.9 at 16:9)
  tl.to(state, { open: 1.4, duration: 0.25, ease: "power2.in" }, 0.15);
  tl.to(state, { crackle: 0, duration: 0.1, ease: "power1.in" }, 0.32);

  // Into the void: debris appears and streams past (same timing and easing
  // the camera dive used), the world goes dark. The logo stays where it is.
  tl.to(state, { warpFade: 1, duration: 0.15, ease: "power1.inOut" }, 0.35);
  tl.to(state, { dark: 1, duration: 0.33, ease: "power1.inOut" }, 0.42);
  tl.to(state, { travel: -RIFT_DEPTH, duration: 0.52, ease: "power2.inOut" }, 0.48);

  // The logo vanishes into the void as the plunge plays: it shrinks in place
  // (slow start, accelerating) until it is gone; scrolling back restores it
  tl.to(state, { logoScale: 0, duration: 0.4, ease: "power2.in" }, 0.45);

  // Hand-off to the particle logo: the gate opens in the last 10% of the
  // shrink (logo at ~19% size), a short overlap so there is no empty gap.
  // A zero-length set reverts automatically when scrolling back past it.
  tl.set(state, { form: 1 }, PARTICLE_HANDOFF);

  return tl;
}
