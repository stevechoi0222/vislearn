---
name: Vector Search Works
description: A full-screen, seven-station vector-search factory that makes the DiskANN and AiSAQ data-placement comparison visible, controllable, and evidence-backed.
colors:
  ink: "#142a37"
  ink-2: "#213c4a"
  paper: "#f4f0e7"
  concrete: "#e4dfd3"
  warm-white: "#fffdf7"
  cobalt: "#3168d8"
  cobalt-deep: "#1c4da8"
  mint: "#4aae9b"
  mint-deep: "#247666"
  signal-yellow: "#f5c84c"
  signal-yellow-deep: "#b98706"
  coral: "#d85d49"
  muted: "#58707a"
  line: "#b8b6ae"
typography:
  display:
    fontFamily: "Avenir Next Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Avenir Next Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "clamp(1.7rem, 2.4vw, 2.55rem)"
    fontWeight: 700
    lineHeight: 0.93
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "normal"
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 750
    lineHeight: 1.55
    letterSpacing: "normal"
  data:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "0.68rem"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  sm: "7px"
  md: "8px"
  action: "9px"
  lg: "10px"
  round: "50%"
spacing:
  xs: "3px"
  sm: "7px"
  md: "10px"
  lg: "18px"
  xl: "24px"
  section-inline: "clamp(22px, 7vw, 110px)"
  section-block: "clamp(72px, 9vw, 130px)"
components:
  button-primary:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "7px 12px"
  button-action:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "11px 17px"
  button-checkpoint:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 9px"
  chip-selected:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "7px 9px"
  navigation-rail:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.warm-white}"
    padding: "0 24px"
    height: "64px"
  guide-panel:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.ink}"
    padding: "18px 24px 26px"
---

# Design System: Vector Search Works

## Overview

**Creative North Star: "The Seven-Station Vector Factory"**

The Seven-Station Vector Factory treats memory placement as an industrial logistics problem. One continuous isometric floor turns the paper into a route through Index Layout, Query Entry, SSD Read, PQ Scoring, Loop and Re-rank, 4 KB Packing, and Evidence and Limits. Every station contains a cobalt DiskANN machine and a mint AiSAQ machine operating on the same logical query. Signal-yellow PQ packets and query pods make the shared work visible while the paired machinery exposes the one defining difference: where the codes are fetched from.

The full-screen Canvas is framed by an overlay header and HUD, a right-side inspector, and a bottom control dock. Matte concrete, ink machinery, condensed headings, mono data labels, and restrained tonal shading make the experience feel like a precise operating console. Limited gradients clarify the sky, header fade, and active controls; they never replace the hard-edged procedural geometry or turn the interface into glossy dashboard decoration.

**Key Characteristics:**

- One procedural low-poly factory with seven persistent stations and paired method machines.
- Synchronized yellow query pods travelling one route through both implementations.
- Semantic cargo colors that retain one meaning across Canvas, controls, evidence, and feedback.
- Condensed industrial headlines paired with calm body copy and tabular mono data.
- Overlay HUD, inspector, and transport dock that preserve the factory as the dominant first viewport.
- Ambient factory activity separated from phase-specific machine and payload motion.
- Explicit paper evidence, checkpoints, and reduced-motion behavior integrated into the visual system.

## Colors

The palette combines a dark maritime utility rail with warm drafting-paper neutrals and three high-contrast operational signals.

### Primary

- **Signal Cargo Yellow** (`colors.signal-yellow`): active transport controls, progress, selected states, PQ cargo, query vehicles, focus outlines, and the concept-spine field.
- **Deep Signal Ochre** (`colors.signal-yellow-deep`): borders and dimensional accents that keep yellow controls and cargo legible.

### Secondary

- **DRAM Cobalt** (`colors.cobalt`): DiskANN memory, graph evidence, block fills, machine accents, and the DiskANN side of every paired station.
- **Warehouse Cobalt** (`colors.cobalt-deep`): dimensional faces, links, and source actions associated with DiskANN or resident data.

### Tertiary

- **SSD Mint** (`colors.mint`): AiSAQ storage, enabled toggles, correct feedback, machine accents, and the AiSAQ side of every paired station.
- **Deep SSD Mint** (`colors.mint-deep`): benefit panels, truth-note headings, and structural faces associated with AiSAQ.
- **Tradeoff Coral** (`colors.coral`): explicit cost, limitation, or incorrect-answer states; it is never used as ambient decoration.

