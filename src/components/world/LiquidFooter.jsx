// src/components/world/LiquidFooter.jsx
// The liquid-glass footer.
//
// The footer is a slab of dark, frosted liquid glass laid over the 3D world:
// whatever the world shows behind the footer (nebula, aurora, floor, logo) is
// seen through it, bent and softly blurred. Its top edge is a liquid surface
// that sways, with a bright rim; the cursor sends ripple rings across it and
// raises a small bulge where it meets the surface. The AURA INFOTECH logo is
// carved into the bottom of the glass, as wide as the footer's content:
// clearer and brighter inside the letters, bent along their bevelled edges.
//
// It is a post-processing effect on the 3D canvas, limited to the footer's
// place on screen: SiteFooter registers its <footer> and wordmark elements in
// footerGlass, and every frame their rectangles are passed to the
// shader, so the glass follows the footer as the page scrolls. The footer's
// text is ordinary page content drawn on top.
"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import {
    footerGlass, MARK_SRC, MARK_CROP, MARK_ASPECT, FILL_MS, RISE_DELAY_MS, RISE_MS,
} from "@/components/world/footerGlass";
const RIPPLES = 12;                // ripple rings alive at once (oldest is reused)

const fragment = /* glsl */ `
uniform vec4 uRect;        // footer box in uv: left, bottom, right, top
uniform vec4 uMark;        // wordmark box in uv
uniform sampler2D tMark;   // r: bevelled height of the letters, g: letter shape
uniform float uMarkReady;
uniform vec2 uRes;         // viewport, CSS px
uniform float uTime;
uniform vec3 uMouse;       // uv, z: how close the cursor is to the liquid edge (0..1)
uniform vec4 uRipples[${RIPPLES}];  // uv, start time, strength
uniform float uActive;
uniform float uFill;       // 0..1: the liquid rising into the footer (eased)
uniform float uRise;       // 0..1: the glass logo surfacing (eased, may overshoot a little)

// ripple rings, in px of surface height
float ripples(vec2 p) {
    float h = 0.0;
    for (int i = 0; i < ${RIPPLES}; i++) {
        vec4 r = uRipples[i];
        if (r.w <= 0.0) continue;
        float age = uTime - r.z;
        if (age < 0.0 || age > 3.2) continue;
        float d = length(p - r.xy * uRes);
        float x = d - age * 240.0;                       // ring radius grows
        h += sin(x * 0.085) * exp(-x * x / 2200.0) * exp(-age * 1.3) * r.w;
    }
    return h;
}

vec2 mark(vec2 uv) {
    if (uMarkReady < 0.5 || uRise <= 0.0) return vec2(0.0);
    vec2 m = (uv - uMark.xy) / (uMark.zw - uMark.xy);
    // surfacing: the letters start lower down and wobble like liquid
    float still = clamp(uRise, 0.0, 1.0);
    m.y += (1.0 - uRise) * 0.55;
    m.x += sin(m.y * 16.0 + uTime * 5.0) * 0.012 * (1.0 - still);
    if (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) return vec2(0.0);
    return texture2D(tMark, m).rg * smoothstep(0.0, 0.35, still);
}

// height of the glass surface, px
float surface(vec2 uv) {
    vec2 p = uv * uRes;
    float swell = sin(p.x * 0.010 + uTime * 0.8) * sin(p.y * 0.016 - uTime * 0.55) * 2.0;
    return swell + ripples(p) * 5.0 + mark(uv).r * 22.0;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = inputColor;
    if (uActive < 0.5 || uFill <= 0.0) return;

    vec2 p = uv * uRes;
    float top = uRect.w * uRes.y;
    if (p.y > top + 40.0 || uv.x < uRect.x || uv.x > uRect.z) return;

    // ── the liquid edge: swaying waves, ripples reaching it, the cursor bulge
    float wave = sin(p.x * 0.0075 + uTime * 1.05) * 4.0
               + sin(p.x * 0.019 - uTime * 1.6) * 2.0
               + sin(p.x * 0.043 + uTime * 2.4) * 0.7;
    vec2 dm = (uv - uMouse.xy) * uRes;
    float bulge = uMouse.z * 14.0 * exp(-dm.x * dm.x / 1800.0);
    // arrival: the level rises from the bottom of the screen (or of the
    // footer, if that is higher) to the footer's top, choppier while it rises
    float start = max(uRect.y * uRes.y, 0.0) - 30.0;
    float level = mix(start, top, uFill);
    float chop = 1.0 + (1.0 - uFill) * 2.5;
    float edge = level + wave * chop + ripples(vec2(p.x, level)) * 4.0 + bulge * uFill;
    float dy = p.y - edge;                               // > 0: above the surface
    if (dy > 2.0) return;
    float inside = smoothstep(1.0, -1.0, dy);

    // ── surface normal from the height field
    float h0 = surface(uv);
    float hx = surface(uv + vec2(1.5 / uRes.x, 0.0)) - h0;
    float hy = surface(uv + vec2(0.0, 1.5 / uRes.y)) - h0;
    vec3 n = normalize(vec3(-hx / 1.5, -hy / 1.5, 1.0));
    // the meniscus: the surface curves over right under the edge
    float men = exp(dy / 9.0);
    n = normalize(n + vec3(0.0, men * 0.8, 0.0));

    vec2 m = mark(uv);
    float letter = smoothstep(0.35, 0.65, m.g);

    // ── refraction + frost (the letters are clearer than the slab)
    vec2 off = n.xy * (26.0 + m.r * 34.0) / uRes;
    float rad = mix(9.0, 1.5, letter);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt((float(i) + 0.5) / 12.0) * rad;
        acc += texture2D(inputBuffer, uv + off + vec2(cos(a), sin(a)) * r / uRes).rgb;
    }
    vec3 glass = acc / 12.0;

    // dark smoky slab so the footer text stays readable; the letters glow
    glass = glass * mix(0.5, 1.05, letter) + mix(vec3(0.015, 0.03, 0.035), vec3(0.05, 0.09, 0.1), letter);

    // light on the surface
    vec3 L = normalize(vec3(-0.35, 0.75, 0.55));
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 36.0);
    glass += vec3(0.8, 1.0, 1.0) * spec * (0.25 + m.r * 0.7);

    // bright rim along the liquid edge, and a soft line of light under it
    glass += vec3(0.75, 0.97, 0.97) * (exp(-dy * dy / 1.6) * 0.6 + men * 0.08);

    outputColor = vec4(mix(inputColor.rgb, glass, inside), inputColor.a);
}
`;

