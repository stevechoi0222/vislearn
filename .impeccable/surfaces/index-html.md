---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["css/styles.css","js/main.js","js/hardware3d.js","js/render.js","js/sim.js","js/ui.js"]
---

# Surface Brief: Byte Transit Observatory

- Scope: root `index.html`; visitor mode is Read through an interactive Experience.
- Audience: technically curious readers learning arXiv:2404.06004 from first principles, with optional research detail.
- Job: show where bytes live and move during one graph-search hop, then connect the mechanism to memory, block, and index-switching tradeoffs.
- Primary action: run the full hardware path, then pause, step, replay, or scrub any access phase.
- Proof: paper sections and Figures 1–2 for mechanism; Tables 1–5 for reported evidence and limits.
- Constraints: static site with a runtime Three.js module fetch and local 2D fallback, no invented numeric address, responsive, keyboard-operable, reduced-motion safe, and explicit paper/derived/illustrative boundaries.

## Chosen direction

The selected Byte Transit Observatory uses a dark transparent 3D server cutaway with paired DiskANN and AiSAQ lanes spanning CPU, host DRAM, PCIe/NVMe, SSD controller, and NAND. Mirrored GPU/VRAM boards frame inward but stay dim in the default paper path. A synchronized trace ledger makes request down, NAND assembly, read-unit return up, scoring, commit, and release inspectable. The memorable moment is the same neighbor IDs reaching the same scoring role through two supply paths: DiskANN gathers PQ codes from global DRAM; AiSAQ consumes inline PQ codes from the returned SSD chunk.

## Truth contract

- Primary scope is the full-inline AiSAQ layout evaluated in arXiv v2.
- The active transport scene is a node-cache miss; cache-hit, CPU-cache, and OS-cache internals are omitted.
- Query `q`, centroids, and LUT state remain host-side.
- Requests use symbolic `LBA(p)` and aligned logical spans; numeric addresses are not fabricated.
- Returned 4 KiB logical units enter reusable DRAM scratch.
- The default compute path is CPU-based. GPU assist is an opt-in illustrative branch through PCIe, VRAM, and GPU that returns scalar state to the host; it does not replace the storage route.
- `L` stores ID, scalar PQ distance, and expansion state; a separate seen-ID set deduplicates insertion; the implementation exact-score ledger stores ID plus scalar exact distance during expansion. Paper `V` is the logical reranking set, not the C++ seen set.
- Method identity is lane/name/marker; yellow, periwinkle, teal, and coral retain CPU, DRAM, SSD, and full-vector semantics across both lanes.

## Implementation inventory

| Ingredient | Commitment |
|---|---|
| 3D cutaway | Three.js 0.185.1, transparent paired hardware lanes, inward GPU framing, event-driven motion, and automatic 2D Canvas fallback |
| Hardware beats | inspect, request, NAND read, block return, DRAM join, inline unpack, PQ score, exact score, queue commit, scratch release, block pack, and evidence |
| Trace ledger | request/address, data return, compute/commit plus optional research fields |
| Learning inspector | beginner explanation, bilateral comparison, citation, checkpoint, and route |
| Transport dock | Run Full Path, previous, play, next, phase replay, scrub, progress, camera/follow/labels, and responsive secondary controls |
| Scope badge | arXiv v2 full-inline and cache-miss/caches-omitted caveat |
| Mobile surface | 44px collapsed inspector peek and 208px dock with the Run Full Path action retained at 760px and below |
| Learning sections | block lab, measured evidence, tradeoff, recall test, and fidelity ledger |

## Responsive and accessibility commitments

Desktop preserves the full 3D cutaway behind a slim left HUD, right inspector, and bottom dock; closing the inspector expands the working area. At narrower widths, low-priority controls disappear first. At 760px and below, the inspector defaults collapsed, the dock is 208px, the full-run action remains available, touch targets are at least 44px, and Research detail remains opt-in. Native controls, visible focus, semantic Canvas text, reduced-motion behavior, and stacked editorial sections remain required. The visible trace ledger is not live; `#phase-live` politely announces only discrete transitions.

## Verification status

The current implementation has local browser evidence at 1440 × 900 and 390 × 844 in WebGL `hardware-3d` mode with zero console warnings or errors, plus passing static-integrity and trace-contract checks. Assistive-technology, physical-device, and production verification remain pending.
