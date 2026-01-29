// public/tracking.worker.js

// Import MediaPipe directly in the worker
importScripts('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');

let hands;

self.onmessage = async (e) => {
    // 1. Initialize on first message
    if (!hands) {
        hands = new self.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
            // Send simple data back to main thread
            self.postMessage(results);
        });
    }

    // 2. Process the frame
    if (e.data.image) {
        await hands.send({ image: e.data.image });
    }
};