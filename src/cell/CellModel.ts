import * as THREE from 'three';
import { bodyGeometry, organelleGeometry, scatter, cluster, makeCristae, makeGrana } from './shapes';
import { makeRng } from '../util/math';
import type { CellSpec, CellPartSpec, OrganelleMeta } from '../types';
import { organelleById } from '../data/catalog';

export interface CellPart {
  id: string; // organelle id
  meta: OrganelleMeta;
  /** Group holding every instance of this part. */
  group: THREE.Group;
  /** All meshes for raycasting / styling. */
  meshes: THREE.Mesh[];
  /** Base (unexploded) local positions for each mesh. */
  basePositions: THREE.Vector3[];
  hidden: boolean;
  opacity: number;
}

/**
 * Builds a whole cell from a CellSpec: one named Group per organelle id.
 *
 * Scene graph:
 *   root
 *   ├── wall part group        (rigid — never scaled by osmosis)
 *   └── protoplast             (all living content; shrinks during plasmolysis)
 *        ├── membrane / cytoplasm / central vacuole (Deformer scales these by V)
 *        └── organelle part groups (positions scale, sizes do not)
 *
 * Parts are individually transformable (explode, isolate) and deformable.
 * Adding an organelle = organelles.json entry + cells.json spec (+ optional shape
 * in shapes.ts — unknown ids get a bumpy sphere, so it still renders).
 */
export class CellModel {
  readonly root = new THREE.Group();
  readonly protoplast = new THREE.Group();
  readonly spec: CellSpec;
  readonly quality: number;
  readonly parts = new Map<string, CellPart>();

  /** Meshes whose SCALE follows cell volume (membrane, cytoplasm, vacuole). */
  readonly volumeMeshes: THREE.Mesh[] = [];
  /** Parts whose POSITIONS follow cell volume but not size. */
  private positionScaled: CellPart[] = [];

  private raycastTargets: THREE.Object3D[] = [];

  constructor(spec: CellSpec, quality = 0.8, seed = 1337) {
    this.spec = spec;
    this.quality = quality;
    const rng = makeRng(seed);
    const q = quality;
    const R = spec.radius;

    this.root.name = `cell-${spec.id}`;
    this.protoplast.name = 'protoplast';
    this.root.add(this.protoplast);

    for (const p of spec.parts) {
      this.buildPart(p, rng, q, R);
    }
    this.rebuildRaycastTargets();
  }

  // --------------------------------------------------------------------------

