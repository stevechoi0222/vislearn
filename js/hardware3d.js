(function () {
  "use strict";

  const DEFAULT_THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";
  const FAMILY_BY_STAGE = ["layout", "host", "read", "score", "commit", "pack", "evidence"];
  const STAGE_BY_ID = {
    "layout-at-rest": 0,
    entrypoint: 1,
    "read-current-chunk": 2,
    "score-neighbors": 3,
    "advance-and-rerank": 4,
    "block-cost": 5,
    "evidence-switch-limits": 6,
  };
  const PRESETS = {
    SIFT1M: { diskann: 1, aisaq: 2, diskBytes: 740, aiBytes: 7908 },
    SIFT1B: { diskann: 1, aisaq: 1, diskBytes: 340, aiBytes: 2004 },
    "KILT E5 22M": { diskann: 2, aisaq: 4, diskBytes: 4376, aiBytes: 13208 },
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (value) => {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  };

  async function createHardwareTransitRenderer(canvas, options) {
    const opts = options || {};
    const THREE = await import(opts.threeUrl || DEFAULT_THREE_URL);
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedQuery.matches;
    let disposed = false;
    let view = "split";
    let computePath = ["gpu", "gpu-assist"].includes(opts.computePath) ? "gpu-assist" : "paper";
    let followEnabled = true;
    let width = Math.max(1, canvas.clientWidth || 1);
    let height = Math.max(1, canvas.clientHeight || 1);
    let desiredDistance = 16.5;
    let orbitYaw = 0;
    let orbitPitch = 0.14;
    let manualOrbit = false;
    let pointer = null;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071019);
    scene.fog = new THREE.Fog(0x071019, 22, 80);
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 120);
    camera.position.set(0, 3.2, desiredDistance);

    const world = new THREE.Group();
    scene.add(world);
    const dynamic = new THREE.Group();
    world.add(dynamic);

    const colors = {
      ink: 0x071019,
      steel: 0x526170,
      steelLight: 0xa9b6c1,
      white: 0xeaf2f4,
      ssd: 0x20b7aa,
      ssdDeep: 0x11645f,
      dram: 0x3e70df,
      dramDeep: 0x1d3f91,
      cpu: 0xe4a933,
      cpuDeep: 0x8c6114,
      pq: 0xf3d252,
      vector: 0xe86e62,
      request: 0xf1ae3d,
      returnBlock: 0x58e1e6,
      gpu: 0x936de8,
      gpuDim: 0x3b3553,
    };

    const resources = new Set();
    const labelSprites = [];
    function remember(resource) { resources.add(resource); return resource; }
    function material(color, extra) {
      return remember(new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.68, metalness: 0.18 }, extra || {})));
    }
    function hardwareMaterial(color, extra) {
      return remember(new THREE.MeshPhysicalMaterial(Object.assign({
        color,
        roughness: 0.34,
        metalness: 0.42,
        clearcoat: 0.38,
        clearcoatRoughness: 0.3,
      }, extra || {})));
    }
    function basicMaterial(color, extra) {
      return remember(new THREE.MeshBasicMaterial(Object.assign({ color }, extra || {})));
    }
    function box(parent, size, position, mat, name) {
      const geometry = remember(new THREE.BoxGeometry(size[0], size[1], size[2]));
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.name = name || "";
      parent.add(mesh);
      return mesh;
    }
    function roundedRectShape(widthValue, heightValue, radiusValue) {
      const halfWidth = widthValue / 2;
      const halfHeight = heightValue / 2;
      const radius = Math.min(radiusValue, halfWidth, halfHeight);
      const shape = new THREE.Shape();
      shape.moveTo(-halfWidth + radius, -halfHeight);
      shape.lineTo(halfWidth - radius, -halfHeight);
      shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
      shape.lineTo(halfWidth, halfHeight - radius);
      shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
      shape.lineTo(-halfWidth + radius, halfHeight);
      shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
      shape.lineTo(-halfWidth, -halfHeight + radius);
      shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
      return shape;
    }
    function chamferBox(parent, size, position, mat, name, bevelValue) {
      const smallestSide = Math.min(size[0], size[1], size[2]);
      const bevel = Math.min(bevelValue == null ? 0.045 : bevelValue, smallestSide * 0.18);
      const faceWidth = Math.max(0.01, size[0] - bevel * 2);
      const faceHeight = Math.max(0.01, size[1] - bevel * 2);
      const faceDepth = Math.max(0.01, size[2] - bevel * 2);
      const geometry = remember(new THREE.ExtrudeGeometry(
        roundedRectShape(faceWidth, faceHeight, Math.min(bevel * 0.72, faceWidth * 0.12, faceHeight * 0.12)),
        {
          curveSegments: 1,
          steps: 1,
          depth: faceDepth,
          bevelEnabled: true,
          bevelSegments: 1,
          bevelSize: bevel,
          bevelThickness: bevel,
        }
      ));
      geometry.center();
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.name = name || "";
      parent.add(mesh);
      return mesh;
    }
    function edges(parent, mesh, color, opacity) {
      const geometry = remember(new THREE.EdgesGeometry(mesh.geometry));
      const lineMaterial = remember(new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity == null ? 1 : opacity }));
      const line = new THREE.LineSegments(geometry, lineMaterial);
      line.position.copy(mesh.position);
      line.rotation.copy(mesh.rotation);
      line.scale.copy(mesh.scale);
      parent.add(line);
      return line;
    }
    function lineBetween(parent, start, end, color, radius, opacity) {
      const a = new THREE.Vector3(start[0], start[1], start[2]);
      const b = new THREE.Vector3(end[0], end[1], end[2]);
      const direction = b.clone().sub(a);
      const geometry = remember(new THREE.CylinderGeometry(radius, radius, direction.length(), 8));
      const mesh = new THREE.Mesh(geometry, material(color, { transparent: opacity < 1, opacity }));
      mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      parent.add(mesh);
      return mesh;
    }
    function labelTexture(text, background, foreground) {
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 512;
      labelCanvas.height = 112;
      const labelCtx = labelCanvas.getContext("2d");
      const inset = 12;
      const notch = 10;
      labelCtx.clearRect(0, 0, 512, 112);
      labelCtx.beginPath();
      labelCtx.moveTo(inset + notch, 19);
      labelCtx.lineTo(512 - inset, 19);
      labelCtx.lineTo(512 - inset, 93 - notch);
      labelCtx.lineTo(512 - inset - notch, 93);
      labelCtx.lineTo(inset, 93);
      labelCtx.lineTo(inset, 19 + notch);
      labelCtx.closePath();
      labelCtx.globalAlpha = 0.86;
      labelCtx.fillStyle = background;
      labelCtx.fill();
      labelCtx.globalAlpha = 1;
      labelCtx.strokeStyle = "rgba(255,255,255,.3)";
      labelCtx.lineWidth = 3;
      labelCtx.stroke();
      labelCtx.globalAlpha = 0.62;
      labelCtx.fillStyle = foreground;
      labelCtx.fillRect(inset + 9, 86, 512 - inset * 2 - 18, 3);
      labelCtx.globalAlpha = 1;
      labelCtx.font = "800 34px Avenir Next, Arial, sans-serif";
      labelCtx.textAlign = "center";
      labelCtx.textBaseline = "middle";
      labelCtx.fillText(text, 256, 55, 468);
      const texture = remember(new THREE.CanvasTexture(labelCanvas));
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }
    function label(parent, text, position, scale, background, foreground) {
      const spriteMaterial = remember(new THREE.SpriteMaterial({
        map: labelTexture(text, background || "#101a23", foreground || "#eef6f6"),
        transparent: true,
        depthTest: true,
        depthWrite: false,
      }));
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(position[0], position[1], position[2]);
      const resolvedScale = (scale || 2.5) * 0.64;
      sprite.scale.set(resolvedScale, resolvedScale * 0.219, 1);
      sprite.renderOrder = 20;
      parent.add(sprite);
      labelSprites.push(sprite);
      return sprite;
    }
    function packet(parent, size, color, labelText) {
      const group = new THREE.Group();
      const body = chamferBox(group, size, [0, 0, 0], hardwareMaterial(color, {
        roughness: 0.27,
        metalness: 0.26,
        clearcoat: 0.58,
        emissive: color,
        emissiveIntensity: 0.16,
      }), labelText, Math.min(0.055, Math.min(size[0], size[1], size[2]) * 0.16));
      edges(group, body, 0x0b1720, 0.9);
      const faceColor = new THREE.Color(color).lerp(new THREE.Color(colors.white), 0.34).getHex();
      chamferBox(
        group,
        [Math.max(0.08, size[0] * 0.68), Math.max(0.05, size[1] * 0.42), Math.max(0.018, size[2] * 0.035)],
        [0, 0, size[2] * 0.515],
        hardwareMaterial(faceColor, {
          roughness: 0.22,
          metalness: 0.18,
          emissive: color,
          emissiveIntensity: 0.12,
        }),
        "packet-inset",
        0.018
      );
      if (labelText) label(group, labelText, [0, 0, size[2] * 0.53 + 0.03], Math.max(0.85, size[0] * 1.45), "#0b1720", "#f7fbfb");
      parent.add(group);
      return group;
    }
    function setPathPosition(object, points, t) {
      const value = clamp(t, 0, 1) * (points.length - 1);
      const index = Math.min(points.length - 2, Math.floor(value));
      const local = smooth(value - index);
      object.position.lerpVectors(points[index], points[index + 1], local);
    }

    scene.add(new THREE.HemisphereLight(0xcce7ee, 0x14202a, 2.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-4, 10, 10);
    scene.add(keyLight);
    const sideLight = new THREE.DirectionalLight(0x55d3d1, 1.1);
    sideLight.position.set(8, 2, 5);
    scene.add(sideLight);
    const rimLight = new THREE.DirectionalLight(0x879dff, 1.15);
    rimLight.position.set(-7, 4, -9);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      remember(new THREE.PlaneGeometry(24, 18)),
      material(0x0b1821, { roughness: 0.92, metalness: 0.04 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.15;
    world.add(floor);
    const grid = new THREE.GridHelper(22, 22, 0x29414f, 0x172834);
    grid.position.y = -4.12;
    grid.material.transparent = true;
    grid.material.opacity = 0.38;
    resources.add(grid.geometry);
    resources.add(grid.material);
    world.add(grid);

    const host = new THREE.Group();
    host.position.set(0, 4.85, -0.9);
    world.add(host);
    const hostBack = box(host, [12.8, 1.45, 0.32], [0, 0, 0], material(0x142431, { transparent: true, opacity: 0.92 }));
    edges(host, hostBack, 0x73909e, 0.7);
    label(host, "HOST CONTROL · q / L / seen / exact", [0, 0.98, 0.25], 5.5, "#132430", "#eef6f6");
    const hostCells = [
      { key: "q", x: -5.05, w: 1.5, text: "q" },
      { key: "lut", x: -3.0, w: 2.1, text: "CENTROID / LUT" },
      { key: "L", x: -0.35, w: 2.5, text: "L · {ID, dPQ}" },
      { key: "seen", x: 2.15, w: 1.65, text: "seen · ID" },
      { key: "exact", x: 4.75, w: 2.75, text: "exact · {ID, distance}" },
    ];
    const hostObjects = {};
    const hostBodies = {};
    hostCells.forEach((cell) => {
      const cellGroup = new THREE.Group();
      cellGroup.position.x = cell.x;
      host.add(cellGroup);
      const body = chamferBox(cellGroup, [cell.w, 0.72, 0.48], [0, -0.07, 0.25], hardwareMaterial(cell.key === "lut" ? colors.cpuDeep : colors.dramDeep, {
        roughness: 0.42,
        metalness: 0.34,
        clearcoat: 0.28,
      }), "", 0.05);
      edges(cellGroup, body, 0xb4c6d0, 0.55);
      label(cellGroup, cell.text, [0, 0.04, 0.54], Math.min(cell.w * 1.35, 2.6), "#11202a", "#f3f7f7");
      hostObjects[cell.key] = cellGroup;
      hostBodies[cell.key] = body;
    });

    function buildLane(method, laneX) {
      const group = new THREE.Group();
      group.position.x = laneX;
      world.add(group);
      const isDisk = method === "diskann";

      const chassisMat = material(0x8ea5b1, { transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide });
      const chassis = box(group, [6.7, 7.9, 3.7], [0, -0.1, 0], chassisMat);
      edges(group, chassis, isDisk ? 0xc4d0d6 : 0x8ca1aa, 0.62);
      label(group, isDisk ? "DISKANN · global PQ address" : "AiSAQ · inline PQ payload", [0, 4.1, 1.25], 4.6, isDisk ? "#26333b" : "#101f27", "#f6f8f8");

      const board = chamferBox(group, [5.9, 0.14, 2.8], [0, -0.55, -0.2], hardwareMaterial(0x173934, {
        roughness: 0.58,
        metalness: 0.2,
        clearcoat: 0.16,
      }), "board", 0.025);
      edges(group, board, 0x4da395, 0.8);
      chamferBox(group, [5.45, 0.045, 2.42], [0, -0.462, -0.2], material(0x245049, {
        roughness: 0.72,
        metalness: 0.08,
      }), "board-inlay", 0.008);

      const cpuSocket = chamferBox(group, [1.98, 0.16, 1.82], [0.65, 2.01, 0], hardwareMaterial(0x202a2f, {
        roughness: 0.5,
        metalness: 0.58,
        clearcoat: 0.18,
      }), "cpu-socket", 0.035);
      edges(group, cpuSocket, 0x7c878c, 0.58);
      const cpu = chamferBox(group, [1.7, 0.55, 1.55], [0.65, 2.35, 0], hardwareMaterial(0xc68d24, {
        roughness: 0.28,
        metalness: 0.48,
        clearcoat: 0.5,
        emissive: colors.cpuDeep,
        emissiveIntensity: 0.18,
      }), "cpu", 0.07);
      edges(group, cpu, 0xffd36d, 0.9);
      const cpuCap = chamferBox(group, [1.28, 0.1, 1.1], [0.65, 2.675, 0], hardwareMaterial(colors.cpu, {
        roughness: 0.2,
        metalness: 0.72,
        clearcoat: 0.52,
      }), "cpu-cap", 0.035);
      edges(group, cpuCap, 0xffe59a, 0.54);
      label(group, "CPU · LUT / exact", [0.65, 2.82, 0.9], 2.3, "#2e2412", "#ffd978");

      const scratchSlot = chamferBox(group, [2.52, 0.16, 1.58], [0.55, 0.43, 0], hardwareMaterial(0x17243e, {
        roughness: 0.56,
        metalness: 0.44,
      }), "dram-slot", 0.03);
      edges(group, scratchSlot, 0x6383c7, 0.5);
      const scratch = chamferBox(group, [2.25, 0.55, 1.35], [0.55, 0.75, 0], hardwareMaterial(colors.dram, {
        roughness: 0.32,
        metalness: 0.25,
        clearcoat: 0.46,
        transparent: true,
        opacity: 0.82,
        emissive: colors.dramDeep,
        emissiveIntensity: 0.12,
      }), "scratch", 0.055);
      edges(group, scratch, 0xa8c0ff, 0.88);
      const scratchChips = [];
      for (let index = 0; index < 5; index += 1) {
        scratchChips.push(chamferBox(group, [0.31, 0.075, 0.82], [-0.17 + index * 0.36, 1.065, 0], hardwareMaterial(0x173d88, {
          roughness: 0.4,
          metalness: 0.34,
          clearcoat: 0.24,
          transparent: true,
          opacity: 0.86,
          emissive: colors.dramDeep,
          emissiveIntensity: 0.04,
        }), "dram-chip", 0.018));
      }
      label(group, "DRAM · reusable scratch", [0.55, 1.19, 0.77], 2.7, "#14265b", "#eaf0ff");

      const pqBank = new THREE.Group();
      const pqCells = [];
      pqBank.position.set(-2.05, 0.75, 0);
      group.add(pqBank);
      const pqBackplane = chamferBox(pqBank, [1.95, 1.72, 0.14], [0, 0, -0.5], hardwareMaterial(0x1b2943, {
        roughness: 0.56,
        metalness: 0.35,
      }), "pq-backplane", 0.025);
      edges(pqBank, pqBackplane, 0x60769d, 0.42);
      for (let index = 0; index < (isDisk ? 8 : 2); index += 1) {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const activeCell = index < (isDisk ? 8 : 1);
        pqCells.push(chamferBox(
          pqBank,
          [0.35, 0.7, 0.85],
          [(column - 1.5) * 0.43, row * 0.78 - 0.38, 0],
          hardwareMaterial(activeCell ? colors.pq : colors.steel, {
            roughness: 0.3,
            metalness: 0.42,
            clearcoat: 0.34,
            emissive: activeCell ? colors.pq : colors.steel,
            emissiveIntensity: 0.04,
          }),
          "pq-cell",
          0.035
        ));
      }
      label(group, isDisk ? "DRAM · GLOBAL PQ[N]" : "DRAM · n_ep seed only", [-2.05, 1.52, 0.72], 2.45, "#14265b", "#f7e88e");

      const pcie = lineBetween(group, [0.65, 2.02, -0.25], [0.55, -1.4, -0.25], colors.request, 0.055, 0.62);
      pcie.name = "pcie-nvme";
      label(group, "PCIe / NVMe", [1.2, -0.2, 0.7], 1.9, "#3b2c13", "#ffd56f");

      const controllerBoard = chamferBox(group, [2.82, 0.14, 1.72], [0.55, -1.75, 0], hardwareMaterial(0x173934, {
        roughness: 0.58,
        metalness: 0.24,
      }), "controller-board", 0.025);
      edges(group, controllerBoard, 0x3a7f75, 0.45);
      const controller = chamferBox(group, [2.4, 0.48, 1.35], [0.55, -1.45, 0], hardwareMaterial(colors.ssdDeep, {
        roughness: 0.31,
        metalness: 0.38,
        clearcoat: 0.42,
        emissive: colors.ssdDeep,
        emissiveIntensity: 0.08,
      }), "controller", 0.055);
      edges(group, controller, 0x5de1d2, 0.82);
      const controllerCap = chamferBox(group, [1.35, 0.085, 0.82], [0.55, -1.165, 0], hardwareMaterial(colors.ssd, {
        roughness: 0.25,
        metalness: 0.54,
        clearcoat: 0.45,
      }), "controller-cap", 0.025);
      edges(group, controllerCap, 0x9ff8ec, 0.46);
      label(group, "SSD controller", [0.55, -1.03, 0.78], 2.15, "#10332f", "#9ff8ec");

      const nand = new THREE.Group();
      const nandChips = [];
      nand.position.set(0.3, -2.85, 0);
      group.add(nand);
      const nandBoard = chamferBox(nand, [5.35, 0.14, 1.43], [0, -0.32, 0], hardwareMaterial(0x153a34, {
        roughness: 0.6,
        metalness: 0.2,
      }), "nand-board", 0.025);
      edges(nand, nandBoard, 0x3f8c80, 0.46);
      for (let index = 0; index < 4; index += 1) {
        const chipX = (index - 1.5) * 1.3;
        const chip = chamferBox(nand, [1.15, 0.52, 1.05], [chipX, 0, 0], hardwareMaterial(0x168a80, {
          roughness: 0.3,
          metalness: 0.34,
          clearcoat: 0.4,
          emissive: colors.ssdDeep,
          emissiveIntensity: 0.06,
        }), "nand-chip", 0.055);
        nandChips.push(chip);
        edges(nand, chip, 0x8ff4e7, 0.75);
        chamferBox(nand, [0.78, 0.075, 0.68], [chipX, 0.298, 0], hardwareMaterial(colors.ssd, {
          roughness: 0.25,
          metalness: 0.48,
          clearcoat: 0.46,
        }), "nand-cap", 0.022);
      }
      label(group, "SSD · NAND packages", [0.3, -2.35, 0.72], 2.75, "#10332f", "#a8fff4");

      const ssdCopy = packet(group, isDisk ? [2.3, 0.42, 0.78] : [3.15, 0.42, 0.78], colors.returnBlock, "4 KB node copy");
      ssdCopy.position.set(0.3, -3.48, 0.8);
      const pqStripe = box(ssdCopy, [isDisk ? 0.03 : 1.05, 0.46, 0.82], [isDisk ? 1.2 : 0.88, 0, 0], material(isDisk ? colors.steel : colors.pq));
      pqStripe.visible = !isDisk;

      const gpuGroup = new THREE.Group();
      const componentMirror = isDisk ? -1 : 1;
      const gpuGroupX = isDisk ? 1.75 : -1.75;
      const gpuDieX = -0.35 * componentMirror;
      gpuGroup.position.set(gpuGroupX, -0.5, -1.18);
      group.add(gpuGroup);
      const gpuBoard = chamferBox(gpuGroup, [2.9, 1.65, 0.14], [0, 0, 0], hardwareMaterial(0x262b3b, {
        roughness: 0.55,
        metalness: 0.3,
        clearcoat: 0.16,
      }), "gpu-board", 0.025);
      edges(gpuGroup, gpuBoard, 0x786ca9, 0.65);
      const gpuDie = chamferBox(gpuGroup, [0.95, 0.95, 0.28], [gpuDieX, 0, 0.16], hardwareMaterial(colors.gpuDim, {
        roughness: 0.28,
        metalness: 0.46,
        clearcoat: 0.4,
        emissive: colors.gpu,
        emissiveIntensity: 0.02,
      }), "gpu", 0.045);
      edges(gpuGroup, gpuDie, 0xaa92ef, 0.55);
      const gpuDieCap = chamferBox(gpuGroup, [0.62, 0.62, 0.075], [gpuDieX, 0, 0.345], hardwareMaterial(0x51496e, {
        roughness: 0.2,
        metalness: 0.62,
        clearcoat: 0.45,
      }), "gpu-cap", 0.025);
      const vram = [];
      const vramCaps = [];
      const vramPositions = [[-1.05, 0.56], [-1.05, -0.56], [0.45, 0.62], [0.45, -0.62]];
      vramPositions.forEach((position) => {
        const chipX = position[0] * componentMirror;
        vram.push(chamferBox(gpuGroup, [0.48, 0.38, 0.24], [chipX, position[1], 0.16], hardwareMaterial(colors.gpuDim, {
          roughness: 0.36,
          metalness: 0.38,
          emissive: colors.gpu,
          emissiveIntensity: 0,
        }), "vram", 0.03));
        vramCaps.push(chamferBox(gpuGroup, [0.3, 0.22, 0.055], [chipX, position[1], 0.315], hardwareMaterial(0x494361, {
          roughness: 0.24,
          metalness: 0.52,
        }), "vram-cap", 0.016));
      });
      label(gpuGroup, "GPU · optional illustrative", [0, 1.16, 0.22], 2.75, "#241d3e", "#c8b7ff");
      label(gpuGroup, "VRAM", [-0.86 * componentMirror, -0.2, 0.35], 1.05, "#241d3e", "#c8b7ff");
      const vramAverageX = vramPositions.reduce((sum, position) => sum + position[0] * componentMirror, 0) / vramPositions.length;
      const gpuPoints = {
        pcie: [0.35, -0.05, -0.62],
        vram: [gpuGroupX + vramAverageX, -0.5, -0.96],
        compute: [gpuGroupX + gpuDieX, -0.5, -0.92],
        link: [gpuGroupX + gpuDieX, 0.1, -1.18],
      };
      const gpuLink = lineBetween(group, [0.65, 2.05, -0.72], gpuPoints.link, colors.gpuDim, 0.045, 0.35);

      return { method, group, chassis, board, cpu, scratch, scratchChips, pqBank, pqCells, pcie, controller, nand, nandChips, ssdCopy, gpuGroup, gpuBoard, gpuDie, gpuDieCap, vram, vramCaps, gpuLink, gpuPoints };
    }

    const lanes = {
      diskann: buildLane("diskann", -4.15),
      aisaq: buildLane("aisaq", 4.15),
    };

    const requestPulses = {
      diskann: packet(dynamic, [0.24, 0.24, 0.24], colors.request, ""),
      aisaq: packet(dynamic, [0.24, 0.24, 0.24], colors.request, ""),
    };
    const returnBlocks = {
      diskann: packet(dynamic, [1.75, 0.55, 0.9], colors.returnBlock, "4 KB"),
      aisaq: packet(dynamic, [2.2, 0.55, 0.9], colors.returnBlock, "4 KB + PQ"),
    };
    const scanPlanes = {
      diskann: box(dynamic, [5.4, 0.045, 2.7], [-4.15, 0, 0], material(colors.returnBlock, { transparent: true, opacity: 0.25, emissive: colors.returnBlock, emissiveIntensity: 0.35 })),
      aisaq: box(dynamic, [5.4, 0.045, 2.7], [4.15, 0, 0], material(colors.returnBlock, { transparent: true, opacity: 0.25, emissive: colors.returnBlock, emissiveIntensity: 0.35 })),
    };
    const nandVoxels = { diskann: [], aisaq: [] };
    Object.keys(nandVoxels).forEach((method) => {
      for (let index = 0; index < 8; index += 1) nandVoxels[method].push(packet(dynamic, [0.34, 0.28, 0.34], colors.returnBlock, ""));
    });
    const pqFragments = [];
    for (let index = 0; index < 10; index += 1) pqFragments.push(packet(dynamic, [0.3, 0.3, 0.3], colors.pq, index === 0 ? "PQ" : ""));
    const scalarTokens = { diskann: [], aisaq: [] };
    const queueTokens = {};
    const exactVectors = {};
    const gpuTokens = { diskann: [], aisaq: [] };
    ["diskann", "aisaq"].forEach((method) => {
      for (let index = 0; index < 4; index += 1) scalarTokens[method].push(packet(dynamic, [0.34, 0.25, 0.38], colors.white, index === 0 ? "d" : ""));
      queueTokens[method] = packet(dynamic, [1.15, 0.42, 0.55], colors.white, "ID + scalar");
      exactVectors[method] = packet(dynamic, [1.25, 0.48, 0.68], colors.vector, "full vector");
      for (let index = 0; index < 5; index += 1) gpuTokens[method].push(packet(dynamic, [0.28, 0.28, 0.28], index < 4 ? colors.pq : colors.white, ""));
    });

    const blockBay = new THREE.Group();
    blockBay.position.set(0, -0.8, 2.45);
    world.add(blockBay);
    const blockObjects = [];
    function disposeObjectTree(object) {
      const members = new Set();
      object.traverse((child) => members.add(child));
      for (let index = labelSprites.length - 1; index >= 0; index -= 1) {
        if (members.has(labelSprites[index])) labelSprites.splice(index, 1);
      }
      members.forEach((child) => {
        if (child.geometry) {
          resources.delete(child.geometry);
          child.geometry.dispose();
        }
        const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
        materials.forEach((entry) => {
          if (entry.map) {
            resources.delete(entry.map);
            entry.map.dispose();
          }
          resources.delete(entry);
          entry.dispose();
        });
      });
    }
    function rebuildBlockBay(datasetName) {
      blockObjects.splice(0).forEach((object) => {
        blockBay.remove(object);
        disposeObjectTree(object);
      });
      const preset = PRESETS[datasetName] || PRESETS.SIFT1B;
      ["diskann", "aisaq"].forEach((method, laneIndex) => {
        const count = preset[method];
        const bytes = method === "diskann" ? preset.diskBytes : preset.aiBytes;
        const group = new THREE.Group();
        group.position.x = laneIndex ? 4.15 : -4.15;
        for (let index = 0; index < count; index += 1) {
          const used = clamp(bytes - index * 4096, 0, 4096);
          const block = packet(group, [Math.min(1.35, 5.4 / count), 2.5, 0.52], colors.returnBlock, "4 KB");
          block.position.x = (index - (count - 1) / 2) * Math.min(1.55, 5.75 / count);
          block.scale.y = Math.max(0.12, used / 4096);
          block.position.y = -1.25 + block.scale.y * 1.25;
          const fill = box(block, [Math.min(1.2, 5.1 / count), 0.16, 0.58], [0, 1.15, 0], material(method === "aisaq" && bytes > preset.diskBytes ? colors.pq : colors.vector));
          fill.position.y = 1.15;
        }
        label(group, `${method === "diskann" ? "DiskANN" : "AiSAQ"} · ${bytes.toLocaleString()} B · ${count} block${count === 1 ? "" : "s"}`, [0, 2.05, 0.45], 4.1, "#0e1c25", "#eaf5f5");
        blockBay.add(group);
        blockObjects.push(group);
      });
    }
    let blockDataset = "";

    function inferFrame(state, context) {
      const directHardware = context && context.beat ? context : null;
      const hardware = (context && context.hardware) || directHardware || {};
      const trace = (context && context.trace) || (state && state.trace) || {};
      const nestedScene = trace.scene && typeof trace.scene === "object" ? trace.scene : {};
      const stageObject = (context && context.stage) || context || {};
      const stageIndex = Number.isFinite(state && state.stageIndex)
        ? state.stageIndex
        : Number.isFinite(stageObject.stageIndex)
          ? stageObject.stageIndex
          : STAGE_BY_ID[stageObject.id || ""] || 0;
      let progress = hardware.phaseProgress;
      if (!Number.isFinite(progress)) progress = hardware.progress;
      if (!Number.isFinite(progress)) progress = trace.phaseProgress;
      if (!Number.isFinite(progress)) progress = trace.progress;
      if (!Number.isFinite(progress)) progress = context && context.phaseProgress;
      if (!Number.isFinite(progress)) progress = state && state.progress;
      progress = clamp(Number(progress) || 0, 0, 1);
      if (reducedMotion) progress = progress >= 0.5 ? 1 : 0;

      const fallbackFamily = trace.sceneFamily || nestedScene.family || FAMILY_BY_STAGE[stageIndex] || "layout";
      const fallbackBeat = {
        layout: "inspect",
        host: "inspect",
        read: "block-return",
        score: "pq-score",
        commit: "queue-commit",
        pack: "block-pack",
        evidence: "evidence",
      }[fallbackFamily] || "inspect";
      const beat = String(hardware.beat || fallbackBeat).toLowerCase();
      const family = beat === "inspect" ? fallbackFamily
        : ["request", "nand-read", "block-return"].includes(beat) ? "read"
          : ["dram-join", "inline-unpack", "pq-score"].includes(beat) ? "score"
            : ["exact-score", "queue-commit", "scratch-release"].includes(beat) ? "commit"
              : beat === "block-pack" ? "pack"
                : beat === "evidence" ? "evidence" : fallbackFamily;
      const datasetSource = trace.dataset || hardware.dataset || (state && state.dataset) || "SIFT1B";
      const datasetName = typeof datasetSource === "string" ? datasetSource : (datasetSource.label || datasetSource.id || "SIFT1B");
      const sourceDestination = `${hardware.source || ""} ${hardware.destination || ""}`.toLowerCase();
      const hardwareGpuActive = Boolean(hardware.gpu && hardware.gpu.active);
      const requestedPath = hardware.computePath || (sourceDestination.includes("gpu") || sourceDestination.includes("vram") || hardwareGpuActive ? "gpu-assist" : computePath);
      const gpuMode = ["gpu", "gpu-assist"].includes(requestedPath) ? "gpu-assist" : "paper";
      const computeBeat = ["pq-score", "exact-score"].includes(beat);
      const hasHardwareGpuFlag = hardware.gpu && typeof hardware.gpu.active === "boolean";
      const gpuActive = hasHardwareGpuFlag ? hardware.gpu.active : computeBeat && gpuMode === "gpu-assist";
      return {
        beat,
        family,
        progress,
        datasetName,
        method: ["diskann", "aisaq"].includes(hardware.method) ? hardware.method : "both",
        cameraTarget: hardware.cameraTarget || "overview",
        source: hardware.source || "",
        destination: hardware.destination || "",
        payload: hardware.payload || "",
        computePath: gpuMode,
        gpuActive,
        labels: !state || state.labels !== false,
      };
    }

    function laneWorld(lane, local) {
      return new THREE.Vector3(lane.group.position.x + local[0], local[1], local[2]);
    }
    function resetDynamicVisibility() {
      Object.values(requestPulses).forEach((pulse) => { pulse.visible = false; });
      Object.values(returnBlocks).forEach((block) => { block.visible = false; });
      Object.values(scanPlanes).forEach((plane) => { plane.visible = false; });
      Object.values(nandVoxels).flat().forEach((voxel) => { voxel.visible = false; });
      pqFragments.forEach((fragment) => { fragment.visible = false; });
      Object.values(scalarTokens).flat().forEach((token) => { token.visible = false; });
      Object.values(queueTokens).forEach((token) => { token.visible = false; });
      Object.values(exactVectors).forEach((token) => { token.visible = false; });
      Object.values(gpuTokens).flat().forEach((token) => { token.visible = false; });
    }
    function applyView() {
      lanes.diskann.group.visible = view !== "aisaq";
      lanes.aisaq.group.visible = view !== "diskann";
    }
    function methodsFor(frame, gpuBoth) {
      let methods = frame.method === "both" ? ["diskann", "aisaq"] : [frame.method];
      if (gpuBoth && view === "split") methods = ["diskann", "aisaq"];
      if (view === "diskann") methods = methods.filter((method) => method === "diskann");
      if (view === "aisaq") methods = methods.filter((method) => method === "aisaq");
      return methods;
    }
    function setGlow(mesh, color, intensity) {
      if (!mesh || !mesh.material || !mesh.material.emissive) return;
      mesh.material.emissive.setHex(color);
      mesh.material.emissiveIntensity = intensity;
    }
    function resetHardwareState() {
      Object.values(hostBodies).forEach((body) => setGlow(body, colors.dramDeep, 0));
      Object.values(lanes).forEach((lane) => {
        setGlow(lane.cpu, colors.cpuDeep, 0.18);
        setGlow(lane.scratch, colors.dramDeep, 0.12);
        lane.scratch.material.opacity = 0.82;
        lane.scratchChips.forEach((chip) => { chip.material.opacity = 0.86; });
        setGlow(lane.controller, colors.ssdDeep, 0.08);
        lane.nandChips.forEach((chip) => setGlow(chip, colors.ssdDeep, 0.06));
        lane.pqCells.forEach((cell) => setGlow(cell, colors.pq, 0.04));
        lane.ssdCopy.scale.set(1, 1, 1);
      });
    }
    function updateGpuMode(mode) {
      const active = mode === "gpu-assist";
      Object.values(lanes).forEach((lane) => {
        lane.gpuBoard.material.color.setHex(active ? 0x393052 : 0x262b3b);
        lane.gpuDie.material.color.setHex(active ? colors.gpu : colors.gpuDim);
        lane.gpuDieCap.material.color.setHex(active ? 0xb19af0 : 0x51496e);
        lane.vram.forEach((chip) => chip.material.color.setHex(active ? 0x7054b3 : colors.gpuDim));
        lane.vramCaps.forEach((chip) => chip.material.color.setHex(active ? 0x9c83dc : 0x494361));
        setGlow(lane.gpuDie, colors.gpu, active ? 0.35 : 0.02);
        lane.vram.forEach((chip) => setGlow(chip, colors.gpu, active ? 0.16 : 0));
        lane.gpuLink.material.color.setHex(active ? colors.gpu : colors.gpuDim);
        lane.gpuLink.material.opacity = active ? 0.72 : 0.2;
      });
    }

    const cameraLook = new THREE.Vector3(0, 0.3, 0);
    const desiredLook = new THREE.Vector3(0, 0.3, 0);

    function cameraFocus(frame) {
      const methods = methodsFor(frame, frame.gpuActive);
      const laneX = methods.length ? methods.reduce((sum, method) => sum + lanes[method].group.position.x, 0) / methods.length : 0;
      const averageGpuPoint = (key) => {
        if (!methods.length) return new THREE.Vector3(0, -0.5, -1);
        const total = methods.reduce((sum, method) => sum.add(laneWorld(lanes[method], lanes[method].gpuPoints[key])), new THREE.Vector3());
        return total.multiplyScalar(1 / methods.length);
      };
      const gpuVramPoint = averageGpuPoint("vram");
      const gpuComputePoint = averageGpuPoint("compute");
      const gpuDistance = methods.length > 1 ? 11.2 : 9.4;
      const targets = {
        overview: { point: [0, 0.65, 0], distance: 18 },
        "ssd-controller": { point: [laneX + 0.55, -1.45, 0], distance: 10.3 },
        "ssd-nand": { point: [laneX + 0.3, -2.75, 0], distance: 10.4 },
        "dram-scratch": { point: [laneX + 0.55, 0.75, 0], distance: 10.6 },
        "dram-pq-array": { point: [laneX - 2.05, 0.75, 0], distance: 10.8 },
        "cpu-lut": { point: [laneX + 0.65, 2.35, 0], distance: 10.6 },
        "cpu-exact": { point: [laneX + 0.65, 2.35, 0], distance: 10.6 },
        "host-queues": { point: [-0.35, 4.75, 0], distance: 11.8 },
        "host-result": { point: [4.75, 4.75, 0], distance: 10.8 },
        "ssd-blocks": { point: [0, -0.7, 1.3], distance: 11.4 },
        "evidence-panel": { point: [0, 0.4, 0], distance: 16.2 },
        pcie: { point: [laneX + 0.55, -0.05, -0.1], distance: 10.8 },
        "gpu-vram": { point: [gpuVramPoint.x, gpuVramPoint.y, gpuVramPoint.z], distance: gpuDistance },
        "gpu-compute": { point: [gpuComputePoint.x, gpuComputePoint.y, gpuComputePoint.z], distance: gpuDistance },
      };
      const target = targets[frame.cameraTarget] || targets.overview;
      const aspect = width / Math.max(1, height);
      if (aspect < 0.78) {
        const portraitFactor = methods.length > 1
          ? clamp(1.38 / Math.max(0.34, aspect), 1.55, 2.9)
          : clamp(0.92 / Math.max(0.34, aspect), 1.15, 2.15);
        target.distance *= portraitFactor;
      }
      return target;
    }
    function updateCamera(frame, dt) {
      const target = cameraFocus(frame);
      if (followEnabled && !manualOrbit) {
        desiredLook.set(target.point[0], target.point[1], target.point[2]);
        desiredDistance = target.distance;
      }
      const amount = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0.001, Number(dt) || 1 / 60) * 4.6);
      cameraLook.lerp(desiredLook, amount);
      const distance = desiredDistance;
      const x = cameraLook.x + Math.sin(orbitYaw) * Math.cos(orbitPitch) * distance;
      const y = cameraLook.y + Math.sin(orbitPitch) * distance + 2.2;
      const z = cameraLook.z + Math.cos(orbitYaw) * Math.cos(orbitPitch) * distance;
      camera.position.lerp(new THREE.Vector3(x, y, z), amount);
      camera.lookAt(cameraLook);
    }

    function updateInspect(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const scan = scanPlanes[method];
        scan.visible = true;
        scan.position.y = lerp(-3.55, 3.2, frame.progress);
        setGlow(lane.pqCells[Math.floor(frame.progress * lane.pqCells.length) % lane.pqCells.length], colors.pq, 0.9);
      });
    }
    function updateRequest(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const pulse = requestPulses[method];
        pulse.visible = true;
        setPathPosition(pulse, [
          laneWorld(lane, [0.65, 2.35, 0.6]),
          laneWorld(lane, [0.6, 0.1, 0.5]),
          laneWorld(lane, [0.55, -1.45, 0.6]),
        ], frame.progress);
        setGlow(lane.controller, colors.request, 0.35 + frame.progress * 0.8);
      });
    }
    function updateNandRead(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        lane.nandChips.forEach((chip, index) => {
          setGlow(chip, colors.returnBlock, clamp(frame.progress * 5 - index, 0.06, 1.25));
        });
        nandVoxels[method].forEach((voxel, index) => {
          const chipIndex = index % lane.nandChips.length;
          const source = laneWorld(lane, [0.3 + (chipIndex - 1.5) * 1.3, -2.85, 0.65]);
          const target = laneWorld(lane, [0.55 + (index % 4 - 1.5) * 0.31, -2.0 + Math.floor(index / 4) * 0.31, 0.78]);
          const local = clamp(frame.progress * 1.35 - index * 0.045, 0, 1);
          voxel.visible = local > 0;
          setPathPosition(voxel, [source, target], local);
        });
      });
    }
    function updateBlockReturn(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const block = returnBlocks[method];
        block.visible = true;
        setPathPosition(block, [
          laneWorld(lane, [0.55, -1.45, 0.85]),
          laneWorld(lane, [0.55, -0.15, 1.1]),
          laneWorld(lane, [0.55, 0.75, 0.8]),
        ], frame.progress);
        setGlow(lane.scratch, colors.returnBlock, 0.2 + frame.progress);
      });
    }
    function updatePqTransfer(frame, method, inline) {
      if ((view === "diskann" && method !== "diskann") || (view === "aisaq" && method !== "aisaq")) return;
      const lane = lanes[method];
      const offset = method === "diskann" ? 0 : 5;
      const source = inline ? laneWorld(lane, [0.55, 0.75, 0.65]) : laneWorld(lane, [-2.05, 0.75, 0.65]);
      const target = laneWorld(lane, [0.65, 2.35, 0.9]);
      for (let index = 0; index < 5; index += 1) {
        const fragment = pqFragments[offset + index];
        fragment.visible = true;
        setPathPosition(fragment, [source, new THREE.Vector3(lerp(source.x, target.x, 0.5), 1.55, 1.05), target], clamp(frame.progress * 1.35 - index * 0.075, 0, 1));
        fragment.position.z += (index - 2) * 0.11;
      }
      setGlow(lane.cpu, colors.pq, 0.35 + frame.progress);
      if (inline) setGlow(lane.scratch, colors.pq, 0.65);
      else lane.pqCells.forEach((cell) => setGlow(cell, colors.pq, 0.65));
    }
    function updatePqScore(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const cpu = laneWorld(lane, [0.65, 2.35, 0.9]);
        const hostL = new THREE.Vector3(-0.35, 4.78, 0.05);
        setGlow(lane.cpu, colors.cpu, 0.55 + Math.sin(frame.progress * Math.PI) ** 2 * 1.3);
        setGlow(hostBodies.L, colors.white, 0.55);
        scalarTokens[method].forEach((token, index) => {
          token.visible = true;
          setPathPosition(token, [cpu, new THREE.Vector3(lerp(cpu.x, hostL.x, 0.55), 3.6, 1), hostL], clamp(frame.progress * 1.25 - index * 0.08, 0, 1));
          token.position.z += (index - 1.5) * 0.09;
        });
      });
    }
    function updateExactScore(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const vector = exactVectors[method];
        vector.visible = true;
        const scratch = laneWorld(lane, [0.55, 0.75, 0.72]);
        const cpu = laneWorld(lane, [0.65, 2.35, 0.92]);
        const ledger = new THREE.Vector3(4.75, 4.78, 0.08);
        setPathPosition(vector, [scratch, cpu], clamp(frame.progress / 0.58, 0, 1));
        vector.visible = frame.progress < 0.7;
        const scalar = scalarTokens[method][0];
        scalar.visible = frame.progress > 0.48;
        setPathPosition(scalar, [cpu, new THREE.Vector3(lerp(cpu.x, ledger.x, 0.52), 3.65, 1), ledger], clamp((frame.progress - 0.48) / 0.52, 0, 1));
        setGlow(lane.cpu, colors.vector, 0.45 + frame.progress);
        setGlow(hostBodies.exact, colors.vector, 0.7);
      });
    }
    function updateQueueCommit(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const token = queueTokens[method];
        token.visible = true;
        const cpu = laneWorld(lane, [0.65, 2.35, 0.9]);
        const hostL = new THREE.Vector3(-0.35, 4.78, 0.05);
        setPathPosition(token, [cpu, new THREE.Vector3(lerp(cpu.x, hostL.x, 0.55), 3.6, 1), hostL], frame.progress);
        setGlow(hostBodies.L, colors.white, 0.85);
      });
    }
    function updateScratchRelease(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const scratch = lane.scratch;
        const release = smooth(clamp(frame.progress / 0.72, 0, 1));
        scratch.material.opacity = lerp(0.82, 0.055, release);
        lane.scratchChips.forEach((chip) => { chip.material.opacity = lerp(0.86, 0.08, release); });
        setGlow(scratch, colors.returnBlock, lerp(0.55, 0, frame.progress));
      });
    }
    function updateBlockPack(frame) {
      blockBay.visible = true;
      blockBay.scale.set(1, lerp(0.12, 1, smooth(frame.progress)), 1);
      blockBay.position.y = lerp(-1.75, -0.8, smooth(frame.progress));
    }
    function updateEvidence(frame) {
      const pulse = 0.35 + Math.sin(frame.progress * Math.PI) ** 2;
      lanes.diskann.pqCells.forEach((cell) => setGlow(cell, colors.pq, pulse));
      setGlow(lanes.aisaq.controller, colors.returnBlock, pulse);
      lanes.aisaq.nandChips.forEach((chip) => setGlow(chip, colors.returnBlock, pulse * 0.65));
      setGlow(hostBodies.L, colors.white, pulse * 0.55);
      lanes.aisaq.ssdCopy.scale.setScalar(1 + pulse * 0.035);
    }
    function updateGpuAssist(frame) {
      const methods = methodsFor(frame, true);
      const source = String(frame.source || "").toLowerCase();
      const destinationName = String(frame.destination || "").toLowerCase();
      const payloadName = typeof frame.payload === "string" ? frame.payload.toLowerCase() : JSON.stringify(frame.payload || {}).toLowerCase();
      const segment = source.includes("pcie") && destinationName.includes("vram") ? "pcie-vram"
        : source.includes("vram") && destinationName.includes("gpu") ? "vram-gpu"
          : source.includes("gpu") && (destinationName.includes("host") || destinationName.includes("result") || destinationName.includes("queue") || destinationName.includes("ledger")) ? "gpu-host"
            : destinationName.includes("pcie") || source.includes("dram") || source.includes("scratch") ? "dram-pcie"
              : frame.cameraTarget === "gpu-vram" ? "pcie-vram"
                : frame.cameraTarget === "gpu-compute" ? "vram-gpu"
                  : frame.cameraTarget === "host-result" ? "gpu-host" : "dram-pcie";
      methods.forEach((method) => {
        const lane = lanes[method];
        const scratch = laneWorld(lane, [0.55, 0.75, 0.72]);
        const pcie = laneWorld(lane, lane.gpuPoints.pcie);
        const vram = laneWorld(lane, lane.gpuPoints.vram);
        const gpu = laneWorld(lane, lane.gpuPoints.compute);
        const hostResult = destinationName.includes("exact") || payloadName.includes("exact") || payloadName.includes("full")
          ? new THREE.Vector3(4.75, 4.78, 0.08)
          : new THREE.Vector3(-0.35, 4.78, 0.05);
        const fullVector = payloadName.includes("full") || payloadName.includes("vector") || frame.beat === "exact-score";
        const inputTokens = fullVector ? [exactVectors[method]] : gpuTokens[method].slice(0, 4);
        const segmentPath = segment === "dram-pcie" ? [scratch, pcie]
          : segment === "pcie-vram" ? [pcie, vram]
            : segment === "vram-gpu" ? [vram, gpu] : [gpu, new THREE.Vector3(lerp(gpu.x, hostResult.x, 0.55), 2.6, 0.55), hostResult];

        if (segment === "dram-pcie") {
          setGlow(lane.scratch, colors.gpu, 0.8);
          lane.gpuLink.material.opacity = 0.9;
        } else if (segment === "pcie-vram") {
          lane.vram.forEach((chip) => setGlow(chip, colors.gpu, 0.9));
          lane.gpuLink.material.opacity = 0.95;
        } else if (segment === "vram-gpu") {
          lane.vram.forEach((chip) => setGlow(chip, colors.gpu, 0.65));
          setGlow(lane.gpuDie, colors.gpu, 1.35);
        } else {
          setGlow(lane.gpuDie, colors.gpu, 1.35);
          setGlow(destinationName.includes("exact") ? hostBodies.exact : hostBodies.L, colors.gpu, 0.9);
        }

        if (segment === "gpu-host") {
          const result = gpuTokens[method][4];
          result.visible = true;
          setPathPosition(result, segmentPath, frame.progress);
          return;
        }
        inputTokens.forEach((token, index) => {
          token.visible = true;
          setPathPosition(token, segmentPath, clamp(frame.progress * 1.18 - index * 0.055, 0, 1));
          token.position.z += (index - (inputTokens.length - 1) / 2) * 0.1;
        });
      });
    }

    function updateBeat(frame) {
      const p = frame.progress;
      if (frame.gpuActive) updateGpuAssist(frame);
      else if (frame.beat === "inspect") updateInspect(frame);
      else if (frame.beat === "request") updateRequest(frame);
      else if (frame.beat === "nand-read") updateNandRead(frame);
      else if (frame.beat === "block-return") updateBlockReturn(frame);
      else if (frame.beat === "dram-join") updatePqTransfer(frame, "diskann", false);
      else if (frame.beat === "inline-unpack") updatePqTransfer(frame, "aisaq", true);
      else if (frame.beat === "pq-score") updatePqScore(frame);
      else if (frame.beat === "exact-score") updateExactScore(frame);
      else if (frame.beat === "queue-commit") updateQueueCommit(frame);
      else if (frame.beat === "scratch-release") updateScratchRelease(frame);
      else if (frame.beat === "block-pack") updateBlockPack(frame);
      else if (frame.beat === "evidence") updateEvidence(frame);
      if (p >= 1 && frame.beat === "request") methodsFor(frame).forEach((method) => setGlow(lanes[method].controller, colors.request, 1));
    }

    function render(state, context, dt) {
      if (disposed) return false;
      const frame = inferFrame(state || {}, context || {});
      if (frame.datasetName !== blockDataset) {
        blockDataset = PRESETS[frame.datasetName] ? frame.datasetName : "SIFT1B";
        rebuildBlockBay(blockDataset);
      }
      resetDynamicVisibility();
      resetHardwareState();
      applyView();
      updateGpuMode(frame.gpuActive ? "gpu-assist" : "paper");
      labelSprites.forEach((sprite) => { sprite.visible = frame.labels; });
      blockBay.visible = false;
      blockBay.scale.set(1, 1, 1);
      blockBay.position.y = -0.8;
      if (frame.beat === "block-pack") Object.values(lanes).forEach((lane) => { lane.group.visible = false; });
      updateBeat(frame);
      updateCamera(frame, dt);
      renderer.render(scene, camera);
      return true;
    }

    function resize(nextWidth, nextHeight) {
      width = Math.max(1, Math.round(nextWidth || 1));
      height = Math.max(1, Math.round(nextHeight || 1));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
      renderer.setSize(width, height, false);
    }
    function setView(method) {
      view = ["diskann", "aisaq"].includes(method) ? method : "split";
      manualOrbit = false;
    }
    function setComputePath(value) { computePath = ["gpu", "gpu-assist"].includes(value) ? "gpu-assist" : "paper"; }
    function setFollow(value) { followEnabled = Boolean(value); if (followEnabled) manualOrbit = false; }
    function zoomIn() { desiredDistance = clamp(desiredDistance - 1.5, 7.5, 65); }
    function zoomOut() { desiredDistance = clamp(desiredDistance + 1.5, 7.5, 65); }
    function fit() {
      const aspect = width / Math.max(1, height);
      desiredDistance = aspect < 0.78
        ? 18 * (view === "split" ? clamp(1.38 / Math.max(0.34, aspect), 1.55, 2.9) : clamp(0.92 / Math.max(0.34, aspect), 1.15, 2.15))
        : 18;
      desiredLook.set(0, 0.65, 0);
      orbitYaw = 0;
      orbitPitch = 0.14;
      manualOrbit = false;
    }

    function manualCamera() {
      manualOrbit = true;
      followEnabled = false;
      if (typeof opts.onManualCamera === "function") opts.onManualCamera();
    }
    function onPointerDown(event) {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
    }
    function onPointerMove(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      manualCamera();
      orbitYaw -= dx * 0.006;
      orbitPitch = clamp(orbitPitch + dy * 0.004, -0.16, 0.72);
    }
    function onPointerUp(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      pointer = null;
      canvas.releasePointerCapture?.(event.pointerId);
    }
    function onWheel(event) {
      event.preventDefault();
      manualCamera();
      desiredDistance = clamp(desiredDistance + Math.sign(event.deltaY) * 0.9, 7.5, 65);
    }
    function onMotionChange(event) { reducedMotion = event.matches; }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    if (reducedQuery.addEventListener) reducedQuery.addEventListener("change", onMotionChange);

    function dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      if (reducedQuery.removeEventListener) reducedQuery.removeEventListener("change", onMotionChange);
      resources.forEach((resource) => resource && resource.dispose && resource.dispose());
      renderer.dispose();
    }

    const api = { resize, render, setView, setComputePath, setFollow, zoomIn, zoomOut, fit, dispose };
    api.ready = Promise.resolve(api);
    return api;
  }

  window.createHardwareTransitRenderer = createHardwareTransitRenderer;
})();
