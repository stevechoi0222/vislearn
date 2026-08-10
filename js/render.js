(function () {
  "use strict";

  const I = window.AISAQ_ISO;
  const COLORS = {
    ink: "#142a37",
    concrete: "#e4dfd3",
    grid: "#c2c0b8",
    blue: "#3168d8",
    blueDeep: "#1c4da8",
    mint: "#4aae9b",
    mintDeep: "#247666",
    yellow: "#f5c84c",
    yellowDeep: "#b98706",
    coral: "#d85d49",
    steel: "#6c7d84",
    white: "#fffdf7",
  };

  const GRAPH_POINTS = [
    { x: 1.25, y: 5.6 }, { x: 2.45, y: 4.4 }, { x: 3.4, y: 5.25 },
    { x: 4.0, y: 3.55 }, { x: 5.3, y: 4.2 }, { x: 6.2, y: 2.85 },
    { x: 7.1, y: 4.05 }, { x: 7.75, y: 2.15 }, { x: 5.0, y: 1.75 },
  ];
  const EDGES = [[0,1],[1,2],[1,3],[2,4],[3,4],[3,8],[8,5],[4,5],[5,6],[5,7],[6,7],[8,7]];
  const ROUTE = [0, 1, 3, 8, 5, 7, 6];

  function createRenderer(canvas) {
    const ctx = canvas.getContext("2d", { alpha: false });
    let logicalWidth = 1;
    let logicalHeight = 1;
    let dpr = 1;

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

    function drawBackground() {
      ctx.fillStyle = COLORS.concrete;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      const step = 32;
      ctx.save();
      ctx.strokeStyle = "rgba(20,42,55,.075)";
      ctx.lineWidth = 1;
      for (let x = -logicalHeight; x < logicalWidth + logicalHeight; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + logicalHeight, logicalHeight); ctx.stroke();
      }
      for (let x = 0; x < logicalWidth + logicalHeight * 2; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - logicalHeight, logicalHeight); ctx.stroke();
      }
      for (let y = 11; y < logicalHeight; y += 19) {
        for (let x = (y * 13) % 31; x < logicalWidth; x += 47) {
          const radius = 0.45 + ((x + y) % 4) * .16;
          ctx.fillStyle = (x + y) % 3 === 0 ? "rgba(255,255,255,.14)" : "rgba(20,42,55,.065)";
          ctx.beginPath();
          ctx.arc(x, y + ((x * 7) % 9), radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawGround(project, mode, scale) {
      const a = project(.35, .45, 0);
      const b = project(8.65, .45, 0);
      const c = project(8.65, 6.85, 0);
      const d = project(.35, 6.85, 0);
      I.polygon(ctx, [
        { x: a.x + 9 * scale, y: a.y + 13 * scale },
        { x: b.x + 9 * scale, y: b.y + 13 * scale },
        { x: c.x + 9 * scale, y: c.y + 13 * scale },
        { x: d.x + 9 * scale, y: d.y + 13 * scale },
      ], "rgba(20,42,55,.13)");
      I.polygon(ctx, [d, c, { x: c.x, y: c.y + 5 * scale }, { x: d.x, y: d.y + 5 * scale }], mode === "diskann" ? "#aeb4b5" : "#9fbeb4", "rgba(20,42,55,.42)", .8 * scale);
      I.polygon(ctx, [b, c, { x: c.x, y: c.y + 5 * scale }, { x: b.x, y: b.y + 5 * scale }], mode === "diskann" ? "#c0c3c1" : "#b6cec6", "rgba(20,42,55,.36)", .8 * scale);
      I.polygon(ctx, [a, b, c, d], mode === "diskann" ? "#e2e1dd" : "#dce6e0", "rgba(20,42,55,.45)", 1.2 * scale);
      ctx.save();
      ctx.strokeStyle = mode === "diskann" ? "rgba(49,104,216,.16)" : "rgba(74,174,155,.19)";
      ctx.lineWidth = .8 * scale;
      for (let x = .5; x <= 8.5; x += 1) I.line(ctx, project(x, .5, 0.01), project(x, 6.7, 0.01), ctx.strokeStyle, ctx.lineWidth);
      for (let y = .5; y <= 6.5; y += 1) I.line(ctx, project(.5, y, 0.01), project(8.5, y, 0.01), ctx.strokeStyle, ctx.lineWidth);
      for (let lane = 0; lane < 5; lane += 1) {
        const x = 4.4 + lane * .42;
        I.line(ctx, project(x, .56, .025), project(x + .22, .56, .025), lane % 2 ? "rgba(20,42,55,.48)" : "rgba(245,200,76,.9)", 3.3 * scale);
      }
      ctx.restore();
    }

    function drawWarehouse(project, mode, scale, focus, labels) {
      const disk = mode === "diskann";
      const h = disk ? 2.7 : .72;
      const color = disk ? COLORS.blue : COLORS.mint;
      const building = I.cuboid(ctx, project, .75, .65, 3.05, 1.7, h, color, {
        lineWidth: 1.1 * scale,
        frontAccent: disk ? "#91b4ff" : "#8ae0cd",
        alpha: focus === "aisaq" && disk ? .68 : 1,
      });

      const frontY = .65 + 1.7 + .012;
      const openingBottomLeft = project(1.12, frontY, .18);
      const openingBottomRight = project(3.45, frontY, .18);
      const openingTopRight = project(3.45, frontY, Math.max(.46, h - .33));
      const openingTopLeft = project(1.12, frontY, Math.max(.46, h - .33));
      I.polygon(ctx, [openingBottomLeft, openingBottomRight, openingTopRight, openingTopLeft], "#162831", "rgba(255,255,255,.22)", .8 * scale);
      I.cuboid(ctx, project, .94, 2.15, .22, .18, Math.max(.5, h - .15), color, { shadow: false, lineWidth: .7 * scale });
      I.cuboid(ctx, project, 3.42, 2.15, .22, .18, Math.max(.5, h - .15), color, { shadow: false, lineWidth: .7 * scale });
      const roof = [project(.58, .48, h + .13), project(4.03, .48, h + .13), project(4.03, 2.57, h + .13), project(.58, 2.57, h + .13)];
      I.polygon(ctx, roof, I.shade(color, 18), "rgba(20,42,55,.8)", 1.1 * scale);
      I.line(ctx, project(.58, 2.57, h + .13), project(4.03, 2.57, h + .13), disk ? "#a9c3ff" : "#a5eadb", 2.2 * scale);
      for (let seam = 1; seam < 7; seam += 1) {
        const x = .58 + seam * (3.45 / 7);
        I.line(ctx, project(x, .48, h + .145), project(x, 2.57, h + .145), "rgba(20,42,55,.16)", .55 * scale);
      }
      for (let rib = 1; rib < 6; rib += 1) {
        const x = .75 + rib * (3.05 / 6);
        I.line(ctx, project(x, 2.36, .12), project(x, 2.36, Math.max(.42, h - .08)), "rgba(255,255,255,.18)", .55 * scale);
      }

      I.cuboid(ctx, project, 1.0, 2.28, 2.6, .36, .08, "#9aa4a5", { shadow: false, lineWidth: .5 * scale });

      const crateRows = disk ? 4 : 1;
      const crateCols = disk ? 5 : 1;
      for (let row = 0; row < crateRows; row += 1) {
        for (let col = 0; col < crateCols; col += 1) {
          I.cuboid(ctx, project, 1.06 + col * .45, 2.14 - row * .25, .31, .23, disk ? .25 : .15, disk ? COLORS.blueDeep : COLORS.yellow, {
            shadow: false,
            lineWidth: .65 * scale,
            alpha: disk ? .95 : .68,
          });
        }
      }
      if (labels) I.label(ctx, disk ? "DRAM · all PQ codes" : "DRAM · entry state", building.center.x, building.center.y - 6 * scale, {
        fontSize: Math.max(7, 9 * scale), accent: disk ? COLORS.blue : COLORS.mint,
      });
    }

    function drawYardProps(project, mode, scale) {
      const postColor = mode === "diskann" ? COLORS.blueDeep : COLORS.mintDeep;
      [[.55,3.0],[.55,6.3],[8.45,1.0],[8.45,5.9]].forEach(([x, y]) => {
        I.cuboid(ctx, project, x, y, .11, .11, .62, postColor, { shadow: false, lineWidth: .45 * scale });
        const cap = project(x + .055, y + .055, .67);
        I.circle(ctx, cap.x, cap.y, 1.7 * scale, COLORS.yellow, COLORS.yellowDeep, .5);
      });

      const tank = project(8.08, 1.2, .15);
      ctx.save();
      ctx.fillStyle = "rgba(20,42,55,.16)";
      ctx.beginPath(); ctx.ellipse(tank.x + 4 * scale, tank.y + 9 * scale, 11 * scale, 4.5 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mode === "diskann" ? "#7f929a" : "#6fae9f";
      ctx.fillRect(tank.x - 7 * scale, tank.y - 15 * scale, 14 * scale, 22 * scale);
      ctx.beginPath(); ctx.ellipse(tank.x, tank.y - 15 * scale, 7 * scale, 3.4 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS.ink; ctx.lineWidth = .8 * scale;
      ctx.beginPath(); ctx.ellipse(tank.x, tank.y + 7 * scale, 7 * scale, 3.4 * scale, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      for (let i = 0; i < 3; i += 1) {
        I.cuboid(ctx, project, 7.55 + i * .25, 5.65 - i * .16, .18, .18, .32, i === 1 ? COLORS.yellow : "#88979c", {
          shadow: false, lineWidth: .45 * scale,
        });
      }

      const fence = [[.45,.55],[8.55,.55],[8.55,6.75],[.45,6.75],[.45,.55]].map(([x,y]) => project(x,y,.18));
      for (let i = 0; i < fence.length - 1; i += 1) I.line(ctx, fence[i], fence[i + 1], "rgba(20,42,55,.34)", 1 * scale, [4 * scale, 3 * scale]);
    }

    function drawGraph(project, mode, scale, state, labels) {
      const focus = state.focus;
      const pathProgress = Math.min(.9999, (state.stageIndex + state.progress) / 7);
      const activeIndex = ROUTE[Math.min(ROUTE.length - 1, Math.floor(pathProgress * ROUTE.length))];

      ctx.save();
      EDGES.forEach(([from, to]) => {
        const a = project(GRAPH_POINTS[from].x, GRAPH_POINTS[from].y, .08);
        const b = project(GRAPH_POINTS[to].x, GRAPH_POINTS[to].y, .08);
        I.line(ctx, { x: a.x + 3 * scale, y: a.y + 5 * scale }, { x: b.x + 3 * scale, y: b.y + 5 * scale }, "rgba(20,42,55,.24)", 5.5 * scale);
        I.line(ctx, a, b, mode === "diskann" ? "#526b77" : "#3f746a", 2.5 * scale);
      });
      ctx.restore();

      const order = GRAPH_POINTS.map((point, index) => ({ point, index })).sort((a, b) => (a.point.x + a.point.y) - (b.point.x + b.point.y));
      order.forEach(({ point, index }) => {
        const isActive = index === activeIndex;
        const nodeColor = isActive ? COLORS.yellow : mode === "diskann" ? COLORS.steel : COLORS.mintDeep;
        I.cuboid(ctx, project, point.x - .28, point.y - .25, .56, .5, isActive ? .62 : .42, nodeColor, {
          lineWidth: .85 * scale,
          frontAccent: isActive ? COLORS.yellowDeep : null,
        });

        if (mode === "aisaq") {
          const crateCount = isActive || focus === "aisaq" || focus === "blocks" ? 3 : 2;
          for (let c = 0; c < crateCount; c += 1) {
            I.cuboid(ctx, project, point.x - .21 + c * .16, point.y - .16, .12, .12, .14, COLORS.yellow, {
              shadow: false, lineWidth: .45 * scale,
            });
          }
        }

        if (labels && isActive) {
          const p = project(point.x, point.y, .95);
          I.label(ctx, mode === "diskann" ? "SSD node chunk" : "chunk + neighbor PQ", p.x, p.y, {
            fontSize: Math.max(7, 8.5 * scale), accent: mode === "diskann" ? COLORS.blue : COLORS.mint,
          });
        }
      });

      if (focus === "diskann" && mode === "diskann") {
        const node = GRAPH_POINTS[activeIndex];
        const from = project(node.x, node.y, .8);
        const to = project(2.2, 1.3, 2.2);
        I.line(ctx, from, to, COLORS.yellow, 2 * scale, [5 * scale, 4 * scale]);
        const pulse = .5 + .5 * Math.sin(state.elapsed * 4);
        I.circle(ctx, I.lerp(from.x, to.x, pulse), I.lerp(from.y, to.y, pulse), 4 * scale, COLORS.yellow, COLORS.yellowDeep, 1);
      }

      if (focus === "aisaq" && mode === "aisaq") {
        const node = GRAPH_POINTS[activeIndex];
        for (let i = 0; i < 3; i += 1) {
          const phase = (state.elapsed * .7 + i / 3) % 1;
          const from = project(node.x - .2 + i * .2, node.y, .9);
          const to = project(node.x + .65, node.y + .48, .25);
          I.circle(ctx, I.lerp(from.x, to.x, phase), I.lerp(from.y, to.y, phase), 3.5 * scale, COLORS.yellow, COLORS.yellowDeep, .8);
        }
      }

      if (focus === "blocks") {
        const node = GRAPH_POINTS[activeIndex];
        const p = project(node.x, node.y, 1.12);
        const blocks = mode === "aisaq" ? 4 : 2;
        for (let i = 0; i < blocks; i += 1) {
          const x = p.x + (i - (blocks - 1) / 2) * 17 * scale;
          ctx.save();
          ctx.strokeStyle = i < (mode === "aisaq" ? 3 : 1) ? COLORS.yellow : "rgba(20,42,55,.38)";
          ctx.lineWidth = 1.4 * scale;
          ctx.strokeRect(x - 7 * scale, p.y - 13 * scale, 14 * scale, 12 * scale);
          ctx.restore();
        }
      }
    }

    function drawVehicle(project, scale, state, mode) {
      const route = ROUTE.map((index) => GRAPH_POINTS[index]);
      const travel = Math.max(0, Math.min(.9999, (state.stageIndex + state.progress) / 7));
      const logical = I.pointOnPath(route, travel);
      const p = project(logical.x, logical.y, .72);
      const bob = Math.sin(state.elapsed * 5) * 1.2 * scale;

      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.fillStyle = "rgba(20,42,55,.22)";
      ctx.beginPath(); ctx.ellipse(3 * scale, 8 * scale, 14 * scale, 6 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.yellow;
      ctx.strokeStyle = COLORS.yellowDeep;
      ctx.lineWidth = 1.1 * scale;
      ctx.fillRect(-12 * scale, -8 * scale, 24 * scale, 13 * scale);
      ctx.strokeRect(-12 * scale, -8 * scale, 24 * scale, 13 * scale);
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(-6 * scale, -12 * scale, 12 * scale, 7 * scale);
      ctx.fillStyle = "#9fe0d2";
      ctx.fillRect(-4.5 * scale, -10.5 * scale, 9 * scale, 4 * scale);
      ctx.fillStyle = mode === "aisaq" ? COLORS.yellowDeep : COLORS.blueDeep;
      ctx.fillRect(2 * scale, -6 * scale, 7 * scale, 7 * scale);
      I.circle(ctx, -7 * scale, 6 * scale, 3 * scale, COLORS.ink);
      I.circle(ctx, 8 * scale, 6 * scale, 3 * scale, COLORS.ink);
      ctx.restore();

      if (state.labels) I.label(ctx, "QUERY", p.x, p.y - 17 * scale, {
        fontSize: Math.max(7, 8 * scale), background: COLORS.yellow, color: COLORS.ink,
      });

      if (state.follow) {
        ctx.save();
        ctx.strokeStyle = mode === "diskann" ? "rgba(49,104,216,.48)" : "rgba(74,174,155,.56)";
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 23 * scale + Math.sin(state.elapsed * 3) * 3 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawSite(bounds, mode, state) {
      const scale = Math.min(bounds.width / 300, bounds.height / 420) * (state.view === "split" ? 1 : 1.14);
      const tileW = 43 * scale;
      const tileH = 33 * scale;
      const zScale = 27 * scale;
      const origin = {
        x: bounds.x + bounds.width * .5,
        y: bounds.y + bounds.height * (state.view === "split" ? .58 : .53),
      };
      const project = (x, y, z) => I.isoPoint(origin, x - 4.5, y - 3.3, z, tileW, tileH, zScale);
      const focus = window.AISAQ_CONTENT.stages[state.stageIndex].focus;
      const showLabels = state.labels && bounds.width > 300;
      const localState = Object.assign({}, state, { focus, labels: showLabels });

      ctx.save();
      if ((focus === "diskann" && mode === "aisaq") || (focus === "aisaq" && mode === "diskann")) ctx.globalAlpha = .62;
      drawGround(project, mode, scale);
      drawYardProps(project, mode, scale);
      drawWarehouse(project, mode, scale, focus, showLabels);
      drawGraph(project, mode, scale, localState, showLabels);
      drawVehicle(project, scale, localState, mode);
      ctx.restore();

      if (showLabels && bounds.width > 430) {
        const address = project(7.7, 6.35, .04);
        ctx.save();
        ctx.translate(address.x, address.y);
        ctx.rotate(-.45);
        ctx.fillStyle = mode === "diskann" ? "rgba(49,104,216,.72)" : "rgba(36,118,102,.75)";
        ctx.font = `700 ${Math.max(7, 8.5 * scale)}px ${'"SFMono-Regular", monospace'}`;
        ctx.textAlign = "right";
        ctx.fillText("4 KB ADDRESS PLOTS", 0, 0);
        ctx.restore();
      }
    }

    function render(state) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackground();
      const topPad = 12;
      const bottomPad = logicalWidth < 760 ? 90 : 84;
      const usableH = Math.max(260, logicalHeight - topPad - bottomPad);
      if (state.view === "split") {
        const half = logicalWidth / 2;
        drawSite({ x: 0, y: topPad, width: half, height: usableH }, "diskann", state);
        drawSite({ x: half, y: topPad, width: half, height: usableH }, "aisaq", state);
        ctx.save();
        ctx.strokeStyle = "rgba(20,42,55,.75)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(half, 0); ctx.lineTo(half, logicalHeight); ctx.stroke();
        ctx.restore();
      } else {
        drawSite({ x: 0, y: topPad, width: logicalWidth, height: usableH }, state.view, state);
      }
    }

    return { resize, render };
  }

  window.createAiSAQRenderer = createRenderer;
})();
