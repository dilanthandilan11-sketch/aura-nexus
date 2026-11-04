/**
 * riftShaders.js
 * ==============
 * GLSL for the Quantum Rift. 100% procedural: no textures, only noise.
 *
 *   NOISE_CHUNK    simplex noise, fBm, hash
 *   FISSURE_CHUNK  the tear shape, shared by the void mask and the rift
 *                  edge so the lightning sits exactly on the opening
 *   VOID_*         inverted sphere around the camera: the empty dark void
 *   RIFT_*         fullscreen additive quad: crackling energy on the tear
 *   DEBRIS_*       instanced void debris that warps past the camera
 *
 * Screen position is always derived from clip space, never gl_FragCoord:
 * the glass logo re-renders the scene into a smaller offscreen buffer for
 * its refraction, and gl_FragCoord there would misplace the tear (seen as
 * flicker inside the glass). Clip space is identical in every target.
 */

// ─────────────────────────────────────────────────────────────────────────
// Noise
// ─────────────────────────────────────────────────────────────────────────
export const NOISE_CHUNK = /* glsl */ `
  // Ashima / Stefan Gustavson 3D simplex noise, roughly [-1, 1]
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // Fractional Brownian Motion: 4 octaves, each double frequency, half
  // amplitude. Low octaves = big shapes, high octaves = jagged detail.
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * snoise(p);
      p *= 2.03;        // slightly off 2.0 so octaves never line up
      amplitude *= 0.5;
    }
    return value;
  }

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
`;

// ─────────────────────────────────────────────────────────────────────────
// The fissure: a vertical jagged tear from the centre of the screen
// ─────────────────────────────────────────────────────────────────────────
export const FISSURE_CHUNK = /* glsl */ `
  uniform float uAspect;   // camera aspect (width / height)
  uniform float uBreak;    // 0..1  crack length: grows from the centre
  uniform float uOpen;     // tear half-width, screen-height units
  uniform float uTime;
  varying vec4  vClip;

  // Centred screen position: y in [-0.5, 0.5], x scaled by aspect.
  vec2 screenPos() {
    return (vClip.xy / vClip.w) * 0.5 * vec2(uAspect, 1.0);
  }

  // Centre line of the crack at height y. fBm along y makes it zig-zag like
  // a lightning-split pane; it is frozen in time (no uTime) so the tear
  // keeps its shape while it opens, like real torn material.
  float crackCentre(float y) {
    return fbm(vec3(y * 2.4, 3.7, 0.0)) * 0.07
         + snoise(vec3(y * 14.0, 9.1, 0.0)) * 0.012;
  }

  // Signed distance to the tear's edge: < 0 inside the void, > 0 in the hero.
  //  - dx: horizontal offset from the zig-zag centre line
  //  - each side gets its own ragged edge (different noise seed), so the
  //    halves look torn apart, not cut with a knife
  //  - the opening tapers to a point at the crack's tips, and the crack
  //    length grows with uBreak (centre outward, past the top/bottom edges)
  float fissureDist(vec2 p) {
    float dx   = p.x - crackCentre(p.y);
    float side = dx < 0.0 ? 0.0 : 1.0;
    float rag  = snoise(vec3(p.y * 9.0, side * 17.0, 0.0)) * 0.018
               + snoise(vec3(p.y * 31.0, side * 5.0 + 2.0, 0.0)) * 0.006;
    float len  = uBreak * 0.95;                       // > 0.5 reaches the edges
    // (always low edge first: reversed smoothstep edges are undefined in GLSL)
    float tip  = 1.0 - smoothstep(len - 0.18, len, abs(p.y));
    float halfW = (uOpen + rag * smoothstep(0.0, 0.02, uOpen)) * tip;
    return abs(dx) - halfW;
  }

  // Where crack energy may appear: a lens around the crack that tapers toward
  // its tips and with distance from the tear, so there are no hard cutoffs.
  float crackPresence(vec2 p, float d) {
    float len = uBreak * 0.95;
    float r = abs(p.y) + max(d, 0.0) * 1.2;
    return 1.0 - smoothstep(len * 0.55, len, r);
  }
`;

// ─────────────────────────────────────────────────────────────────────────
// Void: inverted sphere centred on the camera
// ─────────────────────────────────────────────────────────────────────────
export const VOID_VERTEX = /* glsl */ `
  varying vec3 vDir;
  varying vec4 vClip;
  varying vec2 vUv;
  void main() {
    // Centred on the camera, so local position = view direction: no
    // parallax, the void reads as infinitely far away.
    vDir = position;
    vUv = uv;   // sphere UVs = equirectangular mapping for the HDRI
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vClip = gl_Position;
  }
`;

