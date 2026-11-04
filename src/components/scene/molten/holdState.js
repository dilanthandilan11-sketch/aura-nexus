// src/components/scene/molten/holdState.js
// Shared, mutable press-and-hold state (no React state, no re-renders).
// Written once per frame by <HoldController/>, read by the molten shader,
// the bloom / chromatic-aberration boost and anything else that wants it.

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export const holdState = {
    held:   false, // pointer (or open hand) is down right now
    heldFor: 0,    // seconds the current hold has lasted
    value:  0,     // 0..1 pull amount (spring, overshoots a little on release)
    press:  0,     // 0..1 fast attack / slower decay, drives the cursor glow
    flow:   0,     // integral of value over time (liquid streaming outward)
    gate:   1,     // 0..1 how much the effect is allowed (landing only)
};

// Seconds of holding until the pull is fully built
const BUILD_SECONDS = 1.6;

// Don't start a pull when the user is clicking UI
const isInteractive = (el) =>
    !!el?.closest?.("a, button, input, textarea, select, label, [role='button']");

/**
 * Drives holdState from the mouse/touch (or the hand tracker's open hand).
 * `enabled` false = no new holds (intro still frozen, or scrolled past the hero).
 */
export function HoldController({ enabled = true, useHandControl = false, handData = null }) {
    const vel = useRef(0);

    useEffect(() => {
        const down = (e) => {
            if (useHandControl) return;
            if (e.button !== undefined && e.button !== 0) return;
            if (isInteractive(e.target)) return;
            holdState.held = true;
        };
        const up = () => { holdState.held = false; };

        window.addEventListener("pointerdown", down);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        window.addEventListener("blur", up);
        return () => {
            window.removeEventListener("pointerdown", down);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            window.removeEventListener("blur", up);
            holdState.held = false;
        };
    }, [useHandControl]);

    useFrame((_, rawDelta) => {
        const dt = Math.min(rawDelta, 1 / 20);

        // Hand tracking: an open hand (or a tense one) counts as holding
        if (useHandControl) {
            holdState.held = !!handData && (handData.gestures?.openHand || handData.tension > 0.6);
        }

        const held = holdState.held && enabled;
        holdState.heldFor = held ? holdState.heldFor + dt : 0;

        // Target eases in over BUILD_SECONDS while held, 0 on release
        const b = Math.min(holdState.heldFor / BUILD_SECONDS, 1);
        const target = held ? 1 - Math.pow(1 - b, 2.2) : 0;

        // Damped spring: follows the build smoothly, wobbles a touch on release
        const k = held ? 40 : 26;
        const c = held ? 11 : 6.5;
        vel.current += (target - holdState.value) * k * dt;
        vel.current *= Math.exp(-c * dt);
        holdState.value = Math.min(1.15, Math.max(-0.08, holdState.value + vel.current * dt));

        // Cursor glow: snaps on, fades out
        const pTarget = held ? 1 : 0;
        const pRate = held ? 14 : 3.5;
        holdState.press += (pTarget - holdState.press) * (1 - Math.exp(-pRate * dt));

        holdState.flow += Math.max(holdState.value, 0) * dt;

        // Fade the whole effect in/out with the gate (scrolling away mid-hold)
        const gTarget = enabled ? 1 : 0;
        holdState.gate += (gTarget - holdState.gate) * (1 - Math.exp(-6 * dt));
    });

    return null;
}
