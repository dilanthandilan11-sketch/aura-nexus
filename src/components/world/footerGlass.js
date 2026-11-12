// src/components/world/footerGlass.js
// Where the liquid-glass footer is on the page. SiteFooter registers its
// <footer> and glass-logo elements here; LiquidFooter (in the 3D canvas)
// reads their positions every frame. Kept apart from LiquidFooter so the page
// can use it without loading any WebGL code.
export const footerGlass = { footer: null, mark: null };

// The glass logo along the bottom of the footer is /logo.png, cropped to the
// logo itself (the PNG is a 4500 x 4500 square with the logo in a band)
export const MARK_SRC = "/logo.png";
export const MARK_CROP = { x: 0, y: 1388, w: 4500, h: 1622 };   // px in the PNG
export const MARK_ASPECT = MARK_CROP.h / MARK_CROP.w;           // height / width

// The arrival: when the footer scrolls into view, the liquid rises from the
// bottom of the screen and fills it, the content fades in as the liquid
// reaches it, then the glass logo surfaces from below.
// SiteFooter sets `startedAt` (performance.now()) when the footer comes into
// view and clears it on page change; LiquidFooter animates from it.
footerGlass.startedAt = null;
export const FILL_MS = 1100;        // liquid rises and fills the footer
export const RISE_DELAY_MS = 850;   // glass logo starts surfacing
export const RISE_MS = 1300;        // glass logo settles

// How much of the logo shows: the top 70% of "AURA"; the rest (and INFOTECH)
// runs off the bottom of the page. "AURA" is the top 54% of the logo crop.
export const MARK_VISIBLE = 0.54 * 0.7;
