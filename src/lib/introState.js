// src/lib/introState.js
// Has the loading intro already been seen in this visit?
//
// The full intro (boot screen, portal, then the headline after 7 s) plays on a
// real page load. Coming back to Home from another page inside the site (the
// logo, or any link to "/") skips it: the scene is already there and the
// headline, navbar and marquee play their entry straight away instead.
// A browser refresh resets this, so a refresh still shows the intro.

let seen = false;       // set once Home or any inner page has been shown
let returning = false;  // the Home being shown right now is a return visit

// Home: read during render (pure, safe to call twice under StrictMode)
export function homeIsReturn() {
    returning = seen;
    return returning;
}

// Home and the inner pages, from an effect: the visit has started
export function markSeen() {
    seen = true;
}

// How long to wait before an intro-timed element appears on Home.
// `full` is the delay after a real page load.
export const RETURN_DELAY = 700;
export function introDelay(full) {
    return returning ? RETURN_DELAY : full;
}

export function isReturnVisit() {
    return returning;
}
