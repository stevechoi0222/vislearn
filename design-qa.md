---
title: AiSAQ storage yard design QA
date: 2026-08-10
final result: passed
---

# AiSAQ storage yard design QA

## Comparison input

- Approved source: `.impeccable/mocks/aisaq-comp-a-split-yard.png` (1536 × 1024)
- Final desktop capture: `tmp/qa/redesign/local-desktop-final.png` (1905 × 900 pixels from a 1920 × 907 browser viewport)
- Combined source/implementation input: `tmp/qa/redesign/source-vs-final.png`
- Final mobile capture: `tmp/qa/redesign/local-mobile-final.png` (375 × 844 page pixels from a 390 × 844 browser viewport)
- State checked: Compare view, Stage 1 Action 1; mobile block-cost view, Stage 6 Action 1; checkpoint at Stage 1 completion

## Visible comparison

The final build uses the approved isometric storage-yard scene as the actual simulation world, preserving its cobalt DiskANN yard, mint AiSAQ yard, yellow PQ cargo, split composition, dark controls, paper guide, and bottom metrics. The desktop scene now runs edge-to-edge to the guide instead of sitting inside beige side gutters. The guide is narrower than the scene and keeps the current action plus both methods visible at once, matching the approved hierarchy.

The implementation adds semantic motion overlays that the static source did not contain: synchronized query markers, data-source flows, node-read block trays, candidate/re-ranking tags, stage camera movement, and an always-visible Stage/Action status. These overlays use the source palette and do not replace the source artwork.

## Functional and responsive checks

- Seven stages and 27 actions advance at action boundaries; Next moves to the next action before changing stage.
- Every action renders Common action, DiskANN, AiSAQ, and Why it differs together.
- Compare, DiskANN, and AiSAQ views keep both textual explanations visible; the selected method receives priority styling.
- Play/pause, Next, Restart, speed, Follow query, Labels, dataset presets, action buttons, and route buttons work.
- Labels change the rendered scene; Follow query controls camera tracking.
- A completed stage pauses, announces its checkpoint, scrolls the checkpoint into view, and focuses Reveal answer.
- Mobile has no horizontal overflow. The block-cost stage restores the blocks-per-node ledger, and the action cue wraps instead of truncating.
- Reduced-motion users start paused and can step through actions manually.
- The image-load fallback is visible if the storage-yard asset fails.

## Accuracy and accessibility review

- All stage copy, formulas, Table 1–5 values, block spans, memory/load/switch values, and limitations were checked against arXiv:2404.06004v2.
- The site distinguishes prebuilt data placement from runtime movement, `R + n_ep` PQ-code state from total RAM, block span from I/O count, and full-precision re-ranking from exact global search.
- Memory bars disclose their logarithmic scale.
- Action transitions alone update the polite live region; checkpoints receive an explicit live announcement and keyboard focus.
- The generated backdrop contains decorative, non-identical node arrangements. The on-scene badge and Action 1 comparison explicitly state that those decorative nodes are not the logical graph topology. This is a disclosed P2 visual compromise, not a factual claim.

## Correction history

1. Replaced the former code-drawn yard with the approved generated scene and added phase-linked overlays.
2. Rewrote the guide as a bilateral four-row explanation and exposed action-level navigation.
3. Removed opposite-side dimming, fixed dataset-specific block trays, and synchronized both method animations.
4. Surfaced checkpoints, filled the desktop scene, restored mobile block metrics, fixed fallback behavior, and corrected the final paper-fidelity findings.

## Verdict

No P0 or P1 design, interaction, accessibility, or paper-fidelity issue remains in the tested states.

final result: passed