export const VOID_FRAGMENT = /* glsl */ `
  uniform float uDark;      // 0..1 how deep into the void we are
  uniform sampler2D uMap;   // multi-nebulae HDRI (equirectangular)
  uniform float uMapMix;    // 0 = procedural fallback, 1 = HDRI (fades in once loaded)
  uniform float uExposure;  // HDRI brightness
  varying vec3 vDir;
  varying vec2 vUv;
  ${NOISE_CHUNK}
  ${FISSURE_CHUNK}

  void main() {
    // 1. Mask: draw only inside the tear (soft 1.5px-ish edge). Once fully
    //    open (uOpen past the screen edges) the void covers everything.
    vec2 p = screenPos();
    float inside = 1.0 - smoothstep(-0.006, 0.0, fissureDist(p));
    if (inside <= 0.001) discard;

    vec3 d = normalize(vDir);

    // 2. Faint deep-space haze: very low fBm in dark violet / navy, only at
    //    the threshold; it fades out completely as we go deeper, leaving an
    //    empty black void (plus the debris layer).
    float haze = fbm(d * 2.2 + vec3(0.0, uTime * 0.01, 0.0));
    vec3 col = vec3(0.002, 0.003, 0.008);
    col += vec3(0.03, 0.017, 0.07) * smoothstep(0.1, 0.9, haze) * (1.0 - uDark);
    col += vec3(0.0, 0.035, 0.08) * pow(smoothstep(0.3, 1.0, haze), 2.0) * (1.0 - uDark);

    // 3. Sparse, dim stars: hash a fine grid of directions.
    float h = hash13(floor(d * 260.0));
    col += vec3(0.55, 0.65, 0.9) * step(0.9985, h) * (0.5 + 0.5 * sin(uTime * 1.3 + h * 40.0)) * 0.6;

    // 4. The multi-nebulae HDRI. It loads in the background after the
    //    landing; until then the procedural darkness above stands in, then
    //    the HDRI cross-fades over it. HDR values above 1 feed the Bloom.
    if (uMapMix > 0.001) {
      vec3 hdri = texture2D(uMap, vUv).rgb * uExposure;
      col = mix(col, hdri, uMapMix);
    }

    gl_FragColor = vec4(col, inside);
  }
`;

// ─────────────────────────────────────────────────────────────────────────
// Rift edge: crackling energy along the tear
// ─────────────────────────────────────────────────────────────────────────
export const RIFT_VERTEX = /* glsl */ `
  varying vec4 vClip;
  void main() {
    // -1..1 plane written straight to clip space: a fullscreen quad.
    gl_Position = vec4(position.xy, 0.0, 1.0);
    vClip = gl_Position;
  }
`;

