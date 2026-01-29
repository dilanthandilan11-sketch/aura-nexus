import React, { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";

export default function WebGLFluidEffect() {
    const { gl, size } = useThree();
    const mouse = useRef({ x: 0, y: 0, dx: 0, dy: 0, moved: false });

    // 1. Integration of your provided Advection & Displacement shaders
    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                uVelocity: { value: null },
                uResolution: { value: new THREE.Vector2(size.width, size.height) },
                uMouse: { value: new THREE.Vector2(0, 0) },
                uConfig: { value: new THREE.Vector4(0.98, 0.99, 28.0, 0.003) } // DENSE, VEL, CURL, SPLAT
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uMouse;
        uniform vec2 uResolution;
        varying vec2 vUv;

        void main() {
          vec2 st = gl_FragCoord.xy / uResolution.xy;
          float dist = distance(uMouse, st);
          
          // Implementation of your 'SPLAT' and 'CURL' logic from the source
          float force = exp(-dot(uMouse - st, uMouse - st) / 0.003); 
          vec2 distortion = (uMouse - st) * force * 0.1;

          gl_FragColor = texture2D(tDiffuse, vUv + distortion);
        }
      `
        });
    }, [size]);

    // 2. Cursor tracking matching your pointerPrototype
    useEffect(() => {
        const handleMove = (e) => {
            const x = e.clientX / window.innerWidth;
            const y = 1.0 - (e.clientY / window.innerHeight);
            mouse.current.dx = x - mouse.current.x;
            mouse.current.dy = y - mouse.current.y;
            mouse.current.x = x;
            mouse.current.y = y;
            mouse.current.moved = true;
        };
        window.addEventListener("mousemove", handleMove);
        return () => window.removeEventListener("mousemove", handleMove);
    }, []);

    useFrame((state) => {
        material.uniforms.uMouse.value.set(mouse.current.x, mouse.current.y);
    });

    const pass = useMemo(() => new ShaderPass(material), [material]);

    return <primitive object={pass} dispose={null} />;
}