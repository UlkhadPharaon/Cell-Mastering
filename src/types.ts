// Shared types for Cell-Mastering. DOM-free where possible so pure modules stay testable.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Localized text: EN required, FR optional (falls back to EN). */
export type Loc = { en: string; fr?: string };

export interface OrganelleMeta {
  id: string;
  name: Loc;
  function: Loc;
  facts: Loc[];
  /** Approximate size, human readable, e.g. "1–2 µm". */
  size: Loc;
  /** Everyday analogy, the memory hook. */
  analogy: Loc;
  /** Hex color used when the part has no baked material. */
  color: number;
  /** Direction the part travels in the explode view (unit-ish vector, model space). */
  explodeDir?: Vec3;
  /** Default render order hints. */
  translucent?: boolean;
  /** Group id: parts sharing a group are toggled together (e.g. all mitochondria). */
  group?: string;
}

export interface CellPartSpec {
  /** Reference into organelles.json. */
  organelleId: string;
  /** How many instances of this part to build. */
  count: number;
  /** Placement strategy consumed by the cell builder. */
  placement: 'nucleus-center' | 'scatter' | 'shell' | 'chain' | 'stack' | 'surface' | 'cluster' | 'ring';
  /** Radius range from cell center for scatter/placement, in cell-radius units. */
  radiusRange?: [number, number];
  /** Per-instance size jitter factor. */
  sizeJitter?: number;
  baseSize?: number;
}

export interface CellSpec {
  id: string;
  name: Loc;
  kind: 'animal' | 'plant' | 'rbc';
  /** Nominal cell radius in scene units. */
  radius: number;
  parts: CellPartSpec[];
  /** Osmosis physiology (see docs/ARCHITECTURE.md §6). */
  osmosis: {
    /** Internal NaCl-equivalent concentration, mol/L. */
    internalC: number;
    /** Has a rigid wall (plant). */
    hasWall: boolean;
    /** Wall rest volume in multiples of V0. */
    wallVolumeFactor: number;
    /** Wall elastic stiffness (arbitrary sim units). */
    wallK: number;
    /** Volume multiple of V0 at which an animal/RBC membrane lyses. */
    lyseVolumeFactor: number;
    /** Volume multiple below which crenation morph kicks in. */
    crenationFactor: number;
    /** Hydraulic conductivity Lp (sim units). */
    Lp: number;
  };
  /** Default camera framing distance multiplier. */
  viewDistance?: number;
}

export type HandName = 'Left' | 'Right' | 'Unknown';

export interface RawHand {
  handedness: HandName;
  /** 21 normalized landmarks (image space 0..1). Flat [x0,y0,z0,...] or array of Vec3. */
  landmarks: Vec3[];
  /** 21 world landmarks in meters, origin at hand center. */
  worldLandmarks: Vec3[];
  /** Detection score 0..1. */
  score: number;
  /** Timestamp ms of the frame this came from. */
  tMs: number;
}

export type GestureFlag = 'pinch' | 'point' | 'palm';

export interface HandState {
  name: HandName;
  present: boolean;
  /** Smoothed normalized landmarks. */
  landmarks: Vec3[];
  smoothedWorld: Vec3[];
  /** Pinch state after hysteresis. */
  pinching: boolean;
  pointing: boolean;
  palmOpen: boolean;
  /** Normalized thumb-index distance / hand scale (the raw pinch signal). */
  pinchNorm: number;
  /** 0..1 how closed the pinch is (1 = fully pinched) for smooth visuals. */
  pinchStrength: number;
  /** Hand center in normalized image space, smoothed. */
  center: Vec3;
  /** Hand apparent scale (wrist → middle MCP, normalized units). */
  scale: number;
  /** Estimated camera-space depth, meters-ish, from apparent size + world landmarks. */
  depth: number;
  /** Roll angle of the hand in the image plane, radians. */
  roll: number;
  /** Index fingertip ray origin/direction in normalized space for laser. */
  indexTip: Vec3;
}

export interface TwoHandState {
  active: boolean;
  /** Distance between hands in meters (world landmarks). */
  distance: number;
  /** Relative twist between the two hands, radians. */
  twist: number;
  /** Midpoint in normalized image space. */
  midpoint: Vec3;
}

export interface GestureOutput {
  hands: [HandState, HandState];
  two: TwoHandState;
  /** True if at least one hand is tracked this frame. */
  anyHand: boolean;
  /** Frame timestamp ms. */
  tMs: number;
}

/** Intents the InteractionManager publishes for the scene to consume. */
export type Intent =
  | { type: 'grab-start'; hand: 0 | 1; target: string; point: Vec3 }
  | { type: 'grab-move'; hand: 0 | 1; position: Vec3; rotation: { yaw: number; pitch: number } }
  | { type: 'grab-end'; hand: 0 | 1 }
  | { type: 'scale'; factor: number; pivot: Vec3 }
  | { type: 'twist'; angle: number }
  | { type: 'hover'; organelleId: string | null; point: Vec3 }
  | { type: 'select'; organelleId: string; point: Vec3 }
  | { type: 'release-part'; organelleId: string };

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'live'
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'insecure-context'
  | 'unsupported';

export type TrackingStatus = 'disabled' | 'initializing' | 'gpu' | 'cpu' | 'error';

export type QualityMode = 'low' | 'high';
export type Language = 'en' | 'fr';

export type OsmosisStatus =
  | 'idle'
  | 'stable'
  | 'swelling'
  | 'shrinking'
  | 'turgid'
  | 'plasmolysed'
  | 'crenated'
  | 'lysed';

export interface OsmosisSample {
  /** Seconds since sim start. */
  t: number;
  /** V/V0. */
  volumeRatio: number;
  /** External concentration mol/L. */
  cOut: number;
  status: OsmosisStatus;
}

export interface BeakerSpec {
  id: string;
  label: Loc;
  /** NaCl percentage for the UI. */
  percent: number;
  /** Solute concentration, mol/L. */
  concentration: number;
  tonicity: Loc;
  colorHex: number;
  position: [number, number, number];
}