### Neutral

- **Freight Ink** (`colors.ink`): primary text, utility rails, dark learning sections, hard edges, and the deepest Canvas strokes.
- **Raised Ink** (`colors.ink-2`): secondary navigation surfaces and dark tonal layering.
- **Drafting Paper** (`colors.paper`): the main editorial page field.
- **Yard Concrete** (`colors.concrete`): the simulation ground and neutral tradeoff field.
- **Warm Evidence White** (`colors.warm-white`): guide panels, evidence surfaces, readable labels, and inverse text.
- **Muted Steel Copy** (`colors.muted`): explanatory prose, metadata, and low-priority evidence.
- **Survey Line** (`colors.line`): dividers and boundaries on light surfaces.

**The Cargo Color Rule.** Signal Cargo Yellow always means query movement, PQ cargo, active progress, selection, or focus; it is not a decorative wash.

**The Fixed Address Rule.** Cobalt remains DiskANN and DRAM, mint remains AiSAQ and SSD, and coral remains cost or error across every medium.

## Typography

**Display Font:** Avenir Next Condensed (with Arial Narrow, Roboto Condensed, and sans-serif fallbacks)

**Body Font:** Avenir Next (with Avenir, Segoe UI, Helvetica, Arial, and sans-serif fallbacks)
**Label/Mono Font:** SFMono-Regular (with Consolas, Liberation Mono, and monospace fallbacks)

**Character:** Condensed display type behaves like industrial signage: broad enough for dramatic section markers but compact enough for the simulation guide. The body stack stays neutral and generous, while monospaced numerals make measurements, stages, and addresses read as operational data.

### Hierarchy

- **Display** (700, fluid 2.25–5.25rem, 0.96 line-height): major editorial section headings; keep the measure at or below 780px.
- **Headline** (700, fluid 1.7–2.55rem, 0.93 line-height): the current simulation stop and compact panel headlines.
- **Title** (700, 1.3rem, 1.55 line-height): balance panels and local content groups.
- **Body** (400, 1rem, 1.55 line-height): explanations and evidence context; explanatory measures stop at 64–68ch.
- **Label** (750, 0.78rem): controls, presets, and compact operational language; uppercase is reserved for metadata or physical labeling.
- **Data** (700, 0.68rem, tabular numerals where available): stage counts, measurements, outputs, addresses, and chart labels.

**The Condensed Infrastructure Rule.** Use condensed type for landmarks and large values, not for paragraphs; long explanations stay in the body stack.

**The Numbers Are Cargo Rule.** Measurements use the mono stack and tabular numerals so changing values do not jitter or lose alignment.

## Layout

The first viewport is a working surface, not a conventional hero. The simulation occupies one full small viewport height (`100svh`) with the procedural Canvas fixed to the entire factory surface. A dark overlay header places the brand at left, the live line/station/action/query HUD in the middle, and paper, accuracy, and guide controls at right. The Canvas remains visible behind a live ledger at upper left, a compact scene-status placard near the top center, camera controls on the left edge, a right inspector clamped to 360–430px, and a bottom transport dock that fills the remaining width.

Editorial sections use generous fluid padding (`spacing.section-block` and `spacing.section-inline`) and an intentionally varied sequence of yellow, ink, white, concrete, and teal fields. Internal grids respond to the information: four-step flow, control-plus-block lab, evidence chart-plus-table, balanced tradeoff, two-column quiz, and three-column source ledger. Explanatory copy generally stops at 68ch.

Hiding the inspector expands the dock and recenters the camera in the newly available Canvas area. At narrower desktop widths, low-priority HUD items and transport toggles are removed before the core run, pause, step, restart, dataset, and speed controls. At 760px and below, the header and HUD become two compact rows, the inspector becomes a bottom sheet above a two-row transport dock, and the sheet collapses to a visible 32px handle instead of leaving the factory. Dataset, speed, method view, and toggles are hidden from the compact dock; the same paired machines remain on the same single floor. Nonessential labels and the method key disappear as space tightens, while the active station remains labeled. Editorial evidence, tradeoffs, quiz choices, and sources stack below the simulation without horizontal scrolling.