class LiquidFooterEffect extends Effect {
    constructor() {
        super("LiquidFooterEffect", fragment, {
            attributes: EffectAttribute.CONVOLUTION,     // reads neighbouring pixels
            uniforms: new Map([
                ["uRect", new THREE.Uniform(new THREE.Vector4())],
                ["uMark", new THREE.Uniform(new THREE.Vector4())],
                ["tMark", new THREE.Uniform(null)],
                ["uMarkReady", new THREE.Uniform(0)],
                ["uRes", new THREE.Uniform(new THREE.Vector2(1, 1))],
                ["uTime", new THREE.Uniform(0)],
                ["uMouse", new THREE.Uniform(new THREE.Vector3(0.5, 0, 0))],
                ["uRipples", new THREE.Uniform(Array.from({ length: RIPPLES }, () => new THREE.Vector4()))],
                ["uActive", new THREE.Uniform(0)],
                ["uFill", new THREE.Uniform(0)],
                ["uRise", new THREE.Uniform(0)],
            ]),
        });
    }
}

// The logo as a texture: r = bevelled height (blurred shape), g = the shape
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function makeMarkTexture() {
    const W = 2048;
    const H = Math.round(W * MARK_ASPECT);
    const img = await loadImage(MARK_SRC);

    const sharp = document.createElement("canvas");
    sharp.width = W; sharp.height = H;
    const s = sharp.getContext("2d");
    s.drawImage(img, MARK_CROP.x, MARK_CROP.y, MARK_CROP.w, MARK_CROP.h, 0, 0, W, H);

    // the bevel: a soft copy of the shape (small, so INFOTECH's thin letters survive)
    const soft = document.createElement("canvas");
    soft.width = W; soft.height = H;
    const b = soft.getContext("2d");
    b.filter = "blur(9px)";
    b.drawImage(sharp, 0, 0);

    const a = s.getImageData(0, 0, W, H).data;
    const c = b.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const src = (y * W + x) * 4;
            const dst = ((H - 1 - y) * W + x) * 4;             // flip: uv runs bottom-up
            out[dst] = c[src + 3];
            out[dst + 1] = a[src + 3];
            out[dst + 3] = 255;
        }
    }
    const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

