"use client"

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { holdState } from "@/components/scene/molten/holdState";

const _mouse = new THREE.Vector2();

export default function AuroraStreaksFlowing({
                                                 count = 40,
                                                 opacity = 0.5,
                                                 intensity = 1.0,
                                                 speed = 0.2,
                                                 colorScheme = 0,
                                                 offset = 0,
                                                 freeze = false
                                             }) {
    const groupRef = useRef();
    const materialRefs = useRef([]);

    // Generate aurora curtain geometries
    const streaks = useMemo(() => {
        const streakArray = [];

        for (let i = 0; i < count; i++) {
            // Random direction for curtain orientation
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const direction = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            ).normalize();

            // Create VERY WIDE curtain with natural taper
            const topWidth = 25 + Math.random() * 15; // 25-40 units at top (VERY WIDE!)
            const bottomWidth = 3 + Math.random() * 5; // 3-8 units at bottom (narrow)
            const height = 120;
            const widthSegments = 30;
            const heightSegments = 60;

            // Create custom geometry for tapered curtain
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const uvs = [];
            const indices = [];

            // Generate vertices with smooth curves and natural taper
            for (let h = 0; h <= heightSegments; h++) {
                const v = h / heightSegments; // 0 at top, 1 at bottom
                const y = (v - 0.5) * height; // Center around 0

                // Smooth width taper from top (thick) to bottom (thin)
                const widthAtHeight = THREE.MathUtils.lerp(topWidth, bottomWidth, v * v); // Quadratic taper

                // Add natural wave/undulation to the curtain
                const waveOffset = Math.sin(v * Math.PI * 3 + i * 0.5) * 2;
                const curveFactor = Math.sin(v * Math.PI) * 8; // Bellows out in middle

                for (let w = 0; w <= widthSegments; w++) {
                    const u = w / widthSegments; // 0 to 1
                    const x = (u - 0.5) * (widthAtHeight + curveFactor);

                    // Add depth curve (curtain curves forward/back)
                    const z = Math.sin(u * Math.PI) * 5 + waveOffset;

                    // Transform by direction
                    const localPos = new THREE.Vector3(x, y, z);
                    const rotatedPos = localPos.applyAxisAngle(
                        new THREE.Vector3(0, 1, 0),
                        theta
                    ).applyAxisAngle(
                        new THREE.Vector3(1, 0, 0),
                        phi - Math.PI / 2
                    );

                    vertices.push(rotatedPos.x, rotatedPos.y, rotatedPos.z);
                    uvs.push(u, v);
                }
            }

            // Generate indices for triangles
            for (let h = 0; h < heightSegments; h++) {
                for (let w = 0; w < widthSegments; w++) {
                    const a = h * (widthSegments + 1) + w;
                    const b = a + 1;
                    const c = a + (widthSegments + 1);
                    const d = c + 1;

                    indices.push(a, b, c);
                    indices.push(b, d, c);
                }
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const timeOffset = Math.random() * Math.PI * 2;
            const colorMix = Math.random();

            streakArray.push({
                geometry,
                timeOffset,
                colorMix,
                speedVariation: 0.5 + Math.random()
            });
        }

        return streakArray;
    }, [count]);

    // Press-and-hold warp uniforms. Created ONCE and shared by every curtain:
    // three.js keeps the uniform objects it saw when the shader compiled, and
    // the uniforms block below is rebuilt whenever opacity/intensity change
    // (they do while scrolling). Fresh warp objects there were never read by
    // the GPU, so after scrolling away and back the curtains stopped warping.
    const warpUniforms = useMemo(() => ({
        uHold:   { value: 0 },
        uPress:  { value: 0 },
        uFlow:   { value: 0 },
        uAspect: { value: 1 },
        uMouse:  { value: new THREE.Vector2() },
    }), []);

    const uniforms = useMemo(() => ({
        uTime: { value: offset },
        uOpacity: { value: opacity },
        uIntensity: { value: intensity },
        uColorA: { value: new THREE.Color("#00AEEF") },
        uColorB: { value: new THREE.Color("#7B2CBF") },
        uColorC: { value: new THREE.Color("#FF006E") },
        uColorScheme: { value: colorScheme },
        ...warpUniforms,   // same objects every time (see above)
    }), [opacity, intensity, colorScheme, offset, warpUniforms]);

    useFrame((state) => {
        if (!groupRef.current || freeze) return;

        // Same pull as the nebula (see warp/nebulaWarpShaders.js)
        warpUniforms.uHold.value   = Math.max(0, holdState.value) * holdState.gate;
        warpUniforms.uPress.value  = holdState.press * holdState.gate;
        warpUniforms.uFlow.value   = holdState.flow;
        warpUniforms.uAspect.value = state.size.width / state.size.height;
        warpUniforms.uMouse.value.lerp(_mouse.set(state.pointer.x, state.pointer.y), 0.35);

        const time = state.clock.elapsedTime * speed;

        // Update time uniform for all materials
        materialRefs.current.forEach((mat, i) => {
            if (mat) {
                const streak = streaks[i];
                mat.uniforms.uTime.value = time * streak.speedVariation + streak.timeOffset;
            }
        });
    });

    const vertexShader = `
        varying vec2 vUv;
        varying vec3 vPosition;

        uniform float uHold;
        uniform float uPress;
        uniform float uFlow;
        uniform float uAspect;
        uniform vec2  uMouse;   // cursor in NDC

        // cheap smooth wobble (no texture lookups in the vertex stage)
        vec2 wobble(vec2 p) {
            return vec2(sin(p.y * 3.1 + p.x * 1.7), cos(p.x * 2.9 - p.y * 2.3));
        }

        void main() {
            vUv = uv;
            vPosition = position;
            vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            // ── press-and-hold pull, done in screen space ──────────────
            // Mirrors the nebula warp: everything is dragged outward from
            // the logo (mostly sideways) and stretched along the pull.
            if (clip.w > 0.0 && (uHold > 0.001 || uPress > 0.001)) {
                float w = max(clip.w, 1e-3);
                vec2 p = clip.xy / w * vec2(uAspect, 1.0) * 0.5;   // centred, y in -0.5..0.5
                float r = length(p);
                vec2 rdir = p / (r + 1e-4);
                vec2 dir = normalize(mix(rdir, vec2(p.x / (abs(p.x) + 0.08), 0.0), 0.45) + vec2(1e-4, 0.0));
                float k = smoothstep(0.02, 0.35, r);

                float pull = 1.0 + uHold * 0.9 * smoothstep(0.0, 0.9, r);
                p *= pull;
                p += dir * dot(p, dir) * (uHold * 1.8) * 0.35 * k;
                p += wobble(p * 2.2 - dir * uFlow * 0.7) * 0.025 * uHold * k;

                vec2 m = uMouse * vec2(uAspect, 1.0) * 0.5;
                vec2 dm = p - m;
                p += normalize(dm + 1e-5) * exp(-dot(dm, dm) / 0.03) * 0.06 * (uPress * 0.6 + uHold);

                clip.xy = p / (vec2(uAspect, 1.0) * 0.5) * w;
            }
            gl_Position = clip;
        }
    `;

    const fragmentShader = `
        precision highp float;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        
        uniform float uTime;
        uniform float uOpacity;
        uniform float uIntensity;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform float uColorScheme;
        
        // Simplex noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
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
        
        void main() {
            // Use Y coordinate for flow direction (along the streak)
            float y = vUv.y + uTime * 0.1; // Flow animation
            float x = vUv.x * 3.0;
            
            // Create flowing bands along the streak
            float wave = snoise(vec2(x * 0.5, y * 2.0)) * 0.3;
            float wave2 = snoise(vec2(x + uTime * 0.05, y * 1.5)) * 0.2;
            
            y += wave + wave2;
            
            // Flowing bands
            float bands = sin(y * 3.14159 * 4.0 + uTime * 0.5) * 0.5 + 0.5;
            bands = pow(bands, 2.5);
            
            // Detail layer
            float detail = snoise(vec2(x * 2.0 - uTime * 0.15, y * 2.5));
            detail = smoothstep(0.3, 0.7, detail) * 0.3;
            
            float aurora = bands * (0.6 + detail * 0.4);
            
            // Streaks within bands
            float streaks = snoise(vec2(x * 5.0 + uTime * 0.3, y * 1.2));
            streaks = smoothstep(0.45, 0.55, streaks) * 0.2;
            aurora += streaks * bands;
            
            // Fade at edges (horizontally)
            float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
            aurora *= edgeFade;
            
            // Color mixing
            float colorNoise1 = snoise(vec2(x * 0.6 + uTime * 0.08, y * 0.4));
            float colorNoise2 = snoise(vec2(x * 0.9 - uTime * 0.1, y * 0.6));
            
            float colorMix1 = smoothstep(-0.4, 0.6, colorNoise1);
            float colorMix2 = smoothstep(-0.3, 0.7, colorNoise2);
            
            vec3 color;
            if (uColorScheme < 0.5) {
                // Cyan to Green
                color = mix(uColorA, vec3(0.0, 1.0, 0.53), colorMix1);
            } else if (uColorScheme < 1.5) {
                // Purple to Pink
                color = mix(uColorB, uColorC, colorMix1);
            } else {
                // Mixed
                color = mix(uColorA, uColorB, colorMix1);
                color = mix(color, uColorC, colorMix2 * 0.4);
            }
            
            color *= (0.5 + aurora * 0.5) * uIntensity;
            
            float alpha = aurora * uOpacity;
            
            gl_FragColor = vec4(color, alpha);
        }
    `;

    return (
        <group ref={groupRef}>
            {streaks.map((streak, i) => (
                <mesh
                    key={i}
                    geometry={streak.geometry}
                >
                    <shaderMaterial
                        ref={(ref) => (materialRefs.current[i] = ref)}
                        uniforms={{
                            ...uniforms,
                            uColorScheme: { value: colorScheme }
                        }}
                        vertexShader={vertexShader}
                        fragmentShader={fragmentShader}
                        transparent
                        side={THREE.DoubleSide}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            ))}
        </group>
    );
}