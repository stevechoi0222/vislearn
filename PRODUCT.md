# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Semantic HTML, CSS, and JavaScript with a Three.js 0.185.1 WebGL renderer dynamically imported from jsDelivr. The experience has no backend, tracking, or runtime application API, but the primary 3D renderer does make that module fetch. A local 2D Canvas renderer is the automatic fallback when the import or WebGL initialization fails.

## Users

Technically curious readers learning AiSAQ from first principles, including researchers who want to inspect the paper boundary and newcomers who need a concrete memory-access model.

## Product Purpose

Turn arXiv:2404.06004v2 into a controllable hardware transit trace. Success means a reader can explain where PQ codes live, follow one cache-miss graph hop across CPU, DRAM, PCIe/NVMe, SSD controller, and NAND, distinguish transient bytes from retained records, state the DRAM-versus-SSD tradeoff, and distinguish the paper CPU path from the optional illustrative GPU/VRAM route.

## Positioning

Byte Transit Observatory treats data placement as observable movement through a transparent server. DiskANN and AiSAQ share graph logic and scoring roles but expose different PQ supply paths through the same host and storage hardware. GPU assist is available as a labeled thought experiment, not as a claim about the evaluated AiSAQ path.

## Operating Context

The first viewport is a learning instrument: the 3D cutaway leads, a semantic access ledger mirrors its state, a collapsible inspector supplies beginner explanation and citations, and a transport dock supports the full path, replay, and scrubbing. Block lab, evidence, tradeoff, recall, and source sections continue below.

## Capabilities and Constraints

- Explain graph ANNS, PQ, node-chunk layout, traversal, expansion-time exact scoring, block alignment, memory behavior, and index switching.
- Show host-side `q` and LUT state; a cache-miss request down; 4 KiB logical aligned units up to reusable scratch; DiskANN global-DRAM PQ gather versus AiSAQ inline PQ use; and separate `L`, seen-ID, and exact-score state.
- Animate 12 hardware beats: inspect, request, NAND read, block return, DRAM join, inline unpack, PQ score, exact score, queue commit, scratch release, block pack, and evidence.
- Provide Run Full Path, play/pause, previous, next, phase replay, stage-local scrubbing, restart, dataset, speed, view, camera orbit/zoom/fit, follow, labels, checkpoints, and Research detail.
- Default to the paper CPU path. Keep the opt-in GPU assist route visibly illustrative, preserve the host-owned query and search state, and do not bypass the modeled NVMe/SSD/NAND storage beats.
- Cite paper sections, figures, or tables near material claims and distinguish paper-backed, derived, and illustrative state.
- Do not invent numeric addresses, request IDs, unpublished benchmark coordinates, production telemetry, or reproduction claims.
- Scope the primary visual to the full-inline AiSAQ layout evaluated in arXiv v2 dated 26 February 2025. The modeled path is a node-cache miss; CPU and OS cache internals are omitted.
- Keep method identity separate from memory-tier color semantics.

## Brand Commitments

Use an observatory/cutaway visual world: dark host console, transparent 3D hardware, precise directional movement, compact paper annotations, synchronized text and renderer evidence, and learner-controlled time. Frame GPU/VRAM inward toward each method lane so the optional branch remains legible without pushing the actual SSD route out of view. Preserve the low-poly spatial memory aid without copying reference names, assets, code, or prose.

## Evidence on Hand

- Primary source: arXiv:2404.06004v2, Figures 1–6 and Tables 1–5.
- Implementation reference: the authors’ public AiSAQ DiskANN repository.
- Interaction references: Laurentiu Raducu’s learning article and public Canvas examples.
- No independent benchmark reproduction, customer claim, production telemetry, or physical-device certification is available.

## Product Principles

- Show the byte path before adding terminology.
- Preserve identical graph/search logic while making data placement visibly different.
- Distinguish live payload, reusable capacity, and retained scalar records.
- Let the learner pause, scrub, replay, and revisit every phase.
- Pair important claims with evidence status and an honest caveat.
- Teach the cost as clearly as the memory benefit.

## Accessibility & Inclusion

Keyboard-operable native controls, visible focus, semantic Canvas description, phase-transition announcements through `#phase-live`, reduced-motion behavior, 44px mobile targets, a collapsed mobile inspector peek, and no required animation for comprehension. The visible trace ledger is intentionally not live because it updates throughout animation.
