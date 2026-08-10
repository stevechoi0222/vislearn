# AiSAQ Storage Yard

AiSAQ Storage Yard is a dependency-free, interactive explanation of **AiSAQ** from [arXiv:2404.06004v2](https://arxiv.org/abs/2404.06004). It turns the paper's central data-placement idea into a controllable storage-yard simulation: a query moves through the same graph while the interface shows what resides in DRAM, what is read from SSD, and how the DiskANN and AiSAQ layouts differ.

The learning approach is inspired by Laurentiu Raducu's article, ["How I use LLMs to learn complex topics"](https://laurentiugabriel.github.io/blog/articles/how-i-use-llms-to-learn/): build a source-grounded mental model, map abstract concepts to persistent visual objects, and let the learner stop, replay, and inspect the process.

## What the site teaches

- Why graph-based approximate nearest-neighbor search uses compressed product-quantization (PQ) vectors while traversing candidates.
- The DiskANN baseline: compressed vectors used during traversal are kept in memory while full vectors and graph data live on SSD.
- AiSAQ's central change: the compressed vectors needed to evaluate a node's neighbors are stored with that node's SSD record, reducing the index's DRAM requirement in exchange for larger SSD records and potentially larger node-chunk reads.
- How a query expands candidates, visits graph nodes, and eventually re-ranks a short list with full vectors.
- Why the storage layout can make switching among multiple indexes more practical.

Use the play/pause, next-step, restart, speed, follow-camera, label, and comparison controls to inspect the animation at your own pace. The interface also supports keyboard operation, touch layouts, and reduced-motion preferences.

## Run locally

No package install or build step is required. From the repository root, start any static file server. For example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Serving the files over HTTP is recommended instead of opening `index.html` directly so browser module and asset loading behave the same way they do on GitHub Pages.

The production site consists of root `index.html`, `css/`, and `js/` files. Node.js is used only by CI to run `node --check` against every `js/*.js` file before deployment.

## Source and fidelity

The primary technical source is:

- Kento Tatsuno, Daisuke Miyashita, Taiga Ikeda, Kiyoshi Ishiyama, Kazunari Sumiyoshi, and Jun Deguchi, ["AiSAQ: All-in-Storage ANNS with Product Quantization for DRAM-free Information Retrieval"](https://arxiv.org/pdf/2404.06004v2), arXiv:2404.06004v2.

Claims tied to the paper are cited in the interface by section, figure, or table. The yard, forklifts, moving query, timing, block shapes, and small example graph are teaching metaphors—not a benchmark trace or a literal rendering of the implementation. Any values marked as illustrative are not paper results. Consult the paper for the algorithm, experimental setup, qualifications, and exact measurements.

## Deploy with GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Open the **Actions** tab and let **Deploy static site to Pages** finish, or run it manually with **Run workflow**.
4. Follow the deployment URL shown in the workflow summary. For a project repository, it normally has the form `https://OWNER.github.io/REPOSITORY/`.

The workflow validates all files matching `js/*.js`, assembles only `index.html`, `css/`, `js/`, and `.nojekyll` into the Pages artifact, and deploys only after validation succeeds. `.nojekyll` keeps the published tree explicitly static.
