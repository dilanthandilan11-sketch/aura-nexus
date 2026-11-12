// src/components/landing/landingStore.js
// State shared by the landing page (DOM) and its 3D scene. Mutable module
// state read every frame by the scene, so writing it never re-renders React.

// Where the glass mark sits for each section of the page, in order.
// x / y: position as a fraction of the half-screen (-1 left .. 1 right,
//        -1 bottom .. 1 top); z: depth (negative = further away);
// rx / ry: tilt and turn (radians); s: size; glow: brightness of the light
//        inside the glass.
export const POSES = {
    hero:      { x:  0.38, y:  0.08, z:  0.0, rx:  0.05, ry: -0.36, s: 1.08, glow: 1.0 },
    statement: { x: -0.46, y:  0.02, z: -0.6, rx:  0.10, ry:  1.20, s: 0.90, glow: 0.8 },
    services:  { x:  0.62, y: -0.02, z: -1.2, rx:  0.18, ry: -1.05, s: 0.70, glow: 1.0 },
    work:      { x:  0.00, y:  0.30, z: -7.0, rx:  0.30, ry:  0.40, s: 0.60, glow: 0.3 },
    process:   { x:  0.58, y:  0.32, z: -1.4, rx: -0.38, ry:  0.85, s: 0.62, glow: 0.9 },
    cta:       { x:  0.00, y:  0.48, z: -0.6, rx:  0.00, ry:  0.00, s: 0.58, glow: 1.6 },
    footer:    { x:  0.00, y:  0.46, z: -2.0, rx:  0.10, ry:  0.30, s: 0.80, glow: 1.0 },
};

// Phones: the mark stays centred; outside the hero it sits back and dims so
// it never fights the text that runs over it
export const NARROW = {
    hero:      { x: 0, y: 0.42, z: 0.0, s: 0.56 },
    other:     { x: 0, y: 0.70, z: -12.0, s: 0.50, glow: 0.35 },
};

export const landing = {
    // [{ name, center }] in page coordinates, set by Landing on resize
    anchors: [],
    // a service row being hovered: its colour lights the inside of the glass
    hoverTint: null,
    // 0 -> 1 once the loader has gone: the mark rises into place
    revealAt: null,
    // the scene has drawn its first frame (shaders compiled)
    sceneReady: false,
};
