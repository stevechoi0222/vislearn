# Byte Transit Observatory: DiskANN vs AiSAQ

Byte Transit Observatory is a visual explanation of **AiSAQ** based on [arXiv:2404.06004v2](https://arxiv.org/abs/2404.06004). A full-screen, transparent 3D server cutaway makes one graph-search hop observable across CPU, host DRAM, PCIe/NVMe, the SSD controller, and NAND. GPU and VRAM are present as an optional, explicitly illustrative route; the default view preserves the paper's CPU path.

The experience is designed for two reading depths: beginner copy explains what moves and why; Research detail exposes event IDs, phase-relative timing, evidence status, memory figures, and derived block spans.

## What the trace shows

1. Query `q`, PQ centroids, and lookup-table state remain host-side.
2. On the modeled node-cache miss, an aligned logical read request travels down toward symbolic `LBA(p)`—numeric addresses are not invented.
3. One or more 4 KiB logical read units return up into reusable DRAM scratch.
4. DiskANN joins returned neighbor IDs with its dataset-wide PQ array in DRAM. AiSAQ consumes neighbor PQ codes already stored inline in the returned SSD node chunk.
5. Both run the same PQ-distance role. Candidate list `L` carries `ID + scalar PQ distance + expansion state`, while a separate seen-ID set deduplicates insertions.
6. During expansion, the current full vector is scored exactly; the implementation’s exact-score ledger retains `ID + scalar exact distance`, then scratch capacity is reused. Paper Algorithm 1’s logical `V` is not the C++ seen-ID set.

The two methods remain separate comparison lanes. CPU, DRAM, and SSD colors identify memory tiers across both lanes; they are not method identities.

The animation is driven by 12 named hardware beats: inspect, request, NAND read, block return, DRAM join, inline unpack, PQ score, exact score, queue commit, scratch release, block pack, and evidence. Those beats keep the hardware fixed while changing the payload, route, highlight, and camera target.

## Controls

Run the full seven-stage path, play or pause, move to the previous or next phase, replay the current phase, scrub within it, restart, change dataset or speed, and switch between paired or single-method views. The camera supports guided follow, pointer orbit, zoom, fit, and labels. The compute-path selector defaults to `Paper path · CPU`; `GPU assist · illustrative` branches host-prepared scoring operands through PCIe, VRAM, and GPU, then returns the scalar result to host-owned search state. It does not rewrite the paper's SSD request and NAND-return path.

Keyboard stepping, visible focus, reduced-motion behavior, semantic Canvas fallback text, and a collapsible mobile inspector are included. The visible trace ledger is a synchronized status panel, not an ARIA live region; phase-transition announcements are isolated in `#phase-live` so progress animation does not continuously interrupt assistive technology.

## Run locally

No package install or build step is required:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The site is static HTML, CSS, and JavaScript with no backend or tracking. Its primary renderer dynamically imports Three.js 0.185.1 from jsDelivr at runtime, so the 3D view requires network access to that module. If the import or WebGL initialization fails, the experience automatically falls back to the repository's local 2D Canvas renderer.

## Source and fidelity

The primary technical source is Kento Tatsuno et al., [“AiSAQ: All-in-Storage ANNS with Product Quantization for DRAM-free Information Retrieval”](https://arxiv.org/pdf/2404.06004v2), arXiv:2404.06004v2.

The primary visual model is the full-inline layout evaluated in v2. The animated transport path intentionally shows a cache miss and omits CPU/OS cache internals. The evaluated/public AiSAQ path is presented as CPU-based. The optional GPU/VRAM branch is a separate illustrative systems path and is never presented as a paper result. The experience is a teaching trace, not captured production telemetry, a benchmark reproduction, or a literal rendering of the authors’ implementation. Measured values are attributed to paper tables; formulas and block spans are labeled derived; animation-only states are labeled illustrative.

The interaction approach was informed by Laurentiu Raducu’s learning article and the public `rocket-engine` / `engineworks` examples. This implementation uses independently authored structure, code, artwork, and copy.

Local visual verification covered the WebGL `hardware-3d` renderer at 1440 × 900 and 390 × 844 with zero browser-console warnings or errors, plus the repository's static-integrity and trace-contract checks. Assistive-technology sessions, physical-device behavior, and a production deployment were not verified.

The repository includes a GitHub Pages workflow, but this document does not claim that a deployment has occurred.
