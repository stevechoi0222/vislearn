---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["css/styles.css","js/render.js","js/ui.js"]
---

# Surface Brief: AiSAQ Storage Yard

- Scope: root `index.html`; visitor mode is Read through an interactive Experience.
- Audience: technically curious readers learning arXiv:2404.06004 from first principles.
- Job: explain where PQ codes live, trace one graph hop, and retain the memory/I-O tradeoff.
- Primary action: play, pause, step, or jump through the seven-stop query route.
- Proof: paper sections and Figures 1-2 for the mechanism; Tables 1-5 for reported evidence and limits.
- Constraints: static GitHub Pages site, no backend/runtime fetches, responsive, keyboard-operable, reduced-motion safe, and explicit fact/simplification boundaries.

## Chosen direction

An isometric low-poly storage yard fused with a memory-allocation atlas. The approved north star is `.impeccable/mocks/aisaq-comp-a-split-yard.png`, supplemented by the route-first guide structure from `.impeccable/mocks/aisaq-comp-c-query-route.png`. The memorable moment is the same yellow query vehicle crossing the same graph while the cobalt DRAM warehouse empties and yellow PQ cargo appears inside mint SSD node chunks.

## Implementation inventory

| Visible ingredient | Commitment | Medium |
|---|---|---|
| Ink utility rail | compact brand, thesis, four source/learning links | semantic HTML/CSS |
| Split storage yard | simultaneous DiskANN/AiSAQ comparison on 4 KB plots | animated Canvas geometry |
| DRAM warehouses | scale-heavy cobalt warehouse versus small mint entry-state store | animated Canvas cuboids |
| Query route | same yellow vehicle, same graph path, synchronized focus states | animated Canvas |
| Paper guide | seven stops, source anchor, truth note, route jump list | semantic HTML |
| Live ledger | peak memory, resident/working PQ codes, derived blocks | semantic HTML, tabular data |
| Transport dock | play/pause, next, restart, speed, follow, labels | semantic form controls |
| Block lab | three paper presets and transparent formula-derived packing | semantic form controls + CSS blocks |
| Evidence | exact Tables 2-4 values and scoped measurement note | semantic table + CSS bars |
| Tradeoff balance | lighter DRAM/load time versus heavier SSD/I-O/features | semantic HTML/CSS |
| Recall test | four paper-backed questions with feedback | semantic fieldsets/radios |
| Fidelity ledger | real, simplified, and unestablished boundaries | semantic HTML |

## Responsive commitments

Desktop keeps the yard and guide side by side. Tablet moves the guide below the yard. Mobile preserves simultaneous comparison, puts the dataset control on its own row, reduces nonessential canvas labels, and stacks evidence, tradeoffs, questions, and sources without horizontal scrolling.

## Unresolved publishing decision

The local directory implies a new public `stevechoi0222/vislearn` repository. Confirm that inference immediately before external creation/push if the user changes direction.
