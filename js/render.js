(function () {
  "use strict";

  const I = window.AISAQ_ISO;
  const ART = Object.freeze({ width: 1184, height: 648, split: 592 });
  const COLORS = Object.freeze({
    ink: "#142a37",
    blue: "#3168d8",
    blueDeep: "#1c4da8",
    mint: "#4aae9b",
    mintDeep: "#247666",
    yellow: "#f5c84c",
    yellowDeep: "#b98706",
    paper: "#fffdf7",
    concrete: "#e4dfd3",
    coral: "#b84032",
  });

  const CAMERAS = Object.freeze({
    "layout-at-rest": { x: .5, y: .48, zoom: 1 },
    entrypoint: { x: .5, y: .61, zoom: 1.055 },
    "read-current-chunk": { x: .5, y: .64, zoom: 1.085 },
    "score-neighbors": { x: .5, y: .58, zoom: 1.075 },
    "advance-and-rerank": { x: .5, y: .66, zoom: 1.095 },
    "block-cost": { x: .5, y: .58, zoom: 1.03 },
    "evidence-switch-limits": { x: .5, y: .46, zoom: 1 },
  });

  const ROUTES = Object.freeze({
    diskann: [
      { x: 416, y: 456 }, { x: 365, y: 401 }, { x: 311, y: 409 },
      { x: 270, y: 454 }, { x: 344, y: 458 }, { x: 430, y: 476 },
    ],
    aisaq: [
      { x: 835, y: 490 }, { x: 805, y: 421 }, { x: 744, y: 366 },
      { x: 690, y: 430 }, { x: 750, y: 466 }, { x: 902, y: 444 },
    ],
  });

  const BLOCK_COUNTS = Object.freeze({
    SIFT1M: { diskann: 1, aisaq: 2, sizes: "740 B → 7,908 B" },
    SIFT1B: { diskann: 1, aisaq: 1, sizes: "340 B → 2,004 B" },
    "KILT E5 22M": { diskann: 2, aisaq: 4, sizes: "4,376 B → 13,208 B" },
  });

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, value) { return a + (b - a) * value; }
  function easeOut(value) { return 1 - Math.pow(1 - clamp(value, 0, 1), 3); }

  function createRenderer(canvas) {
    const ctx = canvas.getContext("2d", { alpha: false });
    const yardArt = new Image();
    let logicalWidth = 1;
    let logicalHeight = 1;
    let dpr = 1;
    let artReady = false;
    let camera = { x: .5, y: .48, zoom: 1 };
    let cameraInitialized = false;
    let labelsEnabled = true;

    yardArt.decoding = "async";
    yardArt.addEventListener("load", () => {
      artReady = true;
      canvas.dispatchEvent(new CustomEvent("aisaq:asset-ready"));
    }, { once: true });
    yardArt.addEventListener("error", () => {
      canvas.dispatchEvent(new CustomEvent("aisaq:asset-error"));
    }, { once: true });
    yardArt.src = "assets/aisaq-storage-yard.png";

    function resize(width, height) {
      logicalWidth = Math.max(1, Math.round(width));
      logicalHeight = Math.max(1, Math.round(height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(logicalWidth * dpr));
      canvas.height = Math.max(1, Math.round(logicalHeight * dpr));
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sourceForView(view) {
      if (view === "diskann") return { x: 0, y: 0, width: ART.split, height: ART.height };
      if (view === "aisaq") return { x: ART.split, y: 0, width: ART.width - ART.split, height: ART.height };
      return { x: 0, y: 0, width: ART.width, height: ART.height };
    }

    function containRect(source, bounds) {
      const ratio = Math.min(bounds.width / source.width, bounds.height / source.height);
      const width = source.width * ratio;
      const height = source.height * ratio;
      return {
        x: bounds.x + (bounds.width - width) / 2,
        y: bounds.y + (bounds.height - height) / 2,
        width,
        height,
      };
    }

    function fillWidthRect(source, bounds) {
      const ratio = bounds.width / source.width;
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: source.height * ratio,
      };
    }

    function cameraTarget(state) {
      if (!state.follow) return camera;
      if (state.view !== "split") return { x: .5, y: .5, zoom: 1 };
      const stage = window.AISAQ_CONTENT.stages[state.stageIndex];
      return CAMERAS[stage.id] || CAMERAS["layout-at-rest"];
    }

    function updateCamera(state) {
      const target = cameraTarget(state);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!cameraInitialized || reduced) {
        camera = { x: target.x, y: target.y, zoom: target.zoom };
        cameraInitialized = true;
      } else {
        const amount = state.playing ? .085 : .2;
        camera.x = lerp(camera.x, target.x, amount);
        camera.y = lerp(camera.y, target.y, amount);
        camera.zoom = lerp(camera.zoom, target.zoom, amount);
      }
      const delta = Math.abs(camera.x - target.x) + Math.abs(camera.y - target.y) + Math.abs(camera.zoom - target.zoom);
      return delta > .0015;
    }

    function drawWorld(state) {
      const bottomPad = logicalWidth < 760 ? 104 : 92;
      const bounds = { x: 0, y: 0, width: logicalWidth, height: Math.max(180, logicalHeight - bottomPad) };
      const source = sourceForView(state.view);
      const base = state.view === "split" && logicalWidth >= 760
        ? fillWidthRect(source, { ...bounds, height: logicalHeight })
        : containRect(source, bounds);

      ctx.fillStyle = COLORS.concrete;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      if (!artReady) {
        ctx.fillStyle = COLORS.ink;
        ctx.font = "700 15px 'Avenir Next', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Loading the storage yard…", logicalWidth / 2, logicalHeight / 2);
        return { source, dest: base };
      }

      const localFocusX = state.view === "split"
        ? clamp((camera.x * ART.width - source.x) / source.width, 0, 1)
        : .5;
      const localFocusY = state.view === "split"
        ? clamp((camera.y * ART.height - source.y) / source.height, 0, 1)
        : .5;
      const zoom = state.view === "split" ? camera.zoom : 1;
      const width = base.width * zoom;
      const height = base.height * zoom;
      const dest = {
        x: base.x + base.width / 2 - localFocusX * width,
        y: base.y + base.height / 2 - localFocusY * height,
        width,
        height,
      };

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        yardArt,
        source.x, source.y, source.width, source.height,
        dest.x, dest.y, dest.width, dest.height,
      );
      ctx.restore();
      return { source, dest };
    }

    function mapper(world) {
      return (point) => ({
        x: world.dest.x + ((point.x - world.source.x) / world.source.width) * world.dest.width,
        y: world.dest.y + ((point.y - world.source.y) / world.source.height) * world.dest.height,
      });
    }

    function visible(point, world) {
      return point.x >= world.source.x && point.x <= world.source.x + world.source.width;
    }

    function drawPulse(point, color, time, size) {
      const wave = .5 + .5 * Math.sin(time * 4.2);
      ctx.save();
      ctx.globalAlpha = .82 - wave * .28;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, size * .08);
      ctx.beginPath();
      ctx.arc(point.x, point.y, size * (.7 + wave * .35), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = .22;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size * .62, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawTag(text, point, color, align) {
      if (!labelsEnabled) return;
      ctx.save();
      ctx.font = `800 ${logicalWidth < 760 ? 8 : 11}px "Avenir Next Condensed", sans-serif`;
      const padX = logicalWidth < 760 ? 6 : 9;
      const height = logicalWidth < 760 ? 20 : 27;
      const width = ctx.measureText(text).width + padX * 2;
      const x = align === "right" ? point.x - width : point.x - width / 2;
      const y = point.y - height;
      ctx.fillStyle = "rgba(20,42,55,.94)";
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 4, height);
      ctx.fillStyle = COLORS.paper;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + padX + 2, y + height / 2 + .5);
      ctx.restore();
    }

    function drawFlow(from, to, color, progress, time) {
      ctx.save();
      ctx.strokeStyle = "rgba(20,42,55,.62)";
      ctx.lineWidth = logicalWidth < 760 ? 3 : 5;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 3; i += 1) {
        const phase = (progress * .45 + time * .22 + i / 3) % 1;
        const x = lerp(from.x, to.x, phase);
        const y = lerp(from.y, to.y, phase);
        ctx.fillStyle = color;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1;
        ctx.fillRect(x - 5, y - 4, 10, 8);
        ctx.strokeRect(x - 5, y - 4, 10, 8);
      }
      ctx.restore();
    }

    function routePoint(mode, value) {
      const route = ROUTES[mode];
      const scaled = clamp(value, 0, .9999) * (route.length - 1);
      const index = Math.floor(scaled);
      const local = scaled - index;
      return {
        x: lerp(route[index].x, route[Math.min(route.length - 1, index + 1)].x, local),
        y: lerp(route[index].y, route[Math.min(route.length - 1, index + 1)].y, local),
      };
    }

    function queryTravel(stageId, phaseIndex, phaseProgress) {
      if (stageId === "entrypoint") return .02;
      if (stageId === "read-current-chunk") return .2;
      if (stageId === "score-neighbors") return .2;
      if (stageId === "advance-and-rerank") return clamp(.2 + (phaseIndex + phaseProgress) / 4 * .72, 0, .92);
      return null;
    }

    function drawQuery(mode, map, travel, time, world) {
      const sourcePoint = routePoint(mode, travel);
      if (!visible(sourcePoint, world)) return;
      const point = map(sourcePoint);
      drawPulse(point, COLORS.yellow, time, logicalWidth < 760 ? 13 : 20);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.fillStyle = COLORS.yellow;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, 7);
      ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (logicalWidth >= 760) drawTag("SAME QUERY", { x: point.x, y: point.y - 17 }, mode === "diskann" ? COLORS.blue : COLORS.mint, "center");
    }

    function drawBlockTray(mode, map, state, point) {
      const stats = BLOCK_COUNTS[state.dataset] || BLOCK_COUNTS.SIFT1B;
      const count = stats[mode];
      const mapped = map(point);
      const blockWidth = logicalWidth < 760 ? 18 : 28;
      const blockHeight = logicalWidth < 760 ? 14 : 22;
      const total = count * blockWidth + Math.max(0, count - 1) * 4;
      ctx.save();
      ctx.fillStyle = "rgba(20,42,55,.88)";
      ctx.fillRect(mapped.x - total / 2 - 10, mapped.y - 39, total + 20, 58);
      for (let i = 0; i < count; i += 1) {
        const x = mapped.x - total / 2 + i * (blockWidth + 4);
        ctx.fillStyle = mode === "diskann" ? COLORS.blue : COLORS.mint;
        ctx.fillRect(x, mapped.y - 25, blockWidth, blockHeight);
        if (mode === "aisaq") {
          ctx.fillStyle = COLORS.yellow;
          ctx.fillRect(x + 3, mapped.y - 22, Math.max(4, blockWidth * .45), 4);
        }
        ctx.strokeStyle = COLORS.paper;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, mapped.y - 25, blockWidth, blockHeight);
      }
      ctx.fillStyle = COLORS.paper;
      ctx.font = `800 ${logicalWidth < 760 ? 7 : 9}px "Avenir Next", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${count} × 4 KB`, mapped.x, mapped.y + 11);
      ctx.restore();
    }

    function drawOverlays(state, world) {
      if (!artReady) return;
      const stage = window.AISAQ_CONTENT.stages[state.stageIndex];
      const phases = stage.phases || [];
      const count = Math.max(1, phases.length);
      const phaseIndex = Math.min(count - 1, Math.floor(clamp(state.progress, 0, .999999) * count));
      const phaseProgress = clamp(state.progress * count - phaseIndex, 0, 1);
      const map = mapper(world);
      const time = state.playing ? state.elapsed : phaseIndex + phaseProgress;
      const travel = queryTravel(stage.id, phaseIndex, phaseProgress);

      if (stage.id === "layout-at-rest") {
        if (visible({ x: 318, y: 176 }, world)) drawPulse(map({ x: 318, y: 176 }), COLORS.blue, time, logicalWidth < 760 ? 25 : 48);
        if (visible({ x: 855, y: 405 }, world)) drawPulse(map({ x: 855, y: 405 }), COLORS.mint, time, logicalWidth < 760 ? 25 : 48);
        if (phaseIndex >= 1) {
          if (visible({ x: 316, y: 125 }, world)) drawTag("N · bPQ IN DRAM", map({ x: 316, y: 125 }), COLORS.blue, "center");
          if (visible({ x: 850, y: 335 }, world)) drawTag("NEIGHBOR PQ IN SSD", map({ x: 850, y: 335 }), COLORS.mint, "center");
        }
      }

      if (travel !== null) {
        drawQuery("diskann", map, travel, time, world);
        drawQuery("aisaq", map, travel, time, world);
      }

      if (stage.id === "entrypoint" && phaseIndex >= 1) {
        const left = map(routePoint("diskann", .02));
        const right = map(routePoint("aisaq", .02));
        if (visible(routePoint("diskann", .02), world)) drawTag("L = {s} · V = ∅", { x: left.x, y: left.y - 31 }, COLORS.blue, "center");
        if (visible(routePoint("aisaq", .02), world)) drawTag("L = {s} · V = ∅", { x: right.x, y: right.y - 31 }, COLORS.mint, "center");
      }

      if (stage.id === "read-current-chunk") {
        drawBlockTray("diskann", map, state, { x: 345, y: 515 });
        drawBlockTray("aisaq", map, state, { x: 840, y: 545 });
        if (phaseIndex >= 2) {
          const left = map(routePoint("diskann", .2));
          const right = map(routePoint("aisaq", .2));
          if (visible(routePoint("diskann", .2), world)) drawTag("full(p) UNPACKED", { x: left.x, y: left.y - 34 }, COLORS.blue, "center");
          if (visible(routePoint("aisaq", .2), world)) drawTag("full(p) UNPACKED", { x: right.x, y: right.y - 34 }, COLORS.mint, "center");
        }
      }

      if (stage.id === "score-neighbors") {
        const leftNode = map(routePoint("diskann", .2));
        const rightNode = map(routePoint("aisaq", .2));
        const dram = map({ x: 320, y: 190 });
        const inline = map({ x: 855, y: 394 });
        if (phaseIndex < 3 && visible(routePoint("diskann", .2), world) && visible({ x: 320, y: 190 }, world)) drawFlow(leftNode, dram, COLORS.blue, phaseProgress, time);
        if (phaseIndex < 3 && visible(routePoint("aisaq", .2), world) && visible({ x: 855, y: 394 }, world)) drawFlow(rightNode, inline, COLORS.mint, phaseProgress, time);
        if (phaseIndex === 3) {
          if (visible({ x: 320, y: 190 }, world)) drawTag("ALL-N PQ STAYS", map({ x: 320, y: 190 }), COLORS.blue, "center");
          if (visible({ x: 855, y: 394 }, world)) drawTag("HOP PQ CLEARED", map({ x: 855, y: 394 }), COLORS.mint, "center");
        } else if (phaseIndex >= 2) {
          if (visible({ x: 270, y: 454 }, world)) drawPulse(map({ x: 270, y: 454 }), COLORS.yellow, time, logicalWidth < 760 ? 11 : 17);
          if (visible({ x: 750, y: 466 }, world)) drawPulse(map({ x: 750, y: 466 }), COLORS.yellow, time, logicalWidth < 760 ? 11 : 17);
        }
      }

      if (stage.id === "advance-and-rerank" && phaseIndex === 0) {
        if (visible({ x: 430, y: 476 }, world)) drawTag("full(p) → V", map({ x: 430, y: 476 }), COLORS.blue, "center");
        if (visible({ x: 902, y: 444 }, world)) drawTag("full(p) → V", map({ x: 902, y: 444 }), COLORS.mint, "center");
      }

      if (stage.id === "advance-and-rerank" && phaseIndex === 2) {
        if (visible({ x: 430, y: 476 }, world)) drawTag("V → FULL-PRECISION RE-RANK", map({ x: 430, y: 476 }), COLORS.blue, "center");
        if (visible({ x: 902, y: 444 }, world)) drawTag("V → FULL-PRECISION RE-RANK", map({ x: 902, y: 444 }), COLORS.mint, "center");
      }

      if (stage.id === "advance-and-rerank" && phaseIndex === 3) {
        if (visible({ x: 430, y: 476 }, world)) drawTag("TOP-k RETURNED", map({ x: 430, y: 476 }), COLORS.blue, "center");
        if (visible({ x: 902, y: 444 }, world)) drawTag("TOP-k RETURNED", map({ x: 902, y: 444 }), COLORS.mint, "center");
      }

      if (stage.id === "block-cost") {
        drawBlockTray("diskann", map, state, { x: 318, y: 505 });
        drawBlockTray("aisaq", map, state, { x: 855, y: 525 });
        if (phaseIndex >= 2 && logicalWidth >= 760) {
          const stats = BLOCK_COUNTS[state.dataset] || BLOCK_COUNTS.SIFT1B;
          drawTag(stats.sizes, map({ x: 592, y: 596 }), COLORS.yellow, "center");
        }
      }

      if (stage.id === "evidence-switch-limits") {
        if (visible({ x: 92, y: 160 }, world)) drawPulse(map({ x: 92, y: 160 }), COLORS.blue, time, logicalWidth < 760 ? 20 : 34);
        if (visible({ x: 1090, y: 160 }, world)) drawPulse(map({ x: 1090, y: 160 }), COLORS.mint, time, logicalWidth < 760 ? 20 : 34);
        if (phaseIndex === 1) {
          if (visible({ x: 320, y: 176 }, world)) drawTag("LOAD INDEX PQ ARRAY", map({ x: 320, y: 176 }), COLORS.blue, "center");
          if (visible({ x: 855, y: 176 }, world)) drawTag("LOAD METADATA", map({ x: 855, y: 176 }), COLORS.mint, "center");
        }
        if (phaseIndex >= 2 && visible({ x: 592, y: 330 }, world)) drawTag("11–14 MB ≠ ZERO RAM", map({ x: 592, y: 330 }), COLORS.coral, "center");
      }
    }

    function render(state) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      labelsEnabled = state.labels !== false;
      const cameraMoving = updateCamera(state);
      const world = drawWorld(state);
      drawOverlays(state, world);
      return cameraMoving;
    }

    return { resize, render };
  }

  window.createAiSAQRenderer = createRenderer;
})();
