(function () {
  "use strict";

  const canvas = document.getElementById("yard");
  const wrap = document.querySelector(".stage-wrap");
  const fallback = document.getElementById("canvas-fallback");

  if (!canvas || !canvas.getContext || !window.AISAQ_CONTENT) {
    if (fallback) fallback.style.zIndex = "2";
    return;
  }

  fallback.hidden = false;
  fallback.classList.add("sr-only");
  const simulation = new window.AiSAQSimulation(window.AISAQ_CONTENT.stages);
  const renderer = window.createAiSAQRenderer(canvas);
  const ui = window.bindAiSAQUI(simulation);
  window.AISAQ_APP = Object.freeze({ simulation, renderer });
  let last = performance.now();

  function resize() {
    const rect = wrap.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(wrap);
  resize();

  function frame(now) {
    const seconds = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    const advanced = simulation.update(seconds);
    if (advanced) {
      ui.updateProgress(simulation.state);
    }
    renderer.render(simulation.state, {
      stage: simulation.stage,
      phase: simulation.currentPhase(),
      phaseIndex: simulation.phaseIndex(),
      phaseProgress: simulation.phaseProgress(),
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const followToggle = document.getElementById("follow");
  function disengageFollow() {
    if (followToggle.checked) {
      followToggle.checked = false;
      simulation.setToggle("follow", false);
    }
  }
  document.getElementById("camera-in").addEventListener("click", () => { disengageFollow(); renderer.zoomBy(.12); });
  document.getElementById("camera-out").addEventListener("click", () => { disengageFollow(); renderer.zoomBy(-.12); });
  document.getElementById("camera-fit").addEventListener("click", () => { disengageFollow(); renderer.fit(); });
  followToggle.addEventListener("change", () => {
    if (followToggle.checked) renderer.follow();
    else renderer.fit();
  });
  document.getElementById("tour-start").addEventListener("click", () => {
    simulation.restart();
    if (!simulation.state.playing) simulation.playPause();
  });

  let pointerStart = null;
  canvas.addEventListener("pointerdown", (event) => {
    pointerStart = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, movement: 0 };
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
      renderer.panBy(dx, dy);
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;
    const movement = pointerStart.movement + Math.hypot(event.clientX - pointerStart.lastX, event.clientY - pointerStart.lastY);
    pointerStart = null;
    delete canvas.dataset.dragging;
    canvas.releasePointerCapture?.(event.pointerId);
    if (movement > 8) return;
    const stationIndex = renderer.pick(event.clientX, event.clientY);
    if (stationIndex !== null) simulation.goTo(stationIndex);
  });
  canvas.addEventListener("pointercancel", () => { pointerStart = null; delete canvas.dataset.dragging; });
  canvas.addEventListener("wheel", (event) => {
    if (!event.altKey && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    disengageFollow();
    renderer.zoomBy(event.deltaY < 0 ? .08 : -.08);
  }, { passive: false });

  canvas.addEventListener("aisaq:panel-visibility", (event) => renderer.setPanelVisible(event.detail.visible));

  document.addEventListener("visibilitychange", () => { last = performance.now(); });
})();
