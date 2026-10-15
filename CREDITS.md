# Credits & Licenses

Every third-party asset and dependency, with its license. Rule for this repo: **anything that
ships a binary or model needs a row here before it merges.**

## Bundled third-party assets

| Asset | Author | Source | License | Where |
|---|---|---|---|---|
| MediaPipe vision wasm runtime (`vision_wasm_*.{js,wasm}`) | Google LLC | npm package `@mediapipe/tasks-vision@1.1.0` (copied to `public/mediapipe-wasm/` by `scripts/fetch-assets.mjs`) | Apache-2.0 | local, unmodified |
| `hand_landmarker.task` model (7.8 MB) | Google LLC | https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task | Apache-2.0 (model card: https://aka.ms/hand_landmarker_model) | `public/models/` (committed) |

## Code dependencies (npm)

| Package | Version | License |
|---|---|---|
| three | 0.186.1 | MIT |
| @mediapipe/tasks-vision | 1.1.0 | Apache-2.0 |
| vite | 8.3.4 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| vitest | 5.0.4 | MIT |
| @playwright/test | 1.64.0 | Apache-2.0 |
| @types/three | 0.186.0 | MIT |

## Procedural / original content

- **All 3D geometry** (cells, organelles, lab, microscope, beakers, textures) is generated at
  runtime by code in this repository. No third-party 3D model files are shipped or loaded.
- **Why not NIH 3D / marketplace models:** evaluated in `docs/RESEARCH.md` §3 — per-item licenses
  were unclear or non-commercial, and print-oriented models are fused shells without separable
  named parts, which the app's core interactions (isolate, explode, pull-out) require.
- **Metadata texts** (organelle functions, facts, analogies, EN + FR) are original summaries
  written for this project, reviewed against LibreTexts Biology (CC-BY) osmosis content for the
  Phase-5 wording.
- **Screenshots** in `docs/screenshots/` are renders of this software.

## Notes

- The MediaPipe model file is redistributed unmodified, satisfying Apache-2.0 attribution;
  the NOTICE/LICENSE text lives in `node_modules/@mediapipe/tasks-vision/`.
- No fonts are bundled; the whiteboard/labels render with system sans/monospace.
- This project's own code is MIT-licensed (see `LICENSE`), © 2026 Ulkhad Pharaon / Cell-Mastering
  contributors.
