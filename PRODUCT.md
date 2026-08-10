# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated assumption: dependency-free semantic HTML, CSS, Canvas, and JavaScript, chosen because the requested reference projects use that architecture and it deploys directly to GitHub Pages without a build step.

## Users

Primary user: a technically curious reader who wants to understand the AiSAQ paper from first principles, especially where PQ vectors live and how that changes memory, I/O, and index switching.

## Product Purpose

Turn arXiv:2404.06004v2 into a guided, interactive learning experience. Success means a reader can explain the difference between DiskANN and AiSAQ, trace one graph-search hop, and name the principal tradeoff without depending on a prose-only summary.

## Positioning

The site makes data placement tangible: a moving query visits the same graph under two layouts while DRAM contents, SSD node chunks, I/O blocks, candidate state, and paper-backed measurements change in view.

## Operating Context

The experience follows the learning workflow described in "How I use LLMs to learn complex topics": establish and review source knowledge, map concepts to persistent visual objects, provide a controllable low-poly simulation, support large and small screens, add recall challenges, and publish through GitHub Pages.

## Capabilities and Constraints

- Explain graph-based ANNS, product quantization, the DiskANN baseline, AiSAQ node-chunk layout, graph traversal, re-ranking, block alignment, memory behavior, and index switching.
- Include play/pause, next, restart, speed, follow, labels, click-to-jump, comparison controls, and reduced-motion behavior.
- Cite the paper by section, figure, or table near material claims.
- Clearly separate paper facts from visual simplifications and illustrative animation state.
- Use no backend, no tracking, no runtime API calls, and no invented benchmark claims.
- Target the current arXiv v2 PDF dated February 26, 2025.
- Intended GitHub destination is a new public `vislearn` repository under `stevechoi0222`; this remains an inferred publishing choice until push time.

## Brand Commitments

Use the requested article's learning model: a low-poly, RollerCoaster Tycoon-like simulation with a visible moving object, readable first-pass pacing, and controls that let the learner stop the flow. Do not copy the reference site's name, logo, text, or assets.

## Evidence on Hand

- Primary source: arXiv:2404.06004v2, including Figures 1-6 and Tables 1-5.
- Method reference: Laurentiu Raducu, "How I use LLMs to learn complex topics."
- Implementation references: the paper authors' public AiSAQ DiskANN repository and the method author's public static Canvas examples.
- No customer claims, production telemetry, or independent reproduction evidence is available; the site must not imply otherwise.

## Product Principles

- Make the one architectural change visible before introducing terminology.
- Let the learner control time and revisit any stage.
- Pair every important claim with source evidence and an honest caveat.
- Preserve the distinction between identical graph topology and different data placement.
- Teach the tradeoff, not only the headline memory reduction.

## Accessibility & Inclusion

Keyboard-operable controls, strong contrast, visible focus, semantic text alternatives for the Canvas, reduced-motion support, touch targets suitable for mobile, and a layout that remains usable without animation.
