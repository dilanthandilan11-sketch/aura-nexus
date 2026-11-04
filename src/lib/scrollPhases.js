// Scroll phases shared by page.js (scroll + snap), the Scene (particles) and
// the overlay (Capabilities text, nav). scrollProgress runs 0 -> MAX_PROGRESS.
//
//   0.00         landing hero
//   0.10 - 0.45  Quantum Rift: tear, plunge, glass logo vanishes
//   ~0.38        hand-off: particles start forming, already in the right
//                column, as the Capabilities text arrives (no centred-logo stop)
//   0.45 - 0.90  Capabilities: intro + 5 service steps, one snap stop each

export const MAX_PROGRESS = 0.9;

// One snap stop per Capabilities step: 0 intro, 1 Build ... 5 Sell
export const CAPABILITY_STEPS = [0.45, 0.54, 0.63, 0.72, 0.81, 0.9];
const STEP_SPACING = 0.09;

// Text column appears from here: the particle hand-off (rift timeline 0.81,
// see PARTICLE_HANDOFF in riftTimeline.js -> sp 0.10 + 0.81 * 0.35 ~ 0.38)
export const CAPABILITY_ENTER = 0.38;

// Particle layout moves from screen centre to the right column over this
// span; it completes before the hand-off, while the particles are still
// invisible, so they assemble directly in the right column
export const CAPABILITY_LAYOUT = { start: 0.3, end: 0.37 };

// Scroll snaps to the nearest of these when the user stops scrolling
export const PHASE_STOPS = [0.0, 0.1, 0.25, ...CAPABILITY_STEPS];

// Active Capabilities step for a scroll position: -1 before the section
export function capabilityIndex(sp) {
  if (sp < CAPABILITY_ENTER) return -1;
  const i = Math.round((sp - CAPABILITY_STEPS[0]) / STEP_SPACING);
  return Math.max(0, Math.min(CAPABILITY_STEPS.length - 1, i));
}
