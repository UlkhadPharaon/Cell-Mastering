import * as THREE from 'three';
import type { QualityMode } from '../types';

export interface LightingRig {
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  spots: THREE.SpotLight[];
  envTexture: THREE.Texture | null;
  apply(mode: QualityMode): void;
  dispose(): void;
}

/**
 * PBR lighting rig tuned for 60 fps on a laptop GPU:
 * - high: key light with soft shadows (1024), 2 accents, procedural studio env for reflections.
 * - low: same lights without shadow maps, fewer emitters.
 * A CC0 HDRI file could replace `studioEnvTexture()` — we generate one procedurally instead
 * (zero bytes on disk, no license to track), via PMREMGenerator over a small scene.
 */
export function createLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): LightingRig {
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x3a2d20, 0.5);
  const key = new THREE.DirectionalLight(0xfff3e0, 2.3);
  key.position.set(3.5, 6, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0004;
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.6);
  fill.position.set(-4, 3, 2);
  const rim = new THREE.DirectionalLight(0x6aa8ff, 1.1);
  rim.position.set(-2, 4, -5);

  // two cool accent spots over the beakers + cell stage
  const spotA = new THREE.SpotLight(0xbfe0ff, 14, 9, Math.PI / 7, 0.4, 1.6);
  spotA.position.set(0, 4.4, -0.2);
  spotA.target.position.set(0, 1.4, -0.2);
  const spotB = new THREE.SpotLight(0xffe9c8, 10, 8, Math.PI / 6, 0.5, 1.6);
  spotB.position.set(2.4, 4.2, 0.6);
  spotB.target.position.set(0, 1.3, -0.3);

  scene.add(hemi, key, fill, rim, spotA, spotA.target, spotB, spotB.target);

  // Procedural environment for PBR reflections (studio-ish gradient box).
  let envTexture: THREE.Texture | null = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0x30405a, side: THREE.BackSide, roughness: 1 })
    );
    envScene.add(room);
    const light1 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    light1.position.set(0, 2.9, -3);
    envScene.add(light1);
    const light2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), new THREE.MeshBasicMaterial({ color: 0x88bbff }));
    light2.position.set(-3, 2.6, 2);
    light2.rotation.y = Math.PI / 2;
    envScene.add(light2);
    envTexture = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();
    room.geometry.dispose();
    light1.geometry.dispose(); light2.geometry.dispose();
  } catch {
    // PMREM unsupported (rare): lights alone still render the scene fine.
  }

  const rig: LightingRig = {
    key, fill, rim, hemi, spots: [spotA, spotB], envTexture,
    apply(mode: QualityMode): void {
      const high = mode === 'high';
      key.castShadow = high;
      fill.visible = true;
      spotA.visible = high;
      spotB.visible = high;
      scene.environment = high ? envTexture : null;
      hemi.intensity = high ? 0.5 : 0.9; // low quality compensates with more ambient
      key.intensity = high ? 2.3 : 2.0;
    },
    dispose(): void {
      envTexture?.dispose();
    }
  };
  return rig;
}
