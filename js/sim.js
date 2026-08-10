(function () {
  "use strict";

  class AiSAQSimulation {
    constructor(stages) {
      this.stages = stages;
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
      state.elapsed += seconds;
      if (!state.playing) return false;
      const duration = Math.max(1, Number(this.stage.duration) || 50);
      const before = state.progress;
      state.progress += (seconds * state.speed) / duration;
      if (before < .58 && state.progress >= .58 && !this.checkedStages.has(state.stageIndex)) {
        state.progress = .58;
        state.playing = false;
        state.checkpointPaused = true;
        this.checkedStages.add(state.stageIndex);
        this.emit("checkpoint");
        return true;
      }
      if (state.progress >= 1) {
        if (state.stageIndex >= this.stages.length - 1) {
          state.progress = 1;
          state.playing = false;
          this.emit("complete");
        } else {
          state.stageIndex += 1;
          state.progress = 0;
          state.checkpointPaused = false;
          this.emit("stage");
        }
      }
      return before !== state.progress;
    }

    playPause() {
      if (this.state.stageIndex === this.stages.length - 1 && this.state.progress >= 1) this.restart();
      this.state.checkpointPaused = false;
      this.state.playing = !this.state.playing;
      this.emit("play");
    }

    next() {
      this.state.stageIndex = (this.state.stageIndex + 1) % this.stages.length;
      this.state.progress = 0;
      this.state.checkpointPaused = false;
      this.emit("stage");
    }

    previous() {
      this.state.stageIndex = (this.state.stageIndex - 1 + this.stages.length) % this.stages.length;
      this.state.progress = 0;
      this.state.checkpointPaused = false;
      this.emit("stage");
    }

    goTo(index) {
      const next = Math.max(0, Math.min(this.stages.length - 1, Number(index)));
      if (next === this.state.stageIndex && this.state.progress === 0) return;
      this.state.stageIndex = next;
      this.state.progress = 0;
      this.state.checkpointPaused = false;
      this.emit("stage");
    }

    restart() {
      this.state.stageIndex = 0;
      this.state.progress = 0;
      this.state.playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.state.checkpointPaused = false;
      this.checkedStages.clear();
      this.emit("restart");
    }

    resume() {
      this.state.checkpointPaused = false;
      this.state.playing = true;
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
      return (this.state.stageIndex + this.state.progress) / this.stages.length;
    }
  }

  window.AiSAQSimulation = AiSAQSimulation;
})();
