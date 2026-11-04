"use client";

import * as THREE from "three";
import { useFBO } from "@react-three/drei";
import { useRef } from "react";

export const useDoubleFBO = (width, height, options) => {
  const read = useFBO(width, height, options);
  const write = useFBO(width, height, options);

  const fbo = useRef(null);

  if (!fbo.current) {
    fbo.current = {
      read,
      write,
      swap: () => {
        const temp = fbo.current.read;
        fbo.current.read = fbo.current.write;
        fbo.current.write = temp;
      },
      dispose: () => {
        fbo.current.read?.dispose?.();
        fbo.current.write?.dispose?.();
      },
      setGenerateMipmaps: (value) => {
        if (fbo.current.read?.texture) fbo.current.read.texture.generateMipmaps = value;
        if (fbo.current.write?.texture) fbo.current.write.texture.generateMipmaps = value;
      },
    };
  } else {
    // keep targets updated if useFBO returns new ones (e.g., size/options change)
    fbo.current.read = read;
    fbo.current.write = write;
  }

  return fbo.current;
};