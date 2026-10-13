import * as THREE from 'three';
import type { QualityMode } from '../types';

/** Procedural canvas texture so the lab reads well with zero binary assets. */
function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function woodTexture(q: QualityMode): THREE.CanvasTexture {
  return canvasTexture(q === 'high' ? 512 : 128, (ctx, s) => {
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 6) {
      ctx.fillStyle = `rgba(${90 + Math.sin(i * 0.3) * 20},${60 + Math.sin(i * 0.21) * 14},40,0.5)`;
      ctx.fillRect(0, i, s, 3);
    }
  });
}

/**
 * Phase 2: the laboratory. Bench + shelves + microscope + whiteboard + 3 labelled beakers.
 * Static geometry is merged where sensible to keep draw calls low.
 */
export class LabEnvironment {
  readonly group = new THREE.Group();
  beakers: { mesh: THREE.Mesh; liquid: THREE.Mesh; position: THREE.Vector3; id: string }[] = [];
  private whiteboardMesh: THREE.Mesh | null = null;

  constructor(quality: QualityMode) {
    this.build(quality);
  }

  private build(quality: QualityMode): void {
    const q = quality === 'high';
    const g = this.group;
    g.name = 'lab';

    const mat = (color: number, roughness = 0.7, metalness = 0): THREE.Material =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    // --- floor ----------------------------------------------------------------
    const floorTex = canvasTexture(q ? 512 : 128, (ctx, s) => {
      ctx.fillStyle = '#1c2733';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#28384a';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo((i * s) / 4, 0); ctx.lineTo((i * s) / 4, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, (i * s) / 4); ctx.lineTo(s, (i * s) / 4); ctx.stroke();
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = q;
    floor.name = 'floor';
    g.add(floor);

    // --- back wall -------------------------------------------------------------
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 8), mat(0x24303e, 0.9));
    wall.position.set(0, 4, -5.2);
    wall.receiveShadow = q;
    g.add(wall);

    // --- bench -------------------------------------------------------------------
    const wood = woodTexture(quality);
    const benchTop = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.14, 3.0),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 })
    );
    benchTop.position.set(0, 1.0, -0.2);
    benchTop.castShadow = q; benchTop.receiveShadow = q;
    g.add(benchTop);
    for (const [x, z] of [[-3.3, -1.4], [3.3, -1.4], [-3.3, 1.0], [3.3, 1.0]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), mat(0x30373f, 0.5, 0.6));
      leg.position.set(x, 0.5, z);
      leg.castShadow = q;
      g.add(leg);
    }
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.5, 0.08), mat(0x2a3340, 0.8));
    skirt.position.set(0, 0.75, 1.24);
    g.add(skirt);

    // --- shelves on the wall --------------------------------------------------------
    const shelfMat = mat(0x39445a, 0.7);
    for (const y of [2.6, 3.5]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.07, 0.5), shelfMat);
      shelf.position.set(-4.2, y, -4.7);
      shelf.castShadow = q;
      g.add(shelf);
      // jars on shelves
      const jarGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.34, q ? 14 : 8);
      const rngColors = [0x7fd6a3, 0xe3b34f, 0xd67f7f, 0x7fa8d6, 0xb37fd6];
      for (let i = 0; i < 5; i++) {
        const jar = new THREE.Mesh(jarGeo, new THREE.MeshPhysicalMaterial({
          color: rngColors[i], transparent: true, opacity: 0.5, roughness: 0.2
        }));
        jar.position.set(-5.5 + i * 0.65, y + 0.22, -4.7);
        jar.castShadow = q;
        g.add(jar);
      }
    }

    // --- microscope (decor, right of the cell) -----------------------------------------
    const micro = new THREE.Group();
    micro.name = 'microscope';
    const mMat = mat(0x1f2937, 0.35, 0.7);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, q ? 24 : 12), mMat);
    micro.add(base);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), mMat);
    arm.position.set(-0.2, 0.6, -0.15);
    micro.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), mMat);
    head.position.set(0.02, 1.12, -0.1);
    micro.add(head);
    const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.34, q ? 16 : 8), mat(0x111418, 0.3, 0.8));
    eyepiece.position.set(0.25, 1.3, -0.1);
    eyepiece.rotation.z = -0.5;
    micro.add(eyepiece);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, q ? 16 : 8), mat(0x2b3644, 0.4, 0.6));
    tube.position.set(-0.02, 0.85, 0.08);
    micro.add(tube);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), mat(0x0f172a, 0.5, 0.3));
    stage.position.set(-0.02, 0.55, 0.08);
    micro.add(stage);
    micro.position.set(2.55, 1.1, -0.55);
    micro.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = q; } });
    g.add(micro);

    // --- whiteboard with title ----------------------------------------------------------
    const boardTex = canvasTexture(q ? 512 : 256, (ctx, s) => {
      ctx.fillStyle = '#eef2f5';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#9aa7b4';
      ctx.strokeRect(6, 6, s - 12, s - 12);
      ctx.fillStyle = '#243447';
      ctx.font = `bold ${Math.round(s * 0.09)}px sans-serif`;
      ctx.fillText('CELL-MASTERING', s * 0.08, s * 0.2);
      ctx.font = `${Math.round(s * 0.06)}px sans-serif`;
      ctx.fillText('Live cell culture — today:', s * 0.08, s * 0.35);
      ctx.fillStyle = '#c34';
      ctx.font = `${Math.round(s * 0.055)}px sans-serif`;
      ctx.fillText('• hypotonic 0.2% NaCl', s * 0.1, s * 0.5);
      ctx.fillText('• isotonic 0.9% NaCl', s * 0.1, s * 0.62);
      ctx.fillStyle = '#26a';
      ctx.fillText('• hypertonic 3.0% NaCl', s * 0.1, s * 0.74);
    });
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.5),
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35 })
    );
    board.position.set(0.6, 3.1, -5.15);
    this.whiteboardMesh = board;
    g.add(board);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.65, 0.05), mat(0x8a93a0, 0.5, 0.4));
    frame.position.set(0.6, 3.1, -5.2);
    g.add(frame);

    // --- three labelled beakers -------------------------------------------------------------
    const specs = [
      { id: 'hypotonic', label: '0.2% NaCl', sub: 'HYPOTONIC', color: 0x63b3ff, x: -2.7 },
      { id: 'isotonic', label: '0.9% NaCl', sub: 'ISOTONIC', color: 0x9fe3c0, x: -1.7 },
      { id: 'hypertonic', label: '3.0% NaCl', sub: 'HYPERTONIC', color: 0xffd166, x: 1.7 }
    ];
    const beakerGeo = new THREE.CylinderGeometry(0.34, 0.3, 0.62, q ? 28 : 14, 1, true);
    const liquidGeo = new THREE.CylinderGeometry(0.31, 0.28, 0.5, q ? 24 : 12);
    const bottomGeo = new THREE.CircleGeometry(0.3, q ? 24 : 12);
    for (const s of specs) {
      const glass = new THREE.Mesh(beakerGeo, new THREE.MeshPhysicalMaterial({
        color: 0xdfefff, transparent: true, opacity: 0.18, roughness: 0.05,
        metalness: 0, side: THREE.DoubleSide, depthWrite: false
      }));
      glass.position.set(s.x, 1.38, -0.15);
      glass.name = `beaker:${s.id}`;
      g.add(glass);
      const bottom = new THREE.Mesh(bottomGeo, glass.material.clone());
      bottom.rotation.x = -Math.PI / 2;
      bottom.position.set(s.x, 1.08, -0.15);
      g.add(bottom);
      const liquid = new THREE.Mesh(liquidGeo, new THREE.MeshPhysicalMaterial({
        color: s.color, transparent: true, opacity: 0.38, roughness: 0.1
      }));
      liquid.position.set(s.x, 1.32, -0.15);
      g.add(liquid);
      // label
      const labelTex = canvasTexture(256, (ctx, size) => {
        ctx.fillStyle = '#f7f9fa';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#1a2530';
        ctx.font = `bold ${Math.round(size * 0.13)}px monospace`;
        ctx.fillText(s.label, size * 0.06, size * 0.4);
        ctx.fillStyle = '#b23';
        ctx.font = `bold ${Math.round(size * 0.11)}px monospace`;
        ctx.fillText(s.sub, size * 0.06, size * 0.68);
      });
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.2),
        new THREE.MeshBasicMaterial({ map: labelTex })
      );
      label.position.set(s.x, 1.42, 0.17);
      g.add(label);
      this.beakers.push({ mesh: glass, liquid, position: glass.position.clone(), id: s.id });
    }
  }

  /** Change liquid color when a cell is dropped in (feedback). */
  pulseBeaker(id: string, colorHex: number): void {
    const b = this.beakers.find((x) => x.id === id);
    if (!b) return;
    const m = b.liquid.material as THREE.MeshPhysicalMaterial;
    m.color.setHex(colorHex);
    m.opacity = 0.55;
    setTimeout(() => { m.opacity = 0.38; }, 350);
  }

  /** Whiteboard gets the selected organelle's name as a "chalk" note. */
  setBoardNote(text: string): void {
    if (!this.whiteboardMesh) return;
    const mat = this.whiteboardMesh.material as THREE.MeshStandardMaterial;
    if (!mat.map) return;
    // cheap: regenerate only when text changes; caller debounces
    const old = mat.map;
    const t = canvasTexture(512, (ctx, s) => {
      ctx.fillStyle = '#eef2f5';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#9aa7b4';
      ctx.strokeRect(6, 6, s - 12, s - 12);
      ctx.fillStyle = '#243447';
      ctx.font = `bold ${Math.round(s * 0.08)}px sans-serif`;
      ctx.fillText('NOW STUDYING:', s * 0.07, s * 0.18);
      ctx.fillStyle = '#c34';
      ctx.font = `bold ${Math.round(s * 0.09)}px sans-serif`;
      ctx.fillText(text.slice(0, 22), s * 0.07, s * 0.34);
    });
    mat.map = t;
    mat.needsUpdate = true;
    old?.dispose();
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
      else if (mm) mm.dispose();
    });
  }
}
