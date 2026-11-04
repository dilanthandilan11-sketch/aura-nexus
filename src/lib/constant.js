import { BlendFunction } from "postprocessing";

export const OPTS = {
  blend: 1.18,
  intensity: 0.46,
  force: 0.6,
  distortion: 0.40,
  curl: 0.3,
  radius: 0.2,
  swirl: 1,
  pressure: 0.88,
  densityDissipation: 0.95,
  velocityDissipation: 1.0,
  fluidColor: "#3300ff",
  backgroundColor: "#070410",
  showBackground: true,
  rainbow: false,
  dyeRes: 512,
  simRes: 128,
  blendFunction: BlendFunction.SET,
};

export const DEFAULT_CONFIG = OPTS;

export const REFRESH_RATE = 60;