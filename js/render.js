(function () {
  "use strict";

  const I = window.AISAQ_ISO;
  const COLORS = Object.freeze({
    ink: "#151918",
    ink2: "#242927",
    floor: "#5b5b55",
    floorDark: "#454742",
    floorLine: "rgba(201,199,188,.18)",
    edge: "#1b211f",
    paper: "#f3efe5",
    muted: "#a9aaa3",
    blue: "#3168d8",
    blueDeep: "#203f81",
    mint: "#4aae9b",
    mintDeep: "#276f63",
    yellow: "#f5c84c",
    yellowDeep: "#a66d00",
    coral: "#d85d49",
    steel: "#7d8583",
    steelDark: "#454c4a",
    asphalt: "#242826",
  });

  const FLOOR = Object.freeze({ width: 28, depth: 19 });
  const STATIONS = Object.freeze([
    { id: "layout-at-rest", label: "Index Layout Bay", short: "LAYOUT", x: 5, y: 4, machine: "layout" },
    { id: "entrypoint", label: "Query Airlock", short: "ENTRY", x: 12, y: 3, machine: "entry" },
    { id: "read-current-chunk", label: "SSD Node Lift", short: "READ", x: 20, y: 4, machine: "read" },
    { id: "score-neighbors", label: "PQ Scoring Hall", short: "SCORE", x: 23, y: 10, machine: "score" },
    { id: "advance-and-rerank", label: "Loop & Re-rank Hall", short: "RERANK", x: 17, y: 15, machine: "rerank" },
    { id: "block-cost", label: "4 KB Packing Hall", short: "BLOCKS", x: 9, y: 15, machine: "blocks" },
    { id: "evidence-switch-limits", label: "Evidence & Limits", short: "EVIDENCE", x: 3, y: 10, machine: "evidence" },
  ]);

  const BLOCKS = Object.freeze({
    SIFT1M: { diskann: 1, aisaq: 2, bytes: [740, 7908], label: "SIFT1M" },
    SIFT1B: { diskann: 1, aisaq: 1, bytes: [340, 2004], label: "SIFT1B" },
    "KILT E5 22M": { diskann: 2, aisaq: 4, bytes: [4376, 13208], label: "KILT E5" },
  });

  const MEMORY = Object.freeze({
    SIFT1M: { diskann: 146, aisaq: 11, loadDisk: 46.8, loadAi: .6 },
    SIFT1B: { diskann: 31303, aisaq: 11, loadDisk: 16437.4, loadAi: .6 },
    "KILT E5 22M": { diskann: 2803, aisaq: 14, loadDisk: 1121.4, loadAi: 2 },
  });

  const BACKGROUND_BUILDINGS = Object.freeze([
    { x: 1, y: 1, w: 3.2, d: 2.2, h: 2.5, color: "#3d4643" },
    { x: 9, y: .6, w: 3.4, d: 1.8, h: 2.1, color: "#4a403e" },
    { x: 22.8, y: .7, w: 3.5, d: 2.4, h: 3, color: "#414845" },
    { x: 24.6, y: 15.5, w: 2.6, d: 2.1, h: 2.4, color: "#42413e" },
    { x: .5, y: 15.8, w: 3.2, d: 2, h: 2.5, color: "#4a4541" },
  ]);

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, value) { return a + (b - a) * value; }
  function smooth(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }
  function pulse(time, speed, offset) { return .5 + .5 * Math.sin(time * speed + (offset || 0)); }
  function mixPoint(a, b, value) { return { x: lerp(a.x, b.x, value), y: lerp(a.y, b.y, value) }; }
  function rgba(hex, alpha) {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  function createRenderer(canvas) {
    const ctx = canvas.getContext("2d", { alpha: false });
    let logicalWidth = 1;
    let logicalHeight = 1;
    let dpr = 1;
    let panelVisible = true;
    let labelsEnabled = true;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let camera = { x: 14, y: 9.5, zoom: .64 };
    let cameraMode = "follow";
    let manualTarget = { ...camera };
    let zoomNudge = 0;
    let lastFrame = performance.now();
    let lastMotionFrame = lastFrame;
    let motionTime = 0;
    let lastStageIndex = -1;
    let lastProjection = null;
    let stationScreens = [];

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = (event) => { reducedMotion = event.matches; };
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);

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

    function fitZoom() {
      const guide = panelVisible && logicalWidth > 760 ? Math.min(430, logicalWidth * .27) + 50 : 28;
      const usableWidth = Math.max(280, logicalWidth - guide);
      const usableHeight = logicalWidth <= 760 ? logicalHeight * .71 : logicalHeight * .84;
      return clamp(Math.min(usableWidth / 1170, usableHeight / 690), .29, .86);
    }

    function cameraTarget(state, context) {
      const station = STATIONS[state.stageIndex] || STATIONS[0];
      const stageOpening = state.stageIndex === 0 ? smooth(clamp(state.elapsed / 3.2, 0, 1)) : 1;
      const followZoom = logicalWidth <= 760 ? .9 : logicalWidth <= 1100 ? 1.02 : 1.18;
      if (cameraMode === "manual") return manualTarget;
      if (cameraMode === "fit" || !state.follow) return { x: 14, y: 9.5, zoom: fitZoom() + zoomNudge };
      return {
        x: lerp(14, station.x, stageOpening),
        y: lerp(9.5, station.y, stageOpening),
        zoom: lerp(fitZoom(), followZoom + zoomNudge, stageOpening),
      };
    }

    function updateCamera(state, context, now) {
      if (state.stageIndex !== lastStageIndex) {
        lastStageIndex = state.stageIndex;
      }
      const target = cameraTarget(state, context);
      const seconds = Math.min(.05, Math.max(0, (now - lastFrame) / 1000));
      const amount = reducedMotion || !state.playing ? 1 : 1 - Math.exp(-seconds * 4.8);
      camera.x = lerp(camera.x, target.x, amount);
      camera.y = lerp(camera.y, target.y, amount);
      camera.zoom = lerp(camera.zoom, target.zoom, amount);
      lastFrame = now;
    }

    function makeProjection() {
      const tileW = 52 * camera.zoom;
      const tileH = 27 * camera.zoom;
      const zScale = 25 * camera.zoom;
      const guide = panelVisible && logicalWidth > 760 ? Math.min(430, logicalWidth * .27) + 24 : 0;
      const centerX = (logicalWidth - guide) / 2;
      const centerY = logicalWidth <= 760 ? logicalHeight * .39 : logicalHeight * .48;
      const project = (x, y, z) => ({
        x: centerX + ((x - camera.x) - (y - camera.y)) * tileW * .5,
        y: centerY + ((x - camera.x) + (y - camera.y)) * tileH * .5 - z * zScale,
      });
      lastProjection = project;
      return project;
    }

    function drawGradientSky() {
      const gradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
      gradient.addColorStop(0, "#161a18");
      gradient.addColorStop(.58, "#202522");
      gradient.addColorStop(1, "#0e1110");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      const glow = ctx.createRadialGradient(logicalWidth * .38, logicalHeight * .3, 0, logicalWidth * .38, logicalHeight * .3, logicalWidth * .65);
      glow.addColorStop(0, "rgba(246,194,61,.08)");
      glow.addColorStop(1, "rgba(246,194,61,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    }

    function drawFloor(project) {
      const corners = [project(0, 0, 0), project(FLOOR.width, 0, 0), project(FLOOR.width, FLOOR.depth, 0), project(0, FLOOR.depth, 0)];
      I.polygon(ctx, corners, COLORS.floor, "#252a28", Math.max(1, camera.zoom * 2));

      ctx.save();
      ctx.strokeStyle = COLORS.floorLine;
      ctx.lineWidth = Math.max(.45, camera.zoom * .65);
      for (let x = 0; x <= FLOOR.width; x += 2) I.line(ctx, project(x, 0, .01), project(x, FLOOR.depth, .01), COLORS.floorLine, Math.max(.45, camera.zoom * .65));
      for (let y = 0; y <= FLOOR.depth; y += 2) I.line(ctx, project(0, y, .01), project(FLOOR.width, y, .01), COLORS.floorLine, Math.max(.45, camera.zoom * .65));
      ctx.restore();

      drawHazardBorder(project, 0, 0, FLOOR.width, 0);
      drawHazardBorder(project, FLOOR.width, 0, FLOOR.width, FLOOR.depth);
      drawHazardBorder(project, FLOOR.width, FLOOR.depth, 0, FLOOR.depth);
      drawHazardBorder(project, 0, FLOOR.depth, 0, 0);
    }

    function drawHazardBorder(project, x1, y1, x2, y2) {
      const a = project(x1, y1, .03);
      const b = project(x2, y2, .03);
      I.line(ctx, a, b, COLORS.ink, Math.max(8, 12 * camera.zoom));
      ctx.save();
      ctx.setLineDash([Math.max(8, 13 * camera.zoom), Math.max(7, 11 * camera.zoom)]);
      I.line(ctx, a, b, COLORS.yellow, Math.max(3, 5 * camera.zoom), [Math.max(8, 13 * camera.zoom), Math.max(7, 11 * camera.zoom)]);
      ctx.restore();
    }

    function drawRoute(project, ambientTime) {
      const points = STATIONS.map((station) => project(station.x, station.y, .06));
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = COLORS.asphalt;
      ctx.lineWidth = Math.max(15, 25 * camera.zoom);
      ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();
      ctx.strokeStyle = "#84661b";
      ctx.lineWidth = Math.max(1.5, 2.4 * camera.zoom);
      ctx.setLineDash([Math.max(5, 8 * camera.zoom), Math.max(5, 8 * camera.zoom)]);
      ctx.lineDashOffset = reducedMotion ? 0 : -ambientTime * 11 * camera.zoom;
      ctx.stroke();
      ctx.restore();

      for (let index = 0; index < STATIONS.length; index += 1) {
        const point = points[index];
        I.circle(ctx, point.x, point.y, Math.max(3, 5.5 * camera.zoom), COLORS.yellow, COLORS.ink, 1);
      }
    }

    function drawBackground(project, ambientTime) {
      BACKGROUND_BUILDINGS.forEach((building, index) => {
        I.cuboid(ctx, project, building.x, building.y, building.w, building.d, building.h, building.color, { edge: COLORS.edge, lineWidth: Math.max(.65, camera.zoom), shadowOffset: 6 * camera.zoom });
        const light = project(building.x + building.w * .75, building.y + building.d, building.h * .62);
        I.circle(ctx, light.x, light.y, Math.max(1.3, 2 * camera.zoom), pulse(ambientTime, 1.4, index) > .55 ? COLORS.yellow : "#5e5843", COLORS.edge, .7);
      });

      for (let index = 0; index < 8; index += 1) {
        const x = 2 + index * 3.2;
        const y = index % 2 ? 17.9 : 1.2;
        const base = project(x, y, 0);
        const top = project(x, y, 2.2);
        I.line(ctx, base, top, "#343a37", Math.max(2, 3 * camera.zoom));
        I.circle(ctx, top.x, top.y, Math.max(2, 3.5 * camera.zoom), pulse(ambientTime, 1.8, index) > .35 ? "#e6bd55" : "#6d6348", "#242925", 1);
      }
    }

    function methodPosition(station, method) {
      const offset = method === "diskann" ? -1 : 1;
      return { x: station.x + offset * .95, y: station.y - offset * .95 };
    }

    function methodColor(method) { return method === "diskann" ? COLORS.blue : COLORS.mint; }
    function methodDeep(method) { return method === "diskann" ? COLORS.blueDeep : COLORS.mintDeep; }
    function methodAlpha(state, method) {
      if (!state || state.view === "split" || state.view === method) return 1;
      return .38;
    }

    function drawPlatform(project, station, active, ambientTime) {
      const color = active ? "#68685f" : "#52534e";
      I.cuboid(ctx, project, station.x - 2.25, station.y - 2.25, 4.5, 4.5, .18, color, {
        edge: active ? COLORS.yellowDeep : COLORS.edge,
        lineWidth: active ? Math.max(1, 2 * camera.zoom) : Math.max(.6, camera.zoom),
        frontAccent: active ? COLORS.yellow : "#62635d",
        shadowOffset: 4 * camera.zoom,
      });
      if (active) {
        const center = project(station.x, station.y, .24);
        const radius = Math.max(18, 34 * camera.zoom * (1 + pulse(ambientTime, 2.6) * .12));
        ctx.save();
        ctx.strokeStyle = rgba(COLORS.yellow, .38);
        ctx.lineWidth = Math.max(1, 2 * camera.zoom);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawGenericMachine(project, station, method, active, state, ambientTime) {
      const position = methodPosition(station, method);
      const alpha = methodAlpha(state, method);
      ctx.save();
      ctx.globalAlpha *= alpha;
      I.cuboid(ctx, project, position.x - .72, position.y - .72, 1.44, 1.44, .68, methodDeep(method), {
        edge: COLORS.edge,
        lineWidth: Math.max(.7, camera.zoom),
        shadowOffset: 4 * camera.zoom,
        frontAccent: methodColor(method),
      });
      const beacon = project(position.x, position.y, .93);
      I.circle(ctx, beacon.x, beacon.y, Math.max(1.7, 3 * camera.zoom), active && pulse(ambientTime, 3.1) > .26 ? COLORS.yellow : "#5c5c50", COLORS.edge, .8);
      ctx.restore();
      return position;
    }

    function drawMachine(project, station, method, active, phaseId, phaseProgress, state, ambientTime) {
      const position = drawGenericMachine(project, station, method, active, state, ambientTime);
      ctx.save();
      ctx.globalAlpha *= methodAlpha(state, method);
      if (station.machine === "layout") drawLayoutMachine(project, position, method, active, phaseId, phaseProgress, ambientTime);
      else if (station.machine === "entry") drawEntryMachine(project, position, method, active, phaseId, phaseProgress, ambientTime);
      else if (station.machine === "read") drawReadMachine(project, position, method, active, phaseId, phaseProgress, ambientTime, state.dataset);
      else if (station.machine === "score") drawScoreMachine(project, position, method, active, phaseId, phaseProgress, ambientTime);
      else if (station.machine === "rerank") drawRerankMachine(project, position, method, active, phaseId, phaseProgress, ambientTime);
      else if (station.machine === "blocks") drawBlockMachine(project, position, method, active, phaseId, phaseProgress, ambientTime, state.dataset);
      else if (station.machine === "evidence") drawEvidenceMachine(project, position, method, active, phaseId, phaseProgress, ambientTime, state.dataset);
      if (active) drawStatusPlate(project(position.x, position.y + .95, .34), method === "diskann" ? "DISKANN" : "AISAQ", methodColor(method));
      ctx.restore();
    }

    function drawLayoutMachine(project, position, method, active, phaseId, progress, time) {
      const towerHeight = method === "diskann" ? 2.55 : 1.75;
      I.cuboid(ctx, project, position.x - .58, position.y - .52, 1.16, 1.04, towerHeight, methodDeep(method), {
        edge: COLORS.edge,
        lineWidth: Math.max(.7, camera.zoom),
        shadowOffset: 3 * camera.zoom,
        frontAccent: methodColor(method),
      });
      for (let row = 0; row < (method === "diskann" ? 5 : 3); row += 1) {
        const a = project(position.x - .45, position.y + .53, .62 + row * .38);
        const b = project(position.x + .45, position.y + .53, .62 + row * .38);
        I.line(ctx, a, b, phaseId === "pq-residency" && method === "diskann" && pulse(time, 3.2, row) > .35 ? COLORS.yellow : rgba(methodColor(method), .65), Math.max(1, 2.3 * camera.zoom));
      }
      if (method === "aisaq") {
        for (let row = 0; row < 3; row += 1) {
          const p = project(position.x + .22, position.y + .55, .66 + row * .38);
          ctx.fillStyle = COLORS.yellow;
          ctx.fillRect(p.x - 3 * camera.zoom, p.y - 2 * camera.zoom, 6 * camera.zoom, 3.5 * camera.zoom);
        }
      }
      if (!active) return;

      if (phaseId === "same-graph") {
        drawMiniGraph(project, position, methodColor(method), time);
      } else if (phaseId === "common-ssd-records") {
        const slide = smooth(Math.sin(progress * Math.PI));
        const from = project(position.x, position.y + .62, .72);
        const to = project(position.x, position.y + 1.25, .72);
        drawScreenPacket(mixPoint(from, to, slide), methodColor(method), "FULL+IDs", 1);
        if (method === "aisaq") drawScreenPacket({ x: lerp(from.x, to.x, slide), y: lerp(from.y, to.y, slide) + 10 * camera.zoom }, COLORS.yellow, "+PQ", .9);
      } else if (phaseId === "pq-residency") {
        const scanX = lerp(-.52, .52, (progress + pulse(time, .7) * .12) % 1);
        const top = project(position.x + scanX, position.y - .55, towerHeight + .2);
        const bottom = project(position.x + scanX, position.y + .58, .45);
        I.line(ctx, top, bottom, COLORS.yellow, Math.max(1.2, 2.2 * camera.zoom));
        drawFloatingCounter(project(position.x, position.y - .65, towerHeight + .65), method === "diskann" ? "N PQ IN DRAM" : "n_ep ACTIVE · HOP EMPTY", methodColor(method));
        if (method === "aisaq") drawStatusPlate(project(position.x, position.y + 1.05, .42), "AT HOP · ≤ R + n_ep", COLORS.yellow);
      } else if (phaseId === "prebuilt-not-transfer") {
        const stamp = project(position.x, position.y, towerHeight + .55 + Math.sin(progress * Math.PI) * .45);
        drawStatusPlate(stamp, "INDEX READY", methodColor(method));
        const runtime = project(position.x, position.y + 1.3, .2);
        drawStatusPlate(runtime, "RUNTIME MOVE = 0", COLORS.yellow);
      }
    }

    function drawMiniGraph(project, position, color, time) {
      const points = [
        project(position.x - .45, position.y -.2, 2.9),
        project(position.x + .32, position.y -.35, 3.18),
        project(position.x + .48, position.y + .25, 2.75),
        project(position.x -.28, position.y + .35, 3.05),
      ];
      [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]].forEach((edge) => I.line(ctx, points[edge[0]], points[edge[1]], rgba(color, .78), Math.max(1, 1.6 * camera.zoom)));
      points.forEach((point, index) => I.circle(ctx, point.x, point.y, Math.max(2.2, 4.2 * camera.zoom), pulse(time, 2.4, index) > .32 ? COLORS.yellow : color, COLORS.edge, 1));
    }

    function drawEntryMachine(project, position, method, active, phaseId, progress, time) {
      const wheel = project(position.x, position.y, 1.25);
      drawRotor(wheel, Math.max(10, 18 * camera.zoom), active ? time * 2.4 : time * .25, methodColor(method));
      const queueA = project(position.x - .55, position.y + .82, .52);
      const queueB = project(position.x + .55, position.y + .82, .52);
      I.line(ctx, queueA, queueB, COLORS.steelDark, Math.max(4, 7 * camera.zoom));
      if (!active) return;
      if (phaseId === "query-arrives") {
        drawFloatingCounter(project(position.x, position.y - .7, 1.9), "SAME q · PREPARED", methodColor(method));
      } else if (phaseId === "seed-entrypoint") {
        const locker = method === "diskann" ? project(position.x - .8, position.y, 1.65) : project(position.x + .8, position.y, 1.18);
        const queue = project(position.x, position.y + .72, .7);
        drawScreenPacket(mixPoint(locker, queue, smooth(progress)), COLORS.yellow, "s", 1);
        drawFloatingCounter(project(position.x, position.y - .7, 1.9), method === "diskann" ? "s FROM ALL-N PQ" : "s FROM n_ep", methodColor(method));
      } else if (phaseId === "rank-first-candidate") {
        drawRotor(wheel, Math.max(12, 21 * camera.zoom), time * 6, COLORS.yellow);
        const packet = mixPoint(queueA, queueB, smooth(progress));
        drawScreenPacket(packet, COLORS.yellow, "dPQ(q,s)", .9);
        drawFloatingCounter(project(position.x, position.y - .65, 1.95), "L = {s} · V = ∅", methodColor(method));
      }
    }

    function drawReadMachine(project, position, method, active, phaseId, progress, time, dataset) {
      I.cuboid(ctx, project, position.x - .62, position.y - .58, 1.24, 1.16, 1.7, COLORS.steelDark, { edge: COLORS.edge, lineWidth: Math.max(.7, camera.zoom), shadowOffset: 3 * camera.zoom, frontAccent: methodColor(method) });
      const drawerBase = project(position.x, position.y + .64, 1.05);
      for (let row = 0; row < 3; row += 1) {
        const a = project(position.x - .44, position.y + .59, .62 + row * .37);
        const b = project(position.x + .44, position.y + .59, .62 + row * .37);
        I.line(ctx, a, b, row === 1 && active ? COLORS.yellow : methodColor(method), Math.max(1.2, 2.1 * camera.zoom));
      }
      if (!active) return;
      if (phaseId === "choose-current") {
        const angle = lerp(-.9, .45, smooth(progress));
        const pivot = project(position.x, position.y, 2.05);
        const tip = { x: pivot.x + Math.cos(angle) * 33 * camera.zoom, y: pivot.y + Math.sin(angle) * 23 * camera.zoom };
        I.line(ctx, pivot, tip, COLORS.yellow, Math.max(2, 3 * camera.zoom));
        I.circle(ctx, tip.x, tip.y, Math.max(3, 5 * camera.zoom), COLORS.yellow, COLORS.edge, 1);
        drawFloatingCounter(project(position.x, position.y - .7, 2.45), "top-w · FOLLOW p", methodColor(method));
      } else if (phaseId === "dispatch-read") {
        const source = project(position.x, position.y + 1.7, .3);
        const target = project(position.x, position.y + .68, 1.05);
        drawScreenPacket(mixPoint(source, target, smooth(progress)), methodColor(method), "SSD", 1);
        drawReadBeam(source, target, progress, methodColor(method));
        drawBlockCount(project(position.x, position.y - .7, 2.35), method, dataset);
      } else if (phaseId === "unpack-common-fields") {
        const fullTarget = project(position.x - .7, position.y + 1.25, .45);
        const idsTarget = project(position.x + .7, position.y + 1.25, .45);
        drawScreenPacket(mixPoint(drawerBase, fullTarget, smooth(progress)), methodColor(method), "full(p)", .9);
        for (let index = 0; index < 4; index += 1) {
          const stagger = clamp(progress * 1.5 - index * .12, 0, 1);
          const point = mixPoint(drawerBase, { x: idsTarget.x + index * 7 * camera.zoom, y: idsTarget.y + index * 2 * camera.zoom }, smooth(stagger));
          drawScreenPacket(point, "#b9c0bd", "ID", .55);
        }
      } else if (phaseId === "reveal-neighbor-codes") {
        const origin = method === "diskann" ? project(position.x - 1.65, position.y - .5, 1.8) : drawerBase;
        const target = project(position.x, position.y + 1.32, .55);
        for (let index = 0; index < 4; index += 1) {
          const local = (progress * 1.35 + index * .16) % 1;
          const point = mixPoint(origin, { x: target.x + (index - 1.5) * 8 * camera.zoom, y: target.y }, smooth(local));
          drawScreenPacket(point, COLORS.yellow, "PQ", .72);
        }
        drawFloatingCounter(project(position.x, position.y - .7, 2.4), method === "diskann" ? "IDs → DRAM PQ" : "IDs + PQ · SAME CHUNK", methodColor(method));
      }
    }

    function drawScoreMachine(project, position, method, active, phaseId, progress, time) {
      const wheel = project(position.x, position.y, 1.35);
      drawRotor(wheel, Math.max(13, 23 * camera.zoom), active ? time * 4.7 : time * .35, methodColor(method));
      const left = project(position.x - 1.05, position.y + .3, .65);
      const right = project(position.x + 1.05, position.y + .3, .65);
      I.line(ctx, left, right, COLORS.steelDark, Math.max(5, 8 * camera.zoom));
      if (!active) return;
      if (phaseId === "pair-neighbor-data") {
        for (let index = 0; index < 4; index += 1) {
          const y = (index - 1.5) * 8 * camera.zoom;
          const idPoint = mixPoint({ x: left.x - 28 * camera.zoom, y: left.y + y }, { x: wheel.x - 5 * camera.zoom, y: wheel.y + y * .3 }, smooth(progress));
          const pqPoint = method === "diskann"
            ? mixPoint({ x: left.x - 30 * camera.zoom, y: left.y - 22 * camera.zoom + y }, { x: wheel.x + 5 * camera.zoom, y: wheel.y + y * .3 }, smooth(progress))
            : mixPoint({ x: left.x - 18 * camera.zoom, y: left.y + 6 * camera.zoom + y }, { x: wheel.x + 5 * camera.zoom, y: wheel.y + y * .3 }, smooth(progress));
          drawScreenPacket(idPoint, "#b8bfbc", "ID", .64);
          drawScreenPacket(pqPoint, COLORS.yellow, "PQ", .64);
        }
      } else if (phaseId === "compute-pq-distance") {
        drawRotor(wheel, Math.max(16, 27 * camera.zoom), time * 9, COLORS.yellow);
        for (let index = 0; index < 4; index += 1) {
          const local = (progress + index * .18) % 1;
          drawScreenPacket(mixPoint(wheel, { x: right.x + 20 * camera.zoom, y: right.y + (index - 1.5) * 7 * camera.zoom }, smooth(local)), methodColor(method), "d", .64);
        }
        drawFloatingCounter(project(position.x, position.y - .75, 2.25), "SAME PQ DISTANCE", methodColor(method));
      } else if (phaseId === "update-candidates") {
        for (let index = 0; index < 5; index += 1) {
          const local = clamp(progress * 1.35 - index * .08, 0, 1);
          const target = { x: right.x + 22 * camera.zoom, y: right.y + (index % 3) * 7 * camera.zoom };
          drawScreenPacket(mixPoint(wheel, target, smooth(local)), index < 3 ? COLORS.yellow : COLORS.steel, index < 3 ? "L" : "×", .68);
        }
        drawFloatingCounter(project(position.x, position.y - .75, 2.25), "MERGE · PRUNE L", methodColor(method));
      } else if (phaseId === "release-hop-payload") {
        if (method === "diskann") {
          const warehouse = project(position.x - 1.4, position.y -.7, 1.6);
          drawStatusPlate(warehouse, "N → N RESIDENT", COLORS.blue);
        } else {
          for (let index = 0; index < 4; index += 1) {
            const fade = 1 - smooth(progress);
            ctx.save();
            ctx.globalAlpha *= fade;
            drawScreenPacket({ x: wheel.x + (index - 1.5) * 9 * camera.zoom, y: wheel.y + 20 * camera.zoom }, COLORS.yellow, "PQ", .45);
            ctx.restore();
          }
          drawStatusPlate(project(position.x, position.y - .65, 2.2), "HOP BUFFER → n_ep", COLORS.mint);
          drawStatusPlate(project(position.x, position.y + .9, .45), "SSD COPY INTACT", COLORS.yellow);
        }
      }
    }

    function drawRerankMachine(project, position, method, active, phaseId, progress, time) {
      const rackLeft = project(position.x - .8, position.y + .7, .65);
      const rackRight = project(position.x + .8, position.y + .7, .65);
      I.line(ctx, rackLeft, rackRight, COLORS.steelDark, Math.max(7, 11 * camera.zoom));
      const visitedCount = !active
        ? 0
        : phaseId === "record-current-vector"
          ? 0
          : phaseId === "advance-search"
            ? 1 + Math.floor(progress * 4)
            : 5;
      for (let index = 0; index < 5; index += 1) {
        const point = mixPoint(rackLeft, rackRight, index / 4);
        ctx.save();
        ctx.strokeStyle = rgba(methodColor(method), .45);
        ctx.lineWidth = Math.max(1, camera.zoom);
        ctx.strokeRect(point.x - 5 * camera.zoom, point.y - 4 * camera.zoom, 10 * camera.zoom, 8 * camera.zoom);
        ctx.restore();
        if (index < visitedCount) drawScreenPacket({ x: point.x, y: point.y }, index % 2 ? methodColor(method) : "#9ca5a1", "V", .48);
      }
      const scannerTop = project(position.x, position.y, 2.15);
      I.line(ctx, project(position.x - .8, position.y, .5), project(position.x - .8, position.y, 2.1), COLORS.steel, Math.max(2, 3 * camera.zoom));
      I.line(ctx, project(position.x + .8, position.y, .5), project(position.x + .8, position.y, 2.1), COLORS.steel, Math.max(2, 3 * camera.zoom));
      I.line(ctx, project(position.x - .8, position.y, 2.1), project(position.x + .8, position.y, 2.1), COLORS.steel, Math.max(2, 3 * camera.zoom));
      if (!active) return;
      if (phaseId === "record-current-vector") {
        const start = project(position.x, position.y - 1.1, .95);
        const target = mixPoint(rackLeft, rackRight, .15 + .7 * progress);
        drawScreenPacket(mixPoint(start, target, smooth(progress)), methodColor(method), "full(p)", .8);
        drawFloatingCounter(project(position.x, position.y - .75, 2.4), "|V| + 1", methodColor(method));
      } else if (phaseId === "advance-search") {
        const loop = [
          project(position.x - 1, position.y - .8, .9),
          project(position.x + .9, position.y - .8, .9),
          project(position.x + .9, position.y + .65, .9),
          project(position.x - 1, position.y + .65, .9),
        ];
        const local = (progress * 2.8) % 1;
        const pathIndex = Math.min(loop.length - 2, Math.floor(local * (loop.length - 1)));
        const pathT = local * (loop.length - 1) - pathIndex;
        drawQueryPod(mixPoint(loop[pathIndex], loop[pathIndex + 1], pathT), method);
        drawFloatingCounter(project(position.x, position.y - .75, 2.4), method === "diskann" ? "SSD → DRAM PQ → SCORE" : "SSD IDs+PQ → SCORE", methodColor(method));
      } else if (phaseId === "rerank-visited") {
        const scan = mixPoint(rackLeft, rackRight, .5 + .5 * Math.sin(progress * Math.PI - Math.PI / 2));
        I.line(ctx, { x: scan.x, y: scannerTop.y }, { x: scan.x, y: rackLeft.y + 14 * camera.zoom }, COLORS.yellow, Math.max(1.5, 3 * camera.zoom));
        drawFloatingCounter(project(position.x, position.y - .75, 2.4), "FULL-DISTANCE SORT(V)", methodColor(method));
      } else if (phaseId === "return-results") {
        for (let index = 0; index < 3; index += 1) {
          const local = clamp(progress * 1.35 - index * .13, 0, 1);
          const from = mixPoint(rackLeft, rackRight, index / 4);
          const to = project(position.x + 1.8, position.y + .2 + index * .28, .7);
          drawScreenPacket(mixPoint(from, to, smooth(local)), COLORS.yellow, `${index + 1}`, .65);
        }
        drawFloatingCounter(project(position.x, position.y - .75, 2.4), "3 SHOWN · TOP-k ILLUSTRATIVE", methodColor(method));
      }
    }

    function drawBlockMachine(project, position, method, active, phaseId, progress, time, dataset) {
      const stats = BLOCKS[dataset] || BLOCKS.SIFT1B;
      const count = stats[method];
      const blockWidth = .55;
      for (let index = 0; index < count; index += 1) {
        I.cuboid(ctx, project, position.x - count * blockWidth * .5 + index * blockWidth, position.y -.55, blockWidth - .05, 1.1, .38, method === "diskann" ? COLORS.blueDeep : COLORS.mintDeep, { edge: COLORS.edge, lineWidth: Math.max(.6, camera.zoom), shadow: false, frontAccent: method === "aisaq" ? COLORS.yellow : methodColor(method) });
      }
      const arm = project(position.x + Math.sin(time * .7) * .65, position.y - .8, 1.65);
      I.line(ctx, project(position.x, position.y -.8, 2.2), arm, COLORS.steel, Math.max(2, 3 * camera.zoom));
      if (!active) return;
      drawStatusPlate(project(position.x, position.y + 1.15, .2), "DERIVED · TABLE 1 · 4 KB MODEL", COLORS.yellow);
      if (phaseId === "build-chunk-formulas") {
        const start = project(position.x - 1.6, position.y, .75);
        const end = project(position.x, position.y, .75);
        drawScreenPacket(mixPoint(start, end, smooth(progress)), methodColor(method), "full+deg+IDs", .65);
        if (method === "aisaq") drawScreenPacket(mixPoint(project(position.x + 1.6, position.y, .75), end, smooth(progress)), COLORS.yellow, "R·bPQ", .72);
        drawFloatingCounter(project(position.x, position.y - .75, 2.45), method === "diskann" ? "B_D = b_full + b_num(R+1)" : "B_A = B_D + R·bPQ", methodColor(method));
      } else if (phaseId === "pack-lba-blocks") {
        const sweep = lerp(-1.1, 1.1, smooth(progress));
        I.line(ctx, project(position.x + sweep, position.y -.8, 1.8), project(position.x + sweep, position.y + .8, .3), COLORS.yellow, Math.max(1.5, 3 * camera.zoom));
        drawBlockCount(project(position.x, position.y - .75, 2.35), method, dataset);
      } else if (phaseId === "compare-paper-presets") {
        const labels = ["S1M 1→2", "S1B 1→1", "KILT 2→4"];
        labels.forEach((label, index) => {
          const point = project(position.x + (index - 1) * .82, position.y + (index % 2 ? .1 : -.1), 1.55);
          drawScreenPacket(point, index === 1 ? COLORS.yellow : methodColor(method), label, .5);
        });
        drawFloatingCounter(project(position.x, position.y - .75, 2.45), "DISKANN → AiSAQ BLOCKS", methodColor(method));
      } else if (phaseId === "interpret-io-cost") {
        const from = project(position.x - 1.15, position.y -.7, 1.55);
        const to = project(position.x + 1.15, position.y + .7, .45);
        drawReadBeam(from, to, progress, COLORS.yellow);
        drawFloatingCounter(project(position.x, position.y - .75, 2.45), `ONE CHUNK REQUEST · ${count} BLOCK${count === 1 ? "" : "S"}`, methodColor(method));
      }
    }

    function drawEvidenceMachine(project, position, method, active, phaseId, progress, time, dataset) {
      const values = MEMORY[dataset] || MEMORY.SIFT1B;
      const memory = values[method];
      const normalized = method === "diskann" ? .95 : .24;
      const barHeight = active && phaseId === "memory-and-load-evidence" ? .5 + normalized * 2.4 * smooth(progress) : .7 + normalized;
      I.cuboid(ctx, project, position.x - .45, position.y - .45, .9, .9, barHeight, methodDeep(method), { edge: COLORS.edge, lineWidth: Math.max(.7, camera.zoom), shadowOffset: 3 * camera.zoom, frontAccent: methodColor(method) });
      if (!active) return;
      if (phaseId === "memory-and-load-evidence") {
        drawFloatingCounter(project(position.x, position.y - .65, barHeight + .55), `${memory.toLocaleString()} MB`, methodColor(method));
        drawStatusPlate(project(position.x, position.y + .8, .55), `LOAD ${values[method === "diskann" ? "loadDisk" : "loadAi"].toLocaleString()} ms`, COLORS.yellow);
        drawStatusPlate(project(position.x, position.y + 1.23, .28), "MEASURED TABLE 2/3 · BAR SCHEMATIC", COLORS.yellow);
      } else if (phaseId === "switch-evidence") {
        const trainCount = method === "diskann" ? 5 : 2;
        for (let index = 0; index < trainCount; index += 1) {
          const local = (progress + index / trainCount) % 1;
          const lane = method === "aisaq" ? (index - .5) * .55 : 0;
          const start = project(position.x - 1.7, position.y + .4 + lane, .7);
          const end = project(position.x + 1.7, position.y + .4 + lane, .7);
          const packetLabel = method === "diskann" ? "PQ" : (index === 0 ? "CENTROIDS" : "4KB META");
          drawScreenPacket(mixPoint(start, end, local), index === trainCount - 1 ? COLORS.yellow : methodColor(method), packetLabel, .68);
        }
        drawFloatingCounter(project(position.x, position.y - .65, 2.4), method === "diskann" ? "119.2 ms · LOAD PQ ARRAY" : "1.9 ms RELOAD · 0.3 ms SHARED", methodColor(method));
      } else if (phaseId === "storage-latency-cost") {
        const servers = 3;
        for (let index = 0; index < servers; index += 1) {
          I.cuboid(ctx, project, position.x - 1.25 + index * .8, position.y + .2, .55, .65, .65 + index * .12, methodDeep(method), { edge: COLORS.edge, lineWidth: Math.max(.55, camera.zoom), shadow: false, frontAccent: methodColor(method) });
          if (method === "diskann") drawScreenPacket(project(position.x - 1.02 + index * .8, position.y + .5, 1.12), COLORS.yellow, "N·PQ", .45);
        }
        if (method === "aisaq") drawStatusPlate(project(position.x, position.y -.55, 1.65), "SHARED SSD · R·N·bPQ", COLORS.yellow);
        drawFloatingCounter(project(position.x, position.y - .65, 2.35), method === "diskann" ? "DRAM REPEATS / SERVER" : "MODEL WINS > 2 SERVERS", methodColor(method));
      } else if (phaseId === "implementation-boundaries") {
        const shutters = smooth(progress);
        const left = project(position.x - 1.1 + shutters * .45, position.y -.4, 2.1);
        const right = project(position.x + 1.1 - shutters * .45, position.y -.4, 2.1);
        I.line(ctx, left, project(position.x - 1.1 + shutters * .45, position.y + .7, .4), COLORS.coral, Math.max(5, 8 * camera.zoom));
        I.line(ctx, right, project(position.x + 1.1 - shutters * .45, position.y + .7, .4), COLORS.coral, Math.max(5, 8 * camera.zoom));
        drawFloatingCounter(project(position.x, position.y - .7, 2.5), method === "diskann" ? "BASELINE FEATURE CONTEXT" : "EVALUATED BUILD · 11–14 MB", methodColor(method));
        if (method === "aisaq") {
          drawStatusPlate(project(position.x -.5, position.y + .9, .55), "EVAL BUILD · NO FILTERING", COLORS.coral);
          drawStatusPlate(project(position.x + .5, position.y + .9, .55), "EVAL BUILD · NO DYNAMIC INDEX", COLORS.coral);
        }
      }
    }

    function drawRotor(center, radius, angle, color) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle);
      ctx.strokeStyle = COLORS.edge;
      ctx.lineWidth = Math.max(2, 3 * camera.zoom);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let index = 0; index < 12; index += 1) {
        const a = index * Math.PI / 6;
        const r = index % 2 ? radius * .76 : radius;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      I.circle(ctx, 0, 0, radius * .28, COLORS.ink2, COLORS.paper, Math.max(.7, camera.zoom));
      ctx.restore();
    }

    function drawScreenPacket(point, color, label, scale) {
      const size = Math.max(5, 9 * camera.zoom * (scale || 1));
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.fillStyle = color;
      ctx.strokeStyle = COLORS.edge;
      ctx.lineWidth = Math.max(.65, camera.zoom);
      ctx.fillRect(-size / 2, -size * .38, size, size * .76);
      ctx.strokeRect(-size / 2, -size * .38, size, size * .76);
      if (label && camera.zoom > .53) {
        ctx.fillStyle = COLORS.ink;
        ctx.font = `800 ${Math.max(4.5, 6.2 * camera.zoom)}px ${getComputedStyle(document.documentElement).getPropertyValue("--data")}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 0, .4);
      }
      ctx.restore();
    }

    function drawQueryPod(point, method) {
      const radius = Math.max(6, 10 * camera.zoom);
      const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.2);
      glow.addColorStop(0, rgba(COLORS.yellow, .72));
      glow.addColorStop(1, rgba(COLORS.yellow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(point.x - radius * 2.3, point.y - radius * 2.3, radius * 4.6, radius * 4.6);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.fillStyle = COLORS.yellow;
      ctx.strokeStyle = methodColor(method);
      ctx.lineWidth = Math.max(2, 3 * camera.zoom);
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius * .88, radius * .7);
      ctx.lineTo(-radius * .88, radius * .7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function drawReadBeam(from, to, progress, color) {
      I.line(ctx, from, to, rgba(color, .32), Math.max(4, 7 * camera.zoom));
      const head = mixPoint(from, to, smooth(progress));
      I.circle(ctx, head.x, head.y, Math.max(3, 5 * camera.zoom), color, COLORS.edge, 1);
    }

    function drawFloatingCounter(point, text, accent) {
      if (!labelsEnabled || camera.zoom < .48) return;
      I.label(ctx, text, point.x, point.y, {
        fontSize: Math.max(6.5, 8 * camera.zoom),
        padX: Math.max(5, 7 * camera.zoom),
        padY: Math.max(3, 4 * camera.zoom),
        background: "rgba(18,21,20,.94)",
        accent,
        color: COLORS.paper,
        font: '"SFMono-Regular", Consolas, monospace',
        weight: 800,
      });
    }

    function drawStatusPlate(point, text, accent) {
      if (!labelsEnabled || camera.zoom < .4) return;
      I.label(ctx, text, point.x, point.y, {
        fontSize: Math.max(5.8, 7 * camera.zoom),
        padX: Math.max(4, 6 * camera.zoom),
        padY: Math.max(2.5, 3.5 * camera.zoom),
        background: rgba(COLORS.ink, .94),
        accent,
        color: accent === COLORS.yellow ? COLORS.yellow : COLORS.paper,
        font: '"SFMono-Regular", Consolas, monospace',
        weight: 800,
      });
    }

    function drawBlockCount(point, method, dataset) {
      const stats = BLOCKS[dataset] || BLOCKS.SIFT1B;
      const count = stats[method];
      drawFloatingCounter(point, `DERIVED · ${stats.bytes[method === "diskann" ? 0 : 1].toLocaleString()} B · ${count} × 4 KB`, methodColor(method));
    }

    function drawStationLabel(project, station, index, active) {
      if (!labelsEnabled) return;
      if (camera.zoom < .48 && !active) return;
      const point = project(station.x, station.y - 1.75, 2.9);
      const label = active ? `${index + 1}. ${station.label}` : station.short;
      I.label(ctx, label, point.x, point.y, {
        fontSize: active ? Math.max(7.5, 10 * camera.zoom) : Math.max(5.5, 7 * camera.zoom),
        padX: active ? 8 : 5,
        padY: active ? 5 : 3,
        background: active ? "rgba(19,22,21,.96)" : "rgba(25,28,27,.82)",
        accent: active ? COLORS.yellow : "#636862",
        color: active ? COLORS.paper : "#c2c3bd",
        weight: active ? 850 : 700,
      });
    }

    function drawQueryTravel(project, state, context, ambientTime) {
      if (state.stageIndex === 0 || state.stageIndex >= 5 || context.phaseIndex !== 0) return;
      const station = STATIONS[state.stageIndex];
      const previous = STATIONS[state.stageIndex - 1];
      const phaseProgress = context.phaseProgress || 0;
      const arriving = context.phaseIndex === 0 ? smooth(clamp(phaseProgress * 1.8, 0, 1)) : 1;
      const base = { x: lerp(previous.x, station.x, arriving), y: lerp(previous.y, station.y, arriving) };
      ["diskann", "aisaq"].forEach((method) => {
        const offset = method === "diskann" ? -1 : 1;
        const point = project(base.x + offset * .22, base.y - offset * .22, .8 + pulse(ambientTime, 3.4, offset) * .08);
        ctx.save();
        ctx.globalAlpha *= methodAlpha(state, method);
        drawQueryPod(point, method);
        ctx.restore();
      });
      if (labelsEnabled && camera.zoom > .58) drawStatusPlate(project(base.x, base.y - .45, 1.45), "SAME q · TWO LAYOUTS", COLORS.yellow);
    }

    function drawInvariantRail(project) {
      if (!labelsEnabled || camera.zoom < .56) return;
      const point = project(14, 9.5, .1);
      drawStatusPlate({ x: point.x, y: logicalHeight - (logicalWidth <= 760 ? 118 : 108) }, "SAME GRAPH · SAME PQ MATH · SAME L/V RULES · SAME RE-RANK", COLORS.yellow);
    }

    function render(state, context) {
      const now = performance.now();
      const motionSeconds = Math.min(.05, Math.max(0, (now - lastMotionFrame) / 1000));
      if (state.playing && !reducedMotion) motionTime += motionSeconds;
      lastMotionFrame = now;
      updateCamera(state, context || {}, now);
      const project = makeProjection();
      const ambientTime = motionTime;
      const phaseId = context && context.phase ? context.phase.id : "";
      const phaseProgress = context && Number.isFinite(context.phaseProgress) ? context.phaseProgress : 0;
      labelsEnabled = state.labels !== false;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGradientSky();
      drawFloor(project);
      drawRoute(project, ambientTime);
      drawBackground(project, ambientTime);

      stationScreens = STATIONS.map((station, index) => ({ index, point: project(station.x, station.y, 1.3) }));
      const ordered = STATIONS.map((station, index) => ({ station, index })).sort((a, b) => (a.station.x + a.station.y) - (b.station.x + b.station.y));
      ordered.forEach(({ station, index }) => {
        const active = index === state.stageIndex;
        drawPlatform(project, station, active, ambientTime);
        drawMachine(project, station, "diskann", active, phaseId, phaseProgress, state, ambientTime);
        drawMachine(project, station, "aisaq", active, phaseId, phaseProgress, state, ambientTime);
        drawStationLabel(project, station, index, active);
      });

      drawQueryTravel(project, state, context || {}, ambientTime);
      drawInvariantRail(project);
      return !reducedMotion || state.playing;
    }

    function zoomBy(delta) {
      const base = cameraMode === "manual" ? manualTarget : camera;
      cameraMode = "manual";
      manualTarget = { x: base.x, y: base.y, zoom: clamp(base.zoom + delta, .29, 1.61) };
    }

    function fit() {
      cameraMode = "fit";
      zoomNudge = 0;
    }

    function follow() {
      cameraMode = "follow";
      zoomNudge = 0;
    }

    function panBy(screenX, screenY) {
      const tileW = Math.max(1, 52 * camera.zoom);
      const tileH = Math.max(1, 27 * camera.zoom);
      const base = cameraMode === "manual" ? manualTarget : camera;
      cameraMode = "manual";
      manualTarget = {
        x: base.x - screenX / tileW - screenY / tileH,
        y: base.y + screenX / tileW - screenY / tileH,
        zoom: base.zoom,
      };
    }

    function setPanelVisible(value) { panelVisible = Boolean(value); }

    function pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const point = { x: clientX - rect.left, y: clientY - rect.top };
      let best = null;
      stationScreens.forEach((station) => {
        const distance = Math.hypot(point.x - station.point.x, point.y - station.point.y);
        if (distance < Math.max(26, 45 * camera.zoom) && (!best || distance < best.distance)) best = { index: station.index, distance };
      });
      return best ? best.index : null;
    }

    return { resize, render, zoomBy, fit, follow, panBy, setPanelVisible, pick };
  }

  window.createAiSAQRenderer = createRenderer;
})();
