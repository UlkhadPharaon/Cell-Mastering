import * as THREE from 'three';
import { makeRng, range, spreadPoints, unitVector, clamp } from '../util/math';

/**
 * Geometry factories for procedural cell parts.
 * `q` is a quality factor 0..1: segment counts scale with it so the low-quality
 * preset can reuse the same builders with cheaper geometry.
 */

// ---------------------------------------------------------------------------
// Body shapes (the overall cell outline) — used by membrane / wall / cytoplasm
// ---------------------------------------------------------------------------

export type BodyKind = 'animal' | 'plant' | 'rbc';

/** Organic blob: icosphere with low-frequency sine noise. ~0.92..1.05 radius wobble. */
function animalBody(radius: number, q: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, q > 0.6 ? 4 : 3);
  displace(g, (v) => {
    const n =
      Math.sin(v.x * 4.1 + v.y * 2.3) * 0.02 +
      Math.sin(v.y * 5.7 - v.z * 3.1) * 0.018 +
      Math.sin(v.z * 3.9 + v.x * 6.2) * 0.015;
    return radius + n * radius * 3;
  });
  return g;
}

/** Biconcave disc: sphere squashed in z with central dimples on both faces. */
function rbcBody(radius: number, q: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, q > 0.6 ? 48 : 28, q > 0.6 ? 32 : 20);
  displace(g, (v) => {
    const r2 = (v.x * v.x + v.y * y2(v)) / (radius * radius);
    // dimple: pull z toward 0 near the centre of each face
    const dimple = 1 - 0.55 * Math.max(0, 1 - r2 * 2.2);
    const pos = v.clone();
    pos.z *= 0.34 * dimple;
    pos.x *= 1.02; pos.y *= 1.02;
    return pos;
  });
  return g;
}
function y2(v: THREE.Vector3) { return v.y * v.y; }

/** Plant cell: rounded box (brick). */
function plantBody(radius: number, q: number): THREE.BufferGeometry {
  const s = radius;
  const g = new THREE.BoxGeometry(1.75 * s, 1.15 * s, 1.55 * s, q > 0.6 ? 12 : 6, q > 0.6 ? 8 : 4, q > 0.6 ? 12 : 6);
  // round the corners: normalize each vertex toward a rounded-box shape
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const half = new THREE.Vector3(1.75 * s / 2, 1.15 * s / 2, 1.55 * s / 2);
  const k = 0.16 * s; // corner radius
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const inner = new THREE.Vector3(
      clamp(v.x, -half.x + k, half.x - k),
      clamp(v.y, -half.y + k, half.y - k),
      clamp(v.z, -half.z + k, half.z - k)
    );
    const d = v.clone().sub(inner);
    if (d.length() > k) d.setLength(k);
    pos.setXYZ(i, inner.x + d.x, inner.y + d.y, inner.z + d.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Apply a radius/position function to every vertex, optionally as radial scaling. */
function displace(g: THREE.BufferGeometry, fn: (v: THREE.Vector3) => THREE.Vector3 | number): void {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const out = fn(v);
    if (typeof out === 'number') {
      v.setLength(out); // radial: set absolute radius
    } else {
      v.copy(out);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
}

export function bodyGeometry(kind: BodyKind, radius: number, q: number): THREE.BufferGeometry {
  if (kind === 'rbc') return rbcBody(radius, q);
  if (kind === 'plant') return plantBody(radius, q);
  return animalBody(radius, q);
}

// ---------------------------------------------------------------------------
// Organelle shape factories: id -> (size, q, rngSeedSalt) -> geometry
// ---------------------------------------------------------------------------

type ShapeFactory = (size: number, q: number, salt: number) => THREE.BufferGeometry;

const mitogenome: ShapeFactory = (size, q) => {
  // Bean-ish capsule: sphere scaled and pinched.
  const g = new THREE.SphereGeometry(size, q > 0.6 ? 24 : 14, q > 0.6 ? 16 : 10);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const pinch = 1 - 0.25 * Math.pow(Math.abs(v.x / size), 3);
    pos.setXYZ(i, v.x * 1.7, v.y * 0.8 * pinch, v.z * 0.8 * pinch);
  }
  g.computeVertexNormals();
  return g;
};

const cristaeFactory: ShapeFactory = (size, q) => {
  // Inner folds: a few flattened arcs inside the mitochondrion (merged visually).
  const g = new THREE.TorusGeometry(size * 0.95, size * 0.06, q > 0.6 ? 8 : 5, q > 0.6 ? 24 : 12, Math.PI * 1.4);
  return g;
};

const erRough: ShapeFactory = (size, q) => {
  // Flattened wavy sheet: plane displaced along z.
  const g = new THREE.PlaneGeometry(size * 2.6, size * 1.5, q > 0.6 ? 24 : 12, q > 0.6 ? 16 : 8);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 6 / size) * size * 0.18 + Math.cos(y * 5 / size) * size * 0.12);
  }
  g.computeVertexNormals();
  return g;
};

const erSmooth: ShapeFactory = (size, q) => {
  // Tangled tubes: torus knot looks convincingly reticular at low cost.
  return new THREE.TorusKnotGeometry(size * 1.2, size * 0.16, q > 0.6 ? 64 : 32, q > 0.6 ? 8 : 5, 2, 3);
};

