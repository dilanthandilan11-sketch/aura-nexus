// src/components/scene/RefractionPlane.jsx
"use client";

import React, { useRef, useMemo } from "react";
import { useFrame, useThree, useFBO } from "@react-three/fiber";
import * as THREE from "three";

export default function RefractionPlane({
  children,
  distortionStrength = 0.3,
  noiseScale = 4.0,
  ...props
}) {
  const meshRef = useRef();
  const { viewport, pointer, gl, scene, camera } = useThree();
  const mouseRef = useRef({ x: 0.5, y: 0.5, velX: 0, velY: 0 });

  // Render target for background scene
  const fbo = useFBO();

  useFrame((state) => {
    if (!meshRef.current) return;

    // Calculate mouse velocity
    const targetX = (pointer.x + 1) / 2;
    const targetY = (pointer.y + 1) / 2;
    mouseRef.current.velX = (targetX - mouseRef.current.x) * 0.2;
    mouseRef.current.velY = (targetY - mouseRef.current.y) * 0.2;
    mouseRef.current.x = targetX;
    mouseRef.current.y = targetY;

    // Render background to FBO first
    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Update uniforms
    meshRef.current.material.uniforms.uTexture.value = fbo.texture;
    meshRef.current.material.uniforms.uMouse.value.set(
      mouseRef.current.x,
      mouseRef.current.y
    );
    meshRef.current.material.uniforms.uVelocity.value.set(
      mouseRef.current.velX,
      mouseRef.current.velY
    );
    meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const uniforms = useMemo(
    () => ({
      uTexture: { value: null },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uVelocity: { value: new THREE.Vector2(0, 0) },
      uDistortionStrength: { value: distortionStrength },
      uNoiseScale: { value: noiseScale },
    }),
    [distortionStrength, noiseScale]
  );

  return (
    <>
      {/* Original scene children */}
      <group visible={false}>{children}</group>

      {/* Full-screen refraction plane */}
      <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1, 64, 64]} />
        <shaderMaterial
          transparent
          uniforms={uniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D uTexture;
            uniform float uTime;
            uniform vec2 uMouse;
            uniform vec2 uVelocity;
            uniform float uDistortionStrength;
            uniform float uNoiseScale;
            
            varying vec2 vUv;
            
            // Simplex noise
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
            
            float snoise(vec2 v) {
              const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
              vec2 i  = floor(v + dot(v, C.yy) );
              vec2 x0 = v - i + dot(i, C.xx);
              vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
              vec4 x12 = x0.xyxy + C.xxzz;
              x12.xy -= i1;
              i = mod289(i);
              vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                + i.x + vec3(0.0, i1.x, 1.0 ));
              vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
              m = m*m; m = m*m;
              vec3 x = 2.0 * fract(p * C.www) - 1.0;
              vec3 h = abs(x) - 0.5;
              vec3 ox = floor(x + 0.5);
              vec3 a0 = x - ox;
              m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
              vec3 g;
              g.x  = a0.x  * x0.x  + h.x  * x0.y;
              g.yz = a0.yz * x12.xz + h.yz * x12.yw;
              return 130.0 * dot(m, g);
            }
            
            void main() {
              vec2 uv = vUv;
              
              // Distance from mouse
              float dist = distance(uv, uMouse);
              float radius = 0.25;
              float falloff = smoothstep(radius, 0.0, dist);
              
              // Noise-based displacement
              float noise1 = snoise(uv * uNoiseScale + uTime * 0.2);
              float noise2 = snoise(uv * uNoiseScale * 2.0 - uTime * 0.15);
              float noise = (noise1 + noise2 * 0.5) / 1.5;
              
              // Velocity-based directional distortion
              vec2 displacement = vec2(noise) * uDistortionStrength * falloff;
              displacement += uVelocity * falloff * 2.0;
              
              // Chromatic aberration based on distortion
              float aberration = length(displacement) * 0.5;
              
              vec2 distortedUV = uv + displacement;
              
              // Sample with RGB split for chromatic aberration
              float r = texture2D(uTexture, distortedUV + vec2(aberration, 0.0)).r;
              float g = texture2D(uTexture, distortedUV).g;
              float b = texture2D(uTexture, distortedUV - vec2(aberration, 0.0)).b;
              
              vec3 color = vec3(r, g, b);
              
              // Add subtle glow at cursor
              color += vec3(0.0, 0.8, 1.0) * falloff * 0.1;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
    </>
  );
}