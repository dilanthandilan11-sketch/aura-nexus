// Shared by ServicesSection (DOM detail) and ServicesOrbit3D (WebGL orbit)

export const SERVICES = [
  {
    id: "ai",
    short: "AI Systems",
    label: "AI Systems",
    headline: "Intelligent by Design",
    desc: "Custom models, LLM integrations and AI pipelines tuned to your data, designed around how your business actually works.",
    includes: ["Custom models", "LLM integrations", "Data pipelines"],
  },
  {
    id: "software",
    short: "Software",
    label: "Software Development",
    headline: "Systems That Scale",
    desc: "APIs, backend architecture and platforms engineered for next year's load, with clean code your team can maintain after handoff.",
    includes: ["APIs", "Backend", "Cloud infrastructure"],
  },
  {
    id: "web",
    short: "Web",
    label: "Web Development",
    headline: "Built to Convert",
    desc: "Fast, purposeful websites built around one goal per page, whether that's leads, sign-ups or sales, and tuned for every device.",
    includes: ["Websites", "Conversion", "Performance"],
  },
  {
    id: "marketing",
    short: "Marketing",
    label: "Digital Marketing",
    headline: "Growth That Compounds",
    desc: "Strategy, content and campaigns measured against revenue, not vanity metrics. Every campaign feeds the next one.",
    includes: ["Strategy", "Content", "Campaigns"],
  },
  {
    id: "design",
    short: "Design",
    label: "Graphic Design",
    headline: "Identity That Lasts",
    desc: "A brand system of color, type, motion and voice, defined once so every touchpoint feels unmistakably yours.",
    includes: ["Brand identity", "Visual systems", "Motion"],
  },
];

// Seconds each service stays at the front before auto-advancing
export const ADVANCE_SECONDS = 6.5;

// Orbit plane orientation (radians): tilt toward the camera + slight roll
export const ORBIT_TILT = 0.36;
export const ORBIT_ROLL = -0.06;

// Scale of the glass logo while it acts as the orbit core
export const CORE_SCALE = 0.34;

// Visible area (world units) at the framing distance. The camera chases the
// logo along z during the Quantum Rift, so R3F's `viewport` (measured to the
// origin) stops matching; anything framed relative to the logo uses this
// fixed camera-to-subject distance. At the landing (camera z = 6, logo at 0)
// it returns exactly what `viewport` did.
export const FRAME_DISTANCE = 6;
export function frameViewport(size, fov = 40) {
  const height = 2 * Math.tan((fov * Math.PI) / 360) * FRAME_DISTANCE;
  return { width: height * (size.width / size.height), height };
}

// Orbit size / height in world units, from frameViewport().
// Desktop: centre sits well above the detail text; portrait: higher, smaller.
export function getOrbitLayout(viewport) {
  const portrait = viewport.width < viewport.height;
  return portrait
    ? { R: viewport.width * 0.36, cy: viewport.height * 0.22, portrait }
    : { R: Math.min(2.0, viewport.width * 0.27), cy: viewport.height * 0.17, portrait };
}

// Scroll windows (scrollProgress) for the services phase
export const SERVICES_REVEAL = { start: 0.48, end: 0.66 }; // orbit spirals out
export const CORE_REFORM     = { start: 0.55, end: 0.70 }; // logo returns as core
export const SERVICES_SETTLED = 0.62;                      // auto-advance allowed