export const RIFT_FRAGMENT = /* glsl */ `
  uniform float uCrackle;
  ${NOISE_CHUNK}
  ${FISSURE_CHUNK}

  void main() {
    vec2 p = screenPos();
    float d = fissureDist(p);         // < 0 void, > 0 hero
    float presence = crackPresence(p, d);
    if (presence <= 0.001) discard;

    // 1. The tear line: razor-thin white-hot core + soft cyan halo.
    float core = exp(-abs(d) * 140.0);
    float halo = exp(-abs(d) * 18.0) * 0.3;

    // 2. Fracture lightning: ridged noise (1 - |n|) peaks along zero
    //    crossings; a high power keeps only thin filaments. They branch
    //    outward into the hero from both edges. Slow time = crawling
    //    energy rather than strobing.
    float r1 = 1.0 - abs(snoise(vec3(p * vec2(7.0, 4.0), uTime * 0.35)));
    float r2 = 1.0 - abs(snoise(vec3(p * vec2(16.0, 9.0) + 4.0, uTime * 0.5)));
    float bolts = pow(r1, 26.0) + pow(r2, 34.0) * 0.5;

    // 3. Reach: cracks spread far during the fracture (uBreak rising, tear
    //    still closed), then stay hugging the edges once it opens. They
    //    never extend into the void, which stays clean.
    float spread = mix(0.11, 0.045, smoothstep(0.0, 0.25, uOpen));
    float reach  = exp(-max(d, 0.0) / spread) * step(0.0, d);

    // 4. Slow surge so the energy breathes.
    float surge = 0.85 + 0.15 * snoise(vec3(uTime * 1.5, 0.0, 0.0));

    vec3 col = vec3(0.80, 0.95, 1.0) * core * 2.4
             + vec3(0.10, 0.55, 1.0) * halo
             + mix(vec3(0.25, 0.6, 1.0), vec3(0.8, 0.9, 1.0), r1) * bolts * reach * 1.8 * surge;

    // Additive: black adds nothing, alpha is ignored.
    gl_FragColor = vec4(col * uCrackle * presence, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────
// Void debris: stars, violet/blue dust, cyber data matrices
// ─────────────────────────────────────────────────────────────────────────
export const DEBRIS_VERTEX = /* glsl */ `
  uniform float uCamZ;     // camera z; debris is placed relative to it
  uniform float uTravel;   // virtual distance travelled; drives the streaming
  uniform float uDepth;    // tunnel length
  uniform float uWarp;     // 0 still .. 1 full warp (from camera speed)
  uniform float uStretch;  // max elongation along z at full warp
  attribute vec3  aOffset;
  attribute float aSeed;
  varying float vAlpha;
  varying float vSeed;
  varying vec2  vUv;

  void main() {
    vec3 p = position;

    // 1. Warp stretch along z: seen from a camera flying down -z, z-aligned
    //    streaks radiate from the centre (hyperspace chase).
    p.z *= 1.0 + uWarp * uStretch;

    // 2. Infinite tunnel: wrap each instance by the virtual travel into
    //    [camZ - depth, camZ + 1), so debris streams toward the (static)
    //    camera and reappears far ahead after passing the lens.
    vec3 o = aOffset;
    float rel = mod(o.z - uTravel + uDepth, uDepth) - uDepth; // [-depth, 0)
    o.z = uCamZ + 1.0 + rel;

    // 3. Fade in at the far end, fade out well before the lens, so the
    //    wrap never pops and nothing balloons right in front of the camera.
    float t = -rel / uDepth;                                   // 0 near .. 1 far
    vAlpha = (1.0 - smoothstep(0.75, 1.0, t)) * smoothstep(0.03, 0.12, t);
    vSeed = aSeed;
    vUv = uv;

    gl_Position = projectionMatrix * viewMatrix * vec4(o + p, 1.0);
  }
`;

export const DEBRIS_FRAGMENT = /* glsl */ `
  uniform float uFade;
  uniform float uBright;
  uniform float uWarp;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uMatrix;   // 1 = draw a cyber data-matrix pattern on the quad
  uniform float uTime;
  varying float vAlpha;
  varying float vSeed;
  varying vec2  vUv;

  void main() {
    float a = vAlpha * uFade;

    // Cyber data matrix: a 5 x 3 grid of cells, each lit or dark per
    // instance, a few blinking slowly. Reads as HUD / data-point debris.
    if (uMatrix > 0.5) {
      vec2 cell = floor(vUv * vec2(5.0, 3.0));
      vec2 f    = fract(vUv * vec2(5.0, 3.0));
      float on  = step(0.45, fract(sin(dot(cell + vSeed * 31.0, vec2(12.9898, 78.233))) * 43758.5453));
      float blink = step(0.5, fract(vSeed * 7.0 + uTime * 0.25 + cell.x * 0.13));
      float dotMask = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.75);
      a *= dotMask * on * mix(0.5, 1.0, blink);
      if (a <= 0.001) discard;
    }

    vec3 col = mix(uColorA, uColorB, vSeed) * uBright * (1.0 + uWarp * 1.4);
    gl_FragColor = vec4(col, a);
  }
`;

// ─────────────────────────────────────────────────────────────────────────
// Glass rim: Fresnel edge glow layered over the transmission glass
// ─────────────────────────────────────────────────────────────────────────
export const RIM_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const RIM_FRAGMENT = /* glsl */ `
  uniform float uDark;
  uniform float uTime;
  varying vec3 vNormalV;
  varying vec3 vViewDir;

  void main() {
    // Fresnel: surfaces seen edge-on (normal perpendicular to the view)
    // glow, faces seen head-on stay clear. This outlines the A's silhouette
    // and bevels against the black void.
    float fres = pow(1.0 - abs(dot(vNormalV, vViewDir)), 3.0);

    // Internal refractive tint: dark violet -> blue -> cyan across the rim,
    // drifting slowly with the view angle like light inside thick glass.
    float k = fres + 0.15 * sin(uTime * 0.4 + vNormalV.y * 3.0);
    vec3 col = mix(vec3(0.18, 0.08, 0.45), vec3(0.05, 0.25, 0.9), smoothstep(0.1, 0.6, k));
    col = mix(col, vec3(0.4, 0.95, 1.0), smoothstep(0.55, 1.0, k));

    gl_FragColor = vec4(col * fres * 1.6 * uDark, 1.0);   // additive
  }
`;