**The Same Route Rule.** DiskANN and AiSAQ remain paired inside every station and travel the same seven-stop route; responsive framing may hide controls or labels but never split them into unrelated searches.

## Elevation & Depth

Depth is a hybrid of isometric massing, tonal face shading, dark edge strokes, and blunt offset shadows. The Canvas floor and machines remain matte. Semi-opaque overlay surfaces use restrained blur only to keep text readable over moving geometry; their borders and compact radii retain the industrial-console character.

### Shadow Vocabulary

- **Header Fade:** a dark vertical fade separates the overlay brand and HUD from the Canvas without creating a solid page band.
- **Inspector Lift** (`0 18px 52px rgba(0, 0, 0, .34)`): keeps the right explanation surface legible over factory motion.
- **Dock Lift** (`0 15px 38px rgba(0, 0, 0, .34)`): anchors the bottom transport controls to the working surface.
- **Yard Label Offset** (`5px 7px 0 rgba(20, 42, 55, .18)`): gives physical labels a printed placard character.
- **Ledger Edge:** thin dark borders and opaque-enough ink fields keep live numbers readable without a floating-card shadow.
- **Control Lift** (`0 5px 10px rgba(0, 0, 0, .18)`): gives transport buttons restrained tactility.
- **Balance Mass** (`10px 13px 0 rgba(20, 42, 55, .14)`): supports the deliberate weight metaphor in the tradeoff section.

**The Matte Massing Rule.** Convey hierarchy with planes, edges, and purposeful offset shadows. Blur and glow are reserved for overlay legibility and the active yellow query signal, never for generic card decoration.

## Shapes

The form language is industrial and rectilinear. Canvas buildings, node chunks, cargo, plots, and evidence blocks are hard-edged low-poly volumes with visible strokes and flat-shaded faces. Editorial sections and primary panels keep square corners; their boundaries are created through fields, rules, and borders rather than rounded cards.

Interactive elements use small, functional radii: 7px for compact chips and checkpoint buttons, 8px for selectors and segmented endpoints, 9px for the principal recall action, and 10px for transport controls and the view-mode shell. Circular shapes are reserved for route numbers, concept steps, wheels, and focus pulses. This contrast keeps rounded geometry synonymous with state, sequence, or movement.

**The No Bubble Panels Rule.** Round the control in the hand, not the industrial surface it operates.

## Components

### Buttons

- **Shape:** compact controls use a tactile 7–10px radius; large flat panels do not inherit that rounding.
- **Primary:** Signal Cargo Yellow on Freight Ink, with a deep-ochre border and strong label weight. Transport controls use 7px 12px padding; the recall action uses 11px 17px.
- **Hover / Focus:** hover lifts transport controls by 1px; every interactive element receives a 3px yellow focus outline with a 3px offset.
- **Secondary / Ghost:** secondary controls use a dark steel surface with a visible border; reset and utility actions may be transparent but retain an underline or clear label.

### Chips

- **Style:** compact toggles use a dark rail surface, 7px radius, steel border, and 7px 9px padding.
- **State:** selected toggles switch to SSD Mint with Freight Ink text; view and preset segments switch to Signal Cargo Yellow.

### Cards / Containers

- **Corner Style:** square by default; the system prefers field changes and rules over freestanding rounded cards.
- **Background:** Warm Evidence White for learning/evidence, Freight Ink for labs, Drafting Paper for sources, and Yard Concrete for neutral mechanism framing.
- **Shadow Strategy:** only placards, live overlays, controls, and metaphorical weight panels use the documented structural shadows.
- **Border:** one-pixel steel or survey-line dividers organize dense data; important boundaries use a 2–4px semantic top rule.
- **Internal Padding:** compact panels use 16–24px; editorial sections use the fluid section spacing tokens.

### Inputs / Fields

- **Style:** dark selectors carry a visible steel border and 8px radius; range inputs use the native control with a yellow accent; quiz radios hide the native circle but preserve the semantic input.
- **Focus:** the global 3px yellow outline remains visible on selectors, ranges, buttons, links, and custom radio/toggle surfaces.
- **Error / Disabled:** quiz errors turn coral with a lighter coral border; correct states turn mint. Controls are not visually disabled merely because the simulation is paused.

### Overlay Header and HUD

