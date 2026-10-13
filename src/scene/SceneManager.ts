import * as THREE from 'three';
import type { QualityMode } from '../types';

/**
 * Owns renderer/scene/camera. WebXR seam: enableXR() exists as a documented stub;
 * renderer.xr stays off until a headset build is wired (roadmap).
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private host: HTMLElement;
  private onResizeFns: Array<() => void> = [];

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.05, 120);
    this.camera.position.set(0, 1.9, 5.6);
    this.scene.background = new THREE.Color(0x0d1420);
    this.scene.fog = new THREE.Fog(0x0d1420, 14, 30);

    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    for (const f of this.onResizeFns) f();
  }

  onResize(fn: () => void): void {
    this.onResizeFns.push(fn);
  }

  applyQuality(mode: QualityMode, dprCap = 2): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mode === 'high' ? dprCap : 1));
    this.renderer.shadowMap.enabled = mode === 'high';
    this.renderer.domElement.style.imageRendering = '';
  }

  /** ROADMAP: headset support. Flipping renderer.xr needs a CameraRig replacement, not this stub. */
  enableXR(_enabled: boolean): void {
    // intentionally not implemented in v1 (docs/ARCHITECTURE.md §7)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

/** Simple orbit controller used as the mouse fallback (and camera framing helper). */
export class MouseOrbit {
  private theta = 0;
  private phi = 1.35;
  private dist = 5.6;
  private target = new THREE.Vector3(0, 1.4, 0);
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  enabled = true;

  private cam: THREE.PerspectiveCamera;

  constructor(cam: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.cam = cam;
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    dom.addEventListener('pointermove', (e) => {
      if (!this.dragging || !this.enabled) return;
      this.theta -= (e.clientX - this.lastX) * 0.005;
      this.phi = Math.min(1.6, Math.max(0.25, this.phi - (e.clientY - this.lastY) * 0.004));
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.dist = Math.min(14, Math.max(2.2, this.dist * (1 + e.deltaY * 0.001)));
    }, { passive: false });
    this.update();
  }

  setTarget(v: THREE.Vector3): void { this.target.copy(v); }
  setDistance(d: number): void { this.dist = d; }

  update(): void {
    if (!this.enabled) return;
    const s = Math.sin(this.phi);
    this.cam.position.set(
      this.target.x + this.dist * s * Math.sin(this.theta),
      this.target.y + this.dist * Math.cos(this.phi),
      this.target.z + this.dist * s * Math.cos(this.theta)
    );
    this.cam.lookAt(this.target);
  }
}