function easeOutBack(t) {
    const c = 1.2;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export default function LiquidFooter() {
    const effect = useMemo(() => new LiquidFooterEffect(), []);
    const u = effect.uniforms;
    const state = useMemo(() => ({ next: 0, lastX: -1e4, lastY: -1e4, near: 0, x: 0.5, y: 0 }), []);

    // Wordmark texture
    useEffect(() => {
        let tex = null;
        let alive = true;
        makeMarkTexture().catch(() => null).then((t) => {
            if (!t) return;
            if (!alive) { t.dispose(); return; }
            tex = t;
            u.get("tMark").value = t;
            u.get("uMarkReady").value = 1;
        });
        return () => { alive = false; tex?.dispose(); effect.dispose(); };
    }, [effect, u]);

    // Cursor: ripples while moving over the glass, a splash on press,
    // and the bulge where it meets the liquid edge
    useEffect(() => {
        const ripple = (cx, cy, strength) => {
            const r = u.get("uRipples").value[state.next];
            r.set(cx / window.innerWidth, 1 - cy / window.innerHeight, u.get("uTime").value, strength);
            state.next = (state.next + 1) % RIPPLES;
        };
        const onMove = (e) => {
            const el = footerGlass.footer;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            state.x = e.clientX / window.innerWidth;
            state.y = 1 - e.clientY / window.innerHeight;
            const fromEdge = e.clientY - rect.top;               // > 0: below the edge
            state.near = fromEdge > -80 && fromEdge < 120 ? Math.exp(-(fromEdge * fromEdge) / 3200) : 0;
            if (e.clientY < rect.top - 10 || e.clientY > rect.bottom) return;
            const moved = Math.hypot(e.clientX - state.lastX, e.clientY - state.lastY);
            if (moved > 30) {
                ripple(e.clientX, e.clientY, 0.55);
                state.lastX = e.clientX; state.lastY = e.clientY;
            }
        };
        const onDown = (e) => {
            const rect = footerGlass.footer?.getBoundingClientRect();
            if (rect && e.clientY >= rect.top - 10 && e.clientY <= rect.bottom) ripple(e.clientX, e.clientY, 1.3);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerdown", onDown, { passive: true });
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerdown", onDown);
        };
    }, [u, state]);

    useFrame((frame, delta) => {
        const W = window.innerWidth, H = window.innerHeight;
        const el = footerGlass.footer;
        const rect = el?.getBoundingClientRect();
        const active = rect && rect.top < H && rect.bottom > 0;
        u.get("uActive").value = active ? 1 : 0;
        if (!active) return;

        u.get("uRes").value.set(W, H);
        u.get("uTime").value = frame.clock.elapsedTime;
        u.get("uRect").value.set(rect.left / W, 1 - rect.bottom / H, rect.right / W, 1 - rect.top / H);
        const m = footerGlass.mark?.getBoundingClientRect();
        if (m) u.get("uMark").value.set(m.left / W, 1 - m.bottom / H, m.right / W, 1 - m.top / H);

        // arrival: liquid fill, then the logo surfacing
        const since = footerGlass.startedAt == null ? -1 : performance.now() - footerGlass.startedAt;
        const fill = since < 0 ? 0 : Math.min(since / FILL_MS, 1);
        const rise = since < 0 ? 0 : Math.min(Math.max((since - RISE_DELAY_MS) / RISE_MS, 0), 1);
        u.get("uFill").value = 1 - Math.pow(1 - fill, 3);                  // ease out
        u.get("uRise").value = rise <= 0 ? 0 : easeOutBack(rise);          // settles with a small overshoot

        const mouse = u.get("uMouse").value;
        const k = 1 - Math.exp(-delta * 10);
        mouse.x += (state.x - mouse.x) * k;
        mouse.y += (state.y - mouse.y) * k;
        mouse.z += (state.near - mouse.z) * (1 - Math.exp(-delta * 6));
    });

    return <primitive object={effect} dispose={null} />;
}
