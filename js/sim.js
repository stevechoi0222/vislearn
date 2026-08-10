(function () {
  "use strict";

  const EPSILON = 1e-8;

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
        elapsed: 0,
        checkpointPaused: false,
      };
      this.checkedStages = new Set();
      this.listeners = new Set();
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

    subscribe(listener) {
      this.listeners.add(listener);
      listener(this.state, this.stage, "init");
      return () => this.listeners.delete(listener);
    }

    emit(reason) {
      this.listeners.forEach((listener) => listener(this.state, this.stage, reason));
    }

    update(seconds) {
      const state = this.state;
      const delta = Math.max(0, Number(seconds) || 0);
      if (!state.playing || delta <= 0) return false;

      state.elapsed += delta;
      const phaseBefore = this.phaseIndex();
      const stageDuration = Number(this.stage && this.stage.duration);
      const phaseDuration = this._timeline().reduce((sum, span) => {
        const value = Number(span.phase && (span.phase.duration ?? span.phase.weight));
        return sum + (Number.isFinite(value) && value > 0 ? value : 1);
      }, 0);
      const duration = Number.isFinite(stageDuration) && stageDuration > 0
        ? stageDuration
        : Math.max(1, phaseDuration);

      state.progress = Math.min(1, state.progress + (delta * state.speed) / duration);
      const phaseAfter = this.phaseIndex();

      if (phaseAfter !== phaseBefore) this.emit("phase");

      if (state.progress >= 1 - EPSILON) {
        state.progress = 1;
        state.playing = false;
        state.checkpointPaused = true;
        this.checkedStages.add(state.stageIndex);
        this.emit("checkpoint");
      }
      return true;
    }

    playPause() {
      const state = this.state;
      if (state.progress >= 1 - EPSILON) {
        if (state.stageIndex < this.stages.length - 1) {
          this.resume();
          return;
        }
        this.restart();
        state.playing = true;
        this.emit("play");
        return;
      }
      state.checkpointPaused = false;
      state.playing = !state.playing;
      this.emit("play");
    }

    next() {
      const state = this.state;
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

    restart() {
      this.state.stageIndex = 0;
      this.state.progress = 0;
      this.state.elapsed = 0;
      this.state.playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.state.checkpointPaused = false;
      this.checkedStages.clear();
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
        this.emit("stage");
        return;
      }
      state.checkpointPaused = false;
      state.playing = true;
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
