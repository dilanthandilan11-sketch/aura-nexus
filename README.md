# 3D Particle Sphere - Full Rotation Control

A stunning interactive 3D particle sphere with complete rotation control via hand gestures or mouse.

## ✨ Features

### 🎮 Dual Control System

**Mouse Control:**
- **Drag** anywhere to rotate the entire scene in 3D
- **Hold left click** to form particle sphere (6-7 seconds)
- **Move cursor** to attract particles on sphere surface
- **Double-click** to break sphere and disperse particles

**Hand Gesture Control:**
- **Move hand** position to rotate scene naturally
- **Open hand** (spread fingers) to form sphere
- **Close fist** to break sphere
- **Palm position** attracts particles in 3D space

### 🔄 Full 3D Rotation
- Rotate around X-axis (pitch)
- Rotate around Y-axis (yaw)
- Smooth interpolation between states
- Arrow keys for fine control
- Reset with 'R' key

### 🎨 Visual Effects
- 8,000+ particles with depth-based sizing
- Aurora and nebula backgrounds
- Bloom, chromatic aberration, noise effects
- Glass logo at center
- Smooth particle physics

## 🚀 Quick Start

### 1. File Setup

Replace these files in your project:

**Required Files:**
- `SceneSimplified.jsx` → `/src/scene/Scene.jsx`
- `ArtifactSimplified.jsx` → `/src/scene/Artifact.jsx`
- `StarfieldWithHands.jsx` → `/src/scene/StarfieldWithHands.jsx`
- `HandTracking.jsx` → `/src/scene/HandTracking.jsx`

**Keep These:**
- `Aurora.jsx`
- `Nebula.jsx`

**Remove These (not needed):**
- `HUD.jsx` (menu rings removed)
- `Sections.jsx` (text panels removed)
- `HyperJump.jsx` (zoom animation removed)
- `HyperFX.jsx` (warp effects removed)

### 2. Update App.jsx

```jsx
import Scene from "./scene/Scene.jsx";

export default function App() {
    return <Scene />;
}
```

### 3. Add MediaPipe Scripts

In your `index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
```

## 🎮 Controls Reference

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `H` | Toggle hand/mouse control |
| `R` | Reset rotation to center |
| `←→` | Rotate left/right (yaw) |
| `↑↓` | Rotate up/down (pitch) |

### Mouse Controls
| Action | Effect |
|--------|--------|
| **Drag** | Rotate scene 360° |
| **Hold** | Form particle sphere |
| **Move** | Attract particles |
| **Double-click** | Break sphere |

### Hand Gestures
| Gesture | Effect |
|---------|--------|
| **Move hand left/right** | Rotate scene horizontally |
| **Move hand up/down** | Rotate scene vertically |
| **Open hand** ✋ | Form sphere gradually |
| **Close fist** ✊ | Break and disperse |
| **Palm position** | Attract nearby particles |

## 🔧 Customization

### Rotation Sensitivity

In `SceneSimplified.jsx`:

```javascript
// Mouse rotation sensitivity
const deltaX = e.clientX - lastMouse.x;
const deltaY = e.clientY - lastMouse.y;

setRotation(prev => ({
    x: prev.x - deltaY * 0.005, // Change 0.005 to adjust sensitivity
    y: prev.y + deltaX * 0.005,
    z: prev.z
}));
```

### Hand Rotation Mapping

```javascript
// Hand rotation range
const targetRotX = (handData.palmPos.y - 0.5) * Math.PI; // ±90°
const targetRotY = (handData.palmPos.x - 0.5) * Math.PI * 2; // ±180°

// Change multipliers for wider/narrower range
```

### Particle Count

```jsx
<StarfieldWithHands 
    count={6000}  // Lower for better performance
    ...
/>
```

### Arrow Key Speed

```javascript
const rotSpeed = 0.05; // Increase for faster rotation
```

## 🎯 How It Works

### Mouse Rotation
1. Mouse down starts drag tracking
2. Movement delta calculated each frame
3. Horizontal movement → Y-axis rotation (yaw)
4. Vertical movement → X-axis rotation (pitch)
5. Entire scene group rotates smoothly

### Hand Rotation
1. Palm position detected by MediaPipe (0-1 normalized)
2. Mapped to rotation angles:
    - Palm X → Scene Y rotation (-180° to +180°)
    - Palm Y → Scene X rotation (-90° to +90°)
3. Smooth lerp interpolation (0.1 factor)
4. Updates every frame

### Scene Structure
```
<group> (rotation applied here)
  ├── Aurora (background)
  ├── Nebula (background)
  ├── StarfieldWithHands (particles)
  └── Artifact (glass logo)
```

## 📊 Performance Tips

### For 60 FPS on Mid-Range Devices:
- Reduce particles: `count={5000}`
- Lower webcam resolution: `320x240`
- Disable bloom effect temporarily
- Use mouse mode instead of hand tracking

### For Maximum Quality:
- Increase particles: `count={10000}`
- Higher webcam quality: `640x480`
- Keep all post-processing effects

## 🐛 Troubleshooting

**Rotation feels jerky:**
- Lower rotation sensitivity values
- Increase lerp factor for smoother interpolation

**Hand control not smooth:**
- Ensure good lighting on your hand
- Keep hand steady in webcam frame
- Reduce hand tracking model complexity

**Scene rotates too fast:**
- Decrease `deltaX/Y * 0.005` multiplier
- Increase damping/friction (custom implementation)

**Particles lag during rotation:**
- Reduce particle count
- Disable unnecessary post-processing

## 🎨 Removed Features

From the original version, these have been removed for a cleaner experience:

❌ **Menu orbit rings** - No more HUD component
❌ **Text labels** - Clean particle-only view
❌ **Zoom animations** - No HyperJump transitions
❌ **Section panels** - No content overlays
❌ **Camera movements** - Static camera, scene rotates

The focus is now 100% on the interactive particle sphere!

## 🔮 Future Ideas

- [ ] Pinch to zoom in/out
- [ ] Two-hand gestures (both hands control different aspects)
- [ ] Particle color change with hand distance
- [ ] Custom rotation axes (Z-axis roll)
- [ ] Momentum/inertia on rotation release
- [ ] Touch screen support for mobile
- [ ] Gyroscope control on mobile devices

## 📝 Technical Notes

### Rotation Order
Scene uses Euler angles with default rotation order (XYZ). For gimbal lock prevention in advanced scenarios, consider switching to quaternions.

### Hand Tracking Latency
Typical latency: 50-100ms. Lerp smoothing compensates for jitter but adds slight delay. Adjust lerp factor (0.1) for responsiveness vs. smoothness trade-off.

### Particle Physics
Particles maintain their own physics simulation. Rotation is purely visual transform applied to parent group - particle velocities remain in local space.

---

**Enjoy your fully controllable 3D particle experience!** 🎨✨