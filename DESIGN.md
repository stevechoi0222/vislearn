---
name: Byte Transit Observatory
description: A visual-first systems observatory for tracing one DiskANN and AiSAQ graph-search hop across memory boundaries.
colors:
  observatory: "#071014"
  observatory-raised: "#0b171c"
  panel: "#101e24"
  panel-raised: "#152830"
  ink: "#142a37"
  paper: "#f4f0e7"
  concrete: "#e4dfd3"
  warm-white: "#fffdf7"
  comparison-cobalt: "#4f7fe8"
  comparison-mint: "#55c7ad"
  tier-dram: "#5a82ef"
  tier-ssd: "#35c8b0"
  tier-cpu: "#f5c84c"
  tier-gpu: "#936de8"
  full-vector: "#ec7c68"
  id-field: "#d8e1de"
  caveat: "#d85d49"
  muted: "#58707a"
  line: "#b8b6ae"
  steel: "#84a0aa"
typography:
  display:
    fontFamily: "Avenir Next Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Avenir Next Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "1.43rem"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 750
    lineHeight: 1.35
    letterSpacing: "normal"
  data:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "0.59rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  none: "0"
  trace: "2px"
  control: "3px"
  diagram: "4px"
  round: "50%"
spacing:
  trace-gap: "4px"
  control-gap: "7px"
  panel-pad: "14px"
  section-inline: "clamp(22px, 7vw, 110px)"
  section-block: "clamp(72px, 9vw, 130px)"
components:
  button-primary:
    backgroundColor: "{colors.tier-cpu}"
    textColor: "{colors.observatory}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "6px 9px"
  button-control:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.warm-white}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "6px 9px"
  trace-ledger:
    backgroundColor: "{colors.observatory}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.none}"
    padding: "7px 9px"
  inspector:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
---

# Design System: Byte Transit Observatory

## Overview

**Creative North Star: "The Byte Transit Observatory"**

The first viewport behaves like a systems instrument, not a conventional hero. A dark, transparent 3D server cutaway exposes two synchronized method lanes and shared CPU, host DRAM, PCIe/NVMe, SSD controller, and NAND hardware. Optional GPU/VRAM boards face inward toward the lanes but remain dim and off-path in the default paper view. A slim semantic ledger names the current request, return, or compute event; the inspector and dock recede until the learner asks for explanation or control.

The visual system is precise rather than photorealistic: hard planes, compact data labels, directional arrows, symbolic addresses, and restrained highlights. The 3D renderer carries the mechanism; DOM overlays carry accessibility, paper scope, and exact state.

**Key Characteristics:**

- WebGL-first 3D viewport with synchronized semantic trace and an automatic 2D Canvas fallback.
- Two fixed method lanes over common memory-tier geometry.
- Beginner explanation first; research fields appear only on request.
- Paper-backed, derived, and illustrative information remain distinguishable.
- Editorial labs and evidence retain the warm paper/cobalt/mint system below the viewport.

## Colors

The observatory uses dark blue-black surfaces under low ambient light; semantic payload colors remain bright enough to follow across tiers.

### Primary

- **CPU Signal** (`#f5c84c`): active bytes, CPU work, progress, selection, and focus.
- **DRAM Transit** (`#5a82ef`): DRAM tier boundaries and paths in both method lanes.
- **SSD Transit** (`#35c8b0`): SSD tier boundaries, aligned read units, and return paths in both lanes.

### Secondary

- **Comparison Cobalt** (`#4f7fe8`) and **Comparison Mint** (`#55c7ad`): supporting comparison accents in controls and editorial evidence.
- **Full Vector Coral** (`#ec7c68`): full-vector payload and exact-score path.
- **Illustrative GPU Purple** (`#936de8`): the optional GPU/VRAM compute route only; never a paper-backed tier claim.
- **ID Field** (`#d8e1de`): degree and neighbor-ID fields.
- **Caveat Coral** (`#d85d49`): limits, costs, and incorrect recall feedback.

### Neutral

