---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["css/styles.css","js/render.js","js/ui.js"]
---

# Surface Brief: Vector Search Works

- Scope: root `index.html`; visitor mode is Read through an interactive Experience.
- Audience: technically curious readers learning arXiv:2404.06004 from first principles.
- Job: explain where PQ codes live, trace one graph hop, and retain the memory/I-O tradeoff.
- Primary action: play, pause, step, or jump through the seven-stop query route.
- Proof: paper sections and Figures 1-2 for the mechanism; Tables 1-5 for reported evidence and limits.
- Constraints: static GitHub Pages site, no backend/runtime fetches, responsive, keyboard-operable, reduced-motion safe, and explicit fact/simplification boundaries.

## Chosen direction

A full-screen, independently drawn isometric vector-search factory. One continuous route connects seven stations, and every station contains adjacent DiskANN and AiSAQ machines performing the same action on the same logical query. The memorable moment is the paired signal-yellow query pods arriving together while the cobalt machine fetches PQ data from DRAM and the mint machine reveals equivalent PQ payload already packaged in the SSD node chunk.

## Implementation inventory

| Visible ingredient | Commitment | Medium |
|---|---|---|
| Overlay header and HUD | compact brand plus line, station, action, query, paper, accuracy, and guide controls | semantic HTML/CSS |
| Single factory floor | one procedural isometric world with a continuous seven-station route | animated Canvas primitives |
| Paired station machinery | adjacent cobalt DiskANN and mint AiSAQ machines at every stage | animated Canvas cuboids, rotors, drawers, scanners, and blocks |
| Query route | synchronized yellow pods follow one route and retain method-colored outlines | animated Canvas |
| Camera system | fitted overview, active-station follow, zoom, Fit, panel-aware centering, and Canvas station picking | Canvas interaction |
| Scene status and live ledger | current action plus peak memory, PQ residency, and derived block span | semantic HTML, tabular data |
| Right inspector | seven stops, bilateral action explanation, source anchor, checkpoint, and route jump list | semantic HTML |
| Bottom control dock | run, play/pause, next, restart, progress, view, dataset, speed, follow, and labels | semantic form controls |
| Mobile bottom sheet | persistent Details handle with compact bilateral explanation above the mobile dock | responsive HTML/CSS |
| Block lab | three paper presets and transparent formula-derived packing | semantic form controls + CSS blocks |
| Evidence | exact Tables 2-4 values and scoped measurement note | semantic table + CSS bars |
| Tradeoff balance | lighter DRAM/load time versus heavier SSD/I-O/features | semantic HTML/CSS |
| Recall test | four paper-backed questions with feedback | semantic fieldsets/radios |
| Fidelity ledger | real, simplified, and unestablished boundaries | semantic HTML |

## Responsive commitments

Desktop keeps the Canvas full-screen while the header/HUD, upper-left ledger, right inspector, left camera controls, and bottom dock overlay it. Hiding the inspector expands the dock and recenters the camera. Narrow desktop removes low-priority HUD and dock controls before disturbing the paired factory geometry. At 760px and below, the inspector becomes a collapsible bottom sheet above a compact dock; dataset, speed, method view, toggles, the method key, and nonessential labels are hidden. Both method machines remain together on the same floor, and editorial evidence, tradeoffs, questions, and sources stack below without horizontal scrolling.

## Motion and accessibility commitments

While playback runs, ambient route dashes, beacons, background lights, and idle machinery keep the factory visibly alive. The current phase separately drives explanatory packet movement, scoring, re-ranking, block packing, evidence motion, HUD text, and the bilateral inspector. Pause freezes both ambient and semantic Canvas time. Reduced-motion mode starts paused, snaps camera changes, removes smooth checkpoint scrolling and CSS transitions, and keeps keyboard stepping, direct station jumps, zoom, Fit, Follow, and Labels available. The Canvas retains semantic fallback text and stage changes are announced through a polite live region.