const golgiFactory: ShapeFactory = (size, q) => {
  // Stack of 4 flattened curved cisternae; return the largest, stack built in CellModel.
  const g = new THREE.CylinderGeometry(size * 1.5, size * 1.5, size * 0.16, q > 0.6 ? 28 : 14, 1, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.y += Math.pow(v.length() / (size * 1.5), 2) * size * 0.22;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};

const bumpySphere: ShapeFactory = (size, q, salt) => {
  const g = new THREE.IcosahedronGeometry(size, q > 0.6 ? 2 : 1);
  const rng = makeRng(salt * 7919 + 13);
  const p1 = range(rng, 3, 6), p2 = range(rng, 3, 6);
  displace(g, (v) => {
    const n = Math.sin(v.x * p1 + v.y * p2) * 0.06 + Math.cos(v.z * p1) * 0.05;
    return size * (1 + n);
  });
  return g;
};

const centrioleFactory: ShapeFactory = (size, q) => {
  // Open cylinder of 9 triplets: a thin-walled tube + 9 bumps via torus rings.
  const g = new THREE.CylinderGeometry(size, size, size * 2.6, q > 0.6 ? 18 : 10, 1, true);
  return g;
};

const chloroplastFactory: ShapeFactory = (size, q) => {
  const g = new THREE.SphereGeometry(size, q > 0.6 ? 24 : 14, q > 0.6 ? 16 : 10);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    pos.setXYZ(i, v.x * 1.15, v.y * 0.62, v.z * 0.9);
  }
  g.computeVertexNormals();
  return g;
};

const granaFactory: ShapeFactory = (size, q) => {
  return new THREE.CylinderGeometry(size * 0.5, size * 0.5, size * 0.12, q > 0.6 ? 12 : 8);
};

const vacuoleFactory: ShapeFactory = (size, q) => bumpySphere(size, q, 4242);

/** id -> geometry factory. Unknown ids fall back to a bumpy sphere — extensibility rule. */
const SHAPES: Record<string, ShapeFactory> = {
  nucleus: (size, q) => {
    const g = new THREE.SphereGeometry(size, q > 0.6 ? 40 : 22, q > 0.6 ? 28 : 16);
    return g;
  },
  nucleolus: (size, q) => new THREE.IcosahedronGeometry(size, q > 0.6 ? 3 : 2),
  'rough-er': erRough,
  'smooth-er': erSmooth,
  golgi: golgiFactory,
  mitochondrion: mitogenome,
  lysosome: (size, q, salt) => bumpySphere(size, q, salt),
  ribosome: (size) => new THREE.IcosahedronGeometry(size, 1),
  centriole: centrioleFactory,
  vacuole: vacuoleFactory,
  'central-vacuole': (size, q) => {
    const g = new THREE.SphereGeometry(size, q > 0.6 ? 40 : 22, q > 0.6 ? 28 : 16);
    return g;
  },
  chloroplast: chloroplastFactory,
  hemoglobin: (size) => new THREE.IcosahedronGeometry(size, 1),
  'cytoplasm': () => new THREE.SphereGeometry(1, 8, 6) // builder overrides with body geometry
};

export function organelleGeometry(id: string, size: number, q: number, salt: number): THREE.BufferGeometry {
  const f = SHAPES[id];
  if (f) return f(size, q, salt);
  return bumpySphere(size, q, salt); // new organelle with no custom shape still renders
}

export { cristaeFactory, granaFactory };

/** Standalone detail-geometry helpers (ShapeFactory signature not needed by callers). */
export function makeCristae(size: number, q: number): THREE.BufferGeometry {
  return new THREE.TorusGeometry(size * 0.95, size * 0.06, q > 0.6 ? 8 : 5, q > 0.6 ? 24 : 12, Math.PI * 1.4);
}
export function makeGrana(size: number, q: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(size * 0.5, size * 0.5, size * 0.12, q > 0.6 ? 12 : 8);
}

// ---------------------------------------------------------------------------
// Placement helpers
// ---------------------------------------------------------------------------

export interface Placed {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

/** Scatter `count` points inside a spherical shell radius range, avoiding the nucleus sphere. */
export function scatter(
  rng: () => number,
  count: number,
  cellRadius: number,
  rMin: number,
  rMax: number,
  excludeCenter = 0.22
): Placed[] {
  const dirs = spreadPoints(rng, count, Math.acos(1 - 2 / (count * 1.4)) * 0.8);
  const out: Placed[] = [];
  for (const d of dirs) {
    const r = Math.max(excludeCenter, range(rng, rMin, rMax)) * cellRadius;
    out.push({
      position: new THREE.Vector3(d[0], d[1], d[2]).multiplyScalar(r),
      rotation: new THREE.Euler(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2)
    });
  }
  return out;
}

/** A few positions tightly clustered around a random direction (ER, Golgi, centrioles). */
export function cluster(rng: () => number, count: number, cellRadius: number, rMin: number, rMax: number): Placed[] {
  const base = unitVector(rng);
  const center = new THREE.Vector3(base[0], base[1], base[2]).multiplyScalar(range(rng, rMin, rMax) * cellRadius);
  const out: Placed[] = [];
  for (let i = 0; i < count; i++) {
    const off = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(cellRadius * 0.28);
    out.push({
      position: center.clone().add(off),
      rotation: new THREE.Euler(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2)
    });
  }
  return out;
}
