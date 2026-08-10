---
name: AiSAQ Storage Yard
description: A matte industrial learning yard that makes AiSAQ data placement visible, controllable, and evidence-backed.
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

# Design System: AiSAQ Storage Yard

## Overview

**Creative North Star: "The Addressable Storage Yard"**

The Addressable Storage Yard treats memory placement as an industrial logistics problem. A synchronized isometric yard gives every abstract systems concept a persistent physical role: cobalt DRAM warehouses, mint SSD plots, signal-yellow PQ cargo, a yellow query vehicle, and 4 KB address markings. The same query crosses the same visible graph in both halves, so the visual world reinforces the paper's central distinction instead of merely decorating it.

Matte paper and concrete surfaces keep dense evidence readable, while the ink utility rail, condensed headings, mono data labels, and offset structural shadows make the experience feel like a precise operating console. The mood is tactile, industrious, and explanatory. It rejects glossy dashboard polish, ornamental gradients, photorealism, and motion that cannot be stopped.

**Key Characteristics:**

- Synchronized low-poly comparison with a persistent yellow query vehicle.
- Semantic cargo colors that retain one meaning across Canvas, controls, evidence, and feedback.
- Condensed industrial headlines paired with calm body copy and tabular mono data.
- Matte surfaces, visible edges, and structural offset shadows instead of glossy depth.
- Explicit paper evidence, checkpoints, and reduced-motion behavior integrated into the visual system.

## Colors

The palette combines a dark maritime utility rail with warm drafting-paper neutrals and three high-contrast operational signals.

### Primary

- **Signal Cargo Yellow** (`colors.signal-yellow`): active transport controls, progress, selected states, PQ cargo, query vehicles, focus outlines, and the concept-spine field.
- **Deep Signal Ochre** (`colors.signal-yellow-deep`): borders and dimensional accents that keep yellow controls and cargo legible.

### Secondary

- **DRAM Cobalt** (`colors.cobalt`): DiskANN memory, graph evidence, block fills, and the left-yard identity.
- **Warehouse Cobalt** (`colors.cobalt-deep`): dimensional faces, links, and source actions associated with DiskANN or resident data.

### Tertiary

- **SSD Mint** (`colors.mint`): AiSAQ storage, enabled toggles, correct feedback, and the right-yard identity.
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

The first viewport is a working surface, not a conventional hero. Beneath a 64px sticky utility rail, the simulation consumes the remaining viewport height. Its desktop grid places a flexible yard beside a guide clamped between 310px and 390px; the transport dock occupies the yard's lower row while the guide spans both rows. The Canvas itself splits the available yard exactly in half for synchronized comparison.

Editorial sections use generous fluid padding (`spacing.section-block` and `spacing.section-inline`) and an intentionally varied sequence of yellow, ink, white, concrete, and teal fields. Internal grids respond to the information: four-step flow, control-plus-block lab, evidence chart-plus-table, balanced tradeoff, two-column quiz, and three-column source ledger. Explanatory copy generally stops at 68ch.

At 1100px and below, the yard, transport, and guide become a vertical stack; the guide retains a two-column head/body arrangement and the yard remains at least 480px high. At 760px and below, the utility rail reduces to 58px, the dataset selector receives its own row, the yard becomes 58vh with a 420px minimum, the guide becomes a single column, and section padding becomes 70px by 20px. Evidence, tradeoffs, quiz choices, and sources collapse to one column. The route list remains a compact two-column control grid, while nonessential Canvas labels disappear when either split yard is 300px wide or less.

**The Same Route Rule.** Comparison layouts must preserve simultaneous graph geometry and route progress; responsive reflow may change framing but never imply two different searches.

## Elevation & Depth

Depth is a hybrid of isometric massing, tonal face shading, dark edge strokes, and blunt offset shadows. Large surfaces remain matte. Shadows explain physical stacking or pin a utility surface to the page; they do not create soft floating glass cards.

### Shadow Vocabulary

- **Utility Rail** (`0 7px 16px rgba(20, 42, 55, .25)`): separates sticky navigation from the working surface.
- **Ambient Panel** (`0 18px 36px rgba(20, 42, 55, .18)`): mobile navigation and exceptional raised overlays.
- **Yard Label Offset** (`5px 7px 0 rgba(20, 42, 55, .18)`): gives physical labels a printed placard character.
- **Ledger Offset** (`7px 9px 0 rgba(20, 42, 55, .18)`): anchors the live readout over the Canvas.
- **Control Lift** (`0 5px 10px rgba(0, 0, 0, .18)`): gives transport buttons restrained tactility.
- **Balance Mass** (`10px 13px 0 rgba(20, 42, 55, .14)`): supports the deliberate weight metaphor in the tradeoff section.

**The Matte Massing Rule.** Convey hierarchy with planes, edges, and purposeful offset shadows; do not introduce blur-heavy glass, glow, or decorative gradient depth.

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

### Navigation

The sticky 64px ink rail combines a low-poly three-bar mark, condensed wordmark, compact thesis, and un-underlined links. Hover turns links yellow. Below 1100px, section links move into a full-width dark mobile panel controlled by a semantic menu button; the panel begins directly below the 64px rail, or the 58px mobile rail.

### Split Storage Yard

The signature component is a 50/50 synchronized Canvas comparison. Both sides share graph topology, route, progress, camera grammar, and the yellow query vehicle. Cobalt buildings and cargo represent DiskANN's DRAM-resident PQ codes; mint node plots with inline yellow cargo represent AiSAQ's SSD placement. The renderer uses matte isometric cuboids, plot grids, ramps, fences, crates, tanks, and concise labels. The visible nine-node graph is always identified as illustrative.

### Learning Guide and Checkpoint

The guide pairs a condensed stop headline with source metadata, explanation, a mint truth note, a warm-yellow checkpoint, and a route list. At 58% of each stage, autoplay pauses once and invites recall. Revealing the answer does not advance the route; Continue resumes it. Each of the seven stages lasts 50–75 seconds at 1×, with user speeds from 0.5× to 3×.

### Progress and Motion

Route progress uses transform-based horizontal scaling with a 100ms linear update. The same simulation state drives both yards, the guide dwell bar, and the transport progress bar. With reduced motion enabled, autoplay begins paused, smooth scrolling is removed, and CSS motion durations collapse to 0.001ms; keyboard controls and direct stage jumps remain available.

## Do's and Don'ts

### Do:

- **Do** preserve one semantic color mapping across Canvas objects, controls, charts, feedback, and prose.
- **Do** keep the same graph and query route visibly synchronized whenever DiskANN and AiSAQ are compared.
- **Do** use condensed display type for landmarks, body type for explanations, and mono type for data.
- **Do** label illustrative geometry and keep measured evidence visually distinct from derived or simplified material.
- **Do** preserve visible focus, semantic fallback text, keyboard operation, mobile touch targets, and reduced-motion behavior.
- **Do** use matte planes, hard edges, and structural shadows to maintain the low-poly industrial world.

### Don't:

- **Don't** use Signal Cargo Yellow as an arbitrary decorative accent or assign cobalt, mint, and coral new meanings.
- **Don't** replace the split-yard mechanism with generic cards, a prose-only hero, or two unsynchronized diagrams.
- **Don't** introduce ornamental gradients, glossy glass panels, photorealistic assets, or soft bubble-card styling.
- **Don't** hide source boundaries or style an illustrative animation as if it were benchmark telemetry.
- **Don't** make motion mandatory, remove learner controls, or let decorative Canvas labels collide on narrow screens.
