(function () {
  "use strict";

  function createNoopMotion() {
    return {
      stage() {},
      phase() {},
      beat() {},
      dwell() {},
      destroy() {},
    };
  }

  function createAiSAQMotion() {
    const animeApi = window.anime;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = animeApi && animeApi.animate;
    const stagger = animeApi && animeApi.stagger;

    if (reducedMotion || typeof animate !== "function") {
      document.documentElement.dataset.motion = reducedMotion ? "reduced" : "static-fallback";
      return createNoopMotion();
    }

    document.documentElement.dataset.motion = "animejs";
    const running = new Map();
    let lastBeat = null;
    let lastDwellKind = null;

    function stop(key) {
      const animation = running.get(key);
      if (animation && typeof animation.pause === "function") animation.pause();
      running.delete(key);
    }

    function play(key, targets, parameters) {
      const filtered = Array.from(targets || []).filter(Boolean);
      if (!filtered.length) return null;
      stop(key);
      try {
        const animation = animate(filtered, parameters);
        running.set(key, animation);
        return animation;
      } catch (_error) {
        document.documentElement.dataset.motion = "static-fallback";
        return null;
      }
    }

    function reveal(key, targets, delay) {
      return play(key, targets, {
        opacity: { from: 0.12, to: 1 },
        y: { from: 8, to: 0 },
        filter: { from: "blur(4px)", to: "blur(0px)" },
        delay: typeof stagger === "function" ? stagger(delay || 55) : 0,
        duration: 460,
        ease: "out(3)",
      });
    }

    function pulseRoute() {
      const track = document.querySelector(".scene-route-track");
      const pulse = document.querySelector("#scene-route-pulse");
      if (!track || !pulse) return;
      const travel = Math.max(18, track.clientWidth - pulse.offsetWidth);
      play("route", [pulse], {
        x: { from: 0, to: travel },
        opacity: [0, 1, 1, 0],
        scale: [0.72, 1, 1, 0.8],
        duration: 820,
        ease: "inOutQuad",
      });
    }

    function emphasizeActiveLane() {
      const lane = document.querySelector('.trace-lane[data-status="current"]');
      const direction = lane && lane.querySelector(".trace-direction");
      if (!direction) return;
      play("lane", [direction], {
        scale: [0.82, 1.08, 1],
        boxShadow: [
          "0 0 0 rgba(245, 200, 76, 0)",
          "0 0 18px rgba(245, 200, 76, .36)",
          "0 0 0 rgba(245, 200, 76, 0)",
        ],
        duration: 640,
        ease: "out(3)",
      });
    }

    function stage() {
      reveal("stage", [
        document.querySelector(".guide-head .stage-meta"),
        document.querySelector("#stage-title"),
        document.querySelector("#stage-short"),
      ], 70);
      const currentStop = document.querySelector('#route-list button[aria-current="step"]');
      if (currentStop) {
        play("stop", [currentStop], {
          backgroundColor: ["rgba(245, 200, 76, .08)", "rgba(80, 68, 25, .78)"],
          duration: 520,
          ease: "out(3)",
        });
      }
    }

    function phase() {
      reveal("phase-caption", [
        document.querySelector(".scene-route"),
        document.querySelector(".scene-payload"),
      ], 48);
      reveal("phase-guide", [
        document.querySelector("#guide-action-label"),
        ...document.querySelectorAll(".bilateral-row"),
      ], 55);
    }

    function beat(beatName) {
      const next = String(beatName || "inspect");
      if (next === lastBeat) return;
      lastBeat = next;
      const status = document.querySelector(".scene-status");
      if (status) status.dataset.beat = next;
      reveal("beat", [
        document.querySelector("#scene-action-label"),
        document.querySelector("#scene-shared-cue"),
        document.querySelector("#scene-route-payload"),
      ], 34);
      pulseRoute();
      emphasizeActiveLane();
    }

    function dwell(snapshot) {
      const kind = snapshot && snapshot.active ? snapshot.kind : null;
      if (kind === lastDwellKind) return;
      lastDwellKind = kind;
      const badge = document.querySelector("#scene-dwell-state");
      if (!badge) return;
      play("dwell", [badge], {
        opacity: { from: 0.35, to: 1 },
        backgroundColor: kind
          ? ["rgba(245, 200, 76, .06)", "rgba(245, 200, 76, .18)"]
          : ["rgba(85, 199, 173, .18)", "rgba(85, 199, 173, .06)"],
        duration: 360,
        ease: "out(3)",
      });
    }

    return {
      stage,
      phase,
      beat,
      dwell,
      destroy() {
        running.forEach((animation) => animation && animation.pause && animation.pause());
        running.clear();
      },
    };
  }

  window.createAiSAQMotion = createAiSAQMotion;
})();
