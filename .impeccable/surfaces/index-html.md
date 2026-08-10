---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["css/styles.css","js/render.js","js/ui.js"]
---

# Surface Brief: Byte Transit Observatory

- Scope: root `index.html`; visitor mode is Read through an interactive Experience.
- Audience: technically curious readers learning arXiv:2404.06004 from first principles, with optional research detail.
- Job: show where bytes live and move during one graph-search hop, then connect the mechanism to memory, block, and index-switching tradeoffs.
- Primary action: play, pause, step, replay, or scrub the current access phase.
- Proof: paper sections and Figures 1–2 for mechanism; Tables 1–5 for reported evidence and limits.
- Constraints: static site, no runtime fetch, no invented numeric address, responsive, keyboard-operable, reduced-motion safe, and explicit paper/derived/illustrative boundaries.

## Chosen direction

The selected Byte Transit Observatory uses a dark cutaway with paired DiskANN and AiSAQ lanes over common CPU, DRAM, and SSD tiers. A synchronized trace ledger makes request down, read-unit return up, scoring, commit, and release inspectable. The memorable moment is the same neighbor IDs reaching the same scoring role through two supply paths: DiskANN gathers PQ codes from global DRAM; AiSAQ consumes inline PQ codes from the returned SSD chunk.

## Truth contract

- Primary scope is the full-inline AiSAQ layout evaluated in arXiv v2.
- The active transport scene is a node-cache miss; cache-hit, CPU-cache, and OS-cache internals are omitted.
- Query `q`, centroids, and LUT state remain host-side.
- Requests use symbolic `LBA(p)` and aligned logical spans; numeric addresses are not fabricated.
- Returned 4 KiB logical units enter reusable DRAM scratch.
- `L` stores ID, scalar PQ distance, and expansion state; a separate seen-ID set deduplicates insertion; the implementation exact-score ledger stores ID plus scalar exact distance during expansion. Paper `V` is the logical reranking set, not the C++ seen set.
- Method identity is lane/name/marker; yellow, periwinkle, teal, and coral retain CPU, DRAM, SSD, and full-vector semantics across both lanes.

## Implementation inventory

| Ingredient | Commitment |
|---|---|
| Canvas cutaway | paired method lanes with shared memory-tier grammar and event-driven motion |
| Trace ledger | request/address, data return, compute/commit plus optional research fields |
| Learning inspector | beginner explanation, bilateral comparison, citation, checkpoint, and route |
| Transport dock | previous, play, next, phase replay, scrub, progress, and responsive secondary controls |
| Scope badge | arXiv v2 full-inline and cache-miss/caches-omitted caveat |
| Mobile surface | 44px collapsed inspector peek and compact dock at 760px and below |
| Learning sections | block lab, measured evidence, tradeoff, recall test, and fidelity ledger |

## Responsive and accessibility commitments

Desktop preserves the full Canvas behind a slim left ledger, right inspector, and bottom dock; closing the inspector expands the working area. At narrower widths, low-priority controls disappear first. At 760px and below, the inspector defaults collapsed, touch targets are at least 44px, and Research detail remains opt-in. Native controls, visible focus, semantic Canvas text, polite announcements, reduced-motion behavior, and stacked editorial sections remain required.

## Verification status

The current implementation has local headless render evidence at 1440 × 900 and 390 × 844 plus syntax, DOM-ID, and whitespace checks. Full keyboard, assistive-technology, physical-device, and production verification remain pending.
