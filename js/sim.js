(function () {
  "use strict";

  const EPSILON = 1e-8;
  const DWELL_SECONDS = Object.freeze({
    phase: 1.4,
    stage: 2.2,
  });
  const HARDWARE_BEATS = new Set([
    "inspect", "request", "nand-read", "block-return", "dram-join", "inline-unpack",
    "pq-score", "exact-score", "queue-commit", "scratch-release", "block-pack", "evidence",
  ]);
  const CAMERA_BY_BEAT = {
    inspect: "overview",
    request: "ssd-controller",
    "nand-read": "ssd-nand",
    "block-return": "dram-scratch",
    "dram-join": "dram-pq-array",
    "inline-unpack": "dram-scratch",
    "pq-score": "cpu-lut",
    "exact-score": "cpu-exact",
    "queue-commit": "host-queues",
    "scratch-release": "dram-scratch",
    "block-pack": "ssd-blocks",
    evidence: "evidence-panel",
  };
  const GPU_ROUTE = [
    { beat: "dram-join", source: "host.dram", destination: "host.pcie", cameraTarget: "pcie", payload: "host-prepared scoring operands; canonical q remains host-resident" },
    { beat: "inline-unpack", source: "host.pcie", destination: "gpu.vram", cameraTarget: "gpu-vram", payload: "illustrative operand transfer into VRAM; not a paper event" },
    { beat: "pq-score", source: "gpu.vram", destination: "gpu.compute", cameraTarget: "gpu-compute", payload: "illustrative GPU-assisted scoring over host-prepared operands" },
    { beat: "queue-commit", source: "gpu.compute", destination: "host.result", cameraTarget: "host-result", payload: "scalar result returns to host-owned search state" },
  ];

  class AiSAQSimulation {
    constructor(stages) {
      this.stages = Array.isArray(stages) && stages.length
        ? stages
        : [{ id: "empty", title: "Simulation", duration: 1, phases: [{ id: "empty" }] }];
      this.state = {
        stageIndex: 0,
        progress: 0,
        playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        speed: 1,
        view: "split",
        follow: true,
        labels: true,
        dataset: "SIFT1B",
        computePath: "paper",
        autoTour: false,
        elapsed: 0,
        checkpointPaused: false,
      };
      this.checkedStages = new Set();
      this.listeners = new Set();
      this._dwell = null;
      this._dwellBoundary = null;
      if (this.state.playing) this._startDwell();
    }

    get stage() { return this.stages[this.state.stageIndex]; }

    _phases(stage) {
      const source = stage || this.stage;
      if (source && Array.isArray(source.phases) && source.phases.length) return source.phases;
      return [{
        id: source && source.id ? `${source.id}-phase` : "stage-phase",
        title: source && (source.title || source.short) ? (source.title || source.short) : "Stage",
        duration: source && source.duration,
      }];
    }

    _timeline(stage) {
      const phases = this._phases(stage);
      const weights = phases.map((phase) => {
        const duration = Number(phase && phase.duration);
        const weight = Number(phase && phase.weight);
        if (Number.isFinite(duration) && duration > 0) return duration;
        return Number.isFinite(weight) && weight > 0 ? weight : 1;
      });
      const total = weights.reduce((sum, weight) => sum + weight, 0) || phases.length || 1;
      let cursor = 0;
      const spans = weights.map((weight, index) => {
        const start = cursor / total;
        cursor += weight;
        return {
          phase: phases[index],
          start,
          end: index === weights.length - 1 ? 1 : cursor / total,
        };
      });
      return spans.length ? spans : [{ phase: null, start: 0, end: 1 }];
    }

    phaseIndex() {
      const timeline = this._timeline();
      const progress = Math.max(0, Math.min(1, Number(this.state.progress) || 0));
      if (progress >= 1 - EPSILON) return timeline.length - 1;
      const index = timeline.findIndex((span) => progress < span.end - EPSILON);
      return index < 0 ? timeline.length - 1 : index;
    }

    phaseProgress() {
      const timeline = this._timeline();
      const span = timeline[this.phaseIndex()];
      const progress = Math.max(0, Math.min(1, Number(this.state.progress) || 0));
      if (progress >= 1 - EPSILON) return 1;
      const length = Math.max(EPSILON, span.end - span.start);
      return Math.max(0, Math.min(1, (progress - span.start) / length));
    }

    currentPhase() {
      const timeline = this._timeline();
      return timeline[this.phaseIndex()].phase;
    }

    phaseSpan(stageIndex, phaseIndex) {
      const hasStage = stageIndex !== undefined && stageIndex !== null && Number.isFinite(Number(stageIndex));
      const requestedStage = hasStage ? Math.trunc(Number(stageIndex)) : this.state.stageIndex;
      const targetStage = Math.max(0, Math.min(this.stages.length - 1, requestedStage));
      const timeline = this._timeline(this.stages[targetStage]);
      const hasPhase = phaseIndex !== undefined && phaseIndex !== null && Number.isFinite(Number(phaseIndex));
      const requestedPhase = hasPhase
        ? Math.trunc(Number(phaseIndex))
        : (targetStage === this.state.stageIndex ? this.phaseIndex() : 0);
      const targetPhase = Math.max(0, Math.min(timeline.length - 1, requestedPhase));
      const span = timeline[targetPhase];
      const progress = targetStage === this.state.stageIndex && targetPhase === this.phaseIndex()
        ? this.phaseProgress()
        : 0;
      return {
        stageIndex: targetStage,
        phaseIndex: targetPhase,
        phase: span.phase,
        start: span.start,
        end: span.end,
        progress,
      };
    }

    traceSnapshot() {
      const span = this.phaseSpan();
      const phase = span.phase || {};
      const trace = phase.trace || {};
      const sourceEvents = Array.isArray(trace.events) ? trace.events : [];
      const phaseProgress = span.progress;
      const allEvents = sourceEvents.map((event, index) => {
        const start = Math.max(0, Math.min(1, Number(event.at) || 0));
        const nextAt = sourceEvents[index + 1] && Number(sourceEvents[index + 1].at);
        const end = Number.isFinite(nextAt) ? Math.max(start, Math.min(1, nextAt)) : 1;
        const completed = phaseProgress >= 1 - EPSILON || phaseProgress >= end - EPSILON;
        const current = !completed && phaseProgress >= start - EPSILON;
        const eventProgress = completed
          ? 1
          : current
            ? Math.max(0, Math.min(1, (phaseProgress - start) / Math.max(EPSILON, end - start)))
            : 0;
        return Object.assign({}, event, {
          index,
          start,
          end,
          status: completed ? "completed" : current ? "current" : "pending",
          progress: eventProgress,
        });
      });
      const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const presets = window.AISAQ_CONTENT && Array.isArray(window.AISAQ_CONTENT.blockPackingPresets)
        ? window.AISAQ_CONTENT.blockPackingPresets
        : [];
      const selected = normalize(this.state.dataset);
      const preset = presets.find((item) => normalize(item.id) === selected || normalize(item.label) === selected);
      const dataset = preset ? {
        id: preset.id,
        label: preset.label,
        paperInputs: preset.paperInputs,
        derivationAssumptions: preset.derivationAssumptions,
        derived: preset.derived,
      } : null;
      return {
        stageIndex: this.state.stageIndex,
        stageId: this.stage && this.stage.id,
        phaseIndex: span.phaseIndex,
        phase,
        sceneFamily: trace.sceneFamily || "layout",
        stateLabel: trace.stateLabel || phase.label || "TRACE",
        scene: {
          family: trace.sceneFamily || "layout",
          stateLabel: trace.stateLabel || phase.label || "TRACE",
        },
        phaseProgress,
        progress: phaseProgress,
        currentEvent: allEvents.find((event) => event.status === "current") || null,
        completedEvents: allEvents.filter((event) => event.status === "completed"),
        events: allEvents,
        allEvents,
        dataset,
      };
    }

    _safeHardwareText(value) {
      return String(value || "")
        .replace(/\bLBA\s*(?:[=:#]\s*|\s+)\d+\b/gi, "LBA(p)")
        .replace(/\brequest(?:\s+id)?\s*(?:[=:#]\s*|\s+)\d+\b/gi, "request");
    }

    _hardwareMethod(event) {
      if (event && ["diskann", "aisaq"].includes(event.lane)) return event.lane;
      const path = `${event && event.source || ""} ${event && event.destination || ""}`.toLowerCase();
      const diskann = path.includes("diskann");
      const aisaq = path.includes("aisaq");
      if (diskann !== aisaq) return diskann ? "diskann" : "aisaq";
      return "both";
    }

    _hardwareBeat(event, snapshot) {
      const phase = snapshot.phase || {};
      const scene = snapshot.sceneFamily;
      const eventProgress = event ? Math.max(0, Math.min(1, Number(event.progress) || 0)) : snapshot.phaseProgress;
      const text = `${event && event.id || ""} ${event && event.label || ""} ${event && event.source || ""} ${event && event.destination || ""} ${event && event.payload || ""}`.toLowerCase();
      if (scene === "pack") return { beat: "block-pack", progress: eventProgress };
      if (scene === "evidence") return { beat: "evidence", progress: eventProgress };
      if (scene === "layout") return { beat: "inspect", progress: eventProgress };
      if (/release.*scratch|scratch.*release|scratch-pool|scratch capacity reusable|reuse scratch/.test(text)) {
        return { beat: "scratch-release", progress: eventProgress };
      }
      if (event && event.direction === "down") {
        const split = 0.58;
        return eventProgress < split
          ? { beat: "request", progress: eventProgress / split }
          : { beat: "nand-read", progress: (eventProgress - split) / (1 - split) };
      }
      if (event && event.direction === "up" && /(ssd|lba\(p\)|nand)/.test(text) && /scratch/.test(text)) {
        return { beat: "block-return", progress: eventProgress };
      }
      if (/cache[- ]miss/.test(text)) return { beat: "request", progress: eventProgress };
      if (/inline|scratch\.inline-pq|co-located/.test(text) && !/compute pq|scalar approximate/.test(text)) {
        return { beat: "inline-unpack", progress: eventProgress };
      }
      if (/dram\.pq-array|gather|join id|matching global pq/.test(text) && !/compute pq|scalar approximate/.test(text)) {
        return { beat: "dram-join", progress: eventProgress };
      }
      if (/candidate-list|seen-ids|exact-score-ledger|exact-sorter|host\.results|host\.result|commit|prune|merge|return top|select top k/.test(text)) {
        return { beat: "queue-commit", progress: eventProgress };
      }
      if (/cpu\.exact|compute exact|full vector\(p\).*scalar exact|q × full vector/.test(text)) {
        return { beat: "exact-score", progress: eventProgress };
      }
      if (/cpu\.lut|pq distance|pq-distance|approximate score|scalar approximate|centroid lookup|score entrypoint/.test(text)) {
        return { beat: "pq-score", progress: eventProgress };
      }
      const fallback = event
        ? "inspect"
        : scene === "score"
          ? "pq-score"
          : scene === "commit"
            ? (phase.id === "record-current-vector" ? "exact-score" : "queue-commit")
            : scene === "read" && phase.id === "dispatch-read"
              ? "request"
              : "inspect";
      return { beat: fallback, progress: eventProgress };
    }

    _gpuHardwareSnapshot(snapshot) {
      const scaled = Math.max(0, Math.min(1, snapshot.phaseProgress)) * GPU_ROUTE.length;
      const index = Math.min(GPU_ROUTE.length - 1, Math.floor(scaled));
      const route = GPU_ROUTE[index];
      const progress = snapshot.phaseProgress >= 1 - EPSILON ? 1 : scaled - index;
      const exact = snapshot.phase && snapshot.phase.id === "record-current-vector";
      return {
        beat: index === 2 && exact ? "exact-score" : route.beat,
        method: "both",
        source: route.source,
        destination: route.destination,
        payload: index === 2 && exact
          ? "illustrative GPU-assisted exact scoring over host-prepared operands during expansion; canonical q remains host-resident"
          : route.payload,
        progress,
        phaseProgress: snapshot.phaseProgress,
        cameraTarget: route.cameraTarget,
        factStatus: "illustrative",
        cacheMiss: false,
        computePath: "gpu-assist",
        queryResidency: "host",
        gpu: {
          active: true,
          reason: "illustrative opt-in; not in evaluated AiSAQ query path",
          hop: index,
          route: ["host.dram", "host.pcie", "gpu.vram", "gpu.compute", "host.result"],
        },
      };
    }

    hardwareSnapshot() {
      const snapshot = this.traceSnapshot();
      const event = snapshot.currentEvent
        || snapshot.completedEvents[snapshot.completedEvents.length - 1]
        || snapshot.events[0]
        || null;
      const inferred = this._hardwareBeat(event, snapshot);
      const method = this._hardwareMethod(event);
      const prefix = method === "both" ? "shared" : method;
      let source = this._safeHardwareText(event && event.source || "host.trace");
      let destination = this._safeHardwareText(event && event.destination || "host.trace");
      let payload = this._safeHardwareText(event && event.payload || snapshot.stateLabel || "Inspect trace state");
      if (inferred.beat === "request") {
        source = /request-queue/.test(source) ? source : (method === "both" ? "host.request-queue" : `${prefix}.host.request-queue`);
        destination = /(ssd|lba\(p\))/.test(destination.toLowerCase()) ? destination : `${prefix}.ssd.controller`;
        payload = `${payload}; aligned logical node read travels down toward symbolic LBA(p); q remains host-side`;
      } else if (inferred.beat === "nand-read") {
        source = `${prefix}.ssd.controller`;
        destination = `${prefix}.ssd.nand`;
        payload = "read the node-chunk bytes addressed by symbolic LBA(p); q remains host-side";
      } else if (inferred.beat === "block-return") {
        source = /(ssd|lba\(p\)|nand)/.test(source.toLowerCase()) ? source : `${prefix}.ssd.nand`;
        destination = /scratch/.test(destination.toLowerCase()) ? destination : `${prefix}.dram.scratch`;
        payload = `${payload}; aligned 4 KiB unit(s) travel up into reusable DRAM scratch`;
      } else if (inferred.beat === "exact-score") {
        payload = `${payload}; exact distance is computed during expansion and only ID + scalar exact distance is retained`;
      } else if (inferred.beat === "scratch-release") {
        destination = "host.scratch-pool";
        payload = "release reusable scratch capacity after exact scoring; the SSD index copy is unchanged and is not deleted";
      }
      if (/host\.query/i.test(source) && /(ssd|nand|lba\(p\))/i.test(destination)) {
        source = method === "both" ? "host.request-queue" : `${prefix}.host.request-queue`;
        payload = `${payload}; canonical q remains at host.query and is not transported`;
      }
      if (!HARDWARE_BEATS.has(inferred.beat)) inferred.beat = "inspect";
      const cacheMiss = inferred.beat === "request" || inferred.beat === "nand-read" || inferred.beat === "block-return" || /cache[- ]miss/.test(`${payload} ${event && event.label || ""}`.toLowerCase());
      const paper = {
        beat: inferred.beat,
        method,
        source,
        destination,
        payload,
        progress: Math.max(0, Math.min(1, inferred.progress)),
        phaseProgress: snapshot.phaseProgress,
        cameraTarget: CAMERA_BY_BEAT[inferred.beat] || "overview",
        factStatus: event && event.factStatus || "illustrative",
        cacheMiss,
        computePath: "paper",
        queryResidency: "host",
        gpu: {
          active: false,
          reason: "not in evaluated AiSAQ query path",
        },
      };
      if (this.state.computePath !== "gpu-assist") return paper;
      const gpuPhase = snapshot.phase && ["seed-entrypoint", "compute-pq-distance", "record-current-vector"].includes(snapshot.phase.id);
      if (gpuPhase) return this._gpuHardwareSnapshot(snapshot);
      return Object.assign({}, paper, {
        computePath: "gpu-assist",
        gpu: {
          active: false,
          reason: "armed; current storage or host beat remains on the paper hardware path",
          route: ["host.dram", "host.pcie", "gpu.vram", "gpu.compute", "host.result"],
        },
      });
    }

    subscribe(listener) {
      this.listeners.add(listener);
      listener(this.state, this.stage, "init");
      return () => this.listeners.delete(listener);
    }

    emit(reason) {
      this.listeners.forEach((listener) => listener(this.state, this.stage, reason));
    }

    _boundaryAtCurrentProgress() {
      const progress = Math.max(0, Math.min(1, Number(this.state.progress) || 0));
      if (progress >= 1 - EPSILON) return null;
      if (progress <= EPSILON) {
        return {
          kind: "stage",
          key: `stage:${this.state.stageIndex}`,
        };
      }
      const timeline = this._timeline();
      for (let index = 1; index < timeline.length; index += 1) {
        if (Math.abs(progress - timeline[index].start) <= EPSILON) {
          return {
            kind: "phase",
            key: `phase:${this.state.stageIndex}:${index}`,
          };
        }
      }
      return null;
    }

    _startDwell() {
      const boundary = this._boundaryAtCurrentProgress();
      if (!boundary) return false;
      const duration = DWELL_SECONDS[boundary.kind];
      this._dwellBoundary = boundary.key;
      this._dwell = {
        kind: boundary.kind,
        duration,
        remaining: duration,
      };
      return true;
    }

    _ensureBoundaryDwell() {
      const boundary = this._boundaryAtCurrentProgress();
      if (!boundary || boundary.key === this._dwellBoundary) return false;
      return this._startDwell();
    }

    _clearDwell(forgetBoundary) {
      this._dwell = null;
      if (forgetBoundary) this._dwellBoundary = null;
    }

    dwellSnapshot() {
      if (!this._dwell) {
        return Object.freeze({
          active: false,
          kind: null,
          progress: 0,
          remaining: 0,
          duration: 0,
        });
      }
      const duration = this._dwell.duration;
      const remaining = Math.max(0, Math.min(duration, this._dwell.remaining));
      return Object.freeze({
        active: true,
        kind: this._dwell.kind,
        progress: Math.max(0, Math.min(1, (duration - remaining) / duration)),
        remaining,
        duration,
      });
    }

    update(seconds) {
      const state = this.state;
      const delta = Math.max(0, Number(seconds) || 0);
      if (!state.playing || delta <= 0) return false;

      if (this._ensureBoundaryDwell()) {
        this.emit("dwell");
        return true;
      }

      if (this._dwell) {
        const consumed = Math.min(delta, this._dwell.remaining);
        this._dwell.remaining = Math.max(0, this._dwell.remaining - consumed);
        state.elapsed += consumed;
        if (this._dwell.remaining <= EPSILON) {
          this._clearDwell(false);
          this.emit("dwell");
        }
        return true;
      }

      const stageDuration = Number(this.stage && this.stage.duration);
      const timeline = this._timeline();
      const phaseDuration = timeline.reduce((sum, span) => {
        const value = Number(span.phase && (span.phase.duration ?? span.phase.weight));
        return sum + (Number.isFinite(value) && value > 0 ? value : 1);
      }, 0);
      const duration = Number.isFinite(stageDuration) && stageDuration > 0
        ? stageDuration
        : Math.max(1, phaseDuration);

      const phaseIndex = this.phaseIndex();
      const phaseEnd = timeline[phaseIndex].end;
      const nextProgress = state.progress + (delta * state.speed) / duration;
      if (nextProgress < phaseEnd - EPSILON) {
        state.progress = nextProgress;
        state.elapsed += delta;
        return true;
      }

      const progressToBoundary = Math.max(0, phaseEnd - state.progress);
      state.elapsed += progressToBoundary * duration / Math.max(EPSILON, state.speed);
      state.progress = phaseEnd;

      if (phaseEnd < 1 - EPSILON) {
        this._startDwell();
        this.emit("phase");
        return true;
      }

      if (state.progress >= 1 - EPSILON) {
        if (state.autoTour && state.stageIndex < this.stages.length - 1) {
          this.checkedStages.add(state.stageIndex);
          state.stageIndex += 1;
          state.progress = 0;
          state.checkpointPaused = false;
          state.playing = true;
          this._startDwell();
          this.emit("stage");
          return true;
        }
        state.progress = 1;
        state.playing = false;
        state.checkpointPaused = true;
        state.autoTour = false;
        this.checkedStages.add(state.stageIndex);
        this.emit("checkpoint");
      }
      return true;
    }

    playPause() {
      const state = this.state;
      state.autoTour = false;
      if (state.progress >= 1 - EPSILON) {
        if (state.stageIndex < this.stages.length - 1) {
          this.resume();
          return;
        }
        this.restart();
        state.playing = true;
        this._ensureBoundaryDwell();
        this.emit("play");
        return;
      }
      state.checkpointPaused = false;
      state.playing = !state.playing;
      if (state.playing) this._ensureBoundaryDwell();
      this.emit("play");
    }

    next() {
      const state = this.state;
      state.autoTour = false;
      this._clearDwell(true);
      const timeline = this._timeline();
      const index = this.phaseIndex();
      state.playing = false;
      state.checkpointPaused = false;

      if (index < timeline.length - 1 && state.progress < 1 - EPSILON) {
        state.progress = timeline[index + 1].start;
        this.emit("phase");
        return;
      }

      if (state.stageIndex < this.stages.length - 1) {
        state.stageIndex += 1;
        state.progress = 0;
        this.emit("stage");
        return;
      }

      state.progress = 1;
      state.checkpointPaused = true;
      this.checkedStages.add(state.stageIndex);
      this.emit("checkpoint");
    }

    previous() {
      const state = this.state;
      state.autoTour = false;
      this._clearDwell(true);
      const timeline = this._timeline();
      const index = this.phaseIndex();
      state.playing = false;
      state.checkpointPaused = false;

      if (state.progress >= 1 - EPSILON) {
        state.progress = timeline[timeline.length - 1].start;
        this.emit("step");
        return;
      }

      if (index > 0) {
        state.progress = timeline[index - 1].start;
        this.emit("phase");
        return;
      }

      if (state.stageIndex > 0) {
        state.stageIndex -= 1;
        const previousTimeline = this._timeline();
        state.progress = previousTimeline[previousTimeline.length - 1].start;
        this.emit("stage");
        return;
      }

      state.progress = 0;
      this.emit("step");
    }

    goTo(index) {
      this.state.autoTour = false;
      this._clearDwell(true);
      const numeric = Number(index);
      const requested = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
      const next = Math.max(0, Math.min(this.stages.length - 1, requested));
      this.state.stageIndex = next;
      this.state.progress = 0;
      this.state.elapsed = 0;
      this.state.checkpointPaused = false;
      this.checkedStages.delete(next);
      this.emit("stage");
    }

    goToPhase(stageIndex, phaseIndex) {
      const state = this.state;
      state.autoTour = false;
      this._clearDwell(true);
      const oldStageIndex = state.stageIndex;
      const oldPhaseIndex = this.phaseIndex();
      const numericStage = Number(stageIndex);
      const requestedStage = Number.isFinite(numericStage) ? Math.trunc(numericStage) : 0;
      const targetStage = Math.max(0, Math.min(this.stages.length - 1, requestedStage));
      const timeline = this._timeline(this.stages[targetStage]);
      const numericPhase = Number(phaseIndex);
      const requestedPhase = Number.isFinite(numericPhase) ? Math.trunc(numericPhase) : 0;
      const targetPhase = Math.max(0, Math.min(timeline.length - 1, requestedPhase));

      state.stageIndex = targetStage;
      state.progress = timeline[targetPhase].start;
      state.elapsed = 0;
      state.playing = false;
      state.checkpointPaused = false;
      this.checkedStages.delete(targetStage);

      if (targetStage !== oldStageIndex) this.emit("stage");
      else if (targetPhase !== oldPhaseIndex) this.emit("phase");
      else this.emit("step");
    }

    setProgress(value) {
      const numeric = Number(value);
      this.state.autoTour = false;
      this._clearDwell(true);
      this.state.progress = Math.max(0, Math.min(1, Number.isFinite(numeric) ? numeric : 0));
      this.state.elapsed = 0;
      this.state.playing = false;
      this.state.checkpointPaused = this.state.progress >= 1 - EPSILON;
      if (this.state.checkpointPaused) this.checkedStages.add(this.state.stageIndex);
      else this.checkedStages.delete(this.state.stageIndex);
      this.emit("scrub");
      return this.traceSnapshot();
    }

    replayPhase() {
      const span = this.phaseSpan();
      this.state.autoTour = false;
      this._clearDwell(true);
      this.state.progress = span.start;
      this.state.elapsed = 0;
      this.state.checkpointPaused = false;
      this.checkedStages.delete(this.state.stageIndex);
      this.state.playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (this.state.playing) this._ensureBoundaryDwell();
      this.emit("replay");
      return this.traceSnapshot();
    }

    runAll() {
      this._clearDwell(true);
      this.state.stageIndex = 0;
      this.state.progress = 0;
      this.state.elapsed = 0;
      this.state.checkpointPaused = false;
      this.state.autoTour = true;
      this.state.playing = true;
      this.checkedStages.clear();
      this._startDwell();
      this.emit("runAll");
      return this.traceSnapshot();
    }

    restart() {
      this._clearDwell(true);
      this.state.stageIndex = 0;
      this.state.progress = 0;
      this.state.elapsed = 0;
      this.state.autoTour = false;
      this.state.playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.state.checkpointPaused = false;
      this.checkedStages.clear();
      if (this.state.playing) this._startDwell();
      this.emit("restart");
    }

    resume() {
      const state = this.state;
      if (state.progress >= 1 - EPSILON) {
        if (state.stageIndex >= this.stages.length - 1) {
          state.progress = 1;
          state.playing = false;
          state.checkpointPaused = true;
          this.emit("complete");
          return;
        }
        state.stageIndex += 1;
        state.progress = 0;
        state.checkpointPaused = false;
        state.playing = true;
        this._startDwell();
        this.emit("stage");
        return;
      }
      state.checkpointPaused = false;
      state.playing = true;
      this._ensureBoundaryDwell();
      this.emit("play");
    }

    setSpeed(value) {
      this.state.speed = Math.max(.5, Math.min(3, Number(value) || 1));
      this.emit("speed");
    }

    setView(value) {
      if (!["split", "diskann", "aisaq"].includes(value)) return;
      this.state.view = value;
      this.emit("view");
    }

    setComputePath(value) {
      if (!["paper", "gpu-assist"].includes(value)) return;
      this.state.computePath = value;
      this.emit("computePath");
      return this.hardwareSnapshot();
    }

    setDataset(value) {
      this.state.dataset = value;
      this.emit("dataset");
    }

    setToggle(name, value) {
      if (!["follow", "labels"].includes(name)) return;
      this.state[name] = Boolean(value);
      this.emit(name);
    }

    overallProgress() {
      return (this.state.stageIndex + this.state.progress) / Math.max(1, this.stages.length);
    }
  }

  window.AiSAQSimulation = AiSAQSimulation;
})();