- **Observatory** (`#071014`) and **Raised Observatory** (`#0b171c`): first-viewport field.
- **Panel** (`#101e24`) and **Raised Panel** (`#152830`): ledger, inspector, and dock planes.
- **Drafting Paper** (`#f4f0e7`), **Concrete** (`#e4dfd3`), and **Warm White** (`#fffdf7`): learning sections and evidence.
- **Freight Ink** (`#142a37`), **Muted Copy** (`#58707a`), and **Steel** (`#84a0aa`): editorial text and dividers.

**The Tier Color Rule.** Yellow means CPU/active work, periwinkle means DRAM, teal means SSD, coral means full-vector exact work or caveat depending on context, and purple is reserved for the opt-in illustrative GPU/VRAM route.

**The Method Identity Rule.** DiskANN and AiSAQ are identified by fixed lane, name, and marker shape. Never rely on a memory-tier color to identify a method.

## Typography

**Display Font:** Avenir Next Condensed with Arial Narrow and Roboto Condensed fallbacks.

**Body Font:** Avenir Next with Avenir, Segoe UI, Helvetica, and Arial fallbacks.

**Data Font:** SFMono-Regular with Consolas and Liberation Mono fallbacks

Condensed type behaves like equipment labeling and section signage. The body stack explains concepts at a calm reading rhythm; the mono stack is reserved for addresses, records, phase counters, bytes, and measurements.

### Hierarchy

- **Display** (700, fluid 2.25–5.25rem, 0.96): below-the-fold section landmarks.
- **Headline** (700, 1.43rem, 0.98): inspector phase title.
- **Body** (400, 1rem, 1.55): explanations, generally limited to 68–75ch.
- **Label** (750, approximately 0.65rem): controls and compact operational copy.
- **Data** (700, approximately 0.59rem, tabular): trace routes, symbolic addresses, bytes, distances, and evidence state.

**The Data Has Meaning Rule.** Monospace is used only for state, code-like records, addresses, and measurement—not as generic technical decoration.

## Layout

The first viewport fills `100svh`. At wide desktop, the renderer occupies the field behind a 58px top bar, a compact transit HUD at upper left, a narrow right inspector, and a 128px bottom dock. A compact scene title and paper-scope badge sit over unused 3D space rather than consuming rows.

The cutaway maintains two method lanes while applying the same CPU, DRAM, PCIe/NVMe, controller, and NAND structure to both. GPU boards are mirrored inward so VRAM and compute remain visible within the chassis framing. Seven learning stages and 12 hardware beats change the active payload, route, component glow, and guided camera target without replacing the spatial model.

At 1180px and 900px, low-priority dock and HUD controls disappear before the hardware view is reduced. At 760px and below, the top bar becomes two rows, the inspector defaults to a 44px bottom-sheet peek, and the dock becomes a 208px stack. The Run Full Path action remains visible and primary controls keep 44px targets. Research detail remains opt-in. Editorial sections stack without horizontal scrolling.

## Elevation & Depth

Depth comes from transparent chassis shells, modeled boards and packages, perspective, fog, directional light, one-pixel DOM boundaries, and darker raised surfaces. Soft shadows separate the inspector and dock from moving geometry; glow is limited to an active payload, component, or query signal.

### Shadow Vocabulary

- **Ledger Offset** (`8px 10px 0 rgba(0,0,0,.2)`): makes the semantic trace read as a fixed instrument.
- **Inspector Lift** (`0 18px 46px rgba(0,0,0,.38)`): separates explanation from the cutaway.
- **Dock Lift** (`0 16px 34px rgba(0,0,0,.38)`): anchors transport controls.
- **Control Offset** (`4px 5px 0 #71550a`): gives the primary Run Full Path action tactile weight.

**The Instrument Plane Rule.** Use borders and tonal planes first; reserve a shadow for an overlay that must remain legible over the Canvas.

## Shapes

The observatory is rectilinear. Ledger lanes, panels, tier boxes, aligned read units, and controls use square corners or 2–4px functional rounding. Circles are reserved for numbered phase nodes and small route signals. DiskANN and AiSAQ marker shapes remain distinct even without color.

## Components

### Observatory Renderer

The primary Three.js renderer shows three separate host records—candidate list `L`, seen IDs, and the exact-score ledger—beside CPU scoring, reusable DRAM scratch, PCIe/NVMe, SSD controller/NAND, and aligned read units in paired method lanes. Query `q` and LUT state stay host-side. Request pulses travel down; NAND voxels assemble the return; 4 KiB units travel up into scratch; scoring and commit movement is lateral. Numeric addresses are never synthesized. If the runtime Three.js import or WebGL initialization fails, the local 2D Canvas renderer preserves the teaching trace.

