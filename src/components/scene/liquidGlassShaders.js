// src/components/scene/liquidGlassShaders.js
// Liquid marble for the Aura "A": slowly flowing, domain-warped teal swirls
// with bright cyan ribbons and darker veins, a cyan Fresnel edge and a glossy
// highlight. Self-contained: it does not sample the scene behind the logo, so
// it looks the same on every GPU and costs one draw per piece.
//
// uTint   base tint (the old glass colour; brightened to a vivid hue here)
// uWarp   how swirly the marble is        (old `distortion`)
// uFlow   how fast it flows               (old `temporalDistortion`)
// uSplit  faint colour split on the edges (old `chromaticAberration`)
// uDark   0 landing .. 1 void (darker body, stronger violet rim)

export const LIQUID_VERTEX = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
}
`;

export const LIQUID_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3  uTint;
uniform float uWarp;
uniform float uFlow;
uniform float uSplit;
uniform float uDark;
uniform vec3  uCenter;
uniform float uScale;
uniform float uBrightness;

varying vec3 vPos;
varying vec3 vNormalV;
varying vec3 vViewDir;

// 3D simplex noise (Ashima / Stefan Gustavson)
vec4 permute(vec4 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
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
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p){
    float f = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++){
        f += a * snoise(p);
        p = p * 2.03 + vec3(1.7, 9.2, 3.1);
        a *= 0.5;
    }
    return f;
}

void main(){
    vec3 N = normalize(vNormalV);
    vec3 V = normalize(vViewDir);
    if (!gl_FrontFacing) N = -N;

    // ── marble: domain-warped noise flowing slowly through the logo ──────
    vec3 p = (vPos - uCenter) * uScale;
    float t = uTime * (0.25 + uFlow * 1.5);
    vec3 q = vec3(
        fbm(p + vec3(0.0, 0.0, t * 0.6)),
        fbm(p + vec3(5.2, 1.3, -t * 0.5)),
        fbm(p + vec3(-3.1, 7.7, t * 0.4))
    );
    float warp = 1.2 + uWarp * 4.0;
    float n = fbm(p + q * warp + vec3(0.0, t * 0.15, 0.0));

    // ribbons: bands along the warped field, soft at the edges
    float band  = 0.5 + 0.5 * sin(n * 4.0 + q.x * 2.0);
    float ridge = 1.0 - abs(fract(n * 1.5 + q.y * 0.7) - 0.5) * 2.0;   // thin bright veins

    // palette from the tint: deep teal body, vivid teal, bright cyan
    vec3 hue   = uTint / max(max(uTint.r, uTint.g), max(uTint.b, 1e-4));  // full-brightness hue
    hue = clamp((hue - 0.5) * 1.35 + 0.5, 0.0, 1.0);                    // a little more saturated
    vec3 deep  = hue * 0.06 + vec3(0.0, 0.015, 0.02);
    vec3 mid   = hue * 0.8;
    vec3 hi    = mix(hue, vec3(1.0), 0.2) * 1.15;
    vec3 col = mix(deep, mid, smoothstep(0.2, 0.75, band));
    col = mix(col, hi, smoothstep(0.78, 1.0, band) * 0.85);
    col += hi * pow(ridge, 18.0) * 0.35;                              // fine bright filaments
    col *= 0.3 + 0.7 * smoothstep(-0.45, 0.45, q.z);                  // large slow light/dark areas
    // a touch of deep blue in the dark areas, like the reference
    col += vec3(0.0, 0.02, 0.08) * (1.0 - band);

    // ── lighting: cyan Fresnel edge, glossy highlight, darker sides ──────
    float facing = abs(dot(N, V));
    float fres = pow(1.0 - facing, 3.0);
    vec3 L = normalize(vec3(0.45, 0.65, 0.6));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 70.0);
    col *= mix(0.55, 1.0, facing);                                    // bevels / sides a bit darker
    vec3 rimCol = mix(vec3(0.35, 0.95, 1.0), vec3(0.55, 0.45, 1.0), uDark);
    col += rimCol * fres * (0.55 + 0.6 * uDark);
    col += vec3(0.85, 1.0, 1.0) * spec * 0.7;

    // faint colour split toward the edges
    col.r *= 1.0 - uSplit * 2.0 * fres;
    col.b *= 1.0 + uSplit * 2.0 * fres;

    // void mode: body dims, rim carries it
    col *= mix(1.0, 0.45, uDark);

    gl_FragColor = vec4(col * uBrightness, 1.0);
    #include <colorspace_fragment>
}
`;
