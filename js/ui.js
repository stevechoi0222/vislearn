(function () {
  "use strict";

  const content = window.AISAQ_CONTENT;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const number = new Intl.NumberFormat("en-US");

  function table(id) { return content.benchmarkTables.find((item) => item.id === id); }
  function presetByLabel(label) { return content.blockPackingPresets.find((item) => item.label === label); }

  function datasetStats(label) {
    const memory = table("table-2").rows.find((row) => row[0] === label);
    const load = table("table-3").rows.find((row) => row[0] === label);
    const dataset = table("table-1");
    const col = dataset.columns.indexOf(label);
    const vectors = dataset.rows[0][col];
    const degree = Number(dataset.rows[4][col]);
    const preset = presetByLabel(label);
    return {
      label,
      vectors,
      vectorCount: Number(vectors.replaceAll(",", "")),
      degree,
      diskannMemory: Number(memory[2].replaceAll(",", "")),
      aisaqMemory: Number(memory[3].replaceAll(",", "")),
      diskannLoad: Number(load[1].replaceAll(",", "")),
      aisaqLoad: Number(load[2].replaceAll(",", "")),
      preset,
    };
  }

  function initRoute(sim) {
    const list = $("#route-list");
    content.stages.forEach((stage, index) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = String(index);
      button.innerHTML = `<span>${index + 1}</span><strong>${stage.navLabel || stage.short}</strong>`;
      button.addEventListener("click", () => sim.goTo(index));
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  function phasesFor(stage) {
    if (Array.isArray(stage.phases) && stage.phases.length) return stage.phases;
    return [{
      id: `${stage.id}-overview`,
      label: stage.navLabel || stage.short || stage.title,
      shared: stage.summary || stage.body,
      diskann: stage.body || stage.summary,
      aisaq: stage.body || stage.summary,
      difference: stage.learningGoal || "The methods use different data placement while following the same learning stop.",
      cue: "stage-overview",
    }];
  }

  function phaseIndexFor(sim, stage) {
    const phases = phasesFor(stage);
    const index = typeof sim.phaseIndex === "function" ? Number(sim.phaseIndex()) : 0;
    return Math.max(0, Math.min(phases.length - 1, Number.isFinite(index) ? index : 0));
  }

  function phaseFor(sim, stage) {
    const fromSimulation = typeof sim.currentPhase === "function" ? sim.currentPhase() : null;
    return fromSimulation || phasesFor(stage)[phaseIndexFor(sim, stage)];
  }

  function clamp01(value) {
    const numeric = Number(value);
    return Math.max(0, Math.min(1, Number.isFinite(numeric) ? numeric : 0));
  }

  function traceSnapshot(sim, state, stage) {
    if (typeof sim.traceSnapshot === "function") {
      try {
        const snapshot = sim.traceSnapshot();
        if (snapshot && typeof snapshot === "object") return snapshot;
      } catch (_error) {
        // The text trace remains useful when a renderer/model revision lacks trace data.
      }
    }
    const phase = phaseFor(sim, stage);
    return {
      stageIndex: state.stageIndex,
      stageId: stage.id,
      phaseIndex: phaseIndexFor(sim, stage),
      phase,
      phaseProgress: typeof sim.phaseProgress === "function" ? sim.phaseProgress() : state.progress,
      scene: { family: phase.cue || "teaching-trace", stateLabel: phase.label },
      currentEvent: null,
      completedEvents: [],
      allEvents: [],
    };
  }

  function hardwareSnapshot(sim) {
    if (typeof sim.hardwareSnapshot !== "function") return null;
    try {
      const snapshot = sim.hardwareSnapshot();
      return snapshot && typeof snapshot === "object" ? snapshot : null;
    } catch (_error) {
      return null;
    }
  }

  function componentStepFor(hardware) {
    const flow = hardware?.componentFlow;
    if (!flow || typeof flow !== "object") return null;
    if (flow.activeStep && typeof flow.activeStep === "object") return flow.activeStep;
    const stepId = String(flow.activeStep || hardware?.componentStep || "").trim();
    return Array.isArray(flow.steps)
      ? flow.steps.find((step) => String(step?.id || "") === stepId) || null
      : null;
  }

  function componentMeta(hardware) {
    const flow = hardware?.componentFlow && typeof hardware.componentFlow === "object"
      ? hardware.componentFlow
      : null;
    const activeStep = componentStepFor(hardware);
    return {
      activeStep,
      step: String(hardware?.componentStep || activeStep?.id || flow?.activeStep || "").trim(),
      title: String(hardware?.componentTitle || activeStep?.title || flow?.title || "").trim(),
      note: String(hardware?.componentNote || activeStep?.note || flow?.note || "").trim(),
      coreMapping: String(flow?.coreMapping || "").trim(),
      payload: String(hardware?.componentPayload || activeStep?.payload || flow?.payload || "").trim(),
      source: activeStep?.source || hardware?.source,
      destination: activeStep?.destination || hardware?.destination,
      geometryStatus: String(hardware?.geometryStatus || activeStep?.geometryStatus || flow?.geometryStatus || "illustrative").trim(),
    };
  }

  function gpuComponentRoute(hardware) {
    const component = componentMeta(hardware);
    const source = String(component.source || "").toLowerCase();
    const destination = String(component.destination || "").toLowerCase();
    const step = component.step.toLowerCase();
    const hasSource = (token) => source.includes(token);
    const hasDestination = (token) => destination.includes(token);
    const sourceIsCore = hasSource("core-cluster") || hasSource("gpu.compute");
    const destinationIsCore = hasDestination("core-cluster") || hasDestination("gpu.compute");

    if (hasSource("pcie") && hasDestination("memory-controller")) return "memory-ingress";
    if (hasSource("memory-controller") && hasDestination("vram")) return "vram-write";
    if (hasSource("vram") && hasDestination("memory-controller")) return "vram-read";
    if (hasSource("memory-controller") && destinationIsCore) return "core-dispatch";
    if (sourceIsCore && (hasDestination("reducer") || hasDestination("result-buffer"))) return "core-reduce";
    if ((sourceIsCore || hasSource("result-buffer")) && (hasDestination("host.result") || hasDestination("host-result"))) return "result-return";
    if (step.includes("vram-write") || step.includes("memory-fill")) return "vram-write";
    if (step.includes("vram-read")) return "vram-read";
    if (step.includes("core-dispatch")) return "core-dispatch";
    if (step.includes("core-reduce") || step.includes("reduce")) return "core-reduce";
    if (step.includes("result-return") || step.includes("gpu-host")) return "result-return";
    if (step.includes("memory-ingress") || step.includes("pcie-memory")) return "memory-ingress";
    return "";
  }

  function storageComponentRoute(hardware) {
    const component = componentMeta(hardware);
    const source = String(component.source || "").toLowerCase();
    const destination = String(component.destination || "").toLowerCase();
    const step = component.step.toLowerCase();
    const from = (token) => source.includes(token);
    const to = (token) => destination.includes(token);
    const fromSsdController = from("ssd.controller") || from("ssd.nvme-controller");
    const toSsdController = to("ssd.controller") || to("ssd.nvme-controller");
    const fromDramInput = from("dram.input-port") || from("dram.dimm-input");
    const toDramInput = to("dram.input-port") || to("dram.dimm-input");
    const fromPayloadRegion = from("dram.payload-region") || from("dram.scratch-region") || from("dram.global-pq-region");
    const toPayloadRegion = to("dram.payload-region") || to("dram.scratch-region") || to("dram.global-pq-region");

    if (to("ssd.pcie-endpoint")) return "ssd-pcie-ingress";
    if (from("ssd.pcie-endpoint") && toSsdController) return "ssd-controller-ingress";
    if (fromSsdController && to("ssd.command-queue")) return "ssd-command-queue";
    if (from("ssd.command-queue") && to("ssd.flash-channel")) return "ssd-flash-dispatch";
    if (from("ssd.flash-channel") && to("ssd.nand-package")) return "ssd-package-select";
    if (from("ssd.nand-package") && to("ssd.nand-die")) return "ssd-die-read";
    if (from("ssd.nand-die") && to("ssd.return-buffer")) return "ssd-return-assemble";
    if (from("ssd.return-buffer") && toDramInput) return "storage-handoff";
    if (from("ssd.return-buffer")) return "ssd-return-out";
    if (toDramInput) return "dram-ingress";
    if (fromDramInput && to("dram.package")) return "dram-package-route";
    if (from("dram.package") && to("dram.logical-bank")) return "dram-bank-select";
    if (from("dram.logical-bank") && toPayloadRegion) return "dram-payload-place";
    if (fromPayloadRegion && to("dram.output-port")) return "dram-output";
    if (from("dram.output-port")) return "dram-to-compute";
    if (step.includes("ssd-pcie")) return "ssd-pcie-ingress";
    if (step.includes("command-queue")) return "ssd-command-queue";
    if (step.includes("flash-channel")) return "ssd-flash-dispatch";
    if (step.includes("nand-package")) return "ssd-package-select";
    if (step.includes("nand-die")) return "ssd-die-read";
    if (step.includes("return-buffer")) return "ssd-return-assemble";
    if (step.includes("dram-input")) return "dram-ingress";
    if (step.includes("dram-package")) return "dram-package-route";
    if (step.includes("dram-bank")) return "dram-bank-select";
    if (step.includes("payload-region")) return "dram-payload-place";
    if (step.includes("dram-output")) return "dram-output";
    return "";
  }

  function hardwareCopy(hardware, phase) {
    const component = componentMeta(hardware);
    const gpuActive = hardware?.gpu?.active === true;
    let resolvedCopy = null;
    if (gpuActive) {
      const componentRoute = gpuComponentRoute(hardware);
      if (componentRoute === "vram-read") {
        resolvedCopy = [
          "VRAM banks feed the GPU memory controller",
          "The selected VRAM banks expose the illustrative operand copy before the controller dispatches work toward the core clusters.",
        ];
      } else if (componentRoute === "vram-write") {
        resolvedCopy = [
          "The GPU memory controller fills VRAM banks",
          "The controller places the illustrative operand copy into visible VRAM banks; this transfer is outside the evaluated CPU paper path.",
        ];
      } else if (componentRoute === "core-dispatch") {
        resolvedCopy = [
          "The memory controller dispatches work to GPU core clusters",
          "Illustrative work tiles receive operands from the GPU memory path. Their physical scheduling is a teaching abstraction, not an AiSAQ paper claim.",
        ];
      } else if (componentRoute === "core-reduce") {
        resolvedCopy = [
          "GPU core clusters reduce partial distances",
          "The highlighted clusters feed a compact result buffer; only the resulting scalar state needs to return to the host.",
        ];
      } else if (componentRoute === "result-return") {
        resolvedCopy = [
          "The GPU result buffer returns scalar state",
          "The illustrative accelerator sends a compact result back to the host-owned candidate or exact-score ledger.",
        ];
      } else if (componentRoute === "memory-ingress") {
        resolvedCopy = [
          "PCIe delivers operands to the GPU memory controller",
          "The controller accepts a host-prepared illustrative copy; the canonical query q remains host-resident.",
        ];
      }

      const gpuCopy = {
        "dram-join": [
          "Operands leave DRAM for PCIe",
          "Host-prepared scoring operands depart system DRAM. The canonical query q remains host-side; this GPU-assist route is illustrative.",
        ],
        "inline-unpack": [
          "Operands arrive in VRAM from PCIe",
          "An illustrative operand copy crosses PCIe into VRAM; this transfer is separate from the CPU-based AiSAQ paper path.",
        ],
        "pq-score": [
          "VRAM feeds the GPU scorer",
          "The GPU scores the illustrative operand copy in VRAM; the evaluated AiSAQ path performs this work on the CPU.",
        ],
        "exact-score": [
          "The GPU computes an illustrative exact score during expansion",
          "While full vector(p) is active, the illustrative GPU path produces ID(p) plus scalar exact distance; this is not the evaluated AiSAQ path.",
        ],
        "queue-commit": [
          "A scalar result returns to host state",
          "The GPU-assist route commits only the scalar result to the host-owned candidate or exact-score ledger.",
        ],
      };
      if (!resolvedCopy && gpuCopy[hardware?.beat]) resolvedCopy = gpuCopy[hardware.beat];
    }

    if (!resolvedCopy) {
      const storageCopy = {
        "ssd-pcie-ingress": [
          "The SSD PCIe endpoint receives the logical read",
          "The logical request reaching the SSD is canonical; this endpoint's internal placement and shape are illustrative.",
        ],
        "ssd-controller-ingress": [
          "The SSD controller accepts symbolic LBA(p)",
          "The controller handoff teaches request ownership. It does not assert a vendor-specific controller pipeline.",
        ],
        "ssd-command-queue": [
          "The SSD command queue holds the node read",
          "The requested logical span is canonical; queue depth, slot position, and scheduling order are illustrative.",
        ],
        "ssd-flash-dispatch": [
          "A flash channel carries the internal read",
          "This channel path is illustrative. The trace does not invent a physical channel number or NAND address.",
        ],
        "ssd-package-select": [
          "The controller selects a NAND package",
          "The package selection visualizes an internal SSD hop; only the node-chunk read at symbolic LBA(p) is canonical.",
        ],
        "ssd-die-read": [
          "A NAND die exposes the requested node bytes",
          "The node-chunk payload is canonical, while package and die geometry remain an illustrative cutaway.",
        ],
        "ssd-return-assemble": [
          "The SSD return buffer assembles the read unit",
          "Aligned logical unit(s) return to the host; this internal buffer layout is illustrative.",
        ],
        "ssd-return-out": [
          "The SSD return buffer sends data toward host DRAM",
          "The upward data return is canonical. The depicted internal egress path is illustrative.",
        ],
        "storage-handoff": [
          "The SSD return buffer hands the read to DRAM",
          "The aligned data return into reusable host scratch is canonical; both endpoint geometries are illustrative.",
        ],
        "dram-ingress": [
          "DRAM accepts the returned read at its input port",
          "The data landing in reusable host scratch is canonical; package routing shown inside DRAM is illustrative.",
        ],
        "dram-package-route": [
          "The DRAM package routes the scratch write",
          "This package-level path is a teaching cutaway, not a claim about a specific memory module or controller.",
        ],
        "dram-bank-select": [
          "A logical DRAM bank receives the scratch payload",
          "The reusable scratch lifetime is canonical; the selected bank and internal address are deliberately illustrative.",
        ],
        "dram-payload-place": [
          "The payload region holds the returned fields",
          "Full vector, neighbor IDs, and any inline PQ bytes preserve the trace's data-placement truth; their bank layout is illustrative.",
        ],
        "dram-output": [
          "The DRAM output port exposes active operands",
          "The CPU receives the correct logical operands; this internal output lane is illustrative.",
        ],
        "dram-to-compute": [
          "DRAM sends active operands toward compute",
          "The source tier and payload are canonical, while the visible package-to-processor wiring is illustrative.",
        ],
      };
      const storageRoute = storageComponentRoute(hardware);
      const dramAccessCopy = {
        "dram-join": {
          "dram-package-route": [
            "DRAM routes a resident-PQ lookup",
            "Neighbor IDs select matching entries already resident in DiskANN's global PQ array; the shown package route is illustrative.",
          ],
          "dram-bank-select": [
            "A logical DRAM bank marks the resident-PQ access",
            "The global-DRAM PQ source is canonical for DiskANN; this selected bank and its address are illustrative.",
          ],
          "dram-payload-place": [
            "The resident global-PQ region exposes matching codes",
            "These PQ codes were already in DRAM. They did not arrive with the current SSD node block.",
          ],
          "dram-output": [
            "DRAM sends matching PQ codes toward the CPU LUT",
            "The source tier and operands are canonical; the visible DIMM output lane is illustrative.",
          ],
        },
        "inline-unpack": {
          "dram-package-route": [
            "DRAM routes an access to returned scratch",
            "The neighbor IDs and inline PQ bytes are already in reusable scratch; this package route is illustrative.",
          ],
          "dram-bank-select": [
            "A logical DRAM bank marks the scratch read",
            "Scratch residency is canonical for this hop; the selected bank and its address are illustrative.",
          ],
          "dram-payload-place": [
            "The scratch payload exposes inline neighbor PQ codes",
            "These codes arrived in the current AiSAQ node chunk and remain in reusable scratch for this hop.",
          ],
          "dram-output": [
            "DRAM sends inline PQ operands toward the CPU LUT",
            "The inline-code source is canonical; the visible DIMM output lane is illustrative.",
          ],
        },
      };
      resolvedCopy = dramAccessCopy[hardware?.beat]?.[storageRoute]
        || storageCopy[storageRoute]
        || null;
    }

    const copy = {
      inspect: ["See where every byte waits", "The hardware stays fixed while the active addresses and resident buffers are highlighted."],
      request: ["CPU asks NVMe for node p", "A small command travels toward the SSD. The query q does not travel with it."],
      "nand-read": ["The SSD gathers node p from NAND", "The controller resolves symbolic LBA(p) and assembles the requested node bytes inside the drive."],
      "block-return": ["NVMe writes the 4 KiB read into DRAM", "The large data block returns by DMA into reusable host scratch; it does not pass through CPU registers."],
      "dram-join": ["DiskANN gathers PQ codes from DRAM", "Neighbor IDs from the SSD block address matching entries in the resident global PQ array."],
      "inline-unpack": ["AiSAQ opens PQ codes inside the returned block", "The neighbor IDs and their inline PQ bytes already meet in reusable DRAM scratch."],
      "pq-score": ["The CPU turns PQ bytes into scalar distances", "The common lookup table performs the same approximate-distance role for both index layouts."],
      "exact-score": ["The CPU scores the full vector immediately", "Exact distance is computed during expansion, while the full vector is still in DRAM scratch."],
      "queue-commit": ["Only an ID and scalar distance remain", "The host candidate or exact-score ledger keeps compact scalar state, not the moving 4 KiB payload."],
      "scratch-release": ["DRAM scratch becomes empty and reusable", "The host buffer lifetime ends. The SSD copy remains unchanged and is not deleted."],
      "block-pack": ["Watch the node cross 4 KiB boundaries", "Inline PQ bytes can enlarge an AiSAQ node read by one or more aligned logical units."],
      evidence: ["Compare the measured system costs", "The paper reports memory and index-load measurements; the 3D hardware route remains a teaching abstraction."],
    };
    if (!resolvedCopy) {
      resolvedCopy = copy[hardware?.beat]
        || [phase?.label || "Follow the active hardware path", phase?.shared || "The current trace event is highlighted in the server cutaway."];
    }
    const mappingNote = component.coreMapping && component.step.toLowerCase().includes("core")
      ? `${resolvedCopy[1]} ${component.coreMapping}`
      : resolvedCopy[1];
    return [resolvedCopy[0] || component.title, mappingNote || component.note];
  }

  function routeEndpoint(value, fallback) {
    const raw = String(value || "");
    const text = raw.toLowerCase();
    if (text.includes("request-queue")) return "Host request queue";
    if (text.includes("ssd.pcie-endpoint")) return "SSD · PCIe endpoint";
    if (text.includes("ssd.command-queue")) return "SSD · command queue";
    if (text.includes("ssd.flash-channel")) return "SSD · flash channel";
    if (text.includes("ssd.nand-package")) return "SSD · NAND package";
    if (text.includes("ssd.nand-die")) return "SSD · NAND die";
    if (text.includes("ssd.return-buffer")) return "SSD · return buffer";
    if (text.includes("ssd.controller") || text.includes("ssd.nvme-controller")) return "SSD controller";
    if (text.includes("ssd.nand") || text.includes("lba(p)")) return "SSD · NAND";
    if (text.includes("dram.input-port") || text.includes("dram.dimm-input")) return "DRAM · input port";
    if (text.includes("dram.package")) return "DRAM · package";
    if (text.includes("dram.logical-bank")) return "DRAM · logical bank";
    if (text.includes("dram.payload-region") || text.includes("dram.scratch-region")) return "DRAM · scratch payload";
    if (text.includes("dram.global-pq-region")) return "DRAM · global PQ region";
    if (text.includes("dram.output-port")) return "DRAM · output port";
    if (text.includes("dram.scratch") || text.includes("scratch-pool")) return "DRAM scratch";
    if (text.includes("dram.pq-array")) return "DRAM · PQ array";
    if (text.includes("cpu.cache")) return "CPU · cache slices";
    if (text.includes("cpu.lut") || text.includes("lut-unit") || text.includes("lut-lane")) return "CPU · PQ lookup lane";
    if (text.includes("cpu.exact") || text.includes("exact-unit") || text.includes("exact-lane")) return "CPU · exact-distance lane";
    if (text.includes("cpu.core")) return "CPU · core tiles";
    if (text.includes("cpu.reducer")) return "CPU · result reducer";
    if (text.includes("cpu.result")) return "CPU · result lane";
    if (text.includes("seen-ids")) return "Seen-ID set";
    if (text.includes("candidate-list")) return "Candidate list L";
    if (text.includes("exact-score")) return "Exact-score ledger";
    if (text.includes("host.results") || text.includes("host.result")) return "Host result";
    if (text.includes("gpu.memory-controller")) return "GPU · memory controller";
    if (text.includes("gpu.vram")) return "GPU · VRAM banks";
    if (text.includes("gpu.core") || text.includes("gpu.compute")) return "GPU · core clusters";
    if (text.includes("gpu.reducer")) return "GPU · result reducer";
    if (text.includes("gpu.result")) return "GPU · result buffer";
    if (text.includes("gpu.pcie")) return "GPU · PCIe endpoint";
    if (text.includes("host.pcie") || text.includes("pcie")) return "PCIe / NVMe";
    if (text.includes("paper") || text.includes("reader")) return "Paper evidence";
    return raw.split("+")[0].trim() || fallback;
  }

  function routePayload(hardware) {
    const component = componentMeta(hardware);
    if (component.payload) return component.payload;
    if (hardware?.gpu?.active) {
      const componentRoute = gpuComponentRoute(hardware);
      if (componentRoute === "memory-ingress") return "Host operands entering the GPU memory path";
      if (componentRoute === "vram-write") return "Illustrative operand copy written across VRAM banks";
      if (componentRoute === "vram-read") return "Selected VRAM operands returning to the controller";
      if (componentRoute === "core-dispatch") return "VRAM operands dispatched as core-cluster work";
      if (componentRoute === "core-reduce") return "Parallel partial distances reduced to scalar state";
      if (componentRoute === "result-return") return "Scalar result returning to host state";
      const gpu = {
        "dram-join": "Illustrative scoring operands",
        "inline-unpack": "Operand copy entering VRAM",
        "pq-score": "PQ operands → scalar distances",
        "exact-score": "Full vector → scalar exact distance",
        "queue-commit": "Scalar result returning to host",
      };
      if (gpu[hardware.beat]) return gpu[hardware.beat];
    }
    const storagePayload = {
      "ssd-pcie-ingress": "Logical node read entering the SSD",
      "ssd-controller-ingress": "Symbolic LBA(p) and logical span",
      "ssd-command-queue": "Queued logical node read",
      "ssd-flash-dispatch": "Internal read command · no physical address invented",
      "ssd-package-select": "Illustrative NAND-package selection",
      "ssd-die-read": "Requested node-chunk bytes",
      "ssd-return-assemble": "Aligned logical read unit(s)",
      "ssd-return-out": "Node data returning toward host DRAM",
      "storage-handoff": "Aligned read unit(s) crossing into DRAM scratch",
      "dram-ingress": "Returned node data entering reusable scratch",
      "dram-package-route": "Scratch-write payload",
      "dram-bank-select": "Reusable scratch allocation",
      "dram-payload-place": "Full vector + neighbor IDs + optional inline PQ",
      "dram-output": "Active scoring operands",
      "dram-to-compute": "Logical operands leaving host DRAM",
    };
    const storageRoute = storageComponentRoute(hardware);
    const dramAccessPayload = {
      "dram-join": {
        "dram-package-route": "Logical lookup keyed by neighbor IDs",
        "dram-bank-select": "Logical access to resident global PQ state",
        "dram-payload-place": "Resident global PQ codes for r neighbors",
        "dram-output": "r matching PQ codes toward the CPU LUT",
      },
      "inline-unpack": {
        "dram-package-route": "Logical access to returned scratch",
        "dram-bank-select": "Scratch-resident neighbor/PQ fields",
        "dram-payload-place": "Neighbor IDs + inline PQ codes already in scratch",
        "dram-output": "r inline PQ operands toward the CPU LUT",
      },
    };
    const storageComponentPayload = dramAccessPayload[hardware?.beat]?.[storageRoute]
      || storagePayload[storageRoute];
    if (storageComponentPayload) return storageComponentPayload;
    const payload = {
      inspect: "Resident addresses and reusable buffers",
      request: "Logical node read · q stays host-side",
      "nand-read": "Node-chunk bytes at symbolic LBA(p)",
      "block-return": "Aligned 4 KiB read unit(s)",
      "dram-join": "Neighbor IDs + resident PQ codes",
      "inline-unpack": "Neighbor IDs + inline PQ codes",
      "pq-score": "PQ bytes → scalar distances",
      "exact-score": "Full vector → scalar exact distance",
      "queue-commit": "ID + scalar distance only",
      "scratch-release": "Reusable buffer capacity",
      "block-pack": "Node chunk across 4 KiB units",
      evidence: "Paper-reported system costs",
    };
    return payload[hardware?.beat] || "Current trace payload";
  }

  function renderHardwareHeadline(sim, phase) {
    const hardware = hardwareSnapshot(sim);
    const component = componentMeta(hardware);
    const movement = hardwareCopy(hardware, phase);
    $("#scene-action-label").textContent = movement[0];
    $("#scene-shared-cue").textContent = movement[1];
    $("#scene-route-source").textContent = routeEndpoint(component.source, "Fixed hardware");
    $("#scene-route-destination").textContent = routeEndpoint(component.destination, "Active buffer");
    $("#scene-route-payload").textContent = routePayload(hardware);
    const stageWrap = $(".stage-wrap");
    stageWrap.dataset.hardwareBeat = hardware?.beat || "inspect";
    stageWrap.dataset.componentStep = component.step || "overview";
    stageWrap.dataset.geometryStatus = component.geometryStatus;
    return hardware;
  }

  function phaseSpan(sim, stage) {
    if (typeof sim.phaseSpan === "function") {
      try {
        const span = sim.phaseSpan();
        if (span && Number.isFinite(Number(span.start)) && Number.isFinite(Number(span.end))) {
          return { start: clamp01(span.start), end: clamp01(span.end) };
        }
      } catch (_error) {
        // Fall through to the content-derived phase weights.
      }
    }
    const phases = phasesFor(stage);
    const weights = phases.map((phase) => {
      const value = Number(phase.duration ?? phase.weight);
      return Number.isFinite(value) && value > 0 ? value : 1;
    });
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    const index = phaseIndexFor(sim, stage);
    const start = weights.slice(0, index).reduce((sum, value) => sum + value, 0) / total;
    const end = weights.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / total;
    return { start, end };
  }

  function eventBucket(event) {
    const source = String(event?.source || "").toLowerCase();
    const destination = String(event?.destination || "").toLowerCase();
    const payload = String(event?.payload || "").toLowerCase();
    const direction = String(event?.direction || "").toLowerCase();
    if (source.includes("request-queue") || destination.includes(".ssd") || payload.includes("logical read") || direction === "down") return "request";
    if (source.includes(".ssd") || payload.includes("4 kib unit") || direction === "up") return "return";
    return "compute";
  }

  function chooseLaneEvent(events, bucket) {
    const matching = events.filter((event) => eventBucket(event) === bucket);
    return matching.find((event) => event.status === "current")
      || [...matching].reverse().find((event) => event.status === "completed")
      || matching.find((event) => event.status === "pending")
      || null;
  }

  function writeTraceLane(bucket, event, fallback) {
    const lane = $(`#trace-${bucket}-lane`);
    const route = $(`#trace-${bucket}-route`);
    if (!lane || !route) return;
    const status = event?.status || fallback.status;
    lane.dataset.status = ["pending", "current", "completed"].includes(status) ? status : "pending";
    const source = event?.source || fallback.source;
    const destination = event?.destination || fallback.destination;
    route.textContent = `${source} → ${destination}`;

    if (bucket === "request") {
      $("#trace-request-address").textContent = event?.destination
        ? `Address: ${event.destination}`
        : "Address is symbolic unless supplied by the trace.";
    } else if (bucket === "return") {
      $("#trace-return-payload").textContent = event?.payload || fallback.payload;
    } else {
      const payload = String(event?.payload || fallback.payload);
      const target = String(event?.destination || "");
      if (payload.includes("scalar exact distance") || target.includes("exact-score")) {
        $("#trace-candidate-queue").textContent = `Exact-score ledger · ${payload}`;
      } else if (target.includes("seen-ids") || payload.toLowerCase().includes("dedup")) {
        $("#trace-candidate-queue").textContent = `Seen-ID set · ${payload}`;
      } else if (payload.includes("scalar PQ distance")) {
        $("#trace-candidate-queue").textContent = `Candidate list L · ${payload}`;
      } else {
        $("#trace-candidate-queue").textContent = "Host state · L, seen IDs, exact-score ledger";
      }
    }
  }

  function renderTrace(state, stage, sim) {
    const snapshot = traceSnapshot(sim, state, stage);
    const hardware = hardwareSnapshot(sim);
    const phase = snapshot.phase || phaseFor(sim, stage);
    const events = Array.isArray(snapshot.allEvents)
      ? snapshot.allEvents
      : Array.isArray(snapshot.events)
        ? snapshot.events
        : [];
    const progress = clamp01(snapshot.phaseProgress ?? snapshot.progress ?? (typeof sim.phaseProgress === "function" ? sim.phaseProgress() : state.progress));
    const percent = Math.round(progress * 100);
    $("#trace-progress").textContent = `${percent}%`;
    $("#trace-scrubber-value").textContent = `${percent}%`;
    const scrubber = $("#trace-scrubber");
    if (scrubber.dataset.scrubbing !== "true") scrubber.value = String(Math.round(progress * 1000));
    scrubber.setAttribute("aria-valuetext", `${percent}% through ${phase?.label || "the current phase"}`);

    const fallbacks = {
      request: { status: events.length ? "pending" : "current", source: "host.request-queue", destination: "logical node-chunk address" },
      return: { status: "pending", source: "SSD block", destination: "reusable DRAM scratch", payload: "Full vector + degree + neighbor IDs" },
      compute: { status: "pending", source: "CPU LUT scorer", destination: "host.candidate-list", payload: "ID + scalar PQ distance + expansion flag" },
    };
    ["request", "return", "compute"].forEach((bucket) => writeTraceLane(bucket, chooseLaneEvent(events, bucket), fallbacks[bucket]));

    if (hardware?.computePath === "gpu-assist" && hardware?.gpu?.active) {
      const requestLane = $("#trace-request-lane");
      const returnLane = $("#trace-return-lane");
      const computeLane = $("#trace-compute-lane");
      const storageStatus = state.stageIndex >= 2 ? "completed" : "pending";
      requestLane.dataset.status = storageStatus;
      returnLane.dataset.status = storageStatus;
      computeLane.dataset.status = "current";
      $("#trace-compute-label").textContent = "GPU assist · illustrative";
      $("#trace-compute-route").textContent = `${hardware.source} → ${hardware.destination}`;
      $("#trace-candidate-queue").textContent = hardware.payload;
    } else {
      $("#trace-compute-label").textContent = "Compute / commit";
    }

    const current = snapshot.currentEvent || events.find((event) => event.status === "current") || [...events].reverse().find((event) => event.status === "completed") || null;
    $("#trace-event-id").textContent = hardware?.gpu?.active ? `gpu-assist/${hardware.beat}` : current?.id || "not supplied";
    $("#trace-event-window").textContent = current && Number.isFinite(Number(current.start)) && Number.isFinite(Number(current.end))
      ? `${Math.round(Number(current.start) * 100)}–${Math.round(Number(current.end) * 100)}% of phase`
      : "phase-relative";
    $("#trace-fact-status").textContent = hardware?.gpu?.active ? "illustrative" : current?.factStatus || "illustrative trace";
    const exactEvent = [...events].reverse().find((event) => String(event.payload || "").includes("ID + scalar exact distance"));
    $("#trace-exact-queue").textContent = exactEvent?.payload || "Exact node ID + exact scalar distance (re-rank)";
    $("#dock-phase-label").textContent = snapshot.stateLabel || snapshot.scene?.stateLabel || phase?.label || stage.title;

    const movement = hardwareCopy(hardware, phase);
    const summary = `Visual summary. Stage ${state.stageIndex + 1}. ${movement[0]}. ${movement[1]} Candidate list L, the seen-ID set, and the exact-score ledger remain separate host-side state.`;
    $("#canvas-phase-summary").textContent = summary;
    $("#yard").setAttribute("aria-label", `${summary} Teaching trace assumes a cache miss; CPU and OS caches are omitted.`);
    return snapshot;
  }

  function renderStage(state, stage) {
    $(".stage-wrap").dataset.stage = stage.id;
    $("#hud-station").textContent = `${state.stageIndex + 1} / ${content.stages.length}`;
    $("#stage-count").textContent = `Stop ${state.stageIndex + 1} of ${content.stages.length}`;
    $("#stage-source-short").textContent = stage.sourceLabel.replace(/^Paper\s*/i, "").split("—")[0].trim();
    $("#stage-title").textContent = stage.title;
    $("#stage-short").textContent = stage.summary || stage.short;
    $("#stage-body").textContent = stage.body || stage.summary;
    $("#stage-source").href = stage.sourceUrl;
    $("#stage-source").innerHTML = `${stage.sourceLabel} <span aria-hidden="true">↗</span>`;
    $("#checkpoint-prompt").textContent = stage.checkpoint.prompt;
    $("#checkpoint-reveal-copy").textContent = stage.checkpoint.reveal;
    $("#checkpoint-hint").textContent = `If this is fuzzy: ${stage.checkpoint.confusionHint}`;
    $("#checkpoint-answer").hidden = true;
    $("#checkpoint").classList.remove("active");
    $("#checkpoint").removeAttribute("aria-current");
    $(".guide-body").scrollTop = 0;
    $$("#route-list button").forEach((button, index) => {
      if (index === state.stageIndex) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function renderActionList(state, stage, activeIndex, sim) {
    const list = $("#phase-list");
    const phases = phasesFor(stage);
    if (list.dataset.stage !== String(state.stageIndex)) {
      list.innerHTML = "";
      const stageIndex = state.stageIndex;
      phases.forEach((phase, index) => {
        const item = document.createElement("li");
        item.dataset.phaseIndex = String(index);
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<span>${index + 1}</span><strong></strong>`;
        $("strong", button).textContent = phase.label;
        button.addEventListener("click", () => {
          if (typeof sim.goToPhase === "function") sim.goToPhase(stageIndex, index);
        });
        item.appendChild(button);
        list.appendChild(item);
      });
      list.dataset.stage = String(state.stageIndex);
    }
    $$("li", list).forEach((item, index) => {
      const button = $("button", item);
      item.classList.toggle("active", index === activeIndex);
      if (index === activeIndex) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function renderPhase(state, stage, sim, announce) {
    const phases = phasesFor(stage);
    const index = phaseIndexFor(sim, stage);
    const phase = phaseFor(sim, stage);
    const progress = typeof sim.phaseProgress === "function" ? sim.phaseProgress() : state.progress;
    const count = phases.length;
    const actionCount = `Action ${index + 1} of ${count}`;

    $("#scene-action-count").textContent = `Stage ${state.stageIndex + 1} · Action ${index + 1}/${count}`;
    $("#hud-action").textContent = `${index + 1} / ${count}`;
    $("#hud-query").textContent = state.stageIndex === 0
      ? "index inspection"
      : state.stageIndex <= 4
        ? "query run"
        : state.stageIndex === 5
          ? "derivation"
          : "evidence";
    const hardware = renderHardwareHeadline(sim, phase);
    $("#guide-action-count").textContent = actionCount;
    $("#guide-action-label").textContent = phase.label;
    $("#phase-common").textContent = phase.shared;
    $("#phase-diskann").textContent = phase.diskann;
    $("#phase-aisaq").textContent = phase.aisaq;
    $("#phase-difference").textContent = phase.difference;
    $("#learning-guide").dataset.cue = phase.cue;
    $("#learning-guide").style.setProperty("--action-progress", String(Math.min(1, Math.max(0, progress))));
    renderActionList(state, stage, index, sim);

    if (announce) {
      $(".guide-body").scrollTop = 0;
      $("#phase-live").textContent = `Stage ${state.stageIndex + 1}, ${actionCount}: ${phase.label}. ${phase.shared}`;
    }
    return hardware;
  }

  function renderDwell(state, sim, motion) {
    const snapshot = typeof sim.dwellSnapshot === "function" ? sim.dwellSnapshot() : null;
    const active = Boolean(snapshot?.active);
    const fallbackProgress = typeof sim.phaseProgress === "function" ? sim.phaseProgress() : state.progress;
    const progress = active ? clamp01(snapshot.progress) : clamp01(fallbackProgress);
    $("#dwell-bar").style.transform = `scaleX(${progress})`;
    $("#dwell").classList.toggle("is-holding", active);

    const badge = $("#scene-dwell-state");
    if (active) {
      const label = snapshot.kind === "stage" ? "Read this stage" : "Read this action";
      badge.textContent = `${label} · ${Math.max(0, Number(snapshot.remaining) || 0).toFixed(1)}s`;
    } else if (!state.playing) {
      badge.textContent = "Paused · inspect this step";
    } else {
      badge.textContent = "Watch the highlighted route";
    }
    if (motion && typeof motion.dwell === "function") motion.dwell(snapshot);
  }

  function renderPlayback(state, sim, motion) {
    const label = state.playing ? "Pause" : "Play";
    $("#play-label").textContent = label;
    $("#play-icon").textContent = state.playing ? "Ⅱ" : "▶";
    $("#play").setAttribute("aria-label", `${label} simulation`);
    const fullRun = $("#tour-start");
    fullRun.textContent = state.autoTour ? "Running full path" : state.stageIndex === 0 && state.progress < .01 ? "Run full path" : "Run from start";
    fullRun.setAttribute("aria-pressed", String(Boolean(state.autoTour)));
    renderDwell(state, sim, motion);
    $("#tour-progress").style.transform = `scaleX(${Math.min(1, sim.overallProgress())})`;
  }

  function renderDataset(label, syncLab) {
    const stats = datasetStats(label);
    const preset = stats.preset;
    $("#diskann-memory").textContent = `${number.format(stats.diskannMemory)} MB`;
    $("#aisaq-memory").textContent = `${number.format(stats.aisaqMemory)} MB`;
    $("#diskann-codes").textContent = `${number.format(stats.vectorCount)} PQ codes resident`;
    $("#aisaq-codes").textContent = `≤ R + n_ep codes · ${stats.degree + 1} if n_ep = 1`;
    $("#block-count").textContent = `${preset.derived.diskannBlocksPerNodeRead.value} → ${preset.derived.aisaqBlocksPerNodeRead.value}`;
    if (syncLab) setLabPreset(preset);
  }

  function initEvidence() {
    const memoryTable = table("table-2");
    const values = memoryTable.rows.flatMap((row) => [Number(row[2].replaceAll(",", "")), Number(row[3].replaceAll(",", ""))]);
    const maxLog = Math.log10(Math.max(...values) + 1);
    const target = $("#memory-bars");
    memoryTable.rows.forEach((row) => {
      const disk = Number(row[2].replaceAll(",", ""));
      const aisaq = Number(row[3].replaceAll(",", ""));
      const item = document.createElement("div");
      item.className = "memory-row";
      item.innerHTML = `
        <strong>${row[0]}</strong>
        <div class="bar-pair">
          <div class="bar-line diskann"><i style="width:${Math.max(2, Math.log10(disk + 1) / maxLog * 100)}%"></i><span><b>DiskANN</b><b>${number.format(disk)} MB</b></span></div>
          <div class="bar-line aisaq"><i style="width:${Math.max(2, Math.log10(aisaq + 1) / maxLog * 100)}%"></i><span><b>AiSAQ</b><b>${number.format(aisaq)} MB</b></span></div>
        </div>`;
      target.appendChild(item);
    });

    const loadBody = $("#load-time-body");
    table("table-3").rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${row[0]}</td><td>${row[1]} ms</td><td>${row[2]} ms</td>`;
      loadBody.appendChild(tr);
    });
  }

  function createBlockCell(blockIndex, totalBytes, baseBytes, blockSize, isAiSAQ) {
    const start = blockIndex * blockSize;
    const used = Math.max(0, Math.min(blockSize, totalBytes - start));
    const cell = document.createElement("div");
    cell.className = "block-cell";
    cell.setAttribute("aria-label", `Block ${blockIndex + 1}: ${number.format(used)} of ${number.format(blockSize)} bytes used`);
    const fill = document.createElement("i");
    fill.className = "block-fill";
    fill.style.width = `${used / blockSize * 100}%`;
    if (isAiSAQ && totalBytes > baseBytes) {
      const pqStart = Math.max(start, baseBytes);
      const pqEnd = Math.min(start + used, totalBytes);
      const pqUsed = Math.max(0, pqEnd - pqStart);
      if (pqUsed > 0) {
        const pq = document.createElement("i");
        pq.className = "pq-fill";
        pq.style.left = `${Math.max(0, (pqStart - start) / Math.max(used, 1) * 100)}%`;
        pq.style.width = `${pqUsed / Math.max(used, 1) * 100}%`;
        pq.style.right = "auto";
        fill.appendChild(pq);
      }
    }
    cell.appendChild(fill);
    return cell;
  }

  function renderBlocks(track, totalBytes, baseBytes, isAiSAQ) {
    track.innerHTML = "";
    const blockSize = 4096;
    const count = Math.max(1, Math.ceil(totalBytes / blockSize));
    for (let i = 0; i < count; i += 1) track.appendChild(createBlockCell(i, totalBytes, baseBytes, blockSize, isAiSAQ));
  }

  function updateLab() {
    const full = Number($("#full-bytes").value);
    const degree = Number($("#degree").value);
    const pq = Number($("#pq-bytes").value);
    const diskBytes = full + 4 * (degree + 1);
    const aisaqBytes = diskBytes + degree * pq;
    const diskBlocks = Math.ceil(diskBytes / 4096);
    const aisaqBlocks = Math.ceil(aisaqBytes / 4096);

    $("#full-bytes-output").textContent = number.format(full);
    $("#degree-output").textContent = String(degree);
    $("#pq-bytes-output").textContent = number.format(pq);
    $("#diskann-chunk").textContent = `${number.format(diskBytes)} B`;
    $("#aisaq-chunk").textContent = `${number.format(aisaqBytes)} B`;
    $("#diskann-blocks").textContent = `${diskBlocks} block${diskBlocks === 1 ? "" : "s"}`;
    $("#aisaq-blocks").textContent = `${aisaqBlocks} block${aisaqBlocks === 1 ? "" : "s"}`;
    renderBlocks($("#diskann-track"), diskBytes, diskBytes, false);
    renderBlocks($("#aisaq-track"), aisaqBytes, diskBytes, true);

    const difference = aisaqBlocks - diskBlocks;
    const verdict = $("#block-verdict");
    if (difference === 0) {
      verdict.innerHTML = `<strong>Same 4 KB block span.</strong> Inline PQ codes still fit in ${aisaqBlocks === 1 ? "one block" : `${aisaqBlocks} blocks`} for this layout.`;
    } else {
      verdict.innerHTML = `<strong>${difference} extra block${difference === 1 ? "" : "s"} per node chunk.</strong> Inline PQ codes expand the read from ${diskBlocks} to ${aisaqBlocks} blocks in this layout.`;
    }
  }

  function setLabPreset(preset) {
    if (!preset) return;
    $("#full-bytes").value = String(preset.derived.fullVectorBytes.value);
    $("#degree").value = String(preset.paperInputs.maximumOutdegreeR);
    $("#pq-bytes").value = String(preset.paperInputs.pqVectorBytes);
    $$("[data-preset]").forEach((button) => button.classList.toggle("active", button.dataset.preset === preset.label));
    updateLab();
  }

  function initLab() {
    ["#full-bytes", "#degree", "#pq-bytes"].forEach((selector) => $(selector).addEventListener("input", () => {
      $$("[data-preset]").forEach((button) => button.classList.remove("active"));
      updateLab();
    }));
    $$("[data-preset]").forEach((button) => button.addEventListener("click", () => setLabPreset(presetByLabel(button.dataset.preset))));
    setLabPreset(presetByLabel("SIFT1B"));
  }

  function initQuiz() {
    const form = $("#quiz-form");
    content.quiz.forEach((question) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "quiz-question";
      fieldset.dataset.question = question.id;
      const legend = document.createElement("legend");
      legend.textContent = question.prompt;
      const options = document.createElement("div");
      options.className = "quiz-options";
      question.options.forEach((option) => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="radio" name="${question.id}" value="${option.id}"><span>${option.text}</span>`;
        options.appendChild(label);
      });
      const feedback = document.createElement("p");
      feedback.className = "quiz-feedback";
      feedback.hidden = true;
      fieldset.append(legend, options, feedback);
      form.appendChild(fieldset);
    });

    $("#check-quiz").addEventListener("click", () => {
      let score = 0;
      content.quiz.forEach((question) => {
        const fieldset = $(`[data-question="${question.id}"]`);
        const choice = $(`input[name="${question.id}"]:checked`, fieldset);
        const feedback = $(".quiz-feedback", fieldset);
        $$(".quiz-options span", fieldset).forEach((span) => span.classList.remove("correct", "incorrect"));
        const correctInput = $(`input[value="${question.answerId}"]`, fieldset);
        correctInput.nextElementSibling.classList.add("correct");
        if (choice && choice.value === question.answerId) {
          score += 1;
          feedback.textContent = `Correct. ${question.explanation}`;
        } else {
          if (choice) choice.nextElementSibling.classList.add("incorrect");
          feedback.textContent = `${choice ? "Not quite." : "Choose an answer first."} ${question.explanation}`;
        }
        feedback.hidden = false;
      });
      $("#quiz-score").textContent = `${score} / ${content.quiz.length} correct`;
    });

    $("#reset-quiz").addEventListener("click", () => {
      form.reset();
      $$(".quiz-options span", form).forEach((span) => span.classList.remove("correct", "incorrect"));
      $$(".quiz-feedback", form).forEach((feedback) => { feedback.hidden = true; feedback.textContent = ""; });
      $("#quiz-score").textContent = "";
    });
  }

  function bindControls(sim) {
    const shell = $(".sim-shell");
    function pinSimulationViewport() {
      if (window.scrollY >= shell.offsetHeight) return;
      const restore = () => {
        const root = document.documentElement;
        const previousBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, 0);
        root.style.scrollBehavior = previousBehavior;
      };
      requestAnimationFrame(() => { restore(); requestAnimationFrame(restore); });
    }
    shell.addEventListener("click", pinSimulationViewport);

    $("#play").addEventListener("click", () => sim.playPause());
    $("#previous").addEventListener("click", () => {
      if (typeof sim.previous === "function") sim.previous();
      else if (typeof sim.goTo === "function") sim.goTo(Math.max(0, Number(sim.state?.stageIndex || 0) - 1));
    });
    $("#next").addEventListener("click", () => sim.next());
    $("#replay-phase").addEventListener("click", () => {
      if (typeof sim.replayPhase === "function") {
        sim.replayPhase();
        return;
      }
      const span = phaseSpan(sim, sim.stage || content.stages[sim.state?.stageIndex || 0]);
      if (typeof sim.setProgress === "function") sim.setProgress(span.start);
      else {
        sim.state.progress = span.start;
        sim.state.playing = false;
        if (typeof sim.emit === "function") sim.emit("replay");
      }
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !sim.state.playing) sim.playPause();
    });
    $("#restart").addEventListener("click", () => sim.restart());
    $("#speed").addEventListener("input", (event) => sim.setSpeed(event.target.value));
    $("#dataset-select").addEventListener("change", (event) => sim.setDataset(event.target.value));
    const computePath = $("#compute-path-select");
    if (computePath) {
      computePath.addEventListener("change", (event) => {
        if (typeof sim.setComputePath === "function") sim.setComputePath(event.target.value);
        else {
          sim.state.computePath = event.target.value === "gpu-assist" ? "gpu-assist" : "paper";
          if (typeof sim.emit === "function") sim.emit("computePath");
        }
      });
    }
    $("#follow").addEventListener("change", (event) => sim.setToggle("follow", event.target.checked));
    $("#labels").addEventListener("change", (event) => sim.setToggle("labels", event.target.checked));
    $("#research-mode").addEventListener("change", (event) => {
      document.body.dataset.detail = event.target.checked ? "research" : "beginner";
      event.target.setAttribute("aria-checked", String(event.target.checked));
    });
    $$('[data-view]').forEach((button) => button.addEventListener("click", () => sim.setView(button.dataset.view)));

    const scrubber = $("#trace-scrubber");
    function scrubTo(value) {
      const stage = sim.stage || content.stages[sim.state?.stageIndex || 0];
      const span = phaseSpan(sim, stage);
      const fraction = clamp01(Number(value) / 1000);
      const target = fraction >= 1
        ? Math.max(span.start, span.end - 1e-6)
        : span.start + fraction * Math.max(0, span.end - span.start);
      if (typeof sim.setProgress === "function") sim.setProgress(target);
      else {
        sim.state.progress = clamp01(target);
        sim.state.playing = false;
        if (typeof sim.emit === "function") sim.emit("scrub");
      }
    }
    scrubber.addEventListener("pointerdown", () => { scrubber.dataset.scrubbing = "true"; });
    scrubber.addEventListener("input", (event) => {
      scrubber.dataset.scrubbing = "true";
      scrubTo(event.target.value);
    });
    ["change", "pointerup", "pointercancel", "blur"].forEach((name) => scrubber.addEventListener(name, () => {
      delete scrubber.dataset.scrubbing;
    }));
    $("#checkpoint-reveal").addEventListener("click", () => {
      if (sim.state.playing) sim.playPause();
      $("#checkpoint-answer").hidden = false;
      $("#checkpoint").classList.add("active");
    });
    $("#checkpoint-continue").addEventListener("click", () => {
      document.activeElement?.blur();
      sim.resume();
    });

    const panelToggle = $("#panel-toggle");
    const guideHandle = $("#guide-handle");
    const guide = $("#learning-guide");
    const guideBody = $("#guide-body");
    const canvas = $("#yard");
    function setGuideVisible(visible, userInitiated) {
      shell.classList.toggle("guide-hidden", !visible);
      panelToggle.setAttribute("aria-expanded", String(visible));
      panelToggle.textContent = visible ? "Hide inspector" : "Show inspector";
      guideHandle.setAttribute("aria-expanded", String(visible));
      guideHandle.querySelector("span").textContent = visible ? "Close learning inspector" : "Open learning inspector";
      guideBody.inert = !visible;
      if (!visible && !window.matchMedia("(max-width: 760px)").matches) guide.setAttribute("aria-hidden", "true");
      else guide.removeAttribute("aria-hidden");
      if (userInitiated) guide.dataset.userToggled = "true";
      canvas.dispatchEvent(new CustomEvent("aisaq:panel-visibility", { detail: { visible } }));
    }
    panelToggle.addEventListener("click", () => setGuideVisible(shell.classList.contains("guide-hidden"), true));
    guideHandle.addEventListener("click", () => setGuideVisible(shell.classList.contains("guide-hidden"), true));
    const compactGuide = window.matchMedia("(max-width: 760px)");
    setGuideVisible(!compactGuide.matches, false);
    const syncGuideBreakpoint = (event) => {
      if (!guide.dataset.userToggled) setGuideVisible(!event.matches, false);
    };
    if (typeof compactGuide.addEventListener === "function") compactGuide.addEventListener("change", syncGuideBreakpoint);
    else if (typeof compactGuide.addListener === "function") compactGuide.addListener(syncGuideBreakpoint);

    window.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); sim.playPause(); }
      else if (event.code === "ArrowRight") sim.next();
      else if (event.code === "ArrowLeft") sim.previous();
      else if (event.key.toLowerCase() === "r") sim.restart();
      else if (event.key.toLowerCase() === "f") { $("#follow").click(); }
      else if (event.key.toLowerCase() === "l") { $("#labels").click(); }
    });
  }

  function initMenu() {
    const button = $("#top-menu");
    const nav = $("#mobile-nav");
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      nav.hidden = open;
    });
    $$("a", nav).forEach((link) => link.addEventListener("click", () => {
      button.setAttribute("aria-expanded", "false");
      nav.hidden = true;
    }));
  }

  function renderView(state) {
    $(".stage-wrap").dataset.view = state.view;
    $("#learning-guide").dataset.view = state.view;
    $("#hud-line").textContent = state.view === "split" ? "Both" : state.view === "diskann" ? "DiskANN" : "AiSAQ";
    $$("[data-method]").forEach((row) => {
      const prioritized = state.view !== "split" && row.dataset.method === state.view;
      row.classList.toggle("prioritized", prioritized);
    });
    $$('[data-view]').forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderComputePath(state) {
    const value = state.computePath === "gpu-assist" ? "gpu-assist" : "paper";
    document.body.dataset.computePath = value;
    const select = $("#compute-path-select");
    if (select && select.value !== value) select.value = value;
    const note = $("#compute-path-note");
    if (note) {
      note.textContent = value === "gpu-assist"
        ? "Illustrative accelerator path: DRAM → PCIe → VRAM → GPU → host result. This is not the evaluated AiSAQ path."
        : "Paper path: NVMe returns the read into system DRAM and the CPU performs the evaluated search work; GPU stays off-path.";
    }
  }

  function bindAiSAQUI(sim) {
    initRoute(sim);
    initEvidence();
    initLab();
    initQuiz();
    initMenu();
    bindControls(sim);
    const motion = typeof window.createAiSAQMotion === "function"
      ? window.createAiSAQMotion()
      : null;

    let lastPhaseKey = null;
    let lastStageIndex = null;

    function surfaceCheckpoint(stage) {
      const checkpoint = $("#checkpoint");
      checkpoint.classList.add("active");
      checkpoint.setAttribute("aria-current", "step");
      $("#phase-live").textContent = `Checkpoint after ${stage.title}. ${stage.checkpoint.prompt}`;
      requestAnimationFrame(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const behavior = reduced ? "auto" : "smooth";
        const guideBody = $(".guide-body");
        const bodyRect = guideBody.getBoundingClientRect();
        const checkpointRect = checkpoint.getBoundingClientRect();
        const centered = guideBody.scrollTop + checkpointRect.top - bodyRect.top - (guideBody.clientHeight - checkpointRect.height) / 2;
        guideBody.scrollTo({ top: Math.max(0, centered), behavior });
        if (!guideBody.inert && checkpoint.offsetParent !== null) $("#checkpoint-reveal").focus({ preventScroll: true });
      });
    }

    sim.subscribe((state, stage, reason) => {
      const stageChanged = lastStageIndex === null || lastStageIndex !== state.stageIndex;
      const renderedStage = stageChanged || ["init", "stage", "restart", "runAll", "complete"].includes(reason);
      if (renderedStage) renderStage(state, stage);
      const phase = phaseFor(sim, stage);
      const phaseKey = `${state.stageIndex}:${phase.id}`;
      const isActualTransition = lastPhaseKey !== null && phaseKey !== lastPhaseKey;
      const hardware = renderPhase(state, stage, sim, isActualTransition);
      lastPhaseKey = phaseKey;
      lastStageIndex = state.stageIndex;
      if (reason === "checkpoint") surfaceCheckpoint(stage);
      renderTrace(state, stage, sim);
      if (renderedStage && motion && typeof motion.stage === "function") motion.stage();
      if ((isActualTransition || ["init", "stage", "restart", "runAll", "replay"].includes(reason)) && motion && typeof motion.phase === "function") motion.phase();
      if (motion && typeof motion.beat === "function") motion.beat(hardware?.beat);
      renderPlayback(state, sim, motion);
      if (["init", "dataset"].includes(reason)) renderDataset(state.dataset, reason === "dataset");
      if (["init", "speed"].includes(reason)) $("#speed-value").textContent = `${state.speed}×`;
      if (["init", "view"].includes(reason)) renderView(state);
      if (["init", "computePath"].includes(reason)) renderComputePath(state);
    });

    return {
      updateProgress(state) {
        renderDwell(state, sim, motion);
        $("#tour-progress").style.transform = `scaleX(${Math.min(1, sim.overallProgress())})`;
        const hardware = renderHardwareHeadline(sim, phaseFor(sim, sim.stage || content.stages[state.stageIndex]));
        renderTrace(state, sim.stage || content.stages[state.stageIndex], sim);
        if (motion && typeof motion.beat === "function") motion.beat(hardware?.beat);
      },
    };
  }

  window.bindAiSAQUI = bindAiSAQUI;
})();
