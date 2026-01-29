// src/App.jsx
import React, { useState, useCallback } from "react";
import LandingIntro from "./scene/LandingIntro.jsx";
import Scene from "./scene/Scene.jsx";

export default function App() {
    const [introComplete, setIntroComplete] = useState(false);
    const [showScene, setShowScene] = useState(false);

    const handleIntroComplete = useCallback(() => {
        // Start showing the scene slightly before intro fully fades
        // This creates a crossfade effect
        setShowScene(true);

        // Brief delay then mark complete
        setTimeout(() => {
            setIntroComplete(true);
        }, 100);
    }, []);

    return (
        <>
            {/* Main Scene - starts rendering before intro finishes for smooth transition */}
            {showScene && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    opacity: introComplete ? 1 : 0,
                    transition: 'opacity 0.8s ease',
                    zIndex: 1
                }}>
                    <Scene />
                </div>
            )}

                {/* Landing Intro - overlays everything until complete */}
                {!introComplete && (
                    <LandingIntro onComplete={handleIntroComplete} />
                )}
        </>
    );
}