The header floats over the factory rather than consuming a layout row. A three-bar industrial mark and the “Vector Search Works” wordmark occupy the left edge. Four mono HUD cells report line, station, action, and query state from the same simulation snapshot. Paper, accuracy, and guide controls remain compact on the right; mobile keeps the brand, short actions, and all four HUD values in two rows.

### Seven-Station Vector Factory

The signature component is one continuous procedural Canvas factory. A single route connects Index Layout Bay, Query Airlock, SSD Node Lift, PQ Scoring Hall, Loop & Re-rank Hall, 4 KB Packing Hall, and Evidence & Limits. Each station contains adjacent cobalt DiskANN and mint AiSAQ machinery, while two signal-yellow pods with method-colored outlines represent the same logical query under the two layouts. Method views dim the nonselected machinery instead of changing topology or moving it to another scene.

Machines are composed from Canvas primitives: cuboids, rotors, drawers, packets, scanners, block trays, read beams, status plates, and query pods. The camera begins fitted to the factory, eases toward the active station when Follow is enabled, accounts for the visible inspector width, and returns to the whole floor through the Fit control. Pointer drag pans the floor and modifier-wheel input zooms it; either manual action disables Follow, while Fit remains durable until Follow is explicitly restored. Station labels are picked directly from the Canvas for stage jumps and declutter below the minimum useful zoom.

### Right Inspector and Checkpoint

On desktop, the inspector overlays the right edge from below the header to above the dock. It pairs a condensed station headline and source metadata with an action card whose four rows always explain the common action, DiskANN, AiSAQ, and why they differ. The action list and seven-stop route support direct jumps. At the end of each 14–18 second stage, autoplay pauses at a warm-yellow checkpoint; revealing the answer does not advance the route, and Continue moves to the next station. On mobile, this same inspector becomes a bottom sheet with a persistent Details handle; its action comparison remains available while long stage prose, checkpoints, and route controls are removed from the compact view.

### Bottom Control Dock

The dock overlays the bottom of the factory and contains the query plate, Run query, play/pause, next, restart, overall progress, method view, dataset, speed, Follow, and Labels controls. When the inspector is hidden, the dock expands to the right edge. Mobile reduces it to the query plate, Run query, three transport controls, and progress so the factory and explanation sheet retain usable height.

### Progress and Motion

One simulation state drives the current station and action, paired machine phase, query position, camera target, guide copy, HUD, inspector dwell bar, and overall dock progress. While playback runs, ambient motion keeps the route dashes, beacons, background lights, and idle rotors alive; semantic motion uses the active phase to move SSD packets, PQ packets, candidate tokens, scanners, block packers, and evidence shutters. Pause freezes both ambient and semantic Canvas time so the factory becomes a stable inspection frame.

With reduced motion enabled, autoplay begins paused, ambient Canvas time is frozen, camera changes snap to their targets, smooth checkpoint scrolling is removed, and CSS animation/transition durations collapse to 0.001ms. Play, pause, phase stepping, direct station jumps, zoom, Fit, Follow, and Labels remain available.

## Do's and Don'ts

### Do:

- **Do** preserve one semantic color mapping across Canvas objects, controls, charts, feedback, and prose.
- **Do** keep DiskANN and AiSAQ adjacent at every station and synchronized to the same route, station, and action.
- **Do** use condensed display type for landmarks, body type for explanations, and mono type for data.
- **Do** label illustrative geometry and keep measured evidence visually distinct from derived or simplified material.
- **Do** preserve visible focus, semantic fallback text, keyboard operation, mobile touch targets, and reduced-motion behavior.
- **Do** use ambient motion to keep the factory alive and phase-specific motion to explain what is happening now.
- **Do** keep the Canvas dominant while the overlay header, inspector, ledger, and dock remain readable.

### Don't:

- **Don't** use Signal Cargo Yellow as an arbitrary decorative accent or assign cobalt, mint, and coral new meanings.
- **Don't** split the factory into separate image panels or substitute the procedural world with a static generated backdrop.
- **Don't** let the DiskANN and AiSAQ machines advance to different stations or actions.
- **Don't** introduce ornamental gradients, glossy bubble cards, photorealistic assets, or copied third-party factory artwork.
- **Don't** hide source boundaries or style an illustrative animation as if it were benchmark telemetry.
- **Don't** make motion mandatory, remove learner controls, or let overlay chrome and decorative labels crowd the factory on narrow screens.
