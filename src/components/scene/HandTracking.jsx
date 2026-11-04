// src/scene/HandTracking.jsx
// Hand tracking using MediaPipe Hands
"use client"

import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function HandTracking({ onHandData, enabled = true }) {
    const videoRef = useRef(null);
    const handsRef = useRef(null);
    const cameraRef = useRef(null);
    const rafIdRef = useRef(null); // Track RAF for cleanup
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState(null);

    // Process results from MediaPipe
    const onResults = useCallback((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];

            // Calculate hand data
            const tension = getHandTension(landmarks);
            const palmPos = getPalmPosition(landmarks);
            const gestures = detectGestures(landmarks, tension);

            onHandData({ tension, palmPos, gestures, landmarks });
        } else {
            onHandData(null);
        }
    }, [onHandData]);

    useEffect(() => {
        if (!enabled) {
            onHandData(null);
            return;
        }

        // Check if MediaPipe is available
        if (typeof window === 'undefined') return;

        const initHandTracking = async () => {
            try {
                // Check if Hands is available (loaded from CDN in index.html)
                if (typeof window.Hands === 'undefined') {
                    setError('MediaPipe Hands not loaded. Add the script to index.html');
                    console.error('MediaPipe Hands not loaded. Make sure you have these in index.html:');
                    console.error('<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>');
                    console.error('<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>');
                    return;
                }

                setStatus('Setting up camera...');

                // Create video element if not exists
                if (!videoRef.current) {
                    const video = document.createElement('video');
                    video.style.display = 'none';
                    video.setAttribute('playsinline', '');
                    video.setAttribute('autoplay', '');
                    document.body.appendChild(video);
                    videoRef.current = video;
                }

                // Initialize MediaPipe Hands
                const hands = new window.Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 0, // 0 = Lite, 1 = Full
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                hands.onResults(onResults);
                handsRef.current = hands;

                setStatus('Starting camera...');

                // Initialize camera
                if (typeof window.Camera !== 'undefined') {
                    const camera = new window.Camera(videoRef.current, {
                        onFrame: async () => {
                            if (handsRef.current && videoRef.current) {
                                await handsRef.current.send({ image: videoRef.current });
                            }
                        },
                        width: 320,
                        height: 240
                    });

                    await camera.start();
                    cameraRef.current = camera;
                    setStatus('Hand tracking active');
                    setError(null);
                } else {
                    // Fallback: Use getUserMedia directly
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 320, height: 240 }
                    });

                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();

                    // Manual frame processing
                    const processFrame = async () => {
                        if (!enabled || !handsRef.current || !videoRef.current) {
                            rafIdRef.current = null;
                            return;
                        }

                        if (videoRef.current.readyState >= 2) {
                            await handsRef.current.send({ image: videoRef.current });
                        }

                        rafIdRef.current = requestAnimationFrame(processFrame);
                    };

                    rafIdRef.current = requestAnimationFrame(processFrame);
                    setStatus('Hand tracking active (fallback mode)');
                }

            } catch (err) {
                console.error('Hand tracking error:', err);
                setError(err.message);
                setStatus('Error: ' + err.message);
            }
        };

        initHandTracking();

        // Cleanup
        return () => {
            // Cancel RAF to prevent memory leak
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            if (cameraRef.current) {
                cameraRef.current.stop();
            }
            if (videoRef.current) {
                if (videoRef.current.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                }
                if (videoRef.current.parentNode) {
                    videoRef.current.parentNode.removeChild(videoRef.current);
                }
                videoRef.current = null;
            }
            if (handsRef.current) {
                handsRef.current.close();
                handsRef.current = null;
            }
        };
    }, [enabled, onResults]);

    // Show status indicator when enabled
    if (!enabled) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            padding: '8px 12px',
            background: error ? 'rgba(255,0,0,0.3)' : 'rgba(0,174,239,0.3)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000,
            pointerEvents: 'none'
        }}>
            🖐️ {status}
        </div>
    );
}

// --- Helper Functions ---
function getHandTension(landmarks) {
    const wrist = landmarks[0];
    const tips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky tips
    let total = 0;

    tips.forEach(i => {
        const d = Math.hypot(
            landmarks[i].x - wrist.x,
            landmarks[i].y - wrist.y,
            landmarks[i].z - wrist.z
        );
        total += d;
    });

    // Normalize to 0-1 range (0 = fist, 1 = open hand)
    return Math.max(0, Math.min(1, (total / 5 - 0.2) / 0.4));
}

function getPalmPosition(landmarks) {
    // Average of wrist and base of fingers
    const pts = [0, 1, 5, 9, 13, 17];
    let x = 0, y = 0, z = 0;

    pts.forEach(i => {
        x += landmarks[i].x;
        y += landmarks[i].y;
        z += landmarks[i].z;
    });

    return {
        x: x / pts.length,
        y: y / pts.length,
        z: z / pts.length
    };
}

function detectGestures(landmarks, tension) {
    // Pinch detection: distance between thumb tip and index tip
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const pinchDist = Math.hypot(
        thumbTip.x - indexTip.x,
        thumbTip.y - indexTip.y
    );

    return {
        fist: tension < 0.2,
        openHand: tension > 0.8,
        pinch: pinchDist < 0.05,
        pointing: tension > 0.4 && tension < 0.7 // Index extended, others closed
    };
}