The hardware is built as procedural, named Three.js components rather than a monolithic imported mesh. The CPU package contains schematic cache, LUT, exact-score, core, reducer, and result regions; the GPU card contains a PCIe endpoint, memory controllers, VRAM banks, compute-core clusters, reducer, and result buffer. Component IDs and local flow anchors support targeted glow, camera framing, and data movement without claiming a real processor floorplan or measured per-core activity.

The 12 renderer beats are: inspect, request, NAND read, block return, DRAM join, inline unpack, PQ score, exact score, queue commit, scratch release, block pack, and evidence. Follow mode selects beat-specific component framing. Manual pointer orbit, zoom, or fit disengages follow; labels remain independently toggleable.

The default compute route is the CPU path described by the paper/public implementation. GPU assist is opt-in and illustrative: host-prepared scoring operands branch through PCIe into VRAM/GPU and a scalar result returns to host-owned state. It does not turn the query into an SSD payload or replace the NVMe request, NAND read, and DRAM return beats.

Generated CPU/GPU images in `assets/references/` guide silhouette, material, and exploded-view styling only. They are generic ImageGen concepts, not product photographs, runtime assets, or technical evidence. The reviewed Windows/NVIDIA Fooocus → Hunyuan3D → optional Blender pipeline was unavailable in the local Darwin arm64 environment and was not used to create a GLB or FBX for this renderer.

### Trace Ledger

Three ordered lanes report Request/Address, Data Return, and Compute/Commit. Pending, current, and completed opacity mirrors `traceSnapshot()`. Research mode adds event ID, phase window, evidence status, and the exact-record description. This visible ledger is not an ARIA live region because its values change every animation frame; `#phase-live` alone announces discrete phase and checkpoint transitions.

### Learning Inspector

The narrow right inspector begins with plain-language stage purpose, then bilateral DiskANN/AiSAQ explanation, paper link, checkpoint, and route. On mobile it is a bottom sheet that defaults to a visible collapsed handle.

### Transport Dock

Run Full Path, Previous, Play/Pause, Next, Replay Phase, phase scrubber, and overall progress are primary. View, compute path, dataset, speed, follow, labels, restart, camera orbit/zoom/fit, and Research detail remain available as space permits. Native range, select, and checkbox controls preserve keyboard behavior. The mobile 208px dock retains Run Full Path instead of hiding it.

### Scope Badge

The badge states that arXiv v2 evaluated the full-inline layout and that the teaching trace models a cache miss while omitting CPU/OS cache internals.

### Editorial Components

The block lab, evidence bars/table, tradeoff balance, recall form, and source ledger retain high-contrast paper fields and explicit measured/derived/illustrative labels.

## Do's and Don'ts

### Do:

- **Do** keep the Canvas as the first viewport’s primary explanation.
- **Do** keep `q`, centroids, and LUT state host-side.
- **Do** show logical aligned requests down and 4 KiB read units up into reusable scratch for the modeled cache miss.
- **Do** show DiskANN gathering global DRAM PQ codes and AiSAQ consuming inline PQ codes from its returned chunk.
- **Do** default to CPU compute and label every active GPU/VRAM route illustrative.
- **Do** label `L` as `ID + scalar PQ distance + expansion state`, keep seen IDs separate, and label implementation exact-score records `ID + scalar exact distance`.
- **Do** preserve semantic text, visible focus, reduced motion, and 44px mobile controls.

### Don't:

- **Don't** depict PQ bytes migrating between methods at query time.
- **Don't** send query `q` to SSD or imply the LUT lives in the node chunk.
- **Don't** use DRAM blue or SSD teal as a method identity.
- **Don't** imply the optional GPU branch was evaluated by the AiSAQ paper or public implementation.
- **Don't** invent numeric LBAs, request IDs, latency coordinates, or benchmark results.
- **Don't** imply cache behavior, production telemetry, physical-device proof, deployment, or benchmark reproduction that was not established.
- **Don't** let overlays crowd out the byte path or make Research detail the beginner default.
