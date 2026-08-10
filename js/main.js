(function () {
  "use strict";

  async function boot() {
    let canvas = document.getElementById("yard");
    const wrap = document.querySelector(".stage-wrap");
    const fallback = document.getElementById("canvas-fallback");

    if (!canvas || !canvas.getContext || !wrap || !window.AISAQ_CONTENT) {
      if (fallback) fallback.style.zIndex = "2";
      return;
    }

    document.documentElement.dataset.renderer = "loading";
    const simulation = new window.AiSAQSimulation(window.AISAQ_CONTENT.stages);
    let renderer = null;
    let hardware3D = false;
    let startupError = null;

    if (typeof window.createHardwareTransitRenderer === "function") {
      try {
        renderer = await window.createHardwareTransitRenderer(canvas, {
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          threeUrl: "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js",
          onManualCamera() {
            const followToggle = document.getElementById("follow");
            if (!followToggle || !followToggle.checked) return;
            followToggle.checked = false;
            simulation.setToggle("follow", false);
          },
        });
        hardware3D = Boolean(renderer);
      } catch (error) {
        startupError = error;
      }
    }

    if (!renderer && typeof window.createAiSAQRenderer === "function") {
      if (!canvas.getContext("2d")) {
        const replacement = canvas.cloneNode(true);
        canvas.replaceWith(replacement);
        canvas = replacement;
      }
      renderer = window.createAiSAQRenderer(canvas);
    }

    if (!renderer) {
      if (fallback) {
        fallback.hidden = false;
        fallback.classList.remove("sr-only");
      }
      throw startupError || new Error("No compatible renderer is available.");
    }

    document.documentElement.dataset.renderer = hardware3D ? "hardware-3d" : "canvas-2d";
    if (startupError) console.warn("3D renderer unavailable; using the 2D teaching fallback.", startupError);

    if (fallback) {
      fallback.hidden = false;
      fallback.classList.add("sr-only");
    }

    const ui = window.bindAiSAQUI(simulation);
    window.AISAQ_APP = Object.freeze({ simulation, renderer, ui, mode: hardware3D ? "hardware-3d" : "canvas-2d" });

    let last = performance.now();
    let stageVisible = true;

    function resize() {
      const rect = wrap.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);
    resize();

    function renderContext() {
      return {
        stage: simulation.stage,
        phase: simulation.currentPhase(),
        phaseIndex: simulation.phaseIndex(),
        phaseProgress: simulation.phaseProgress(),
        trace: typeof simulation.traceSnapshot === "function" ? simulation.traceSnapshot() : null,
        hardware: typeof simulation.hardwareSnapshot === "function" ? simulation.hardwareSnapshot() : null,
      };
    }

    function frame(now) {
      requestAnimationFrame(frame);
      if (!stageVisible || document.hidden) {
        last = now;
        return;
      }
      const seconds = Math.min(.05, Math.max(0, (now - last) / 1000));
      last = now;
      const advanced = simulation.update(seconds);
      if (advanced) ui.updateProgress(simulation.state);
      renderer.render(simulation.state, renderContext(), seconds);
    }
    requestAnimationFrame(frame);

    if ("IntersectionObserver" in window) {
      const visibilityObserver = new IntersectionObserver((entries) => {
        stageVisible = entries.some((entry) => entry.isIntersecting);
        last = performance.now();
      }, { rootMargin: "160px 0px" });
      visibilityObserver.observe(wrap);
    }

    const followToggle = document.getElementById("follow");
    function disengageFollow() {
      if (!followToggle || !followToggle.checked) return;
      followToggle.checked = false;
      simulation.setToggle("follow", false);
    }

    function callCamera(primary, fallbackName, fallbackValue) {
      disengageFollow();
      if (typeof renderer[primary] === "function") renderer[primary]();
      else if (typeof renderer[fallbackName] === "function") renderer[fallbackName](fallbackValue);
    }

    document.getElementById("camera-in")?.addEventListener("click", () => callCamera("zoomIn", "zoomBy", .12));
    document.getElementById("camera-out")?.addEventListener("click", () => callCamera("zoomOut", "zoomBy", -.12));
    document.getElementById("camera-fit")?.addEventListener("click", () => {
      disengageFollow();
      renderer.fit?.();
    });

    followToggle?.addEventListener("change", () => {
      if (typeof renderer.setFollow === "function") renderer.setFollow(followToggle.checked);
      else if (followToggle.checked) renderer.follow?.();
      else renderer.fit?.();
    });

    document.getElementById("tour-start")?.addEventListener("click", () => {
      if (typeof simulation.runAll === "function") simulation.runAll();
      else {
        simulation.restart();
        if (!simulation.state.playing) simulation.playPause();
      }
    });

    simulation.subscribe((state) => {
      renderer.setView?.(state.view);
      renderer.setFollow?.(state.follow);
      renderer.setComputePath?.(state.computePath || "paper");
    });

    if (!hardware3D) {
      let pointerStart = null;
      canvas.addEventListener("pointerdown", (event) => {
        pointerStart = { lastX: event.clientX, lastY: event.clientY, movement: 0 };
        canvas.setPointerCapture?.(event.pointerId);
        canvas.dataset.dragging = "true";
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!pointerStart) return;
        const dx = event.clientX - pointerStart.lastX;
        const dy = event.clientY - pointerStart.lastY;
        pointerStart.movement += Math.hypot(dx, dy);
        pointerStart.lastX = event.clientX;
        pointerStart.lastY = event.clientY;
        if (pointerStart.movement > 3) {
          disengageFollow();
          renderer.panBy?.(dx, dy);
        }
      });
      canvas.addEventListener("pointerup", (event) => {
        if (!pointerStart) return;
        const movement = pointerStart.movement;
        pointerStart = null;
        delete canvas.dataset.dragging;
        canvas.releasePointerCapture?.(event.pointerId);
        if (movement > 8) return;
        const stationIndex = renderer.pick?.(event.clientX, event.clientY);
        if (stationIndex !== null && stationIndex !== undefined) simulation.goTo(stationIndex);
      });
      canvas.addEventListener("pointercancel", () => {
        pointerStart = null;
        delete canvas.dataset.dragging;
      });
      canvas.addEventListener("wheel", (event) => {
        if (!event.altKey && !event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        disengageFollow();
        renderer.zoomBy?.(event.deltaY < 0 ? .08 : -.08);
      }, { passive: false });
    }

    canvas.addEventListener("aisaq:panel-visibility", (event) => renderer.setPanelVisible?.(event.detail.visible));
    document.addEventListener("visibilitychange", () => { last = performance.now(); });
    window.addEventListener("pagehide", () => {
      resizeObserver.disconnect();
      renderer.dispose?.();
    }, { once: true });
  }

  boot().catch((error) => {
    console.error(error);
    const fallback = document.getElementById("canvas-fallback");
    if (fallback) {
      fallback.hidden = false;
      fallback.classList.remove("sr-only");
    }
  });
})();