  private buildPart(p: CellPartSpec, rng: () => number, q: number, R: number): void {
    const meta = organelleById(p.organelleId);
    const group = new THREE.Group();
    group.name = `part:${meta.id}`;
    group.userData.organelleId = meta.id;

    const translucent = meta.translucent ?? false;
    const baseOpacity = meta.id === 'cell-wall' ? 0.5 : 0.22;
    const makeMat = (): THREE.MeshPhysicalMaterial =>
      new THREE.MeshPhysicalMaterial({
        color: meta.color,
        transparent: translucent,
        opacity: translucent ? baseOpacity : 1,
        roughness: meta.id === 'ribosome' || meta.id === 'hemoglobin' ? 0.75 : 0.35,
        metalness: 0,
        clearcoat: translucent ? 0.5 : 0.1,
        clearcoatRoughness: 0.4,
        side: translucent ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: !translucent
      });

    const meshes: THREE.Mesh[] = [];
    const basePositions: THREE.Vector3[] = [];
    const isWall = meta.id === 'cell-wall';
    const isBody = ['membrane', 'cytoplasm', 'central-vacuole'].includes(meta.id);

    if (p.placement === 'shell' || isWall || (isBody && p.placement === 'nucleus-center')) {
      // One big body shape for this part.
      const kind = this.spec.kind;
      const shellR = isWall ? R * 1.06 : meta.id === 'cytoplasm' ? R * 0.985
        : meta.id === 'central-vacuole' ? R * 0.55 : R;
      const g = isWall || meta.id !== 'central-vacuole'
        ? bodyGeometry(kind, shellR, q)
        : new THREE.SphereGeometry(shellR, q > 0.6 ? 40 : 22, q > 0.6 ? 28 : 16);
      const m = new THREE.Mesh(g, makeMat());
      m.name = `mesh:${meta.id}`;
      m.userData.organelleId = meta.id;
      group.add(m);
      meshes.push(m);
      basePositions.push(new THREE.Vector3());
      if (isBody && !isWall) this.volumeMeshes.push(m);
      this.attach(meta.id, group, meshes, basePositions, isWall);
      return;
    }

    if ((meta.id === 'nucleus' || meta.id === 'nucleolus') && p.placement === 'nucleus-center') {
      const size = meta.id === 'nucleolus' ? 0.11 * R : 0.3 * R;
      const m = new THREE.Mesh(organelleGeometry(meta.id, size, q, 1), makeMat());
      m.name = `mesh:${meta.id}`;
      m.userData.organelleId = meta.id;
      const off = meta.id === 'nucleolus'
        ? new THREE.Vector3(0.06 * R, -0.05 * R, 0.08 * R)
        : new THREE.Vector3();
      m.position.copy(off);
      group.add(m);
      meshes.push(m);
      basePositions.push(off.clone());
      this.attach(meta.id, group, meshes, basePositions, false);
      return;
    }

    // scatter / cluster placements ------------------------------------------------
    const [rMin, rMax] = p.radiusRange ?? [0.35, 0.75];
    const spots =
      p.placement === 'cluster'
        ? cluster(rng, p.count, R, rMin, rMax)
        : scatter(rng, p.count, R, rMin, rMax, this.spec.kind === 'rbc' ? 0 : 0.24);

    for (let i = 0; i < spots.length; i++) {
      const jitter = 1 + (rng() - 0.5) * 2 * (p.sizeJitter ?? 0);
      const size = Math.max(0.015, (p.baseSize ?? 0.08) * R) * jitter;
      const g = organelleGeometry(meta.id, size, q, i + p.count * 7);
      const m = new THREE.Mesh(g, makeMat());
      m.name = `mesh:${meta.id}:${i}`;
      m.userData.organelleId = meta.id;
      const pos = spots[i].position.clone();
      if (this.spec.kind === 'rbc') pos.z *= 0.3; // keep contents inside the disc
      m.position.copy(pos);
      m.rotation.copy(spots[i].rotation);

      if (meta.id === 'mitochondrion' && q > 0.5) {
        const cm = new THREE.Mesh(
          makeCristae(size * 0.8, q),
          new THREE.MeshStandardMaterial({ color: 0xff6a6a, roughness: 0.5 })
        );
        cm.rotation.z = Math.PI / 2;
        m.add(cm);
      }
      if (meta.id === 'chloroplast' && q > 0.4) {
        const gm = makeGrana(size, q);
        const gmat = new THREE.MeshStandardMaterial({ color: 0x0a5a0a, roughness: 0.6 });
        for (let k = 0; k < 3; k++) {
          const disc = new THREE.Mesh(gm, gmat);
          disc.position.set((k - 1) * size * 0.55, 0, 0);
          disc.rotation.z = Math.PI / 2;
          m.add(disc);
        }
      }
      if (meta.id === 'centriole') {
        m.add(new THREE.Mesh(
          new THREE.CylinderGeometry(size * 1.02, size * 1.02, size * 2.4, q > 0.6 ? 14 : 8),
          new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.6, transparent: true, opacity: 0.9 })
        ));
        if (i === 1) m.rotation.x = Math.PI / 2;
      }
      if (meta.id === 'golgi') {
        // stack 4 cisternae instead of a single disc
        const stack = new THREE.Group();
        stack.position.copy(pos);
        stack.rotation.copy(spots[i].rotation);
        for (let k = 0; k < 4; k++) {
          const disc = new THREE.Mesh(organelleGeometry('golgi', size * (1 - k * 0.08), q, 5), makeMat());
          disc.position.y = (k - 1.5) * size * 0.34;
          disc.userData.organelleId = meta.id;
          disc.name = `mesh:golgi:${i}.${k}`;
          stack.add(disc);
          meshes.push(disc);
          basePositions.push(pos.clone());
        }
        group.add(stack);
        continue;
      }
      group.add(m);
      meshes.push(m);
      basePositions.push(pos.clone());
    }
    this.attach(meta.id, group, meshes, basePositions, false);
  }

  private attach(
    id: string, group: THREE.Group, meshes: THREE.Mesh[],
    basePositions: THREE.Vector3[], toRoot: boolean
  ): void {
    const existing = this.parts.get(id);
    if (existing) {
      // merge instances of the same organelle (e.g. nucleus listed twice)
      existing.group.add(group);
      existing.meshes.push(...meshes);
      existing.basePositions.push(...basePositions);
      return;
    }
    (toRoot ? this.root : this.protoplast).add(group);
    const part: CellPart = {
      id, meta: organelleById(id), group, meshes, basePositions,
      hidden: false, opacity: 1
    };
    this.parts.set(id, part);
    const bodyLike = ['membrane', 'cytoplasm', 'central-vacuole', 'nucleus', 'nucleolus'].includes(id);
    if (!bodyLike) this.positionScaled.push(part);
  }

  private rebuildRaycastTargets(): void {
    this.raycastTargets = [];
    for (const part of this.parts.values()) {
      if (part.hidden) continue;
      // translucent interior jelly should not block picks; keep it as last-resort target
      if (part.id === 'cytoplasm') continue;
      this.raycastTargets.push(...part.meshes);
    }
  }

  // --------------------------------------------------------------------------
  // Public API

  raycastTargetsList(): THREE.Object3D[] {
    return this.raycastTargets;
  }

  pickOrganelleFrom(intersect: THREE.Intersection | null): string | null {
    if (!intersect) return null;
    let o: THREE.Object3D | null = intersect.object;
    while (o) {
      const id = (o.userData as { organelleId?: string }).organelleId;
      if (id) return id;
      o = o.parent;
    }
    return null;
  }

  getPart(id: string): CellPart | undefined {
    return this.parts.get(id);
  }

  /** Explode view: slide each part outward from the center. */
  setExplode(t: number): void {
    for (const part of this.positionScaled) {
      const dir = part.meta.explodeDir ?? { x: 0, y: 0, z: 0 };
      for (let i = 0; i < part.meshes.length; i++) {
        const base = part.basePositions[i];
        if (!base) continue;
        const outward = base.clone();
        if (outward.lengthSq() < 1e-9) outward.set(dir.x, dir.y, dir.z).normalize();
        else outward.normalize();
        const mag = (0.45 + t) * t * this.spec.radius * 0.9;
        part.meshes[i].position.copy(
          base.clone().add(outward.multiplyScalar(mag))
            .add(new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(t * this.spec.radius * 0.55))
        );
      }
    }
  }

  setVisible(organelleId: string, visible: boolean): void {
    const p = this.parts.get(organelleId);
    if (!p) return;
    p.hidden = !visible;
    p.group.visible = visible;
    this.rebuildRaycastTargets();
  }

  setOpacity(organelleId: string, o: number): void {
    const p = this.parts.get(organelleId);
    if (!p) return;
    p.opacity = o;
    const base = p.meta.translucent ? (organelleId === 'cell-wall' ? 0.5 : 0.22) : 1;
    for (const m of p.meshes) {
      const mat = m.material as THREE.MeshPhysicalMaterial;
      mat.opacity = Math.min(1, base * o + (o - 1) * 0.1);
      mat.transparent = mat.opacity < 0.999 || !!p.meta.translucent;
    }
  }

  setColor(organelleId: string, hex: number): void {
    const p = this.parts.get(organelleId);
    if (!p) return;
    for (const m of p.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) (mm as THREE.MeshPhysicalMaterial).color.setHex(hex);
    }
  }

  setHighlight(organelleId: string | null): void {
    for (const [id, part] of this.parts) {
      const on = id === organelleId;
      for (const m of part.meshes) {
        const mat = m.material as THREE.MeshPhysicalMaterial;
        if (!mat.isMeshStandardMaterial) continue;
        mat.emissive.setHex(on ? 0x2a6bff : 0x000000);
        mat.emissiveIntensity = on ? 0.55 : 0;
      }
    }
  }

  /** Isolate = show only this part (plus a ghost membrane for context). */
  isolate(organelleId: string | null): void {
    for (const [id, part] of this.parts) {
      if (id === 'cytoplasm') continue; // ghost context
      const show = organelleId === null || id === organelleId || id === 'membrane';
      part.group.visible = show && !part.hidden;
    }
  }

  resetParts(): void {
    for (const part of this.parts.values()) {
      part.hidden = false;
      part.opacity = 1;
      part.group.visible = true;
      for (const m of part.meshes) {
        const mat = m.material as THREE.MeshPhysicalMaterial;
        mat.opacity = part.meta.translucent ? (part.id === 'cell-wall' ? 0.5 : 0.22) : 1;
        mat.transparent = !!part.meta.translucent;
        mat.color.setHex(part.meta.color);
        m.scale.set(1, 1, 1);
      }
    }
    // restore explode positions
    for (const part of this.positionScaled) {
      for (let i = 0; i < part.meshes.length; i++) {
        const base = part.basePositions[i];
        if (base) part.meshes[i].position.copy(base);
      }
    }
    this.setExplode(0);
    this.protoplast.scale.set(1, 1, 1);
    for (const m of this.volumeMeshes) m.scale.set(1, 1, 1);
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.parts.clear();
  }
}
