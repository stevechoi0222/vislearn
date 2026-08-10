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
    observatory: "#071014",
    observatory2: "#0b171c",
    ssd: "#35c8b0",
    dram: "#5a82ef",
    cpu: "#f5c84c",
    full: "#ec7c68",
    ids: "#d8e1de",
    pq: "#f5c84c",
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
    let camera = { x: 0, y: 0, zoom: 1 };
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

    function fitZoom() { return 1; }

    function cameraTarget(state, context) {
      if (cameraMode === "manual") return manualTarget;
      if (cameraMode === "fit" || !state.follow) return { x: 0, y: 0, zoom: fitZoom() + zoomNudge };
      return { x: 0, y: 0, zoom: 1 + zoomNudge };
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

    /* ------------------------------------------------ Byte Transit Observatory
       This renderer is deliberately orthographic. The subject is not a factory
       process any more; it is a byte path whose source, temporary residence and
       surviving scalar state must remain visible while the learner scrubs time. */

    const OBS_FONT = '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif';
    const OBS_DATA = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
    const PACKING = Object.freeze({
      SIFT1M: { full: 512, meta: 228, pq: 7168 },
      SIFT1B: { full: 128, meta: 212, pq: 1664 },
      "KILT E5 22M": { full: 4096, meta: 280, pq: 8832 },
    });

    function obsRectPath(x, y, width, height, radius) {
      const r = Math.min(Math.max(0, radius || 0), width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function obsBox(x, y, width, height, options) {
      const o = options || {};
      ctx.save();
      if (o.shadow) {
        ctx.fillStyle = o.shadowColor || "rgba(0,0,0,.26)";
        obsRectPath(x + 6, y + 8, width, height, o.radius || 6);
        ctx.fill();
      }
      ctx.fillStyle = o.fill || COLORS.observatory2;
      obsRectPath(x, y, width, height, o.radius || 6);
      ctx.fill();
      if (o.stroke !== false) {
        ctx.strokeStyle = o.stroke || "#34505a";
        ctx.lineWidth = o.lineWidth || 1;
        ctx.stroke();
      }
      if (o.accent) {
        ctx.fillStyle = o.accent;
        ctx.fillRect(x, y, width, Math.max(2, o.accentWidth || 3));
      }
      ctx.restore();
    }

    function obsText(text, x, y, options) {
      const o = options || {};
      ctx.save();
      ctx.fillStyle = o.color || "#dce8e5";
      ctx.font = `${o.weight || 700} ${o.size || 11}px ${o.data ? OBS_DATA : OBS_FONT}`;
      ctx.textAlign = o.align || "left";
      ctx.textBaseline = o.baseline || "alphabetic";
      if (o.maxWidth) ctx.fillText(String(text), x, y, o.maxWidth);
      else ctx.fillText(String(text), x, y);
      ctx.restore();
    }

    function obsRule(x1, y1, x2, y2, color, width, dash) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    function obsArrow(from, to, options) {
      const o = options || {};
      const color = o.color || COLORS.cpu;
      const width = o.width || 2;
      const alpha = Number.isFinite(o.alpha) ? o.alpha : 1;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / length;
      const uy = dy / length;
      const head = Math.max(7, width * 3.2);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x - ux * head * .6, to.y - uy * head * .6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - ux * head - uy * head * .52, to.y - uy * head + ux * head * .52);
      ctx.lineTo(to.x - ux * head + uy * head * .52, to.y - uy * head - ux * head * .52);
      ctx.closePath();
      ctx.fill();
      if (Number.isFinite(o.progress)) {
        const t = smooth(clamp(o.progress, 0, 1));
        const px = lerp(from.x, to.x, t);
        const py = lerp(from.y, to.y, t);
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(3.5, width * 1.8), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function obsSceneRect() {
      const mobile = logicalWidth <= 760;
      const compact = logicalWidth <= 1180 && !mobile;
      const left = mobile ? 8 : compact ? Math.min(238, logicalWidth * .23) : Math.min(336, logicalWidth * .255);
      const right = mobile ? 8 : panelVisible ? (compact ? Math.min(248, logicalWidth * .24) : Math.min(372, logicalWidth * .265)) : 24;
      const top = mobile ? 226 : 94;
      const bottom = mobile ? logicalHeight - 202 : logicalHeight - 136;
      return {
        x: left,
        y: top,
        width: Math.max(280, logicalWidth - left - right),
        height: Math.max(300, bottom - top),
        mobile,
      };
    }

    function obsBackground(scene) {
      const gradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
      gradient.addColorStop(0, "#091419");
      gradient.addColorStop(.62, COLORS.observatory);
      gradient.addColorStop(1, "#040a0d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      ctx.save();
      ctx.beginPath();
      ctx.rect(scene.x, scene.y, scene.width, scene.height);
      ctx.clip();
      ctx.strokeStyle = "rgba(103,139,151,.08)";
      ctx.lineWidth = 1;
      const grid = scene.mobile ? 28 : 34;
      for (let x = scene.x - (scene.x % grid); x < scene.x + scene.width; x += grid) {
        ctx.beginPath(); ctx.moveTo(x, scene.y); ctx.lineTo(x, scene.y + scene.height); ctx.stroke();
      }
      for (let y = scene.y - (scene.y % grid); y < scene.y + scene.height; y += grid) {
        ctx.beginPath(); ctx.moveTo(scene.x, y); ctx.lineTo(scene.x + scene.width, y); ctx.stroke();
      }
      ctx.restore();
      obsRule(scene.x, scene.y, scene.x + scene.width, scene.y, "rgba(128,165,176,.34)", 1);
      obsRule(scene.x, scene.y + scene.height, scene.x + scene.width, scene.y + scene.height, "rgba(128,165,176,.22)", 1);
    }

    function obsWorldTransform(scene) {
      const cx = scene.x + scene.width / 2;
      const cy = scene.y + scene.height / 2;
      ctx.translate(cx + camera.x * 18, cy + camera.y * 18);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-cx, -cy);
    }

    function obsLayout(scene) {
      const rail = scene.mobile ? 22 : 26;
      const common = scene.mobile ? 38 : 44;
      const gap = scene.mobile ? 8 : 11;
      const innerTop = scene.y + rail + gap;
      const commonY = innerTop;
      const lanesY = commonY + common + gap;
      const lanesHeight = scene.height - rail - common - gap * 3;
      const hostH = Math.max(66, lanesHeight * .245);
      const dramH = Math.max(78, lanesHeight * .285);
      const ssdH = Math.max(88, lanesHeight - hostH - dramH - gap * 2);
      const methodGap = scene.mobile ? 8 : 18;
      const laneWidth = (scene.width - methodGap) / 2;
      return {
        railY: scene.y,
        common: { x: scene.x, y: commonY, width: scene.width, height: common },
        diskann: {
          x: scene.x, width: laneWidth,
          host: { x: scene.x, y: lanesY, width: laneWidth, height: hostH },
          dram: { x: scene.x, y: lanesY + hostH + gap, width: laneWidth, height: dramH },
          ssd: { x: scene.x, y: lanesY + hostH + dramH + gap * 2, width: laneWidth, height: ssdH },
        },
        aisaq: {
          x: scene.x + laneWidth + methodGap, width: laneWidth,
          host: { x: scene.x + laneWidth + methodGap, y: lanesY, width: laneWidth, height: hostH },
          dram: { x: scene.x + laneWidth + methodGap, y: lanesY + hostH + gap, width: laneWidth, height: dramH },
          ssd: { x: scene.x + laneWidth + methodGap, y: lanesY + hostH + dramH + gap * 2, width: laneWidth, height: ssdH },
        },
        gap,
      };
    }

    function obsStageRail(scene, state, context) {
      const y = scene.y + 11;
      const left = scene.x + 4;
      const width = scene.width - 8;
      const cell = width / STATIONS.length;
      stationScreens = [];
      STATIONS.forEach((station, index) => {
        const x = left + index * cell;
        const active = index === state.stageIndex;
        ctx.fillStyle = active ? COLORS.cpu : "rgba(86,116,126,.25)";
        ctx.fillRect(x + 2, y, Math.max(2, cell - 4), active ? 4 : 2);
        const cx = x + cell / 2;
        stationScreens.push({ index, point: { x: cx, y: y + 5 } });
        if (labelsEnabled && (!scene.mobile || active)) {
          obsText(active ? `${index + 1} · ${station.short}` : String(index + 1), cx, y + 17, {
            size: active ? 8.5 : 7,
            data: true,
            color: active ? COLORS.cpu : "#718b94",
            align: "center",
            weight: 800,
            maxWidth: Math.max(16, cell - 5),
          });
        }
      });
      const label = context?.trace?.stateLabel || context?.trace?.scene?.stateLabel || context?.phase?.label || "TRACE";
      if (!scene.mobile && labelsEnabled) {
        obsText(label, scene.x + scene.width, y + 18, { size: 8, data: true, align: "right", color: "#9eb1b7", maxWidth: scene.width * .45 });
      }
    }

    function obsCommonHost(box, state, context) {
      obsBox(box.x, box.y, box.width, box.height, { fill: "rgba(11,25,31,.95)", stroke: "#38525c", accent: COLORS.cpu, radius: 4 });
      const small = box.height < 42;
      const qx = box.x + box.width * .18;
      const lutx = box.x + box.width * .55;
      const cy = box.y + box.height * .58;
      ctx.save();
      ctx.fillStyle = COLORS.cpu;
      ctx.strokeStyle = "#fff0a2";
      ctx.lineWidth = 2;
      const radius = small ? 7 : 9;
      ctx.beginPath();
      ctx.arc(qx, cy, radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      obsText("q", qx, cy + 3, { size: small ? 8 : 10, data: true, color: COLORS.observatory, align: "center", weight: 900 });
      obsText("QUERY PINNED IN HOST", qx + radius + 7, cy + 3, { size: small ? 6.5 : 8, data: true, color: "#d7e1df", weight: 800, maxWidth: box.width * .27 });

      const lutW = box.width * .25;
      obsBox(lutx - lutW / 2, cy - (small ? 8 : 10), lutW, small ? 16 : 20, { fill: "#392f14", stroke: "#8f7627", radius: 3 });
      obsText("CENTROIDS + q→LUT", lutx, cy + 3, { size: small ? 6.5 : 8, data: true, color: COLORS.cpu, align: "center", weight: 800, maxWidth: lutW - 8 });
      obsArrow({ x: qx + box.width * .15, y: cy }, { x: lutx - lutW / 2 - 5, y: cy }, { color: COLORS.cpu, width: 1.5, alpha: .62, dash: [4, 4] });

      const scope = box.x + box.width * .87;
      obsText("q DOES NOT DESCEND", scope, cy - 1, { size: small ? 6 : 7.5, data: true, color: "#aebfc3", align: "center", weight: 800, maxWidth: box.width * .22 });
      obsText("cache-miss trace", scope, cy + (small ? 8 : 11), { size: small ? 5.5 : 6.5, data: true, color: "#6f8991", align: "center" });
    }

    function obsLaneHeader(lane, method, state, scene) {
      const dimmed = state.view !== "split" && state.view !== method;
      const marker = method === "diskann" ? "■" : "◆";
      const title = method === "diskann" ? "DISKANN" : "AISAQ";
      const detail = method === "diskann" ? "GLOBAL PQ ARRAY" : "FULL-INLINE NODE CHUNK";
      obsText(`${marker} ${title}`, lane.x + 8, lane.host.y - 7, { size: scene.mobile ? 8 : 10, data: true, color: dimmed ? "#5f737a" : "#ecf2ef", weight: 900 });
      obsText(detail, lane.x + lane.width - 7, lane.host.y - 7, { size: scene.mobile ? 5.5 : 7, data: true, color: dimmed ? "#53666d" : "#7f969e", align: "right", maxWidth: lane.width * .55 });
      obsRule(lane.x, lane.host.y - 2, lane.x + lane.width, lane.host.y - 2, dimmed ? "#273a41" : "#9aacb1", 1.2, method === "aisaq" ? [7, 5] : null);
    }

    function obsTierBox(box, title, accent, scene) {
      obsBox(box.x, box.y, box.width, box.height, { fill: "rgba(11,26,32,.96)", stroke: "#314b54", accent, radius: 4 });
      obsText(title, box.x + 8, box.y + (scene.mobile ? 11 : 14), { size: scene.mobile ? 6.5 : 8, data: true, color: accent, weight: 900, maxWidth: box.width - 16 });
    }

    function obsQueue(host, scene, exact) {
      const pad = scene.mobile ? 6 : 8;
      const y = host.y + host.height * .52;
      const h = Math.max(22, host.height * .34);
      const rowX = host.x + pad;
      const rowW = host.width - pad * 2;
      const gap = scene.mobile ? 2 : 4;
      const candidateW = rowW * .48;
      const seenW = rowW * .19;
      const exactW = rowW - candidateW - seenW - gap * 2;
      const cells = {
        candidate: { x: rowX, width: candidateW },
        seen: { x: rowX + candidateW + gap, width: seenW },
        exact: { x: rowX + candidateW + seenW + gap * 2, width: exactW },
      };
      obsBox(cells.candidate.x, y, cells.candidate.width, h, { fill: "#0c191e", stroke: exact ? "#405862" : "#9a7c24", radius: 3 });
      obsBox(cells.seen.x, y, cells.seen.width, h, { fill: "#0c191e", stroke: "#405862", radius: 3 });
      obsBox(cells.exact.x, y, cells.exact.width, h, { fill: exact ? "#3e211d" : "#0c191e", stroke: exact ? COLORS.full : "#405862", radius: 3 });
      const titleSize = scene.mobile ? 4.5 : 6.2;
      const valueSize = scene.mobile ? 4.3 : 6.4;
      obsText("L · CANDIDATES", cells.candidate.x + 4, y + (scene.mobile ? 8 : 10), { size: titleSize, data: true, color: "#aebfc3", weight: 900, maxWidth: cells.candidate.width - 8 });
      obsText("ID + d_PQ + flag", cells.candidate.x + cells.candidate.width - 4, y + h - (scene.mobile ? 5 : 7), { size: valueSize, data: true, color: COLORS.cpu, align: "right", weight: 800, maxWidth: cells.candidate.width - 8 });
      obsText("SEEN", cells.seen.x + cells.seen.width / 2, y + (scene.mobile ? 8 : 10), { size: titleSize, data: true, color: "#aebfc3", align: "center", weight: 900, maxWidth: cells.seen.width - 4 });
      obsText("IDs", cells.seen.x + cells.seen.width / 2, y + h - (scene.mobile ? 5 : 7), { size: valueSize, data: true, color: COLORS.ids, align: "center", weight: 800, maxWidth: cells.seen.width - 4 });
      obsText("EXACT", cells.exact.x + cells.exact.width / 2, y + (scene.mobile ? 8 : 10), { size: titleSize, data: true, color: exact ? "#ffc0b4" : "#71868c", align: "center", weight: 900, maxWidth: cells.exact.width - 4 });
      obsText("ID + d_full", cells.exact.x + cells.exact.width / 2, y + h - (scene.mobile ? 5 : 7), { size: valueSize, data: true, color: exact ? "#f0a394" : "#71868c", align: "center", weight: 800, maxWidth: cells.exact.width - 4 });
      return {
        candidate: { x: cells.candidate.x + cells.candidate.width / 2, y: y + h / 2 },
        seen: { x: cells.seen.x + cells.seen.width / 2, y: y + h / 2 },
        exact: { x: cells.exact.x + cells.exact.width / 2, y: y + h / 2 },
      };
    }

    function obsScratch(dram, method, scene, phaseId) {
      const pad = scene.mobile ? 6 : 8;
      const bankW = method === "diskann" ? dram.width * .42 : dram.width * .24;
      const scratchX = dram.x + bankW + pad * 2;
      const scratchW = dram.width - bankW - pad * 3;
      const y = dram.y + (scene.mobile ? 17 : 21);
      const h = dram.height - (scene.mobile ? 23 : 29);
      obsBox(dram.x + pad, y, bankW, h, { fill: method === "diskann" ? "#172a61" : "#132b38", stroke: method === "diskann" ? "#5878da" : "#3d6471", radius: 3 });
      obsText(method === "diskann" ? "GLOBAL PQ" : "n_ep", dram.x + pad + bankW / 2, y + 12, { size: scene.mobile ? 5.5 : 7, data: true, color: method === "diskann" ? "#a9bdff" : "#9fb8bf", align: "center", weight: 900, maxWidth: bankW - 6 });
      if (method === "diskann") {
        const rows = scene.mobile ? 3 : 5;
        for (let index = 0; index < rows; index += 1) {
          ctx.fillStyle = index % 2 ? "#496bd0" : "#3156bc";
          ctx.fillRect(dram.x + pad + 5, y + 19 + index * ((h - 25) / rows), bankW - 10, Math.max(2, (h - 30) / rows - 2));
        }
      } else {
        ctx.fillStyle = COLORS.pq;
        ctx.fillRect(dram.x + pad + bankW * .3, y + 22, bankW * .4, Math.max(4, h - 30));
      }
      const released = phaseId === "release-hop-payload";
      obsBox(scratchX, y, scratchW, h, { fill: released ? "rgba(18,38,46,.35)" : "#102a42", stroke: released ? "#526970" : COLORS.dram, radius: 3 });
      obsText("4 KiB-ALIGNED SCRATCH", scratchX + scratchW / 2, y + 12, { size: scene.mobile ? 5 : 6.8, data: true, color: released ? "#768b91" : "#a9bdff", align: "center", weight: 900, maxWidth: scratchW - 8 });
      if (released) {
        obsText("REUSABLE · SSD COPY INTACT", scratchX + scratchW / 2, y + h * .64, { size: scene.mobile ? 4.8 : 6.5, data: true, color: "#81969c", align: "center", weight: 800, maxWidth: scratchW - 8 });
      }
      return { bank: { x: dram.x + pad, y, width: bankW, height: h }, scratch: { x: scratchX, y, width: scratchW, height: h } };
    }

    function obsPayloadFields(x, y, width, height, method, dataset, options) {
      const o = options || {};
      const data = PACKING[dataset] || PACKING.SIFT1B;
      const fields = [
        { key: "FULL", bytes: data.full, color: COLORS.full, text: "#2c1612" },
        { key: "DEG + IDs", bytes: data.meta, color: COLORS.ids, text: "#1b262a" },
      ];
      if (method === "aisaq") fields.push({ key: "NEIGHBOR PQ", bytes: data.pq, color: COLORS.pq, text: "#2b250e" });
      const total = fields.reduce((sum, field) => sum + field.bytes, 0);
      let cursor = x;
      fields.forEach((field, index) => {
        const raw = width * field.bytes / total;
        const segmentWidth = index === fields.length - 1 ? x + width - cursor : raw;
        ctx.fillStyle = field.color;
        ctx.fillRect(cursor, y, segmentWidth, height);
        if (segmentWidth > (o.compact ? 30 : 42) && labelsEnabled) {
          obsText(field.key, cursor + segmentWidth / 2, y + height / 2 + 3, { size: o.compact ? 5.3 : 7, data: true, color: field.text, align: "center", weight: 900, maxWidth: segmentWidth - 5 });
        }
        cursor += segmentWidth;
      });
      ctx.strokeStyle = "rgba(4,13,16,.72)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
    }

    function obsSsdBlocks(ssd, method, dataset, scene) {
      const stats = BLOCKS[dataset] || BLOCKS.SIFT1B;
      const data = PACKING[dataset] || PACKING.SIFT1B;
      const count = stats[method];
      const pad = scene.mobile ? 6 : 9;
      const y = ssd.y + (scene.mobile ? 18 : 23);
      const height = ssd.height - (scene.mobile ? 27 : 34);
      const gap = scene.mobile ? 3 : 5;
      const width = (ssd.width - pad * 2 - gap * (count - 1)) / count;
      const totalBytes = stats.bytes[method === "diskann" ? 0 : 1];
      const fields = [
        { key: "FULL", start: 0, end: data.full, color: COLORS.full, text: "#2c1612" },
        { key: "DEG + IDs", start: data.full, end: data.full + data.meta, color: COLORS.ids, text: "#1b262a" },
      ];
      if (method === "aisaq") fields.push({ key: "NEIGHBOR PQ", start: data.full + data.meta, end: totalBytes, color: COLORS.pq, text: "#2b250e" });
      for (let index = 0; index < count; index += 1) {
        const x = ssd.x + pad + index * (width + gap);
        obsBox(x, y, width, height, { fill: "#113e3b", stroke: COLORS.ssd, radius: 2, shadow: !scene.mobile });
        const blockStart = index * 4096;
        const blockEnd = blockStart + 4096;
        const fieldX = x + 3;
        const fieldY = y + 16;
        const fieldW = width - 6;
        const fieldH = height - 19;
        fields.forEach((field) => {
          const overlapStart = Math.max(blockStart, field.start);
          const overlapEnd = Math.min(blockEnd, field.end);
          if (overlapEnd <= overlapStart) return;
          const fx = fieldX + (overlapStart - blockStart) / 4096 * fieldW;
          const fw = (overlapEnd - overlapStart) / 4096 * fieldW;
          ctx.fillStyle = field.color;
          ctx.fillRect(fx, fieldY, fw, fieldH);
          if (fw > (scene.mobile ? 27 : 38) && labelsEnabled) {
            obsText(field.key, fx + fw / 2, fieldY + fieldH / 2 + 3, { size: scene.mobile ? 4.8 : 6, data: true, color: field.text, align: "center", weight: 900, maxWidth: fw - 4 });
          }
        });
        ctx.strokeStyle = "rgba(217,238,233,.16)";
        ctx.strokeRect(fieldX, fieldY, fieldW, fieldH);
        obsText("4 KiB", x + width / 2, y + 11, { size: scene.mobile ? 5 : 6.5, data: true, color: "#91dccc", align: "center", weight: 900 });
      }
      return {
        center: { x: ssd.x + ssd.width / 2, y: y + height / 2 },
        top: { x: ssd.x + ssd.width / 2, y },
        count,
      };
    }

    function obsCpu(host, scene, exact, phaseId) {
      obsTierBox(host, "CPU · LOOKUP + DISTANCE", COLORS.cpu, scene);
      const aluX = host.x + host.width * .16;
      const aluY = host.y + host.height * .31;
      const aluW = host.width * .68;
      const aluH = Math.max(18, host.height * .17);
      const aluLabel = phaseId === "record-current-vector"
        ? "EXACT d(q,p)"
        : phaseId === "advance-search"
          ? "SELECT NEXT p"
          : phaseId === "rerank-visited"
            ? "SORT scalar d_full"
            : phaseId === "return-results"
              ? "RETURN TOP k"
              : "PQ LUT SUM";
      const exactWork = ["record-current-vector", "rerank-visited", "return-results"].includes(phaseId);
      obsBox(aluX, aluY, aluW, aluH, { fill: exactWork ? "#4a251e" : "#3a3014", stroke: exactWork ? COLORS.full : "#8f772c", radius: 3 });
      obsText(aluLabel, aluX + aluW / 2, aluY + aluH / 2 + 3, { size: scene.mobile ? 6 : 8, data: true, color: exactWork ? "#ffc1b5" : COLORS.cpu, align: "center", weight: 900, maxWidth: aluW - 8 });
      const queues = obsQueue(host, scene, exact);
      return {
        alu: { x: aluX + aluW / 2, y: aluY + aluH / 2 },
        queue: queues.candidate,
        candidate: queues.candidate,
        seen: queues.seen,
        exact: queues.exact,
      };
    }

    function obsEventProgress(trace, lane, direction) {
      const events = trace?.events || trace?.allEvents || [];
      const exact = events.filter((event) => (event.lane === lane || event.lane === "shared") && (!direction || event.direction === direction));
      const current = exact.find((event) => event.status === "current");
      const completed = exact.filter((event) => event.status === "completed");
      return { current, completed, active: Boolean(current), done: completed.length > 0 };
    }

    function obsMovingCartridge(from, to, progress, method, dataset, scene) {
      const point = mixPoint(from, to, smooth(progress));
      const stats = BLOCKS[dataset] || BLOCKS.SIFT1B;
      const count = stats[method];
      const width = scene.mobile ? 34 : 48;
      const height = scene.mobile ? 16 : 21;
      ctx.save();
      ctx.shadowColor = "rgba(53,200,176,.45)";
      ctx.shadowBlur = 12;
      obsBox(point.x - width / 2, point.y - height / 2, width, height, { fill: "#164b46", stroke: COLORS.ssd, radius: 2 });
      obsText(`${count}×4K`, point.x, point.y + 3, { size: scene.mobile ? 5.5 : 7, data: true, color: "#c5f4ea", align: "center", weight: 900 });
      ctx.restore();
    }

    function obsBaseLane(layout, method, state, context, scene) {
      const lane = layout[method];
      const dimmed = state.view !== "split" && state.view !== method;
      const phaseId = context?.phase?.id || "";
      ctx.save();
      ctx.globalAlpha *= dimmed ? .18 : 1;
      obsLaneHeader(lane, method, state, scene);
      const exact = ["record-current-vector", "rerank-visited", "return-results"].includes(phaseId);
      const cpu = obsCpu(lane.host, scene, exact, phaseId);
      obsTierBox(lane.dram, "DRAM · RESIDENT + TEMPORARY", COLORS.dram, scene);
      const memory = obsScratch(lane.dram, method, scene, phaseId);
      obsTierBox(lane.ssd, "SSD · NODE p @ LBA(p)", COLORS.ssd, scene);
      const storage = obsSsdBlocks(lane.ssd, method, state.dataset, scene);

      const requestFrom = { x: lane.host.x + lane.host.width * .86, y: lane.host.y + lane.host.height * .68 };
      const requestTo = { x: storage.top.x, y: storage.top.y - 3 };
      const returnFrom = { x: storage.center.x, y: storage.top.y + 3 };
      const returnTo = { x: memory.scratch.x + memory.scratch.width / 2, y: memory.scratch.y + memory.scratch.height - 3 };
      obsArrow(requestFrom, requestTo, { color: "#8aa0a7", width: 1.2, alpha: .32, dash: [5, 5] });
      obsArrow(returnFrom, returnTo, { color: COLORS.ssd, width: scene.mobile ? 3 : 4.5, alpha: .32 });

      ctx.restore();
      return { lane, cpu, memory, storage, requestFrom, requestTo, returnFrom, returnTo, dimmed };
    }

    function obsLayoutScene(parts, state, context, scene) {
      const phaseId = context?.phase?.id || "";
      [parts.diskann, parts.aisaq].forEach((part) => {
        if (part.dimmed) return;
        ctx.save();
        const method = part === parts.diskann ? "diskann" : "aisaq";
        const label = method === "diskann" ? "N PQ CODES RESIDENT" : "PQ DUPLICATED IN SSD CHUNKS";
        const target = method === "diskann" ? part.memory.bank : part.lane.ssd;
        ctx.strokeStyle = method === "diskann" ? COLORS.dram : COLORS.ssd;
        ctx.lineWidth = 2;
        ctx.setLineDash(method === "aisaq" ? [6, 4] : []);
        ctx.strokeRect(target.x - 2, target.y - 2, target.width + 4, target.height + 4);
        ctx.setLineDash([]);
        if (labelsEnabled) obsText(label, target.x + target.width / 2, target.y + target.height - 6, { size: scene.mobile ? 5.3 : 7, data: true, color: method === "diskann" ? "#bfd0ff" : "#b8efe3", align: "center", weight: 900, maxWidth: target.width - 8 });
        ctx.restore();
      });
      if (phaseId === "prebuilt-not-transfer") {
        obsText("PREBUILT LAYOUTS · NOTHING MIGRATES BETWEEN METHODS AT QUERY TIME", scene.x + scene.width / 2, scene.y + scene.height - 8, { size: scene.mobile ? 6 : 8.5, data: true, color: COLORS.cpu, align: "center", weight: 900, maxWidth: scene.width - 20 });
      }
    }

    function obsHostScene(parts, state, context, scene) {
      [parts.diskann, parts.aisaq].forEach((part) => {
        if (part.dimmed) return;
        const qFrom = { x: scene.x + scene.width * .18, y: parts.layout.common.y + parts.layout.common.height * .58 };
        obsArrow(qFrom, part.cpu.alu, { color: COLORS.cpu, width: 2, alpha: .66, progress: context.phaseProgress });
        const seed = part === parts.diskann ? part.memory.bank : part.memory.bank;
        obsArrow({ x: seed.x + seed.width / 2, y: seed.y }, part.cpu.alu, { color: COLORS.dram, width: 2.4, alpha: .7, progress: context.phaseProgress });
      });
    }

    function obsReadScene(parts, state, context, scene) {
      const trace = context?.trace || {};
      ["diskann", "aisaq"].forEach((method) => {
        const part = parts[method];
        if (part.dimmed) return;
        const down = obsEventProgress(trace, method, "down");
        const up = obsEventProgress(trace, method, "up");
        [-10, -5, 5].forEach((offset) => {
          obsArrow(
            { x: part.requestFrom.x + offset, y: part.requestFrom.y },
            { x: part.requestTo.x + offset * .45, y: part.requestTo.y },
            { color: "#7f9298", width: 1, alpha: .13, dash: [3, 6] },
          );
        });
        obsArrow(part.requestFrom, part.requestTo, {
          color: "#a6b6ba", width: 2, alpha: down.active || down.done ? .9 : .4, dash: [6, 5], progress: down.current?.progress,
        });
        obsArrow(part.returnFrom, part.returnTo, {
          color: COLORS.ssd, width: scene.mobile ? 4 : 6, alpha: up.active || up.done ? .95 : .42, progress: up.current?.progress,
        });
        if (up.active) obsMovingCartridge(part.returnFrom, part.returnTo, up.current.progress, method, state.dataset, scene);
        if (up.done || ["unpack-common-fields", "reveal-neighbor-codes"].includes(context?.phase?.id)) {
          const scratch = part.memory.scratch;
          obsPayloadFields(scratch.x + 4, scratch.y + scratch.height * .38, scratch.width - 8, scratch.height * .34, method, state.dataset, { compact: true });
        }
        obsText("ENLARGED: 1 OF ≤ w NODE READS", part.lane.host.x + part.lane.host.width - 6, part.lane.host.y + part.lane.host.height - 5, { size: scene.mobile ? 4.4 : 6, data: true, color: "#72878d", align: "right", weight: 800, maxWidth: part.lane.host.width * .62 });
      });
    }

    function obsScoreScene(parts, state, context, scene) {
      const progress = context.phaseProgress || 0;
      ["diskann", "aisaq"].forEach((method) => {
        const part = parts[method];
        if (part.dimmed) return;
        const source = method === "diskann"
          ? { x: part.memory.bank.x + part.memory.bank.width / 2, y: part.memory.bank.y }
          : { x: part.memory.scratch.x + part.memory.scratch.width / 2, y: part.memory.scratch.y };
        const color = method === "diskann" ? COLORS.dram : COLORS.pq;
        obsArrow(source, part.cpu.alu, { color, width: scene.mobile ? 3 : 4, alpha: .9, progress });
        if (context?.phase?.id === "update-candidates") {
          obsArrow(part.cpu.alu, part.cpu.candidate, { color: COLORS.cpu, width: 3, alpha: .9, progress });
        }
      });
      if (context?.phase?.id === "release-hop-payload") {
        obsText("INLINE PQ SCRATCH RELEASED AFTER SCORE · SSD COPY UNCHANGED", scene.x + scene.width / 2, scene.y + scene.height - 8, { size: scene.mobile ? 5.5 : 8, data: true, color: "#9db0b5", align: "center", weight: 900, maxWidth: scene.width - 18 });
      }
    }

    function obsCommitScene(parts, state, context, scene) {
      const progress = context.phaseProgress || 0;
      const phaseId = context?.phase?.id || "";
      ["diskann", "aisaq"].forEach((method) => {
        const part = parts[method];
        if (part.dimmed) return;
        const scratch = part.memory.scratch;
        const full = { x: scratch.x + scratch.width * .2, y: scratch.y + scratch.height * .58 };
        if (phaseId === "record-current-vector") {
          const live = 1 - smooth(clamp((progress - .72) / .18, 0, 1));
          ctx.save();
          ctx.globalAlpha *= live;
          obsBox(scratch.x + 5, scratch.y + scratch.height * .42, scratch.width - 10, scratch.height * .28, { fill: COLORS.full, stroke: "#ffb2a3", radius: 2 });
          obsText("full(p) · LIVE FOR EXACT SCORE", scratch.x + scratch.width / 2, scratch.y + scratch.height * .58 + 3, { size: scene.mobile ? 4.8 : 6.5, data: true, color: "#321713", align: "center", weight: 900, maxWidth: scratch.width - 16 });
          ctx.restore();
          if (progress >= .72) {
            obsText("SCRATCH REUSABLE", scratch.x + scratch.width / 2, scratch.y + scratch.height * .61, { size: scene.mobile ? 4.8 : 6.5, data: true, color: "#82989e", align: "center", weight: 900, maxWidth: scratch.width - 12 });
          }
          const qFrom = { x: scene.x + scene.width * .18, y: parts.layout.common.y + parts.layout.common.height * .58 };
          obsArrow(qFrom, part.cpu.alu, { color: COLORS.cpu, width: scene.mobile ? 1.7 : 2.2, alpha: .72, progress });
          obsArrow(full, part.cpu.alu, { color: COLORS.full, width: scene.mobile ? 3 : 4.5, alpha: .92, progress });
          obsArrow(part.cpu.alu, part.cpu.exact, { color: COLORS.full, width: 2.5, alpha: .86, progress });
        } else if (phaseId === "advance-search") {
          obsArrow(part.cpu.candidate, part.cpu.alu, { color: COLORS.cpu, width: 2.5, alpha: .86, progress });
          obsText("REUSABLE", scratch.x + scratch.width / 2, scratch.y + scratch.height * .61, { size: scene.mobile ? 4.8 : 6.5, data: true, color: "#82989e", align: "center", weight: 900, maxWidth: scratch.width - 12 });
        } else if (["rerank-visited", "return-results"].includes(phaseId)) {
          obsArrow(part.cpu.exact, part.cpu.alu, { color: COLORS.full, width: 3, alpha: .9, progress });
        }
      });
      const note = phaseId === "rerank-visited"
        ? "FINAL STEP SORTS STORED SCALARS · NO DEFERRED FULL-VECTOR DISTANCE PASS"
        : phaseId === "return-results"
          ? "RETURN TOP k FROM THE SORTED EXACT-SCORE LEDGER"
          : phaseId === "advance-search"
            ? "L SELECTS THE NEXT UNEXPANDED p · SCRATCH CAPACITY IS REUSED"
            : "EXPANSION COMPUTES d_full NOW · EXACT LEDGER RETAINS ID + SCALAR d_full";
      obsText(note, scene.x + scene.width / 2, scene.y + scene.height - 8, { size: scene.mobile ? 5.3 : 8, data: true, color: COLORS.full, align: "center", weight: 900, maxWidth: scene.width - 18 });
    }

    function obsBlockRow(x, y, width, height, method, dataset, scene) {
      const stats = BLOCKS[dataset] || BLOCKS.SIFT1B;
      const data = PACKING[dataset] || PACKING.SIFT1B;
      const count = stats[method];
      const total = stats.bytes[method === "diskann" ? 0 : 1];
      const fields = [
        { key: "FULL", start: 0, end: data.full, color: COLORS.full, text: "#2b1510" },
        { key: "DEG + IDs", start: data.full, end: data.full + data.meta, color: COLORS.ids, text: "#172328" },
      ];
      if (method === "aisaq") fields.push({ key: "NEIGHBOR PQ", start: data.full + data.meta, end: total, color: COLORS.pq, text: "#29230c" });
      const gap = scene.mobile ? 4 : 8;
      const blockW = (width - gap * (count - 1)) / count;
      for (let index = 0; index < count; index += 1) {
        const bx = x + index * (blockW + gap);
        const start = index * 4096;
        const end = start + 4096;
        obsBox(bx, y, blockW, height, { fill: "#102e32", stroke: COLORS.ssd, radius: 3, shadow: !scene.mobile });
        obsText(`LBA(p)+${index} · 4 KiB`, bx + blockW / 2, y + 14, { size: scene.mobile ? 5.5 : 7, data: true, color: "#a4e5d7", align: "center", weight: 900, maxWidth: blockW - 8 });
        fields.forEach((field) => {
          const overlapStart = Math.max(start, field.start);
          const overlapEnd = Math.min(end, field.end);
          if (overlapEnd <= overlapStart) return;
          const fx = bx + 4 + (overlapStart - start) / 4096 * (blockW - 8);
          const fw = (overlapEnd - overlapStart) / 4096 * (blockW - 8);
          ctx.fillStyle = field.color;
          ctx.fillRect(fx, y + 24, fw, height - 31);
          if (fw > 34 && labelsEnabled) obsText(field.key, fx + fw / 2, y + height * .62, { size: scene.mobile ? 5 : 6.5, data: true, color: field.text, align: "center", weight: 900, maxWidth: fw - 5 });
        });
        ctx.strokeStyle = "rgba(217,238,233,.15)";
        ctx.strokeRect(bx + 4, y + 24, blockW - 8, height - 31);
      }
      obsText(`${total.toLocaleString()} B · ${count} LOGICAL READ UNIT${count === 1 ? "" : "S"}`, x + width, y + height + (scene.mobile ? 10 : 14), { size: scene.mobile ? 5.5 : 7.5, data: true, color: method === "aisaq" ? COLORS.cpu : "#b6c6ca", align: "right", weight: 900, maxWidth: width });
    }

    function obsPackScene(scene, state, context) {
      const stats = BLOCKS[state.dataset] || BLOCKS.SIFT1B;
      const pad = scene.mobile ? 8 : 18;
      const titleY = scene.y + 46;
      obsText("ONE NODE CHUNK · CONTIGUOUS 4 KiB LOGICAL READ UNITS", scene.x + scene.width / 2, titleY, { size: scene.mobile ? 8 : 12, data: true, color: "#e4ece9", align: "center", weight: 900, maxWidth: scene.width - 20 });
      obsText("Not a NAND erase block · byte spans are derived from Table 1 and the paper formula", scene.x + scene.width / 2, titleY + (scene.mobile ? 13 : 18), { size: scene.mobile ? 5.5 : 7.5, data: true, color: "#849ba2", align: "center", maxWidth: scene.width - 20 });
      const rowGap = scene.mobile ? 38 : 56;
      const rowHeight = Math.max(64, (scene.height - 150 - rowGap) / 2);
      const firstY = titleY + (scene.mobile ? 38 : 50);
      ["diskann", "aisaq"].forEach((method, index) => {
        const dimmed = state.view !== "split" && state.view !== method;
        ctx.save();
        ctx.globalAlpha *= dimmed ? .18 : 1;
        const y = firstY + index * (rowHeight + rowGap);
        const labelW = scene.mobile ? 58 : 92;
        obsText(method === "diskann" ? "■ DISKANN" : "◆ AISAQ", scene.x + pad, y + 18, { size: scene.mobile ? 7 : 9, data: true, color: "#e9f0ed", weight: 900 });
        obsText(method === "diskann" ? "B_D = full + 4(R+1)" : "B_A = B_D + R·bPQ", scene.x + pad, y + 34, { size: scene.mobile ? 5.5 : 7, data: true, color: method === "aisaq" ? COLORS.cpu : "#8ca2a9", maxWidth: labelW });
        obsBlockRow(scene.x + pad + labelW, y, scene.width - pad * 2 - labelW, rowHeight, method, state.dataset, scene);
        ctx.restore();
      });
      obsText(`${stats.label} · DISKANN ${stats.diskann} → AISAQ ${stats.aisaq} BLOCK${stats.aisaq === 1 ? "" : "S"}`, scene.x + scene.width / 2, scene.y + scene.height - 10, { size: scene.mobile ? 7 : 10, data: true, color: COLORS.cpu, align: "center", weight: 900, maxWidth: scene.width - 20 });
    }

    function obsEvidenceScene(scene, state) {
      const values = MEMORY[state.dataset] || MEMORY.SIFT1B;
      const maxLog = Math.log10(Math.max(values.diskann, values.aisaq));
      const baseY = scene.y + scene.height * .77;
      const maxH = scene.height * .48;
      const barW = Math.min(150, scene.width * .18);
      const center = scene.x + scene.width / 2;
      const methods = [
        { id: "diskann", x: center - barW * 1.35, memory: values.diskann, load: values.loadDisk },
        { id: "aisaq", x: center + barW * .35, memory: values.aisaq, load: values.loadAi },
      ];
      obsText("PAPER-REPORTED PEAK PROCESS MEMORY", center, scene.y + 50, { size: scene.mobile ? 8 : 12, data: true, color: "#e7efec", align: "center", weight: 900, maxWidth: scene.width - 20 });
      obsText("Table 2 · log-height bars · not an independent reproduction", center, scene.y + (scene.mobile ? 65 : 70), { size: scene.mobile ? 5.5 : 7.5, data: true, color: "#81989f", align: "center", maxWidth: scene.width - 20 });
      methods.forEach((method) => {
        const dimmed = state.view !== "split" && state.view !== method.id;
        const height = Math.max(24, maxH * Math.log10(Math.max(1.1, method.memory)) / Math.max(1, maxLog));
        ctx.save();
        ctx.globalAlpha *= dimmed ? .18 : 1;
        const color = method.id === "diskann" ? COLORS.dram : COLORS.ssd;
        obsBox(method.x, baseY - height, barW, height, { fill: rgba(color, .58), stroke: color, accent: color, radius: 3, shadow: true });
        obsText(method.id === "diskann" ? "■ DISKANN" : "◆ AISAQ", method.x + barW / 2, baseY + 20, { size: scene.mobile ? 7 : 9, data: true, color: "#dfe9e6", align: "center", weight: 900 });
        obsText(`${method.memory.toLocaleString()} MB`, method.x + barW / 2, baseY - height + 25, { size: scene.mobile ? 9 : 14, data: true, color: "#ffffff", align: "center", weight: 900, maxWidth: barW - 10 });
        obsText(`LOAD ${method.load.toLocaleString()} ms`, method.x + barW / 2, baseY - height + 43, { size: scene.mobile ? 5.5 : 7.5, data: true, color: "#c1d0d2", align: "center", weight: 800, maxWidth: barW - 10 });
        ctx.restore();
      });
      obsText("AiSAQ saves dataset-scale PQ residency; it does not mean zero RAM or zero I/O.", center, scene.y + scene.height - 20, { size: scene.mobile ? 6 : 8.5, data: true, color: COLORS.cpu, align: "center", weight: 900, maxWidth: scene.width - 24 });
    }

    function obsRenderLayered(scene, state, context) {
      const layout = obsLayout(scene);
      obsStageRail(scene, state, context);
      obsCommonHost(layout.common, state, context);
      const parts = {
        layout,
        diskann: obsBaseLane(layout, "diskann", state, context, scene),
        aisaq: obsBaseLane(layout, "aisaq", state, context, scene),
      };
      const family = context?.trace?.sceneFamily || context?.trace?.scene?.family || "layout";
      if (family === "layout") obsLayoutScene(parts, state, context, scene);
      else if (family === "host") obsHostScene(parts, state, context, scene);
      else if (family === "read") obsReadScene(parts, state, context, scene);
      else if (family === "score") obsScoreScene(parts, state, context, scene);
      else if (family === "commit") obsCommitScene(parts, state, context, scene);
    }

    function render(state, context) {
      const now = performance.now();
      const motionSeconds = Math.min(.05, Math.max(0, (now - lastMotionFrame) / 1000));
      if (state.playing && !reducedMotion) motionTime += motionSeconds;
      lastMotionFrame = now;
      updateCamera(state, context || {}, now);
      labelsEnabled = state.labels !== false;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scene = obsSceneRect();
      obsBackground(scene);
      ctx.save();
      ctx.beginPath();
      ctx.rect(scene.x, scene.y, scene.width, scene.height);
      ctx.clip();
      obsWorldTransform(scene);
      const family = context?.trace?.sceneFamily || context?.trace?.scene?.family || "layout";
      if (family === "pack") {
        stationScreens = [];
        obsStageRail(scene, state, context || {});
        obsPackScene(scene, state, context || {});
      } else if (family === "evidence") {
        stationScreens = [];
        obsStageRail(scene, state, context || {});
        obsEvidenceScene(scene, state);
      } else {
        obsRenderLayered(scene, state, context || {});
      }
      ctx.restore();
      return !reducedMotion || state.playing;
    }

    function zoomBy(delta) {
      const base = cameraMode === "manual" ? manualTarget : camera;
      cameraMode = "manual";
      manualTarget = { x: base.x, y: base.y, zoom: clamp(base.zoom + delta, .72, 1.48) };
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
      const base = cameraMode === "manual" ? manualTarget : camera;
      cameraMode = "manual";
      manualTarget = {
        x: clamp(base.x + screenX / 18, -16, 16),
        y: clamp(base.y + screenY / 18, -12, 12),
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
