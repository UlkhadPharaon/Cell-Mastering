import * as THREE from 'three';
import { CellModel } from '../cell/CellModel';
import { cellById, CELLS } from '../data/catalog';
import { SceneManager, MouseOrbit } from '../scene/SceneManager';
import { LabEnvironment } from '../scene/LabEnvironment';
import { createLighting, type LightingRig } from '../scene/Lighting';
import type { QualityMode } from '../types';

/**
 * App orchestrator. Phase 2 target: full lab scene + quality toggle.
 * Phase 3 adds hand tracking; Phase 5 adds experiments (OsmosisSim plugs into setBeaker).
 */
export class App {
  readonly sm: SceneManager;
  readonly orbit: MouseOrbit;
  private rig: LightingRig;
  private lab: LabEnvironment | null = null;
  private cell: CellModel | null = null;
  private quality: QualityMode = 'high';
  private explode = 0;
  private beakerActive: string | null = null;
  /** Called when the cell is dropped into / removed from a beaker (Phase 5 hook). */
  onBeakerChange: (beakerId: string | null) => void = () => {};

  constructor(host: HTMLElement) {
    this.sm = new SceneManager(host);
    this.orbit = new MouseOrbit(this.sm.camera, this.sm.renderer.domElement);
    this.rig = createLighting(this.sm.scene, this.sm.renderer);
    this.setQuality(this.quality);
    this.buildLab();
    this.setCell(0);

    this.orbit.setTarget(new THREE.Vector3(0, 1.7, 0));
    this.orbit.setDistance(6.2);

    window.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= String(CELLS.length)) this.setCell(Number(e.key) - 1);
      if (e.key === 'e') { this.explode = (this.explode + 0.25) % 1.5; this.cell?.setExplode(this.explode); }
      if (e.key === 'r') { this.cell?.resetParts(); this.explode = 0; }
      if (e.key === 'q') this.setQuality(this.quality === 'high' ? 'low' : 'high');
      if (e.key === 'c') this.cell?.root.position.set(0, 1.7, 0); // re-center
    });

    this.sm.renderer.setAnimationLoop(() => {
      this.orbit.update();
      this.checkBeakerDrop();
      this.sm.render();
    });
  }

  // --------------------------------------------------------------------------

  setQuality(mode: QualityMode): void {
    this.quality = mode;
    this.sm.applyQuality(mode);
    this.rig.apply(mode);
    // lab geometry density depends on quality: rebuild
    if (this.lab) {
      this.sm.scene.remove(this.lab.group);
      this.lab.dispose();
    }
    this.lab = new LabEnvironment(mode);
    this.sm.scene.add(this.lab.group);
  }

  private buildLab(): void {
    this.lab = new LabEnvironment(this.quality);
    this.sm.scene.add(this.lab.group);
  }

  setCell(i: number): void {
    if (this.cell) {
      this.sm.scene.remove(this.cell.root);
      this.cell.dispose();
    }
    const spec = CELLS[i];
    this.cell = new CellModel(cellById(spec.id), this.quality === 'high' ? 0.85 : 0.4);
    this.cell.root.position.set(0, 1.7, 0.2);
    this.sm.scene.add(this.cell.root);
    this.explode = 0;
  }

  get cellModel(): CellModel | null {
    return this.cell;
  }

  // --------------------------------------------------------------------------
  // Beaker drop detection (position proximity on the bench plane)

  private checkBeakerDrop(): void {
    if (!this.cell || !this.lab) return;
    const p = this.cell.root.position;
    let inside: string | null = null;
    for (const b of this.lab.beakers) {
      const dx = p.x - b.position.x;
      const dy = p.y - b.position.y;
      const dz = p.z - b.position.z;
      if (Math.hypot(dx, dz) < 0.5 && Math.abs(dy) < 0.8) { inside = b.id; break; }
    }
    if (inside !== this.beakerActive) {
      this.beakerActive = inside;
      if (inside) this.lab.pulseBeaker(inside, 0x8fd3ff);
      this.onBeakerChange(inside);
    }
  }

  /** Move the cell into a beaker programmatically (UI drag alternative). */
  dropInBeaker(id: string | null): void {
    if (!this.cell || !this.lab) return;
    if (id === null) { this.cell.root.position.set(0, 1.7, 0.2); return; }
    const b = this.lab.beakers.find((x) => x.id === id);
    if (!b) return;
    this.cell.root.position.set(b.position.x, b.position.y, b.position.z);
  }

  dispose(): void {
    this.sm.renderer.setAnimationLoop(null);
    this.cell?.dispose();
    this.lab?.dispose();
    this.rig.dispose();
  }
}
