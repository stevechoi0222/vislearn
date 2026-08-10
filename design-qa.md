---
title: DiskANN and AiSAQ animated factory design QA
date: 2026-08-10
final result: passed
---

# DiskANN and AiSAQ animated factory design QA

## Comparison input

- Behavior and composition reference: `tmp/qa/rocket-reference/source-desktop-top.png` (1536 × 1024)
- Release-candidate desktop capture: `tmp/qa/factory-redesign/final-desktop-k.png` (1521 × 1014 browser pixels from a 1536 × 1024 viewport)
- Padded desktop comparison input: `tmp/qa/factory-redesign/final-desktop-k-padded.png` (1536 × 1024)
- Combined reference and implementation: `tmp/qa/factory-redesign/source-vs-final-desktop-k.png` (3072 × 1024)
- Mobile expanded, checkpoint, and collapsed captures: `tmp/qa/factory-redesign/final-mobile-expanded-j.png`, `final-mobile-checkpoint-j.png`, and `final-mobile-collapsed-j.png` (375 × 812 browser pixels from a 390 × 844 viewport)
- Intermediate-width capture: `tmp/qa/factory-redesign/final-tablet-corrected.png` (885 × 787 browser pixels from a 900 × 800 viewport)

The combined image was reviewed as one comparison input. The implementation matches the reference's full-screen isometric factory, top HUD, right inspector, bottom transport, camera controls, active-station focus, and synchronized single-state behavior. Its geometry and artwork are independently drawn for the DiskANN/AiSAQ subject; no source code, image, text, or asset from the reference repository is included because that repository exposes no license file.

## Core experience

- The primary visual is a procedural Canvas factory, not a bitmap backdrop or image overlay.
- Seven camera stations cover index layout, query entry, SSD node reads, PQ scoring, loop and re-ranking, 4 KB block derivation, and evidence or limits.
- All 27 actions have a distinct machine state. The release sweep found 27 unique stage/action/label combinations.
- Common action, DiskANN, AiSAQ, and Why it differs remain non-empty and visible at every action.
- The HUD separates `index inspection`, `query run`, `derivation`, and `evidence`; query carriers stop before the derivation and evidence stations.
- Camera follow, zoom, fit, pointer drag, modifier-wheel zoom, station selection, view mode, dataset, speed, labels, pause, next, restart, and checkpoint continuation are operational. Ordinary wheel gestures remain available for scrolling to the learning sections below the factory.

## Motion and state integrity

- One simulation state drives the camera target, active station, machine phase, progress bars, HUD, guide, action list, route, and controls.
- Pause freezes semantic and ambient factory motion. Two Canvas captures taken 1.6 seconds apart while paused were byte-identical (`e42f353b…` for both), while progress remained unchanged.
- Checkpoint and Continue keep the document at `scrollY = 0`; only the inspector's internal scroll position changes.
- Manual camera movement disables Follow, and Fit remains selected through subsequent actions until Follow is explicitly restored.
- Reduced-motion users start paused, camera transitions snap, ambient animation is frozen, and action stepping remains available.

## Responsive and accessibility checks

- At 1536 × 1024, 900 × 800, and 390 × 844 there is no horizontal overflow.
- The 900px guide retains all four comparison rows; the earlier hidden progress-row grid collapse is corrected.
- Mobile keeps a full-height Canvas with a scrollable bottom sheet. The sheet can collapse to reveal the complete factory.
- Stage checkpoints remain visible and actionable on mobile; the tested Reveal button stayed inside the expanded sheet.
- Collapsed guide content is inert and visually hidden.
- The Canvas has an updated semantic phase summary, while the visual Canvas itself is excluded from the accessibility tree.
- Phase transitions use a polite live region, checkpoints receive focus without moving the document, and Next and Restart have explicit accessible names.
- The release browser console reported zero warnings and zero errors.

## Paper-fidelity checks

- The graph topology and search rule stay matched; the visual changes data placement, not the Vamana topology or PQ-distance rule.
- No runtime migration is shown. AiSAQ neighbor PQ codes are visibly prebuilt into SSD node chunks.
- Stage 1 distinguishes pre-query `n_ep` state from the hop-local `R + n_ep` bound.
- Full vectors enter `V` before full-distance sorting, and returned packets are labeled as an illustrative three of top-k.
- Chunk formulas include the outdegree field: `B_D = b_full + b_num(R + 1)` and `B_A = B_D + R·b_PQ`.
- SIFT1M, SIFT1B, and KILT block values are labeled derived from Table 1 inputs and a 4 KB teaching model.
- Evidence bars are explicitly schematic while exact memory and load values are labeled measured from Tables 2 and 3.
- The 1.9 ms centroid reload and 0.3 ms shared-centroid plus 4 KB metadata paths are shown separately.
- Filtering and dynamic indexing are scoped to the evaluated build, and 11–14 MB is never presented as zero RAM.

## Finish review

The interface detector's actionable side-tab warnings were removed by replacing thick inset stripes with borders or outlines. Remaining literal-color and scale advisories are intentional tonal shading inside the documented factory palette, not untracked component variants. Syntax checks, phase-state assertions, reduced-motion stepping, the 27-action browser sweep, breakpoint captures, pause hashes, checkpoint scroll checks, manual-camera checks, and source-versus-final visual comparison all passed.

final result: passed
