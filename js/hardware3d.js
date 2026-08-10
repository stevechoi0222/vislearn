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
    if (typeof window.createHardwareComponentFactory !== "function") {
      throw new Error("Detailed hardware component factory is unavailable.");
    }
    const componentFactory = window.createHardwareComponentFactory(THREE, {
      chamferBox,
      box,
      edges,
      hardwareMaterial,
      material,
      lineBetween,
      colors,
    });
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
      const componentMirror = isDisk ? -1 : 1;

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

      const cpuAssembly = componentFactory.createCpuAssembly(group, {
        idPrefix: method,
        position: [0.65, 2.35, 0],
      });
      const cpu = cpuAssembly.body;
      const cpuLabel = label(group, "CPU · LUT / exact", [0.65, 3.12, 0.72], 2.3, "#2e2412", "#ffd978");

      const dramScratchAssembly = componentFactory.createDramAssembly(group, {
        idPrefix: `${method}.scratch`,
        position: [0.82, 0.78, 0.16],
      });
      dramScratchAssembly.group.scale.setScalar(0.78);
      const scratch = dramScratchAssembly.body;
      const scratchChips = dramScratchAssembly.memoryPackages;
      const dramScratchLabel = label(group, "DRAM · reusable scratch", [0.82, 1.3, 0.62], 2.2, "#14265b", "#eaf0ff");

      const pqDramAssembly = componentFactory.createDramAssembly(group, {
        idPrefix: `${method}.pq`,
        position: [-1.78, 0.78, 0.12],
      });
      pqDramAssembly.group.scale.setScalar(0.68);
      pqDramAssembly.payloadOverlay.material.color.setHex(isDisk ? colors.pq : colors.steel);
      pqDramAssembly.payloadOverlay.material.emissive.setHex(isDisk ? colors.pq : colors.steel);
      pqDramAssembly.logicalBanks.forEach((bank, index) => {
        const representative = index === 0;
        bank.material.color.setHex(representative ? colors.pq : colors.steel);
        bank.material.emissive.setHex(representative ? colors.pq : colors.steel);
        bank.material.opacity = representative ? 0.72 : 0.22;
      });
      const pqBank = pqDramAssembly.group;
      const pqCells = pqDramAssembly.logicalBanks;
      const dramPqLabel = label(group, isDisk ? "DRAM · GLOBAL PQ[N]" : "DRAM · n_ep seed", [-1.78, 1.27, 0.58], 2.05, "#14265b", "#f7e88e");

      const ssdAssembly = componentFactory.createSsdAssembly(group, {
        idPrefix: method,
        mirror: componentMirror,
        position: [0.3, -2.16, 0.18],
      });
      const controller = ssdAssembly.controller;
      const nand = ssdAssembly.group;
      const nandChips = ssdAssembly.nandPackages;
      const ssdLabel = label(group, "SSD · NVMe / NAND cutaway", [0.3, -1.42, 0.62], 2.55, "#10332f", "#a8fff4");
      const ssdPcieAnchor = ssdAssembly.anchors.pcie;
      const ssdPciePoint = [
        ssdAssembly.group.position.x + ssdPcieAnchor[0],
        ssdAssembly.group.position.y + ssdPcieAnchor[1],
        ssdAssembly.group.position.z + ssdPcieAnchor[2],
      ];
      const pcie = lineBetween(group, [0.65, 2.02, -0.25], ssdPciePoint, colors.request, 0.055, 0.62);
      pcie.name = "pcie-nvme";
      label(group, "PCIe / NVMe", [1.2, -0.2, 0.7], 1.9, "#3b2c13", "#ffd56f");

      const ssdCopy = packet(group, isDisk ? [2.3, 0.42, 0.78] : [3.15, 0.42, 0.78], colors.returnBlock, "4 KB node copy");
      ssdCopy.position.set(0.3, -3.48, 0.8);
      const pqStripe = box(ssdCopy, [isDisk ? 0.03 : 1.05, 0.46, 0.82], [isDisk ? 1.2 : 0.88, 0, 0], material(isDisk ? colors.steel : colors.pq));
      pqStripe.visible = !isDisk;

      const gpuGroupX = isDisk ? 1.75 : -1.75;
      const gpuGroupY = -0.2;
      const gpuGroupZ = 1.28;
      const gpuAssembly = componentFactory.createGpuAssembly(group, {
        idPrefix: method,
        mirror: componentMirror,
        position: [gpuGroupX, gpuGroupY, gpuGroupZ],
      });
      const gpuGroup = gpuAssembly.group;
      const gpuBoard = gpuAssembly.board;
      const gpuDie = gpuAssembly.die;
      const gpuDieCap = gpuAssembly.dieFrame;
      const vram = gpuAssembly.vramBanks;
      const vramCaps = gpuAssembly.vramCaps;
      const gpuLabel = label(gpuGroup, "GPU · optional illustrative", [0, 1.16, 0.22], 2.75, "#241d3e", "#c8b7ff");
      const gpuDetailLabel = label(gpuGroup, "VRAM · CORE ARRAY", [-0.72 * componentMirror, -0.16, 0.46], 1.45, "#241d3e", "#c8b7ff");
      const gpuLanePoint = (point) => [gpuGroupX + point[0], gpuGroupY + point[1], gpuGroupZ + point[2]];
      const gpuPoints = {
        board: gpuLanePoint(gpuAssembly.anchors.board),
        pcie: gpuLanePoint(gpuAssembly.anchors.pcie),
        memoryController: gpuLanePoint(gpuAssembly.anchors.memoryController),
        vram: gpuLanePoint(gpuAssembly.anchors.vram),
        vramBanks: gpuAssembly.anchors.vramBanks.map(gpuLanePoint),
        compute: gpuLanePoint(gpuAssembly.anchors.cores),
        coreClusters: gpuAssembly.anchors.coreClusters.map(gpuLanePoint),
        reducer: gpuLanePoint(gpuAssembly.anchors.reducer),
        result: gpuLanePoint(gpuAssembly.anchors.result),
        link: gpuLanePoint(gpuAssembly.anchors.pcie),
      };
      const gpuLink = lineBetween(group, [0.65, 2.05, -0.72], gpuPoints.link, colors.gpuDim, 0.045, 0.35);

      return {
        method, group, chassis, board,
        cpu, cpuAssembly, cpuLabel,
        scratch, scratchChips, dramScratchAssembly, dramScratchLabel,
        pqBank, pqCells, pqDramAssembly, dramPqLabel,
        pcie, controller, nand, nandChips, ssdAssembly, ssdLabel, ssdCopy,
        gpuGroup, gpuAssembly, gpuLabel, gpuDetailLabel, gpuBoard, gpuDie, gpuDieCap, vram, vramCaps, gpuLink, gpuPoints,
      };
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
    const cpuTokens = { diskann: [], aisaq: [] };
    const gpuTokens = { diskann: [], aisaq: [] };
    const storageTokens = { diskann: [], aisaq: [] };
    ["diskann", "aisaq"].forEach((method) => {
      for (let index = 0; index < 4; index += 1) scalarTokens[method].push(packet(dynamic, [0.34, 0.25, 0.38], colors.white, index === 0 ? "d" : ""));
      queueTokens[method] = packet(dynamic, [1.15, 0.42, 0.55], colors.white, "ID + scalar");
      exactVectors[method] = packet(dynamic, [1.25, 0.48, 0.68], colors.vector, "full vector");
      for (let index = 0; index < 3; index += 1) cpuTokens[method].push(packet(dynamic, [0.22, 0.18, 0.22], index === 0 ? colors.pq : colors.cpu, ""));
      for (let index = 0; index < 5; index += 1) gpuTokens[method].push(packet(dynamic, [0.18, 0.18, 0.18], index < 4 ? colors.pq : colors.white, ""));
      for (let index = 0; index < 3; index += 1) storageTokens[method].push(packet(dynamic, [0.2, 0.16, 0.2], colors.returnBlock, ""));
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
      const componentFlow = hardware.componentFlow && typeof hardware.componentFlow === "object" ? hardware.componentFlow : null;
      let activeComponentStep = componentFlow?.activeStep && typeof componentFlow.activeStep === "object"
        ? componentFlow.activeStep
        : null;
      const activeComponentStepId = String(hardware.componentStep || componentFlow?.activeStep || "").trim();
      if (!activeComponentStep && activeComponentStepId && Array.isArray(componentFlow?.steps)) {
        activeComponentStep = componentFlow.steps.find((entry) => String(entry?.id || "") === activeComponentStepId) || null;
      }
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
      const resolvedSource = activeComponentStep?.source || hardware.source || "";
      const resolvedDestination = activeComponentStep?.destination || hardware.destination || "";
      const sourceDestination = `${resolvedSource} ${resolvedDestination}`.toLowerCase();
      const hardwareGpuActive = Boolean(hardware.gpu && hardware.gpu.active);
      const requestedPath = hardware.computePath || (sourceDestination.includes("gpu") || sourceDestination.includes("vram") || hardwareGpuActive ? "gpu-assist" : computePath);
      const gpuMode = ["gpu", "gpu-assist"].includes(requestedPath) ? "gpu-assist" : "paper";
      const computeBeat = ["pq-score", "exact-score"].includes(beat);
      const hasHardwareGpuFlag = hardware.gpu && typeof hardware.gpu.active === "boolean";
      const gpuActive = hasHardwareGpuFlag ? hardware.gpu.active : computeBeat && gpuMode === "gpu-assist";
      let componentProgress = Number(hardware.componentProgress ?? activeComponentStep?.progress ?? componentFlow?.stepProgress);
      if (!Number.isFinite(componentProgress)) componentProgress = progress;
      componentProgress = clamp(componentProgress, 0, 1);
      if (reducedMotion) componentProgress = componentProgress >= 0.5 ? 1 : 0;
      return {
        beat,
        family,
        progress,
        datasetName,
        method: ["diskann", "aisaq"].includes(hardware.method) ? hardware.method : "both",
        cameraTarget: hardware.componentFocus || activeComponentStep?.cameraTarget || hardware.cameraTarget || "overview",
        source: resolvedSource,
        destination: resolvedDestination,
        payload: hardware.payload || "",
        componentStep: activeComponentStepId,
        componentProgress,
        componentFocus: hardware.componentFocus || hardware.cameraTarget || "",
        componentTitle: hardware.componentTitle || activeComponentStep?.title || componentFlow?.title || "",
        componentNote: hardware.componentNote || activeComponentStep?.note || componentFlow?.note || "",
        componentPayload: hardware.componentPayload || activeComponentStep?.payload || componentFlow?.payload || "",
        componentProcessor: String(componentFlow?.processor || "").toLowerCase(),
        payloadRegion: activeComponentStep?.payloadRegion || componentFlow?.payloadRegion || null,
        activeComponents: Array.isArray(hardware.activeComponents)
          ? hardware.activeComponents
          : Array.isArray(componentFlow?.activeComponents) ? componentFlow.activeComponents : [],
        geometryStatus: hardware.geometryStatus || activeComponentStep?.geometryStatus || componentFlow?.geometryStatus || "",
        operationStatus: hardware.operationStatus || hardware.factStatus || "",
        computePath: gpuMode,
        gpuActive,
        labels: !state || state.labels !== false,
      };
    }

    function laneWorld(lane, local) {
      return new THREE.Vector3(lane.group.position.x + local[0], local[1], local[2]);
    }
    function cpuWorld(lane, key, index) {
      const assembly = lane.cpuAssembly;
      const anchor = key === "cores"
        ? assembly.anchors.cores[index == null ? 0 : index]
        : assembly.anchors[key];
      return laneWorld(lane, [
        assembly.group.position.x + anchor[0],
        assembly.group.position.y + anchor[1],
        assembly.group.position.z + anchor[2],
      ]);
    }
    function gpuWorld(lane, key, index) {
      const points = lane.gpuPoints[key];
      const point = Array.isArray(points?.[0]) ? points[index == null ? 0 : index] : points;
      return laneWorld(lane, point);
    }
    function objectWorld(object) {
      if (!object) return null;
      return object.getWorldPosition(new THREE.Vector3());
    }
    function dramAssemblyFor(frame, lane) {
      return frame.payloadRegion === "global-pq" ? lane.pqDramAssembly : lane.dramScratchAssembly;
    }
    function dramAddressObject(frame, lane, address) {
      const assembly = dramAssemblyFor(frame, lane);
      const value = String(address || "").toLowerCase();
      if (value.includes("input-port")) return assembly.inputPort;
      if (value.includes("package")) return assembly.memoryPackages[0];
      if (value.includes("logical-bank")) return assembly.logicalBanks[0];
      if (value.includes("payload-region")) return assembly.payloadOverlay;
      if (value.includes("output-port")) return assembly.outputPort;
      return assembly.payloadOverlay;
    }
    function ssdAddressObject(lane, address) {
      const assembly = lane.ssdAssembly;
      const value = String(address || "").toLowerCase();
      if (value.includes("pcie-endpoint")) return assembly.pcieEndpoint;
      if (value.includes("command-queue")) return assembly.commandQueue;
      if (value.includes("flash-channel")) return assembly.flashChannels[0];
      if (value.includes("nand-package")) return assembly.nandPackages[0];
      if (value.includes("nand-die")) return assembly.nandDies[0];
      if (value.includes("return-buffer")) return assembly.returnBuffer;
      if (value.includes("controller")) return assembly.controller;
      return assembly.controller;
    }
    function componentAddressObject(frame, lane, address) {
      const value = String(address || "").toLowerCase();
      if (value.includes("ssd.")) return ssdAddressObject(lane, value);
      if (value.includes("dram.")) return dramAddressObject(frame, lane, value);
      return null;
    }
    function resetDynamicVisibility() {
      Object.values(requestPulses).forEach((pulse) => { pulse.visible = false; });
      Object.values(returnBlocks).forEach((block) => {
        block.visible = false;
        block.scale.setScalar(1);
      });
      Object.values(scanPlanes).forEach((plane) => { plane.visible = false; });
      Object.values(nandVoxels).flat().forEach((voxel) => { voxel.visible = false; });
      pqFragments.forEach((fragment) => { fragment.visible = false; });
      Object.values(scalarTokens).flat().forEach((token) => { token.visible = false; });
      Object.values(queueTokens).forEach((token) => { token.visible = false; });
      Object.values(exactVectors).forEach((token) => { token.visible = false; });
      Object.values(cpuTokens).flat().forEach((token) => { token.visible = false; });
      Object.values(gpuTokens).flat().forEach((token) => { token.visible = false; });
      Object.values(storageTokens).flat().forEach((token) => { token.visible = false; });
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
        lane.cpuAssembly.coreTiles.forEach((tile) => {
          setGlow(tile, colors.cpuDeep, 0.025);
          tile.scale.setScalar(1);
        });
        lane.cpuAssembly.cacheSlices.forEach((slice) => setGlow(slice, colors.cpuDeep, 0.03));
        setGlow(lane.cpuAssembly.lutUnit, colors.cpu, 0.08);
        setGlow(lane.cpuAssembly.exactUnit, colors.vector, 0.04);
        setGlow(lane.cpuAssembly.reducer, colors.cpuDeep, 0.03);
        setGlow(lane.cpuAssembly.inputPort, colors.dram, 0.08);
        setGlow(lane.cpuAssembly.resultPort, colors.white, 0.05);
        lane.cpuAssembly.flowTraces.forEach((trace) => setGlow(trace, colors.cpuDeep, 0));
        [lane.dramScratchAssembly, lane.pqDramAssembly].forEach((assembly) => {
          assembly.memoryPackages.forEach((entry, index) => {
            setGlow(entry, colors.dramDeep, index === 0 ? 0.035 : 0.012);
            entry.scale.setScalar(1);
          });
          assembly.logicalBanks.forEach((entry, index) => {
            const pqRegion = assembly === lane.pqDramAssembly;
            const activePqCell = index === 0;
            const regionColor = pqRegion && !activePqCell ? colors.steel : pqRegion ? colors.pq : colors.dram;
            setGlow(entry, regionColor, pqRegion ? (activePqCell ? 0.04 : 0.005) : 0.08);
            if (pqRegion) entry.material.opacity = activePqCell ? 0.72 : 0.22;
            entry.scale.setScalar(1);
          });
          setGlow(assembly.inputPort, colors.dram, 0.08);
          setGlow(assembly.outputPort, colors.dram, 0.04);
          setGlow(assembly.payloadOverlay, assembly === lane.pqDramAssembly ? colors.pq : colors.dram, 0.12);
          assembly.payloadOverlay.material.opacity = 0.16;
          assembly.flowTraces.forEach((trace) => setGlow(trace, colors.dram, 0));
        });
        setGlow(lane.controller, colors.ssdDeep, 0.08);
        lane.nandChips.forEach((chip, index) => setGlow(chip, colors.ssdDeep, index === 0 ? 0.06 : 0.015));
        setGlow(lane.ssdAssembly.pcieEndpoint, colors.request, 0.06);
        setGlow(lane.ssdAssembly.commandQueue, colors.request, 0.07);
        lane.ssdAssembly.flashChannels.forEach((entry) => setGlow(entry, colors.ssd, 0.04));
        lane.ssdAssembly.nandDies.forEach((entry, index) => setGlow(entry, colors.ssd, index === 0 ? 0.05 : 0.015));
        setGlow(lane.ssdAssembly.returnBuffer, colors.returnBlock, 0.08);
        lane.ssdAssembly.flowTraces.forEach((trace) => setGlow(trace, colors.ssdDeep, 0));
        [...lane.ssdAssembly.nandPackages, ...lane.ssdAssembly.nandDies].forEach((entry) => entry.scale.setScalar(1));
        lane.ssdCopy.scale.set(1, 1, 1);
        lane.gpuAssembly.coreClusters.forEach((cluster) => {
          setGlow(cluster, colors.gpu, 0.02);
          cluster.scale.setScalar(1);
        });
        lane.gpuAssembly.memoryControllers.forEach((controller) => setGlow(controller, colors.returnBlock, 0.025));
        setGlow(lane.gpuAssembly.reducer, colors.gpu, 0.025);
        setGlow(lane.gpuAssembly.resultBuffer, colors.gpu, 0.025);
        setGlow(lane.gpuAssembly.pcieEndpoint, colors.gpu, 0.02);
        lane.vram.forEach((chip) => chip.scale.setScalar(1));
        lane.gpuAssembly.flowTraces.forEach((trace) => setGlow(trace, colors.gpu, 0));
      });
    }
    function updateGpuMode(mode) {
      const active = mode === "gpu-assist";
      Object.values(lanes).forEach((lane) => {
        lane.gpuGroup.visible = active;
        lane.gpuLink.visible = active;
        lane.gpuBoard.material.color.setHex(active ? 0x393052 : 0x262b3b);
        lane.gpuDie.material.color.setHex(active ? colors.gpu : colors.gpuDim);
        lane.gpuDieCap.material.color.setHex(active ? 0xb19af0 : 0x51496e);
        lane.vram.forEach((chip) => chip.material.color.setHex(active ? 0x7054b3 : colors.gpuDim));
        lane.vramCaps.forEach((chip) => chip.material.color.setHex(active ? 0x9c83dc : 0x494361));
        setGlow(lane.gpuDie, colors.gpu, active ? 0.35 : 0.02);
        lane.vram.forEach((chip, index) => setGlow(chip, colors.gpu, active && index === 0 ? 0.16 : 0.02));
        lane.gpuAssembly.coreClusters.forEach((cluster, index) => setGlow(cluster, colors.gpu, active && index === 0 ? 0.1 : 0.02));
        lane.gpuAssembly.memoryControllers.forEach((controller, index) => setGlow(controller, colors.returnBlock, active && index === 0 ? 0.12 : 0.025));
        lane.gpuLink.material.color.setHex(active ? colors.gpu : colors.gpuDim);
        lane.gpuLink.material.opacity = active ? 0.72 : 0.2;
      });
    }

    const cameraLook = new THREE.Vector3(0, 0.3, 0);
    const desiredLook = new THREE.Vector3(0, 0.3, 0);

    function cameraFocus(frame) {
      const methods = methodsFor(frame, frame.gpuActive);
      const laneX = methods.length ? methods.reduce((sum, method) => sum + lanes[method].group.position.x, 0) / methods.length : 0;
      const averageCpuPoint = (key) => {
        if (!methods.length) return new THREE.Vector3(0, 2.35, 0);
        const total = methods.reduce((sum, method) => sum.add(cpuWorld(lanes[method], key)), new THREE.Vector3());
        return total.multiplyScalar(1 / methods.length);
      };
      const averageGpuPoint = (key) => {
        if (!methods.length) return new THREE.Vector3(0, -0.5, -1);
        const total = methods.reduce((sum, method) => sum.add(gpuWorld(lanes[method], key)), new THREE.Vector3());
        return total.multiplyScalar(1 / methods.length);
      };
      const averageSsdPoint = (address) => {
        if (!methods.length) return new THREE.Vector3(0, -2.16, 0.4);
        const total = methods.reduce((sum, method) => sum.add(objectWorld(ssdAddressObject(lanes[method], address))), new THREE.Vector3());
        return total.multiplyScalar(1 / methods.length);
      };
      const averageDramPoint = (address, payloadRegion) => {
        if (!methods.length) return new THREE.Vector3(0, 0.78, 0.4);
        const focusFrame = Object.assign({}, frame, { payloadRegion });
        const total = methods.reduce((sum, method) => sum.add(objectWorld(dramAddressObject(focusFrame, lanes[method], address))), new THREE.Vector3());
        return total.multiplyScalar(1 / methods.length);
      };
      const cpuPackagePoint = averageCpuPoint("package");
      const cpuLutPoint = averageCpuPoint("lut");
      const cpuExactPoint = averageCpuPoint("exact");
      const cpuCorePoint = averageCpuPoint("core");
      const cpuResultPoint = averageCpuPoint("result");
      const gpuBoardPoint = averageGpuPoint("board");
      const gpuMemoryControllerPoint = averageGpuPoint("memoryController");
      const gpuVramPoint = averageGpuPoint("vram");
      const gpuComputePoint = averageGpuPoint("compute");
      const gpuResultPoint = averageGpuPoint("result");
      const ssdPciePoint = averageSsdPoint("ssd.pcie-endpoint");
      const ssdControllerPoint = averageSsdPoint("ssd.controller");
      const ssdQueuePoint = averageSsdPoint("ssd.command-queue");
      const ssdChannelPoint = averageSsdPoint("ssd.flash-channel.0");
      const ssdPackagePoint = averageSsdPoint("ssd.nand-package.0");
      const ssdDiePoint = averageSsdPoint("ssd.nand-die.0");
      const ssdReturnPoint = averageSsdPoint("ssd.return-buffer");
      const dramInputPoint = averageDramPoint("dram.input-port", frame.payloadRegion || "scratch");
      const dramPackagePoint = averageDramPoint("dram.package.0", frame.payloadRegion || "scratch");
      const dramBankPoint = averageDramPoint("dram.logical-bank.0", frame.payloadRegion || "scratch");
      const dramScratchPoint = averageDramPoint("dram.payload-region", "scratch");
      const dramPqPoint = averageDramPoint("dram.payload-region", "global-pq");
      const dramOutputPoint = averageDramPoint("dram.output-port", frame.payloadRegion || "scratch");
      const cpuDistance = methods.length > 1 ? 11.4 : 7.8;
      const gpuDistance = methods.length > 1 ? 11.4 : 7.9;
      const storageDistance = methods.length > 1 ? 11.2 : 7.7;
      const targets = {
        overview: { point: [0, 0.65, 0], distance: 18 },
        "ssd-controller": { point: [ssdControllerPoint.x, ssdControllerPoint.y, ssdControllerPoint.z], distance: storageDistance },
        "ssd-nand": { point: [ssdPackagePoint.x, ssdPackagePoint.y, ssdPackagePoint.z], distance: storageDistance },
        "ssd-pcie": { point: [ssdPciePoint.x, ssdPciePoint.y, ssdPciePoint.z], distance: storageDistance },
        "ssd-command-queue": { point: [ssdQueuePoint.x, ssdQueuePoint.y, ssdQueuePoint.z], distance: storageDistance - 0.2 },
        "ssd-flash-channel": { point: [ssdChannelPoint.x, ssdChannelPoint.y, ssdChannelPoint.z], distance: storageDistance - 0.2 },
        "ssd-nand-package": { point: [ssdPackagePoint.x, ssdPackagePoint.y, ssdPackagePoint.z], distance: storageDistance - 0.3 },
        "ssd-nand-die": { point: [ssdDiePoint.x, ssdDiePoint.y, ssdDiePoint.z], distance: storageDistance - 0.4 },
        "ssd-return-buffer": { point: [ssdReturnPoint.x, ssdReturnPoint.y, ssdReturnPoint.z], distance: storageDistance - 0.2 },
        "dram-scratch": { point: [dramScratchPoint.x, dramScratchPoint.y, dramScratchPoint.z], distance: storageDistance },
        "dram-pq-array": { point: [dramPqPoint.x, dramPqPoint.y, dramPqPoint.z], distance: storageDistance },
        "dram-input": { point: [dramInputPoint.x, dramInputPoint.y, dramInputPoint.z], distance: storageDistance },
        "dram-package": { point: [dramPackagePoint.x, dramPackagePoint.y, dramPackagePoint.z], distance: storageDistance - 0.2 },
        "dram-bank": { point: [dramBankPoint.x, dramBankPoint.y, dramBankPoint.z], distance: storageDistance - 0.3 },
        "dram-scratch-region": { point: [dramScratchPoint.x, dramScratchPoint.y, dramScratchPoint.z], distance: storageDistance - 0.3 },
        "dram-global-pq-region": { point: [dramPqPoint.x, dramPqPoint.y, dramPqPoint.z], distance: storageDistance - 0.3 },
        "dram-output": { point: [dramOutputPoint.x, dramOutputPoint.y, dramOutputPoint.z], distance: storageDistance },
        "cpu-package": { point: [cpuPackagePoint.x, cpuPackagePoint.y, cpuPackagePoint.z], distance: cpuDistance + 0.8 },
        "cpu-cache": { point: [cpuPackagePoint.x, cpuPackagePoint.y, cpuPackagePoint.z], distance: cpuDistance },
        "cpu-lut": { point: [cpuLutPoint.x, cpuLutPoint.y, cpuLutPoint.z], distance: cpuDistance },
        "cpu-exact": { point: [cpuExactPoint.x, cpuExactPoint.y, cpuExactPoint.z], distance: cpuDistance },
        "cpu-cores": { point: [cpuCorePoint.x, cpuCorePoint.y, cpuCorePoint.z], distance: cpuDistance - 0.3 },
        "cpu-result": { point: [cpuResultPoint.x, cpuResultPoint.y, cpuResultPoint.z], distance: cpuDistance },
        "host-queues": { point: [-0.35, 4.75, 0], distance: 11.8 },
        "host-result": { point: [4.75, 4.75, 0], distance: 10.8 },
        "ssd-blocks": { point: [0, -0.7, 1.3], distance: 11.4 },
        "evidence-panel": { point: [0, 0.4, 0], distance: 16.2 },
        pcie: { point: [laneX + 0.55, -0.05, -0.1], distance: 10.8 },
        "gpu-board": { point: [gpuBoardPoint.x, gpuBoardPoint.y, gpuBoardPoint.z], distance: gpuDistance + 0.7 },
        "gpu-memory-controller": { point: [gpuMemoryControllerPoint.x, gpuMemoryControllerPoint.y, gpuMemoryControllerPoint.z], distance: gpuDistance },
        "gpu-memory": { point: [gpuMemoryControllerPoint.x, gpuMemoryControllerPoint.y, gpuMemoryControllerPoint.z], distance: gpuDistance },
        "gpu-vram": { point: [gpuVramPoint.x, gpuVramPoint.y, gpuVramPoint.z], distance: gpuDistance },
        "gpu-compute": { point: [gpuComputePoint.x, gpuComputePoint.y, gpuComputePoint.z], distance: gpuDistance - 0.25 },
        "gpu-cores": { point: [gpuComputePoint.x, gpuComputePoint.y, gpuComputePoint.z], distance: gpuDistance - 0.25 },
        "gpu-result": { point: [gpuResultPoint.x, gpuResultPoint.y, gpuResultPoint.z], distance: gpuDistance },
        "gpu-result-buffer": { point: [gpuResultPoint.x, gpuResultPoint.y, gpuResultPoint.z], distance: gpuDistance },
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
    function storageFlowTrace(frame, lane, source, destination) {
      const from = String(source || "").toLowerCase();
      const to = String(destination || "").toLowerCase();
      if (from.includes("ssd.pcie-endpoint") && to.includes("ssd.controller")) return [lane.ssdAssembly.flowTraceMap.pcieInput];
      if (from.includes("ssd.controller") && to.includes("ssd.command-queue")) return [lane.ssdAssembly.flowTraceMap.commandQueue];
      if (from.includes("ssd.command-queue")) return [lane.ssdAssembly.flowTraceMap.flashChannels[0]];
      if (from.includes("ssd.flash-channel")) {
        return [lane.ssdAssembly.flowTraceMap.flashChannels[2] || lane.ssdAssembly.flowTraceMap.flashChannels[0]];
      }
      if (from.includes("ssd.nand-die") && to.includes("ssd.return-buffer")) return [lane.ssdAssembly.flowTraceMap.nandReturn[0]];
      if (from.includes("ssd.return-buffer") && to.includes("dram.input-port")) {
        return [lane.ssdAssembly.flowTraceMap.returnPcie, lane.dramScratchAssembly.flowTraceMap.input];
      }
      const assembly = dramAssemblyFor(frame, lane);
      if (from.includes("dram.input-port")) return [assembly.flowTraceMap.input];
      if (from.includes("dram.package") || from.includes("dram.logical-bank")) return [assembly.flowTraceMap.banks[0]];
      if (from.includes("dram.payload-region")) return [assembly.flowTraceMap.output];
      return [];
    }
    function glowStorageAddress(frame, lane, address, intensity, local) {
      const value = String(address || "").toLowerCase();
      const object = componentAddressObject(frame, lane, value);
      if (!object) return;
      const color = value.includes("return-buffer") || value.includes("dram.input")
        ? colors.returnBlock
        : value.includes("dram.")
          ? (frame.payloadRegion === "global-pq" ? colors.pq : colors.dram)
          : value.includes("pcie") || value.includes("controller") || value.includes("command-queue")
            ? colors.request : colors.ssd;
      setGlow(object, color, intensity);
      if (/package|nand-die|logical-bank/.test(value)) object.scale.setScalar(1 + Math.sin(local * Math.PI) * 0.07);
    }
    function updateStorageComponentFlow(frame) {
      const sourceName = String(frame.source || "").toLowerCase();
      const destinationName = String(frame.destination || "").toLowerCase();
      if (!sourceName.includes("ssd.") && !sourceName.includes("dram.")
        && !destinationName.includes("ssd.") && !destinationName.includes("dram.")) return false;
      const local = clamp(frame.componentProgress, 0, 1);
      const logicalDramAccess = ["dram-join", "inline-unpack"].includes(frame.beat);
      const payloadEgress = logicalDramAccess
        && sourceName.includes("dram.payload-region")
        && destinationName.includes("dram.output-port");
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const sourceObject = componentAddressObject(frame, lane, sourceName);
        const destinationObject = componentAddressObject(frame, lane, destinationName);
        const source = objectWorld(sourceObject);
        const destination = objectWorld(destinationObject);
        if (!source || !destination) return;
        const midpoint = source.clone().lerp(destination, 0.5);
        midpoint.z += Math.min(0.75, 0.22 + source.distanceTo(destination) * 0.08);
        const path = source.distanceTo(destination) > 1.15 ? [source, midpoint, destination] : [source, destination];

        glowStorageAddress(frame, lane, sourceName, 0.8, local);
        glowStorageAddress(frame, lane, destinationName, 1.15 + Math.sin(local * Math.PI) * 0.55, local);
        const dramSegment = sourceName.includes("dram.") || destinationName.includes("dram.");
        const returnCrossing = sourceName.includes("ssd.return-buffer") && destinationName.includes("dram.input-port");
        const traceColor = returnCrossing
          ? colors.returnBlock
          : logicalDramAccess && !payloadEgress
            ? colors.request
            : dramSegment
              ? (frame.payloadRegion === "global-pq" ? colors.pq : colors.dram)
              : colors.ssd;
        storageFlowTrace(frame, lane, sourceName, destinationName).forEach((trace) => {
          setGlow(trace, traceColor, 1.2);
        });

        if (sourceName.includes("ssd.return-buffer") && destinationName.includes("dram.input-port")) {
          const block = returnBlocks[method];
          block.visible = true;
          block.scale.setScalar(0.52);
          setPathPosition(block, path, local);
          return;
        }

        const tokens = frame.beat === "request" || (logicalDramAccess && !payloadEgress)
          ? [requestPulses[method]]
          : payloadEgress
            ? pqFragments.slice(method === "diskann" ? 0 : 5, method === "diskann" ? 3 : 8)
            : storageTokens[method];
        tokens.forEach((token, index) => {
          token.visible = true;
          setPathPosition(token, path, clamp(local * 1.16 - index * 0.07, 0, 1));
          token.position.z += (index - (tokens.length - 1) / 2) * 0.055;
        });
      });
      return true;
    }
    function updateRequest(frame) {
      methodsFor(frame).forEach((method) => {
        const lane = lanes[method];
        const pulse = requestPulses[method];
        pulse.visible = true;
        setPathPosition(pulse, [
          cpuWorld(lane, "result"),
          laneWorld(lane, [0.6, 0.1, 0.5]),
          objectWorld(lane.ssdAssembly.pcieEndpoint),
          objectWorld(lane.ssdAssembly.controller),
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
          const source = objectWorld(lane.ssdAssembly.nandDies[chipIndex * 2]);
          const target = objectWorld(lane.ssdAssembly.returnBuffer);
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
          objectWorld(lane.ssdAssembly.returnBuffer),
          laneWorld(lane, [0.55, -0.15, 1.1]),
          objectWorld(lane.dramScratchAssembly.inputPort),
          objectWorld(lane.dramScratchAssembly.payloadOverlay),
        ], frame.progress);
        setGlow(lane.scratch, colors.returnBlock, 0.2 + frame.progress);
      });
    }
    function updatePqTransfer(frame, method, inline) {
      if ((view === "diskann" && method !== "diskann") || (view === "aisaq" && method !== "aisaq")) return;
      const lane = lanes[method];
      const offset = method === "diskann" ? 0 : 5;
      const source = objectWorld(inline ? lane.dramScratchAssembly.outputPort : lane.pqDramAssembly.outputPort);
      const target = cpuWorld(lane, "input");
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
    function resolveCpuComponentStep(frame) {
      const name = String(frame.componentStep || "").toLowerCase();
      if (name.includes("retire") || name.includes("result") || name.includes("output")) return { step: "retire", progress: frame.componentProgress };
      if (name.includes("core") || name.includes("execute") || name.includes("dispatch")) return { step: "core", progress: frame.componentProgress };
      if (name.includes("lut") || name.includes("exact") || name.includes("function") || name.includes("unit")) return { step: "function", progress: frame.componentProgress };
      if (name.includes("ingress") || name.includes("input") || name.includes("cache")) return { step: "ingress", progress: frame.componentProgress };
      const scaled = clamp(frame.progress, 0, 1) * 4;
      const index = Math.min(3, Math.floor(scaled));
      return { step: ["ingress", "function", "core", "retire"][index], progress: scaled - index };
    }
    function cpuInputWorld(frame, lane, method, exact) {
      const source = String(frame.source || "").toLowerCase();
      if (source.includes("host.query") || source.endsWith(".q")) return new THREE.Vector3(-5.05, 4.78, 0.05);
      if (source.includes("centroid") || source.includes("host.lut")) return new THREE.Vector3(-3, 4.78, 0.05);
      if (source.includes("pq-array") || (method === "diskann" && !exact && !source.includes("scratch"))) return objectWorld(lane.pqDramAssembly.outputPort);
      return objectWorld(lane.dramScratchAssembly.outputPort);
    }
    function updateCpuComponentFlow(frame, method, exact) {
      const lane = lanes[method];
      const resolved = resolveCpuComponentStep(frame);
      const local = clamp(resolved.progress, 0, 1);
      const input = cpuWorld(lane, "input");
      const cache = cpuWorld(lane, "cache");
      const unit = cpuWorld(lane, exact ? "exact" : "lut");
      const core = cpuWorld(lane, "cores", 0);
      const reducer = cpuWorld(lane, "reducer");
      const result = cpuWorld(lane, "result");
      const source = cpuInputWorld(frame, lane, method, exact);
      const paths = {
        ingress: [source, input, cache],
        function: [cache, unit],
        core: [unit, core],
        retire: [core, reducer, result],
      };
      const tokens = exact && resolved.step === "ingress" ? [exactVectors[method]] : cpuTokens[method];
      tokens.forEach((token, index) => {
        token.visible = true;
        setPathPosition(token, paths[resolved.step], clamp(local * 1.18 - index * 0.075, 0, 1));
        token.position.z += (index - (tokens.length - 1) / 2) * 0.055;
      });

      setGlow(lane.cpu, exact ? colors.vector : colors.cpu, 0.42);
      if (resolved.step === "ingress") {
        setGlow(lane.cpuAssembly.inputPort, exact ? colors.vector : colors.pq, 1.35);
        lane.cpuAssembly.cacheSlices.forEach((slice) => setGlow(slice, exact ? colors.vector : colors.cpu, 0.75));
        setGlow(lane.cpuAssembly.flowTraces[exact ? 2 : 0], exact ? colors.vector : colors.pq, 1.1);
      } else if (resolved.step === "function") {
        lane.cpuAssembly.cacheSlices.forEach((slice) => setGlow(slice, exact ? colors.vector : colors.cpu, 0.55));
        setGlow(exact ? lane.cpuAssembly.exactUnit : lane.cpuAssembly.lutUnit, exact ? colors.vector : colors.pq, 1.65);
        setGlow(lane.cpuAssembly.flowTraces[exact ? 3 : 1], exact ? colors.vector : colors.pq, 1.2);
      } else if (resolved.step === "core") {
        setGlow(exact ? lane.cpuAssembly.exactUnit : lane.cpuAssembly.lutUnit, exact ? colors.vector : colors.pq, 0.8);
        setGlow(lane.cpuAssembly.coreTiles[0], exact ? colors.vector : colors.cpu, 1.75);
        lane.cpuAssembly.coreTiles[0].scale.setScalar(1 + Math.sin(local * Math.PI) * 0.085);
      } else {
        setGlow(lane.cpuAssembly.coreTiles[0], exact ? colors.vector : colors.cpu, 0.95);
        setGlow(lane.cpuAssembly.reducer, exact ? colors.vector : colors.cpu, 1.35);
        setGlow(lane.cpuAssembly.resultPort, colors.white, 1.55);
        setGlow(lane.cpuAssembly.flowTraces[4], exact ? colors.vector : colors.cpu, 1.15);
        setGlow(lane.cpuAssembly.flowTraces[5], colors.white, 1.25);
      }
      return { step: resolved.step, progress: local, result };
    }
    function updatePqScore(frame) {
      methodsFor(frame).forEach((method) => {
        const flow = updateCpuComponentFlow(frame, method, false);
        const hostL = new THREE.Vector3(-0.35, 4.78, 0.05);
        if (flow.step !== "retire") return;
        setGlow(hostBodies.L, colors.white, 0.55 + flow.progress * 0.45);
        scalarTokens[method].forEach((token, index) => {
          token.visible = true;
          setPathPosition(token, [flow.result, new THREE.Vector3(lerp(flow.result.x, hostL.x, 0.55), 3.6, 1), hostL], clamp(flow.progress * 1.25 - index * 0.08, 0, 1));
          token.position.z += (index - 1.5) * 0.09;
        });
      });
    }
    function updateExactScore(frame) {
      methodsFor(frame).forEach((method) => {
        const flow = updateCpuComponentFlow(frame, method, true);
        const ledger = new THREE.Vector3(4.75, 4.78, 0.08);
        if (flow.step !== "retire") return;
        const scalar = scalarTokens[method][0];
        scalar.visible = flow.progress > 0.08;
        setPathPosition(scalar, [flow.result, new THREE.Vector3(lerp(flow.result.x, ledger.x, 0.52), 3.65, 1), ledger], flow.progress);
        setGlow(hostBodies.exact, colors.vector, 0.55 + flow.progress * 0.4);
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
        scratch.material.opacity = lerp(0.16, 0.035, release);
        lane.scratchChips.forEach((chip, index) => {
          setGlow(chip, colors.returnBlock, lerp(0.18, 0, release));
          chip.scale.setScalar(1 - release * (0.025 + index * 0.002));
        });
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
    function resolveGpuComponentStep(frame) {
      const name = String(frame.componentStep || "").toLowerCase();
      const source = String(frame.source || "").toLowerCase();
      const destination = String(frame.destination || "").toLowerCase();
      if (name.includes("host-return") || name.includes("result-return") || (source.includes("result-buffer") && destination.includes("host"))) return { step: "result-host", progress: frame.componentProgress };
      if (name.includes("core-reduce") || name.includes("reduce-result") || name.includes("result-buffer")) return { step: "core-result", progress: frame.componentProgress };
      if (name.includes("core-dispatch") || name.includes("dispatch") || name.includes("vram-read") || (source.includes("vram") && destination.includes("core"))) return { step: "vram-core", progress: frame.componentProgress };
      if (name.includes("vram-write") || name.includes("vram-load") || (source.includes("controller") && destination.includes("vram"))) return { step: "controller-vram", progress: frame.componentProgress };
      if (name.includes("memory-ingress") || name.includes("pcie-ingress") || (source.includes("pcie") && destination.includes("controller"))) return { step: "pcie-controller", progress: frame.componentProgress };
      if (name.includes("host-to-pcie") || name.includes("dram-to-pcie") || name.includes("dram-pcie") || destination.includes("pcie")) return { step: "host-pcie", progress: frame.componentProgress };
      const scaled = clamp(frame.progress, 0, 1) * 6;
      const index = Math.min(5, Math.floor(scaled));
      return { step: ["host-pcie", "pcie-controller", "controller-vram", "vram-core", "core-result", "result-host"][index], progress: scaled - index };
    }
    function updateGpuAssist(frame) {
      const methods = methodsFor(frame, true);
      const resolved = resolveGpuComponentStep(frame);
      const local = clamp(resolved.progress, 0, 1);
      const destinationName = String(frame.destination || "").toLowerCase();
      const payloadValue = frame.componentPayload || frame.payload || "";
      const payloadName = typeof payloadValue === "string" ? payloadValue.toLowerCase() : JSON.stringify(payloadValue).toLowerCase();
      methods.forEach((method) => {
        const lane = lanes[method];
        const scratch = objectWorld(lane.dramScratchAssembly.outputPort);
        const hostPcie = laneWorld(lane, [0.65, 2.05, -0.72]);
        const pcie = gpuWorld(lane, "pcie");
        const controller = gpuWorld(lane, "memoryController");
        const bankIndexes = [0];
        const banks = bankIndexes.map((index) => gpuWorld(lane, "vramBanks", index));
        const coreIndex = 0;
        const core = gpuWorld(lane, "coreClusters", coreIndex);
        const reducer = gpuWorld(lane, "reducer");
        const resultBuffer = gpuWorld(lane, "result");
        const exactResult = destinationName.includes("exact") || payloadName.includes("exact") || payloadName.includes("full vector") || frame.beat === "exact-score";
        const hostResult = exactResult ? new THREE.Vector3(4.75, 4.78, 0.08) : new THREE.Vector3(-0.35, 4.78, 0.05);
        const inputTokens = exactResult ? [exactVectors[method], gpuTokens[method][0]] : gpuTokens[method].slice(0, 3);

        setGlow(lane.gpuDie, colors.gpu, 0.42);
        if (resolved.step === "host-pcie") {
          setGlow(lane.scratch, colors.gpu, 0.85);
          setGlow(lane.gpuAssembly.pcieEndpoint, colors.gpu, 0.75);
          lane.gpuLink.material.opacity = 0.95;
        } else if (resolved.step === "pcie-controller") {
          setGlow(lane.gpuAssembly.pcieEndpoint, colors.gpu, 1.45);
          setGlow(lane.gpuAssembly.memoryControllers[0], colors.returnBlock, 1.25);
          setGlow(lane.gpuAssembly.flowTraceMap.pcie, colors.gpu, 1.2);
          lane.gpuLink.material.opacity = 1;
        } else if (resolved.step === "controller-vram") {
          setGlow(lane.gpuAssembly.memoryControllers[0], colors.returnBlock, 1.1);
          bankIndexes.forEach((index) => {
            setGlow(lane.vram[index], colors.gpu, 1.55);
            setGlow(lane.gpuAssembly.flowTraceMap.vram[index], colors.gpu, 1.2);
            lane.vram[index].scale.setScalar(1 + Math.sin(local * Math.PI) * 0.06);
          });
        } else if (resolved.step === "vram-core") {
          bankIndexes.forEach((index) => setGlow(lane.vram[index], colors.gpu, 1.05));
          setGlow(lane.gpuAssembly.memoryControllers[0], colors.returnBlock, 1.2);
          setGlow(lane.gpuAssembly.coreClusters[coreIndex], colors.gpu, 1.75);
          setGlow(lane.gpuAssembly.flowTraceMap.controllerCore, colors.gpu, 1.35);
          lane.gpuAssembly.coreClusters[coreIndex].scale.setScalar(1 + Math.sin(local * Math.PI) * 0.1);
        } else if (resolved.step === "core-result") {
          setGlow(lane.gpuAssembly.coreClusters[coreIndex], colors.gpu, 1.45);
          setGlow(lane.gpuAssembly.reducer, colors.gpu, 1.55);
          setGlow(lane.gpuAssembly.resultBuffer, colors.white, 1.65);
          setGlow(lane.gpuAssembly.flowTraceMap.coreReducer, colors.gpu, 1.35);
          setGlow(lane.gpuAssembly.flowTraceMap.reducerResult, colors.white, 1.25);
        } else {
          setGlow(lane.gpuAssembly.resultBuffer, colors.white, 1.45);
          setGlow(lane.gpuAssembly.pcieEndpoint, colors.gpu, 1.25);
          setGlow(lane.gpuAssembly.flowTraceMap.pcie, colors.gpu, 1.2);
          setGlow(exactResult ? hostBodies.exact : hostBodies.L, colors.gpu, 0.9);
          lane.gpuLink.material.opacity = 1;
        }

        if (resolved.step === "result-host") {
          const result = gpuTokens[method][4];
          result.visible = true;
          setPathPosition(result, [resultBuffer, pcie, hostPcie, new THREE.Vector3(lerp(hostPcie.x, hostResult.x, 0.52), 3.55, 0.5), hostResult], local);
          return;
        }
        if (resolved.step === "core-result") {
          const result = gpuTokens[method][4];
          result.visible = true;
          setPathPosition(result, [core, reducer, resultBuffer], local);
          return;
        }
        inputTokens.forEach((token, index) => {
          token.visible = true;
          const bank = banks[index % banks.length];
          const path = resolved.step === "host-pcie" ? [scratch, hostPcie]
            : resolved.step === "pcie-controller" ? [hostPcie, pcie, controller]
              : resolved.step === "controller-vram" ? [controller, bank]
                : [bank, controller, core];
          setPathPosition(token, path, clamp(local * 1.18 - index * 0.055, 0, 1));
          token.position.z += (index - (inputTokens.length - 1) / 2) * 0.065;
        });
      });
    }

    function updateBeat(frame) {
      const p = frame.progress;
      if (frame.gpuActive) updateGpuAssist(frame);
      else if (["ssd", "dram", "storage"].includes(frame.componentProcessor) && updateStorageComponentFlow(frame)) return;
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
      const closeCpu = String(frame.cameraTarget || "").startsWith("cpu-");
      const closeGpu = String(frame.cameraTarget || "").startsWith("gpu-");
      const closeSsd = String(frame.cameraTarget || "").startsWith("ssd-");
      const closeDram = String(frame.cameraTarget || "").startsWith("dram-");
      Object.values(lanes).forEach((lane) => {
        lane.cpuLabel.visible = frame.labels && !closeCpu;
        lane.gpuLabel.visible = frame.labels && !closeGpu;
        lane.gpuDetailLabel.visible = frame.labels && !closeGpu;
        lane.ssdLabel.visible = frame.labels && !closeSsd;
        lane.dramScratchLabel.visible = frame.labels && !closeDram;
        lane.dramPqLabel.visible = frame.labels && !closeDram;
      });
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
