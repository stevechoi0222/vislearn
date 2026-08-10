(function () {
  "use strict";

  const TAU = Math.PI * 2;

  function polygon(ctx, points, fill, stroke, lineWidth) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth || 1;
      ctx.stroke();
    }
  }

  function line(ctx, a, b, color, width, dash) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.restore();
  }

  function isoPoint(origin, x, y, z, tileW, tileH, zScale) {
    return {
      x: origin.x + (x - y) * tileW * 0.5,
      y: origin.y + (x + y) * tileH * 0.5 - z * zScale,
    };
  }

  function shade(hex, amount) {
    const raw = hex.replace("#", "");
    const value = Number.parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
    const r = Math.max(0, Math.min(255, (value >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (value & 255) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function cuboid(ctx, project, x, y, w, d, h, color, options) {
    const opts = options || {};
    const p000 = project(x, y, 0);
    const p100 = project(x + w, y, 0);
    const p110 = project(x + w, y + d, 0);
    const p010 = project(x, y + d, 0);
    const p001 = project(x, y, h);
    const p101 = project(x + w, y, h);
    const p111 = project(x + w, y + d, h);
    const p011 = project(x, y + d, h);
    const edge = opts.edge || "rgba(20,42,55,.72)";
    const lw = opts.lineWidth || 1;
    const alpha = Number.isFinite(opts.alpha) ? opts.alpha : 1;

    ctx.save();
    ctx.globalAlpha *= alpha;
    if (opts.shadow !== false) {
      const shadowOffset = opts.shadowOffset || Math.max(6, lw * 5);
      polygon(ctx, [
        { x: p010.x + shadowOffset + 5, y: p010.y + shadowOffset + 6 },
        { x: p110.x + shadowOffset + 5, y: p110.y + shadowOffset + 6 },
        { x: p111.x + shadowOffset + 5, y: p111.y + shadowOffset + 6 },
        { x: p011.x + shadowOffset + 5, y: p011.y + shadowOffset + 6 },
      ], "rgba(20,42,55,.07)");
      polygon(ctx, [
        { x: p010.x + shadowOffset, y: p010.y + shadowOffset },
        { x: p110.x + shadowOffset, y: p110.y + shadowOffset },
        { x: p111.x + shadowOffset, y: p111.y + shadowOffset },
        { x: p011.x + shadowOffset, y: p011.y + shadowOffset },
      ], "rgba(20,42,55,.18)");
    }
    polygon(ctx, [p010, p110, p111, p011], shade(color, -20), edge, lw);
    polygon(ctx, [p100, p110, p111, p101], shade(color, -38), edge, lw);
    polygon(ctx, [p001, p101, p111, p011], shade(color, 12), edge, lw);
    line(ctx, p001, p101, "rgba(255,255,255,.34)", Math.max(.55, lw * .72));
    line(ctx, p001, p011, "rgba(255,255,255,.2)", Math.max(.45, lw * .55));
    line(ctx, p100, p101, "rgba(255,255,255,.12)", Math.max(.4, lw * .45));
    if (opts.frontAccent) {
      const a = project(x + w * 0.08, y + d, h * 0.15);
      const b = project(x + w * 0.92, y + d, h * 0.15);
      line(ctx, a, b, opts.frontAccent, Math.max(1, lw * 2));
    }
    ctx.restore();
    return { top: [p001, p101, p111, p011], center: project(x + w / 2, y + d / 2, h) };
  }

  function circle(ctx, x, y, radius, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
  }

  function label(ctx, text, x, y, options) {
    const opts = options || {};
    const fontSize = opts.fontSize || 11;
    const padX = opts.padX || 8;
    const padY = opts.padY || 5;
    ctx.save();
    ctx.font = `${opts.weight || 750} ${fontSize}px ${opts.font || '"Avenir Next", sans-serif'}`;
    const width = ctx.measureText(text).width + padX * 2;
    const height = fontSize + padY * 2;
    const left = opts.align === "left" ? x : x - width / 2;
    const top = y - height;
    ctx.fillStyle = opts.background || "rgba(20,42,55,.94)";
    ctx.fillRect(left, top, width, height);
    if (opts.accent) {
      ctx.fillStyle = opts.accent;
      ctx.fillRect(left, top, 4, height);
    }
    ctx.fillStyle = opts.color || "#fffdf7";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, left + padX + (opts.accent ? 3 : 0), top + height / 2 + .5);
    ctx.restore();
    return { x: left, y: top, width, height };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function pointOnPath(points, value) {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];
    const scaled = Math.max(0, Math.min(0.999999, value)) * (points.length - 1);
    const index = Math.floor(scaled);
    const local = scaled - index;
    return {
      x: lerp(points[index].x, points[index + 1].x, local),
      y: lerp(points[index].y, points[index + 1].y, local),
    };
  }

  function roundedRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.AISAQ_ISO = Object.freeze({ polygon, line, isoPoint, shade, cuboid, circle, label, lerp, pointOnPath, roundedRect });
})();
