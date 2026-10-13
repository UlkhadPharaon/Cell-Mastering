import * as THREE from 'three';
import { CellModel } from '../cell/CellModel';
import { cellById, CELLS } from '../data/catalog';
import { SceneManager } from '../scene/SceneManager';
import { MouseOrbit } from '../scene/SceneManager';

/**
 * Phase 1 harness: renders the cell in an empty stage with simple lighting and
 * number-key switching (1=animal 2=plant 3=RBC). Full lab + UI arrives later;
 * this file is replaced by App.ts wiring, but it lets Phase 1 run standalone.
 */
export class App {
  private sm: SceneManager;
  private orbit: MouseOrbit;
  private cell: CellModel | null = null;
  private explode = 0;

  constructor(host: HTMLElement) {
    this.sm = new SceneManager(host);
    this.orbit = new MouseOrbit(this.sm.camera, this.sm.renderer.domElement);
    this.buildLights();
    this.buildStage();
    this.setCell(0);
    window.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= String(CELLS.length)) this.setCell(Number(e.key) - 1);
      if (e.key === 'e') this.explode = (this.explode + 0.25) % 1.25;
      if (e.key === 'r') { this.cell?.resetParts(); this.explode = 0; }
    });
    this.sm.renderer.setAnimationLoop(() => {
      this.orbit.update();
      this.sm.render();
    });
  }

  private buildLights(): void {
    this.sm.scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x30281e, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.sm.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6aa8ff, 1.0);
    rim.position.set(-5, 3, -4);
    this.sm.scene.add(rim);
  }

  private buildStage(): void {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.sm.scene.add(floor);
  }

  setCell(i: number): void {
    if (this.cell) {
      this.sm.scene.remove(this.cell.root);
      this.cell.dispose();
    }
    const spec = CELLS[i];
    this.cell = new CellModel(cellById(spec.id), 0.8);
    this.cell.root.position.set(0, 1.6, 0);
    this.sm.scene.add(this.cell.root);
    this.orbit.setTarget(this.cell.root.position.clone());
    this.orbit.setDistance(4.2 * (spec.viewDistance ?? 1));
  }

  setExplode(t: number): void {
    this.explode = t;
    this.cell?.setExplode(t);
  }

  dispose(): void {
    this.sm.renderer.setAnimationLoop(null);
    this.cell?.dispose();
  }
}
