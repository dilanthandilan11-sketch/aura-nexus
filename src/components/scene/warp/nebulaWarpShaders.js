// src/components/scene/warp/nebulaWarpShaders.js
// Nebula environment sphere with the press-and-hold "pull" warp.
//
// Instead of mapping the equirect texture by the sphere's UVs, each pixel
// rebuilds its view ray from a *warped* screen position and samples the
// texture along that ray. That lets the whole environment be pulled outward
// from the logo, stretched into streaks and pushed away from the cursor,
// while the logo and UI stay untouched.
//
// uHold  0..1  how far the pull has built up (spring-driven, see molten/holdState.js)
// uPress 0..1  fast attack on mouse down (cursor push)
// uFlow        integral of uHold over time (features stream outward)

export const nebulaWarpVertex = /* glsl */ `
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nebulaWarpFragment = /* glsl */ `
precision highp float;

uniform sampler2D uMap;
uniform vec2  uResolution;   // drawing-buffer pixels
uniform mat4  uInvProj;      // camera.projectionMatrixInverse
uniform mat4  uCamWorld;     // camera.matrixWorld
uniform mat4  uInvModel;     // inverse of the sphere's matrixWorld
uniform float uTime;
uniform float uHold;
uniform float uPress;
uniform float uFlow;
uniform vec2  uMouse;        // cursor, screen uv 0..1

const float PI = 3.141592653589793;

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

// warped centred coords -> environment colour
vec3 sampleEnv(vec2 q, float aspect){
    vec2 s   = q / vec2(aspect, 1.0) + 0.5;               // back to screen uv
    vec4 v   = uInvProj * vec4(s * 2.0 - 1.0, 1.0, 1.0);  // view-space ray
    vec3 dir = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
    dir      = normalize((uInvModel * vec4(dir, 0.0)).xyz);
    // same UV layout as THREE.SphereGeometry
    float u  = atan(dir.z, -dir.x) / (2.0 * PI);
    u = fract(u);
    float w  = 1.0 - acos(clamp(dir.y, -1.0, 1.0)) / PI;
    return textureLod(uMap, vec2(u, w), 0.0).rgb;
}

void main(){
    float h = uHold;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (gl_FragCoord.xy / uResolution - 0.5) * vec2(aspect, 1.0);

    // ── cursor push: the environment bulges away from the cursor ────────
    vec2 m  = (uMouse - 0.5) * vec2(aspect, 1.0);
    vec2 dm = p - m;
    float md = length(dm);
    float mInf = exp(-md * md / 0.03);
    p -= normalize(dm + 1e-5) * mInf * 0.06 * (uPress * 0.6 + h);

    // ── radial pull from the centre (mostly sideways, like the reference)
    float r    = length(p);
    vec2  rdir = p / (r + 1e-4);
    vec2  dir  = normalize(mix(rdir, vec2(p.x / (abs(p.x) + 0.08), 0.0), 0.45) + vec2(1e-4, 0.0));
    float k    = smoothstep(0.02, 0.35, r);
    float pull = 1.0 + h * 0.9 * smoothstep(0.0, 0.9, r);
    vec2  q    = p / pull;                                 // sample nearer the centre
    float stretch = 1.0 + h * 1.8;
    q -= dir * dot(q, dir) * (1.0 - 1.0 / stretch) * k;     // long streaks along the pull

    // liquid wobble that streams outward while held
    vec2 n = q * 2.2 - dir * uFlow * 0.7;
    q += vec2(snoise(n + uTime * 0.05), snoise(n + 7.3 - uTime * 0.04)) * 0.03 * h * k;

    // ── radial motion blur + slight colour split along the pull ─────────
    vec3 col = vec3(0.0);
    if (h < 0.002 && uPress < 0.002) {
        // at rest: one lookup, identical to the plain nebula sphere
        gl_FragColor = vec4(sampleEnv(q, aspect), 1.0);
        #include <colorspace_fragment>
        return;
    }
    const int N = 6;
    float blur = 0.07 * h;
    float split = 0.012 * h;
    for (int i = 0; i < N; i++){
        float f = float(i) / float(N - 1);
        float sc = 1.0 - f * blur;
        col.r += sampleEnv(q * sc * (1.0 + split), aspect).r;
        col.g += sampleEnv(q * sc, aspect).g;
        col.b += sampleEnv(q * sc * (1.0 - split), aspect).b;
    }
    col /= float(N);

    // the pull energises the environment a little
    col *= 1.0 + h * 0.35 + mInf * uPress * 0.15;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}
`;
