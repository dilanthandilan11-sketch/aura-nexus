// scene/capabilities/shapes.js
// ============================
// Point-set generators for the Capabilities particle morph. Every shape is
// sampled to the SAME particle count and returned as a Float32Array
// (x, y, z per particle), centred on the origin and sized to match the Aura
// logo, so MorphingParticles can morph between them index by index.
//
// No new assets: the logo comes from the existing GLB, everything else is
// generated in code (TextGeometry with a font bundled in three, primitive
// geometries, an inline SVG path, and maths). Temporary geometries are
// disposed after sampling.

import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import fontJson from "three/examples/fonts/helvetiker_bold.typeface.json";

// Seeded PRNG (mulberry32): deterministic, render-pure sampling
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function triangleArea(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const p = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const tri = new THREE.Triangle();
  let area = 0;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    area += tri.set(a, b, c).getArea();
  }
  if (g !== geom) g.dispose();
  return area;
}

// ── Aura logo ─────────────────────────────────────────────────────────────
// Identical algorithm, seed and draw order to the original LogoParticles, so
// the particle "A" that forms at the end of the void is the same point set.
// Also returns the scattered start cloud and per-particle seeds.
export function sampleLogo(scene, count, scatterRadius = 1.6) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh) meshes.push(o); });

  // Bounding box exactly as drei <Center> computes it
  const box = new THREE.Box3();
  const tmpBox = new THREE.Box3();
  meshes.forEach((m) => {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    tmpBox.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    box.union(tmpBox);
  });
  const center = box.getCenter(new THREE.Vector3());
  const dims = box.getSize(new THREE.Vector3());
  const logoSize = Math.max(dims.x, dims.y, dims.z);

  const areas = meshes.map((m) => triangleArea(m.geometry));
  const totalArea = areas.reduce((s, a) => s + a, 0) || 1;

  const rand = seeded(20251);
  const target  = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const seeds   = new Float32Array(count);
  const p = new THREE.Vector3();

  let written = 0;
  meshes.forEach((m, mi) => {
    const n = mi === meshes.length - 1
      ? count - written
      : Math.round((areas[mi] / totalArea) * count);
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(m.geometry)).setRandomGenerator(rand).build();
    for (let i = 0; i < n && written < count; i++, written++) {
      sampler.sample(p);
      p.applyMatrix4(m.matrixWorld).sub(center);
      target.set([p.x, p.y, p.z], written * 3);
    }
  });

  for (let i = 0; i < count; i++) {
    // Loose spherical cloud around the centre, denser toward the middle
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const r = logoSize * scatterRadius * (0.35 + 0.65 * Math.cbrt(rand()));
    const s = Math.sqrt(1 - u * u);
    scatter[i * 3]     = Math.cos(th) * s * r;
    scatter[i * 3 + 1] = u * r * 0.8;
    scatter[i * 3 + 2] = Math.sin(th) * s * r;
    seeds[i] = rand();
  }

  return { target, scatter, seeds, logoSize };
}

// ── Helpers for the generated shapes ──────────────────────────────────────
// Area-weighted surface sampling across several geometries (each already in
// its final placement), then centred and scaled so the largest dimension is
// `size`. Disposes the geometries.
function sampleGeometries(geoms, count, rand, size) {
  const areas = geoms.map(triangleArea);
  const total = areas.reduce((s, a) => s + a, 0) || 1;
  const out = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  let written = 0;
  geoms.forEach((g, gi) => {
    const n = gi === geoms.length - 1 ? count - written : Math.round((areas[gi] / total) * count);
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).setRandomGenerator(rand).build();
    for (let i = 0; i < n && written < count; i++, written++) {
      sampler.sample(p);
      out.set([p.x, p.y, p.z], written * 3);
    }
  });
  geoms.forEach((g) => g.dispose());
  return fitToSize(out, size);
}

// Centre a point set on its bounding box and scale its largest side to `size`
function fitToSize(arr, size) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (arr[i + k] < min[k]) min[k] = arr[i + k];
      if (arr[i + k] > max[k]) max[k] = arr[i + k];
    }
  }
  const c = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const k = size / extent;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i]     = (arr[i] - c[0]) * k;
    arr[i + 1] = (arr[i + 1] - c[1]) * k;
    arr[i + 2] = (arr[i + 2] - c[2]) * k;
  }
  return arr;
}

// ── 1 Build: </> code brackets ────────────────────────────────────────────
function codeBrackets(count, rand, size) {
  const font = new FontLoader().parse(fontJson);
  const geom = new TextGeometry("</>", {
    font,
    size: 2,
    depth: 0.5,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.035,
    bevelSegments: 2,
  });
  return sampleGeometries([geom], count, rand, size);
}

