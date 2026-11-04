/**
 * @typedef {Object} SharedProps
 * @property {number=} blend
 * @property {number=} intensity
 * @property {number=} distortion
 * @property {boolean=} rainbow
 * @property {string=} fluidColor
 * @property {string=} backgroundColor
 * @property {boolean=} showBackground
 * @property {*} blendFunction
 */

/**
 * @typedef {SharedProps & {
 *  densityDissipation?: number,
 *  pressure?: number,
 *  velocityDissipation?: number,
 *  force?: number,
 *  radius?: number,
 *  curl?: number,
 *  swirl?: number
 * }} FluidProps
 */

/**
 * @typedef {SharedProps & {
 *  tFluid: import("three").Texture
 * }} EffectProps
 */

export {};