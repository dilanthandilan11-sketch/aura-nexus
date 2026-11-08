// src/components/world/worldStore.js
// Where the shared 3D world should be for the page that is showing.
//
// Every page (outside Home) names a "station". The world eases from where it
// is toward that station, so moving between pages reads as travelling through
// the same space instead of loading a new page. Mutable module state, read
// every frame: setting it never re-renders React.

// x / y: logo position as a fraction of the half-screen (-1 left .. 1 right,
//        -1 bottom .. 1 top); scale: logo size (1 = Home's size);
// yaw: how far the space around turns (radians); floor: 0 hidden .. 1 shown;
// spin: logo turn speed (radians / second); tint: marble colour;
// side: which side the logo sits on (the text takes the other side).
//
// Every page uses the same logo size and height, so the layout reads the same
// from page to page; only the side changes (Work and Contact are mirrored).
const LOGO = { y: 0.06, scale: 0.8, spin: 0.06, tint: "#1CE3DA" };
const RIGHT = { ...LOGO, x: 0.56, side: "right" };
const LEFT  = { ...LOGO, x: -0.56, side: "left" };

export const STATIONS = {
    services: { ...RIGHT, yaw: 0.18,  floor: 1 },
    service:  { ...RIGHT, yaw: 0.30,  floor: 1 },
    work:     { ...LEFT,  yaw: -0.22, floor: 1 },
    project:  { ...RIGHT, yaw: -0.32, floor: 1 },
    about:    { ...RIGHT, yaw: 0.42,  floor: 1 },
    contact:  { ...LEFT,  yaw: -0.10, floor: 1 },
    legal:    { ...RIGHT, yaw: 0.55,  floor: 1 },
    // 404: the logo drifts small and alone in the middle of the void
    lost:     { ...LOGO, x: 0.00, y: 0.12, scale: 0.22, yaw: -0.55, floor: 1, spin: 0.20, side: "right" },
};

export const world = {
    name: "services",
    target: { ...STATIONS.services },
    // A short burst of the press-and-hold warp: set by a station change
    // (travel) and by the Contact form when a message is sent (transmit)
    pulse: 0,
    // Set when a page wants the marble re-tinted temporarily (service hover)
    hoverTint: null,
};

export function setStation(name, overrides = {}) {
    const base = STATIONS[name] ?? STATIONS.services;
    const changed = world.name !== name || overrides.tint !== world.target.tint;
    world.name = name;
    world.target = { ...base, ...overrides };
    world.hoverTint = null;
    if (changed) world.pulse = Math.max(world.pulse, 0.55);
    // The readability scrim follows the text side (see site.module.css)
    if (typeof document !== "undefined") document.documentElement.dataset.side = world.target.side;
}

export function setHoverTint(hex) {
    world.hoverTint = hex;
}

// Contact: the sent message is pulled into the logo
export function transmit() {
    world.pulse = 1.35;
}