// ── 2 Grow: rising bar chart + upward arrow ───────────────────────────────
function growthChart(count, rand, size) {
  const geoms = [];
  const heights = [1.1, 1.8, 2.6, 3.5];
  heights.forEach((h, i) => {
    const g = new THREE.BoxGeometry(0.75, h, 0.6);
    g.translate(i * 1.05, h / 2, 0);
    geoms.push(g);
  });

  // Arrow outline (pointing +x), extruded, then rotated to rise over the bars
  const s = new THREE.Shape();
  s.moveTo(0, -0.14);
  s.lineTo(3.4, -0.14);
  s.lineTo(3.4, -0.45);
  s.lineTo(4.3, 0);
  s.lineTo(3.4, 0.45);
  s.lineTo(3.4, 0.14);
  s.lineTo(0, 0.14);
  s.closePath();
  const arrow = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false });
  arrow.translate(0, 0, -0.175);
  arrow.rotateZ(0.62);
  arrow.translate(-0.2, 2.0, 0);
  geoms.push(arrow);

  return sampleGeometries(geoms, count, rand, size);
}

// ── 3 Create: pen nib (vector pen tool), from an SVG path ─────────────────
const PEN_NIB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="
    M12 22.5 L19.5 14.5 L15.6 5.2 L8.4 5.2 L4.5 14.5 Z
    M12 12.9 A1.7 1.7 0 1 0 12 16.3 A1.7 1.7 0 1 0 12 12.9 Z
    M11.65 16.6 L12.35 16.6 L12.35 21.2 L11.65 21.2 Z" />
  <path d="M7.6 1.2 L16.4 1.2 L16.4 4 L7.6 4 Z" />
</svg>`;

function penNib(count, rand, size) {
  const data = new SVGLoader().parse(PEN_NIB_SVG);
  const geoms = [];
  data.paths.forEach((path) => {
    SVGLoader.createShapes(path).forEach((shape) => {
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: 2.2,
        bevelEnabled: true,
        bevelThickness: 0.2,
        bevelSize: 0.15,
        bevelSegments: 2,
        curveSegments: 16,
      });
      g.scale(1, -1, 1); // SVG y points down
      geoms.push(g);
    });
  });
  return sampleGeometries(geoms, count, rand, size);
}

// ── 4 Optimize: node network (spheres joined by lines) ────────────────────
function nodeNetwork(count, rand, size) {
  // Nodes in a flattened ellipsoid, roughly evenly spread
  const NODES = 16;
  const nodes = [];
  while (nodes.length < NODES) {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, (rand() * 2 - 1) * 0.45);
    if (v.lengthSq() > 1) continue;
    if (nodes.some((n) => n.distanceTo(v) < 0.42)) continue;
    nodes.push(v.multiplyScalar(2.4));
  }

  // Edges: each node to its 2 nearest neighbours (deduplicated)
  const edges = new Set();
  nodes.forEach((n, i) => {
    nodes
      .map((m, j) => ({ j, d: i === j ? Infinity : n.distanceTo(m) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach(({ j }) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`));
  });
  const edgeList = [...edges].map((e) => e.split("-").map(Number));

  const out = new Float32Array(count * 3);
  const nodeShare = Math.round(count * 0.42);
  const R = 0.2;
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (i < nodeShare) {
      // On a node sphere surface
      const n = nodes[i % NODES];
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      x = n.x + Math.cos(th) * s * R; y = n.y + u * R; z = n.z + Math.sin(th) * s * R;
    } else {
      // Along an edge, with a hair of jitter so lines read as glowing strands
      const [a, b] = edgeList[Math.floor(rand() * edgeList.length)];
      const t = rand();
      const A = nodes[a], B = nodes[b];
      x = A.x + (B.x - A.x) * t + (rand() - 0.5) * 0.04;
      y = A.y + (B.y - A.y) * t + (rand() - 0.5) * 0.04;
      z = A.z + (B.z - A.z) * t + (rand() - 0.5) * 0.04;
    }
    out.set([x, y, z], i * 3);
  }
  return fitToSize(out, size);
}

// ── 5 Sell: shopping bag (box body + torus handle) ────────────────────────
function shoppingBag(count, rand, size) {
  // Body: slightly squat, with a thin rim along the top edge
  const body = new THREE.BoxGeometry(3.2, 2.9, 1.1);
  const rim = new THREE.BoxGeometry(3.3, 0.16, 1.18);
  rim.translate(0, 1.45, 0);
  // Handles: thin, wide arches (a thick, narrow one reads as a padlock),
  // front and back so it reads as a bag from any sway angle
  const handle = new THREE.TorusGeometry(0.95, 0.055, 8, 56, Math.PI);
  handle.scale(1, 1.15, 1);
  handle.translate(0, 1.45, 0);
  const handle2 = handle.clone();
  handle.translate(0, 0, 0.3);
  handle2.translate(0, 0, -0.3);
  return sampleGeometries([body, rim, handle, handle2], count, rand, size);
}

// ── All Capabilities shapes ───────────────────────────────────────────────
// Index matches the steps: 0 intro (logo), 1 Build, 2 Grow, 3 Create,
// 4 Optimize, 5 Sell. Generated shapes are sized relative to the logo.
export function buildCapabilityShapes(logo, count) {
  const size = logo.logoSize * 0.9;
  const rand = seeded(7331);
  return [
    logo.target,
    codeBrackets(count, rand, size),
    growthChart(count, rand, size),
    penNib(count, rand, size),
    nodeNetwork(count, rand, size),
    shoppingBag(count, rand, size),
  ];
}
