// src/components/scene/molten/moltenShaders.js
// Molten liquid-metal splash behind the logo + press-and-hold "pull".
//
// uHold  0..1  how far the pull has built up (spring-driven, see holdState.js)
// uPress 0..1  fast attack on mouse down, drives the cursor heat glow
// uMouse       cursor position in the plane's UV space

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

float fbm(vec2 p){
    float f = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++){
        f += a * snoise(p);
        p = r * p * 2.03 + 11.7;
        a *= 0.5;
    }
    return f;
}
`;

export const moltenVertex = /* glsl */ `
uniform float uHold;
varying vec2 vUv;

void main(){
    vUv = uv;
    vec3 pos = position;
    // 3D pull: the sheet bows toward the camera, outer parts first, so the
    // splash swells and flies outward in perspective while held
    vec2 c = uv - 0.5;
    float r = length(c * vec2(1.0, 0.75));
    pos.z += uHold * (0.15 + 1.1 * smoothstep(0.05, 0.6, r));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const moltenFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uHold;
uniform float uPress;
uniform float uFlow;   // accumulated pull travel (integral of uHold over time)
uniform float uOpacity;
uniform float uAspect;
uniform vec2  uMouse;
uniform vec3  uDeep;
uniform vec3  uMid;
uniform vec3  uHot;
uniform vec3  uCore;

varying vec2 vUv;

${NOISE}

// Liquid height field in "liquid space" (after the pull mapping)
float liquidField(vec2 q, vec2 dir, float stretch, float t){
    // compress the radial component -> features become long radial ribbons
    // fade the anisotropy out right at the centre (no spikes behind the logo)
    float k = smoothstep(0.03, 0.3, length(q));
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 n = q - dir * dot(q, dir) * (1.0 - 1.0 / stretch) * k
               + perp * dot(q, perp) * (stretch - 1.0) * 0.55 * k;
    // features stream outward while the pull is building
    n -= dir * uFlow * 0.5;
    vec2 w = vec2(
        fbm(n * 1.1 + vec2(0.0, t * 0.06)),
        fbm(n * 1.1 + vec2(5.2, 1.3) - t * 0.045)
    );
    return fbm(n * 1.45 + w * 1.25 + vec2(t * 0.035, -t * 0.025));
}

void main(){
    float t = uTime;
    float h = uHold;

    // centred coordinates, y in [-0.5, 0.5]
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

    // ── cursor heat warp: liquid is pushed away from the cursor ──────────
    vec2 m  = (uMouse - 0.5) * vec2(uAspect, 1.0);
    vec2 dm = p - m;
    float md = length(dm);
    float mInf = exp(-md * md / 0.02);
    p += normalize(dm + 1e-5) * mInf * 0.06 * (0.25 + h + uPress * 0.5);

    // ── radial pull from the centre ─────────────────────────────────────
    float r   = length(p);
    vec2  rdir = p / (r + 1e-4);
    // mostly-horizontal pull: the splash is dragged out sideways into ribbons
    vec2  dir = normalize(mix(rdir, vec2(p.x / (abs(p.x) + 0.08), 0.0), 0.55) + vec2(1e-4, 0.0));
    float pull = 1.0 + h * 0.5 * smoothstep(0.0, 0.8, r);
    float rs  = r / pull;           // sample closer to the centre = content moves outward
    vec2  q   = rdir * rs;
    float stretch = 1.0 + h * 2.2;

    // ── splash envelope (wide horizontal wings, stretched by the pull) ──
    vec2  e   = mix(p, q, 0.45) * vec2(0.72, 1.75);
    float env = 1.0 - smoothstep(0.12, 0.66, length(e));
    env *= 0.75 + 0.25 * smoothstep(0.0, 0.25, abs(q.x)); // thinner right behind the logo

    // ── height field + normal ───────────────────────────────────────────
    float f  = liquidField(q, dir, stretch, t);
    const float EPS = 0.006;
    float fx = liquidField(q + vec2(EPS, 0.0), dir, stretch, t);
    float fy = liquidField(q + vec2(0.0, EPS), dir, stretch, t);

    float body = f * 0.95 + env * 1.05 - 0.62;               // > 0 inside the liquid
    float mask = smoothstep(0.0, 0.035, body);
    float depth = smoothstep(0.02, 0.5, body);       // 0 at the edge .. 1 deep inside

    vec3 N = normalize(vec3((f - fx) / EPS * 0.16, (f - fy) / EPS * 0.16, 1.0));

    // ── shading: emissive molten core + glossy metal highlights ─────────
    vec3 L1 = normalize(vec3(-0.4, 0.6, 0.7));
    vec3 L2 = normalize(vec3(0.6, -0.2, 0.75));
    vec3 V  = vec3(0.0, 0.0, 1.0);
    float spec1 = pow(max(dot(reflect(-L1, N), V), 0.0), 38.0);
    float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 18.0);
    float fres  = pow(1.0 - max(N.z, 0.0), 2.0);

    float heat = clamp(depth * (0.75 - h * 0.25) + (f * 0.5 + 0.5) * 0.3, 0.0, 1.0);
    vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.45, heat));
    col = mix(col, uHot, smoothstep(0.4, 0.8, heat));
    col = mix(col, uCore, smoothstep(0.86, 1.0, heat) * 0.6);

    // darker troughs give the liquid volume
    float trough = smoothstep(0.1 + h * 0.1, -0.3, f);
    col *= 1.0 - trough * (0.75 + h * 0.15);

    col += uCore * spec1 * (1.4 + h * 2.2);
    col += uHot  * spec2 * 0.8;
    col += uHot  * fres * 0.55;

    // the pull heats the whole splash up
    col *= 1.0 + h * 0.15;
    vec3 liquid = col * mask;

    // ── burst behind the logo: glow + rays that grow with the pull ─────
    float ang  = atan(p.y, p.x);
    float rays = fbm(vec2(ang * 3.2, r * 1.5 - t * (0.6 + h * 3.0)));
    rays = smoothstep(0.1, 0.65, rays) * smoothstep(0.6, 0.05, r);
    float glow = exp(-r * r / (0.03 + h * 0.06));
    vec3 burst = uMid * glow * (0.45 + h * 0.6) + uHot * rays * (0.08 + h * 0.35);

    // sparks/debris streaking out of the centre
    vec2 sg = vec2(ang * 24.0, r * 9.0 - t * (1.5 + h * 7.0));
    float sp = smoothstep(0.82, 0.98, snoise(sg)) * smoothstep(0.65, 0.08, r) * smoothstep(0.03, 0.1, r);
    burst += uCore * sp * (0.2 + h * 0.9);

    // ── cursor heat glow ────────────────────────────────────────────────
    vec3 cursorGlow = mix(uMid, uHot, mInf) * exp(-md * md / 0.005) * (uPress * 0.9 + h * 0.35);

    vec3 outCol = liquid + burst + cursorGlow;

    // edge vignette so the plane never shows a border
    vec2 uvE = abs(vUv - 0.5) * 2.0;
    float edge = (1.0 - smoothstep(0.75, 1.0, uvE.x)) * (1.0 - smoothstep(0.7, 1.0, uvE.y));

    outCol *= edge * uOpacity * 0.72;
    gl_FragColor = vec4(outCol, 1.0);
}
`;
