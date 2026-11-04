"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import Example2 from "./Example2";

export default function Example2Canvas() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 1000 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Example2 />
        </Suspense>
      </Canvas>
    </div>
  );
}