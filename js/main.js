(function () {
  "use strict";

  const canvas = document.getElementById("yard");
  const wrap = document.querySelector(".stage-wrap");
  const fallback = document.getElementById("canvas-fallback");

  if (!canvas || !canvas.getContext || !window.AISAQ_CONTENT) {
    if (fallback) fallback.style.zIndex = "2";
    return;
  }

  fallback.hidden = true;
  const simulation = new window.AiSAQSimulation(window.AISAQ_CONTENT.stages);
  const renderer = window.createAiSAQRenderer(canvas);
  const ui = window.bindAiSAQUI(simulation);
  let dirty = true;
  let last = performance.now();

  function resize() {
    const rect = wrap.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    dirty = true;
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(wrap);
  resize();

  simulation.subscribe(() => { dirty = true; });

  function frame(now) {
    const seconds = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    const advanced = simulation.update(seconds);
    if (advanced) {
      dirty = true;
      ui.updateProgress(simulation.state);
    }
    if (dirty || simulation.state.playing) {
      renderer.render(simulation.state);
      dirty = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => { last = performance.now(); });
})();
