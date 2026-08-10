# Byte Transit Observatory: DiskANN vs AiSAQ

Byte Transit Observatory is a dependency-free visual explanation of **AiSAQ** based on [arXiv:2404.06004v2](https://arxiv.org/abs/2404.06004). A full-screen Canvas cutaway makes one graph-search hop observable across host state, CPU, DRAM, and SSD while a synchronized text ledger explains the same movement.

The experience is designed for two reading depths: beginner copy explains what moves and why; Research detail exposes event IDs, phase-relative timing, evidence status, memory figures, and derived block spans.

## What the trace shows

1. Query `q`, PQ centroids, and lookup-table state remain host-side.
2. On the modeled node-cache miss, an aligned logical read request travels down toward symbolic `LBA(p)`—numeric addresses are not invented.
3. One or more 4 KiB logical read units return up into reusable DRAM scratch.
4. DiskANN joins returned neighbor IDs with its dataset-wide PQ array in DRAM. AiSAQ consumes neighbor PQ codes already stored inline in the returned SSD node chunk.
5. Both run the same PQ-distance role. Candidate list `L` carries `ID + scalar PQ distance + expansion state`, while a separate seen-ID set deduplicates insertions.
6. During expansion, the current full vector is scored exactly; the implementation’s exact-score ledger retains `ID + scalar exact distance`, then scratch capacity is reused. Paper Algorithm 1’s logical `V` is not the C++ seen-ID set.

The two methods remain separate comparison lanes. CPU, DRAM, and SSD colors identify memory tiers across both lanes; they are not method identities.

## Controls

Play or pause, move to the previous or next phase, replay the current phase, scrub within it, restart the full trace, change dataset or speed, switch method view, follow the camera, toggle labels, and reveal Research detail. Keyboard stepping, visible focus, reduced-motion behavior, semantic Canvas fallback text, and a collapsible mobile inspector are included.

## Run locally

No package install or build step is required:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The site is static HTML, CSS, Canvas, and JavaScript with no backend, tracking, or runtime data fetch.

## Source and fidelity

The primary technical source is Kento Tatsuno et al., [“AiSAQ: All-in-Storage ANNS with Product Quantization for DRAM-free Information Retrieval”](https://arxiv.org/pdf/2404.06004v2), arXiv:2404.06004v2.

The primary visual model is the full-inline layout evaluated in v2. The animated transport path intentionally shows a cache miss and omits CPU/OS cache internals. It is a teaching trace, not captured production telemetry, a benchmark reproduction, or a literal rendering of the authors’ implementation. Measured values are attributed to paper tables; formulas and block spans are labeled derived; animation-only states are labeled illustrative.

The interaction approach was informed by Laurentiu Raducu’s learning article and the public `rocket-engine` / `engineworks` examples. This implementation uses independently authored structure, code, artwork, and copy.

The repository includes a GitHub Pages workflow, but this document does not claim that a deployment has occurred.
