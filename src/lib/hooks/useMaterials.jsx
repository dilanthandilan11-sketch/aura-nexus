"use client";


import { ShaderMaterial, Texture, Vector2, Vector3 } from "three";
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { DEFAULT_CONFIG, REFRESH_RATE } from "../constant";

import baseVertex from "../glsl_js/base.js";
import clearFrag from "../glsl_js/clear.js";
import curlFrag from "../glsl_js/curl.js";
import divergenceFrag from "../glsl_js/divergence.js";
import gradientSubstractFrag from "../glsl_js/gradientSubstract.js";
import pressureFrag from "../glsl_js/pressure.js";
import splatFrag from "../glsl_js/splat.js";
import advectionFrag from "../glsl_js/advection.js";
import vorticityFrag from "../glsl_js/vorticity";

export const useMaterials = () => {
  const size = useThree((s) => s.size);

  const shaderMaterials = useMemo(() => {
    const advection = new ShaderMaterial({
      name: "Fluid/Advection",
      uniforms: {
        uVelocity: { value: new Texture() },
        uSource: { value: new Texture() },
        dt: { value: 1 / REFRESH_RATE },
        uDissipation: { value: 1.0 },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: advectionFrag,
      vertexShader: baseVertex,
      defines: { USE_V_UV: "" },
      depthTest: false,
      depthWrite: false,
    });

    const clear = new ShaderMaterial({
      name: "Fluid/Clear",
      uniforms: {
        uTexture: { value: new Texture() },
        uClearValue: { value: DEFAULT_CONFIG.pressure },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: clearFrag,
      vertexShader: baseVertex,
      defines: { USE_V_UV: "" },
      depthTest: false,
      depthWrite: false,
    });

    const curl = new ShaderMaterial({
      name: "Fluid/Curl",
      uniforms: {
        uVelocity: { value: new Texture() },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: curlFrag,
      vertexShader: baseVertex,
      defines: { USE_OFFSETS: "" },
      depthTest: false,
      depthWrite: false,
    });

    const divergence = new ShaderMaterial({
      name: "Fluid/Divergence",
      uniforms: {
        uVelocity: { value: new Texture() },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: divergenceFrag,
      vertexShader: baseVertex,
      defines: { USE_V_UV: "", USE_OFFSETS: "" },
      depthTest: false,
      depthWrite: false,
    });

    const gradientSubstract = new ShaderMaterial({
      name: "Fluid/GradientSubtract",
      uniforms: {
        uPressure: { value: new Texture() },
        uVelocity: { value: new Texture() },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: gradientSubstractFrag,
      vertexShader: baseVertex,
      defines: { USE_V_UV: "", USE_OFFSETS: "" },
      depthTest: false,
      depthWrite: false,
    });

    const pressure = new ShaderMaterial({
      name: "Fluid/Pressure",
      uniforms: {
        uPressure: { value: new Texture() },
        uDivergence: { value: new Texture() },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: pressureFrag,
      vertexShader: baseVertex,
      defines: { USE_V_UV: "", USE_OFFSETS: "" },
      depthTest: false,
      depthWrite: false,
    });

    const splat = new ShaderMaterial({
      name: "Fluid/Splat",
      uniforms: {
        uTarget: { value: new Texture() },
        aspectRatio: { value: size.width / size.height },
        uColor: { value: new Vector3() },
        uPointer: { value: new Vector2() },
        uRadius: { value: DEFAULT_CONFIG.radius / 100.0 },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: splatFrag,
      vertexShader: baseVertex,
      defines: { USE_V_UV: "" },
      depthTest: false,
      depthWrite: false,
    });

    const vorticity = new ShaderMaterial({
      name: "Fluid/Vorticity",
      uniforms: {
        uVelocity: { value: new Texture() },
        uCurl: { value: new Texture() },
        uCurlValue: { value: DEFAULT_CONFIG.curl },
        dt: { value: 1 / REFRESH_RATE },
        texelSize: { value: new Vector2() },
      },
      fragmentShader: vorticityFrag,
      vertexShader: baseVertex,
      defines: { USE_V_UV: "", USE_OFFSETS: "" },
      depthTest: false,
      depthWrite: false,
    });

    return {
      splat,
      curl,
      clear,
      divergence,
      pressure,
      gradientSubstract,
      advection,
      vorticity,
    };
  }, [size]);

  useEffect(() => {
    for (const material of Object.values(shaderMaterials)) {
      const aspectRatio = size.width / (size.height + 400);

      material.uniforms.texelSize.value.set(
        1 / (DEFAULT_CONFIG.simRes * aspectRatio),
        1 / DEFAULT_CONFIG.simRes
      );
    }

    return () => {
      for (const material of Object.values(shaderMaterials)) {
        material.dispose();
      }
    };
  }, [shaderMaterials, size]);

  return shaderMaterials;
};