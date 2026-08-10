(function () {
  "use strict";

  function createHardwareComponentFactory(THREE, kit) {
    const {
      chamferBox,
      box,
      edges,
      hardwareMaterial,
      material,
      lineBetween,
      colors,
    } = kit;

    function tag(object, componentId, geometryStatus) {
      object.name = componentId;
      object.userData.componentId = componentId;
      object.userData.geometryStatus = geometryStatus || "illustrative";
      return object;
    }

    function component(parent, componentId, size, position, color, materialOptions, bevel, edgeSpec) {
      const mesh = tag(chamferBox(
        parent,
        size,
        position,
        hardwareMaterial(color, materialOptions || {}),
        componentId,
        bevel
      ), componentId);
      if (edgeSpec) edges(parent, mesh, edgeSpec.color, edgeSpec.opacity);
      return mesh;
    }

    function createCpuAssembly(parent, options) {
      const opts = options || {};
      const prefix = `${opts.idPrefix || "lane"}.cpu`;
      const group = tag(new THREE.Group(), prefix);
      const position = opts.position || [0, 0, 0];
      group.position.set(position[0], position[1], position[2]);
      parent.add(group);

      const socket = component(group, `${prefix}.socket`, [2.12, 0.16, 1.92], [0, -0.37, 0], 0x182126, {
        roughness: 0.52,
        metalness: 0.58,
        clearcoat: 0.14,
      }, 0.035, { color: 0x7b898f, opacity: 0.58 });
      const substrate = component(group, `${prefix}.substrate`, [1.9, 0.13, 1.7], [0, -0.24, 0], 0xa56f24, {
        roughness: 0.45,
        metalness: 0.4,
        clearcoat: 0.2,
      }, 0.035, { color: 0xe1b35c, opacity: 0.52 });
      const packageBody = component(group, `${prefix}.package`, [1.72, 0.3, 1.52], [0, -0.08, 0], 0x1f2c29, {
        roughness: 0.3,
        metalness: 0.46,
        clearcoat: 0.5,
        emissive: colors.cpuDeep,
        emissiveIntensity: 0.025,
      }, 0.065, { color: 0x8aa697, opacity: 0.68 });
      const contactPads = [];
      for (let index = 0; index < 7; index += 1) {
        const x = (index - 3) * 0.22;
        [-0.73, 0.73].forEach((z, edgeIndex) => {
          contactPads.push(component(group, `${prefix}.contact.${edgeIndex}.${index}`, [0.13, 0.035, 0.07], [x, -0.145, z], 0xd2a64a, {
            roughness: 0.28,
            metalness: 0.72,
          }, 0.008));
        });
      }
      const die = component(group, `${prefix}.die`, [1.38, 0.07, 1.16], [0, 0.13, 0], 0x4b2d25, {
        roughness: 0.24,
        metalness: 0.22,
        clearcoat: 0.62,
        emissive: colors.cpuDeep,
        emissiveIntensity: 0.04,
      }, 0.025, { color: 0xd19751, opacity: 0.5 });

      const coreTiles = [];
      const coreAnchors = [];
      for (let row = 0; row < 2; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          const index = row * 4 + column;
          const x = (column - 1.5) * 0.25;
          const z = (row - 0.5) * 0.31;
          coreAnchors.push([x, 0.215, z]);
          coreTiles.push(component(group, `${prefix}.core.${index}`, [0.19, 0.055, 0.23], [x, 0.205, z], 0xb96536, {
            roughness: 0.24,
            metalness: 0.26,
            clearcoat: 0.42,
            emissive: colors.cpuDeep,
            emissiveIntensity: 0.025,
          }, 0.012));
        }
      }

      const cacheSlices = [
        component(group, `${prefix}.cache.north`, [1.13, 0.05, 0.09], [0, 0.205, 0.38], 0xd48532, {
          roughness: 0.26,
          metalness: 0.25,
          emissive: colors.cpuDeep,
          emissiveIntensity: 0.03,
        }, 0.012),
        component(group, `${prefix}.cache.south`, [1.13, 0.05, 0.09], [0, 0.205, -0.38], 0xd48532, {
          roughness: 0.26,
          metalness: 0.25,
          emissive: colors.cpuDeep,
          emissiveIntensity: 0.03,
        }, 0.012),
        component(group, `${prefix}.cache.west`, [0.09, 0.05, 0.66], [-0.57, 0.205, 0], 0xd48532, {
          roughness: 0.26,
          metalness: 0.25,
          emissive: colors.cpuDeep,
          emissiveIntensity: 0.03,
        }, 0.012),
      ];
      const lutUnit = component(group, `${prefix}.lut-unit`, [1.08, 0.055, 0.12], [0, 0.215, 0.51], colors.cpu, {
        roughness: 0.22,
        metalness: 0.4,
        clearcoat: 0.4,
        emissive: colors.cpu,
        emissiveIntensity: 0.08,
      }, 0.015);
      const exactUnit = component(group, `${prefix}.exact-unit`, [1.08, 0.055, 0.12], [0, 0.215, -0.51], colors.vector, {
        roughness: 0.22,
        metalness: 0.35,
        clearcoat: 0.4,
        emissive: colors.vector,
        emissiveIntensity: 0.04,
      }, 0.015);
      const reducer = component(group, `${prefix}.reducer`, [0.11, 0.055, 0.7], [0.58, 0.215, 0], 0xe3b35a, {
        roughness: 0.28,
        metalness: 0.42,
        emissive: colors.cpuDeep,
        emissiveIntensity: 0.03,
      }, 0.012);
      const inputPort = component(group, `${prefix}.input-port`, [0.12, 0.08, 0.2], [-0.72, 0.16, 0.5], colors.dram, {
        roughness: 0.28,
        metalness: 0.3,
        emissive: colors.dram,
        emissiveIntensity: 0.08,
      }, 0.015);
      const resultPort = component(group, `${prefix}.result-port`, [0.12, 0.08, 0.2], [0.72, 0.16, 0], colors.white, {
        roughness: 0.22,
        metalness: 0.42,
        emissive: colors.white,
        emissiveIntensity: 0.05,
      }, 0.015);

      const lidMaterial = hardwareMaterial(0xc8c8bd, {
        roughness: 0.2,
        metalness: 0.78,
        clearcoat: 0.4,
      });
      const lidFrame = [
        tag(chamferBox(group, [1.78, 0.075, 0.13], [0, 0.3, 0.69], lidMaterial, `${prefix}.ihs.north`, 0.025), `${prefix}.ihs.north`),
        tag(chamferBox(group, [1.78, 0.075, 0.13], [0, 0.3, -0.69], lidMaterial, `${prefix}.ihs.south`, 0.025), `${prefix}.ihs.south`),
        tag(chamferBox(group, [0.13, 0.075, 1.25], [-0.82, 0.3, 0], lidMaterial, `${prefix}.ihs.west`, 0.025), `${prefix}.ihs.west`),
        tag(chamferBox(group, [0.13, 0.075, 1.25], [0.82, 0.3, 0], lidMaterial, `${prefix}.ihs.east`, 0.025), `${prefix}.ihs.east`),
      ];
      lidFrame.forEach((part) => edges(group, part, 0xf2ead8, 0.38));

      const flowTraces = [
        tag(lineBetween(group, [-0.69, 0.235, 0.5], [0, 0.235, 0.5], colors.dram, 0.012, 0.52), `${prefix}.trace.input-lut`),
        tag(lineBetween(group, [0, 0.235, 0.45], [0, 0.235, 0.18], colors.cpu, 0.012, 0.48), `${prefix}.trace.lut-core`),
        tag(lineBetween(group, [-0.69, 0.235, 0.5], [-0.48, 0.235, -0.5], colors.vector, 0.012, 0.42), `${prefix}.trace.input-exact`),
        tag(lineBetween(group, [-0.48, 0.235, -0.5], [0, 0.235, -0.18], colors.vector, 0.012, 0.42), `${prefix}.trace.exact-core`),
        tag(lineBetween(group, [0.18, 0.235, 0], [0.57, 0.235, 0], colors.cpu, 0.012, 0.48), `${prefix}.trace.core-reducer`),
        tag(lineBetween(group, [0.61, 0.235, 0], [0.71, 0.235, 0], colors.white, 0.012, 0.48), `${prefix}.trace.reducer-result`),
      ];

      return {
        group,
        body: packageBody,
        shell: { socket, substrate, packageBody, lidFrame, contactPads },
        die,
        coreTiles,
        cacheSlices,
        lutUnit,
        exactUnit,
        reducer,
        inputPort,
        resultPort,
        flowTraces,
        anchors: {
          package: [0, 0, 0],
          input: [-0.72, 0.24, 0.5],
          cache: [-0.35, 0.24, 0.38],
          lut: [0, 0.24, 0.51],
          exact: [0, 0.24, -0.51],
          core: coreAnchors[0],
          cores: coreAnchors,
          reducer: [0.58, 0.24, 0],
          result: [0.72, 0.24, 0],
        },
      };
    }

    function createGpuAssembly(parent, options) {
      const opts = options || {};
      const prefix = `${opts.idPrefix || "lane"}.gpu`;
      const mirror = opts.mirror === -1 ? -1 : 1;
      const group = tag(new THREE.Group(), prefix);
      const position = opts.position || [0, 0, 0];
      group.position.set(position[0], position[1], position[2]);
      parent.add(group);

      const board = component(group, `${prefix}.pcb`, [3.15, 1.85, 0.14], [0, 0, 0], 0x212735, {
        roughness: 0.56,
        metalness: 0.3,
        clearcoat: 0.14,
      }, 0.025, { color: 0x786ca9, opacity: 0.58 });
      component(group, `${prefix}.pcb-inlay`, [2.94, 1.65, 0.035], [0, 0, 0.09], 0x30354a, {
        roughness: 0.7,
        metalness: 0.16,
      }, 0.008);
      const bracket = component(group, `${prefix}.bracket`, [0.16, 1.72, 0.32], [-1.62 * mirror, 0, 0.03], 0x9da4a8, {
        roughness: 0.3,
        metalness: 0.82,
      }, 0.025, { color: 0xd1d7d8, opacity: 0.38 });

      const pcieContacts = [];
      for (let index = 0; index < 11; index += 1) {
        pcieContacts.push(tag(box(
          group,
          [0.12, 0.2, 0.035],
          [-0.67 + index * 0.135, -0.9, 0.1],
          material(0xc89a35, { roughness: 0.28, metalness: 0.72 }),
          `${prefix}.pcie-contact.${index}`
        ), `${prefix}.pcie-contact.${index}`));
      }
      const pcieEndpoint = component(group, `${prefix}.pcie-endpoint`, [0.42, 0.13, 0.12], [0, -0.76, 0.19], colors.gpuDim, {
        roughness: 0.28,
        metalness: 0.38,
        emissive: colors.gpu,
        emissiveIntensity: 0.02,
      }, 0.02);

      const dieX = -0.28 * mirror;
      const die = component(group, `${prefix}.die`, [1.02, 0.92, 0.25], [dieX, 0, 0.2], colors.gpuDim, {
        roughness: 0.28,
        metalness: 0.46,
        clearcoat: 0.42,
        emissive: colors.gpu,
        emissiveIntensity: 0.02,
      }, 0.045, { color: 0xaa92ef, opacity: 0.5 });
      const dieFrame = component(group, `${prefix}.die-frame`, [1.18, 1.08, 0.055], [dieX, 0, 0.36], 0x655f70, {
        roughness: 0.23,
        metalness: 0.68,
        transparent: true,
        opacity: 0.34,
      }, 0.025, { color: 0xc8b7ff, opacity: 0.42 });

      const coreClusters = [];
      const coreAnchors = [];
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          const index = row * 4 + column;
          const x = dieX + (column - 1.5) * 0.17;
          const y = (row - 1.5) * 0.16;
          coreAnchors.push([x, y, 0.405]);
          coreClusters.push(component(group, `${prefix}.core-cluster.${index}`, [0.13, 0.12, 0.045], [x, y, 0.39], 0x6e50ad, {
            roughness: 0.22,
            metalness: 0.28,
            clearcoat: 0.38,
            emissive: colors.gpu,
            emissiveIntensity: 0.02,
          }, 0.012));
        }
      }

      const memoryControllers = [
        component(group, `${prefix}.memory-controller.0`, [0.08, 0.72, 0.05], [dieX - 0.42, 0, 0.39], 0x4f8eb8, {
          roughness: 0.24,
          metalness: 0.32,
          emissive: colors.returnBlock,
          emissiveIntensity: 0.025,
        }, 0.01),
        component(group, `${prefix}.memory-controller.1`, [0.08, 0.72, 0.05], [dieX + 0.42, 0, 0.39], 0x4f8eb8, {
          roughness: 0.24,
          metalness: 0.32,
          emissive: colors.returnBlock,
          emissiveIntensity: 0.025,
        }, 0.01),
      ];
      const reducer = component(group, `${prefix}.reducer`, [0.62, 0.075, 0.05], [dieX, 0.4, 0.39], 0x8870c4, {
        roughness: 0.24,
        metalness: 0.32,
        emissive: colors.gpu,
        emissiveIntensity: 0.025,
      }, 0.01);
      const resultBuffer = component(group, `${prefix}.result-buffer`, [0.56, 0.075, 0.05], [dieX, -0.4, 0.39], colors.white, {
        roughness: 0.2,
        metalness: 0.38,
        emissive: colors.gpu,
        emissiveIntensity: 0.025,
      }, 0.01);

      const vramBanks = [];
      const vramCaps = [];
      const vramPositions = [
        [-1.08, 0.5], [-1.08, -0.5], [1.08, 0.5], [1.08, -0.5],
        [-0.48, 0.68], [0.18, 0.68], [-0.48, -0.68], [0.18, -0.68],
      ];
      vramPositions.forEach((positionValue, index) => {
        const x = positionValue[0] * mirror;
        const y = positionValue[1];
        vramBanks.push(component(group, `${prefix}.vram.${index}`, [0.43, 0.31, 0.2], [x, y, 0.2], colors.gpuDim, {
          roughness: 0.36,
          metalness: 0.38,
          emissive: colors.gpu,
          emissiveIntensity: 0,
        }, 0.03));
        vramCaps.push(component(group, `${prefix}.vram-cap.${index}`, [0.28, 0.18, 0.045], [x, y, 0.33], 0x494361, {
          roughness: 0.24,
          metalness: 0.52,
        }, 0.014));
      });

      const powerModules = [];
      for (let index = 0; index < 4; index += 1) {
        powerModules.push(component(group, `${prefix}.power.${index}`, [0.22, 0.19, 0.16], [1.4 * mirror, -0.48 + index * 0.32, 0.18], 0x444a55, {
          roughness: 0.5,
          metalness: 0.42,
        }, 0.02));
      }

      const vramTraces = [];
      vramPositions.forEach((positionValue, index) => {
        const from = [positionValue[0] * mirror, positionValue[1], 0.34];
        const controller = index % 2 === 0 ? [dieX - 0.42, positionValue[1] * 0.32, 0.41] : [dieX + 0.42, positionValue[1] * 0.32, 0.41];
        vramTraces.push(tag(lineBetween(group, from, controller, colors.gpuDim, 0.009, 0.34), `${prefix}.trace.vram.${index}`));
      });
      const pcieTrace = tag(lineBetween(group, [0, -0.76, 0.31], [dieX + 0.42 * mirror, 0, 0.41], colors.gpuDim, 0.012, 0.38), `${prefix}.trace.pcie`);
      const controllerCoreTrace = tag(lineBetween(group, [dieX + 0.42 * mirror, 0, 0.42], [dieX, 0, 0.43], colors.gpuDim, 0.01, 0.34), `${prefix}.trace.controller-core`);
      const coreReducerTrace = tag(lineBetween(group, [dieX, 0, 0.43], [dieX, 0.4, 0.43], colors.gpuDim, 0.01, 0.34), `${prefix}.trace.core-reducer`);
      const reducerResultTrace = tag(lineBetween(group, [dieX, 0.4, 0.43], [dieX, -0.4, 0.43], colors.gpuDim, 0.009, 0.24), `${prefix}.trace.reducer-result`);
      const flowTraces = [...vramTraces, pcieTrace, controllerCoreTrace, coreReducerTrace, reducerResultTrace];

      return {
        group,
        board,
        bracket,
        pcieContacts,
        pcieEndpoint,
        die,
        dieFrame,
        coreClusters,
        memoryControllers,
        reducer,
        resultBuffer,
        vramBanks,
        vramCaps,
        powerModules,
        flowTraces,
        flowTraceMap: {
          vram: vramTraces,
          pcie: pcieTrace,
          controllerCore: controllerCoreTrace,
          coreReducer: coreReducerTrace,
          reducerResult: reducerResultTrace,
        },
        anchors: {
          board: [0, 0, 0.2],
          pcie: [0, -0.78, 0.34],
          memoryController: [dieX + 0.42 * mirror, 0, 0.42],
          vram: [0, 0, 0.36],
          vramBanks: vramPositions.map((positionValue) => [positionValue[0] * mirror, positionValue[1], 0.36]),
          cores: [dieX, 0, 0.43],
          coreClusters: coreAnchors,
          reducer: [dieX, 0.4, 0.43],
          result: [dieX, -0.4, 0.43],
        },
      };
    }

    function createDramAssembly(parent, options) {
      const opts = options || {};
      const prefix = `${opts.idPrefix || "lane"}.dram`;
      const group = tag(new THREE.Group(), prefix);
      const position = opts.position || [0, 0, 0];
      group.position.set(position[0], position[1], position[2]);
      parent.add(group);

      const board = component(group, `${prefix}.pcb`, [2.82, 0.8, 0.11], [0, 0, 0], 0x172d59, {
        roughness: 0.58,
        metalness: 0.18,
        clearcoat: 0.18,
      }, 0.025, { color: 0x557fd9, opacity: 0.68 });
      const boardInlay = component(group, `${prefix}.pcb-inlay`, [2.58, 0.62, 0.025], [0, 0.025, 0.07], 0x213f7c, {
        roughness: 0.7,
        metalness: 0.12,
      }, 0.008);

      const edgeContacts = [];
      const contactColumns = [-1.14, -0.98, -0.82, -0.66, -0.5, -0.34, -0.18, 0.18, 0.34, 0.5, 0.66, 0.82, 0.98, 1.14];
      contactColumns.forEach((x, index) => {
        edgeContacts.push(tag(box(
          group,
          [0.115, 0.16, 0.03],
          [x, -0.42, 0.075],
          material(0xd0a13d, { roughness: 0.27, metalness: 0.76 }),
          `${prefix}.edge-contact.${index}`
        ), `${prefix}.edge-contact.${index}`));
      });

      const packagePositions = [];
      const memoryPackages = [];
      const packageCaps = [];
      for (let index = 0; index < 8; index += 1) {
        const x = -1.05 + index * 0.3;
        packagePositions.push([x, -0.015, 0.19]);
        memoryPackages.push(component(group, `${prefix}.package.${index}`, [0.24, 0.34, 0.13], [x, -0.015, 0.135], 0x13213c, {
          roughness: 0.42,
          metalness: 0.28,
          clearcoat: 0.24,
          emissive: colors.dramDeep,
          emissiveIntensity: 0.035,
        }, 0.022));
        packageCaps.push(component(group, `${prefix}.package-cap.${index}`, [0.17, 0.24, 0.035], [x, -0.015, 0.225], 0x274b92, {
          roughness: 0.3,
          metalness: 0.32,
          emissive: colors.dramDeep,
          emissiveIntensity: 0.02,
        }, 0.012));
      }

      const spd = component(group, `${prefix}.spd`, [0.2, 0.14, 0.09], [-1.18, 0.27, 0.125], 0x26354e, {
        roughness: 0.44,
        metalness: 0.34,
        emissive: colors.dramDeep,
        emissiveIntensity: 0.025,
      }, 0.018, { color: 0x8094bb, opacity: 0.45 });
      const inputPort = component(group, `${prefix}.input-port`, [0.12, 0.16, 0.12], [-1.34, 0.26, 0.14], colors.dram, {
        roughness: 0.26,
        metalness: 0.32,
        emissive: colors.dram,
        emissiveIntensity: 0.08,
      }, 0.016);
      const outputPort = component(group, `${prefix}.output-port`, [0.12, 0.16, 0.12], [1.34, 0.26, 0.14], colors.white, {
        roughness: 0.24,
        metalness: 0.38,
        emissive: colors.dram,
        emissiveIntensity: 0.04,
      }, 0.016);

      const bankPositions = [-0.9, -0.3, 0.3, 0.9].map((x) => [x, 0.225, 0.27]);
      const logicalBanks = bankPositions.map((bankPosition, index) => component(
        group,
        `${prefix}.logical-bank.${index}`,
        [0.5, 0.055, 0.035],
        [bankPosition[0], bankPosition[1], 0.245],
        index % 2 === 0 ? colors.dram : 0x6f91ea,
        {
          roughness: 0.24,
          metalness: 0.26,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          emissive: colors.dram,
          emissiveIntensity: 0.08,
        },
        0.01
      ));
      const payloadOverlay = component(group, `${prefix}.payload-overlay`, [2.36, 0.48, 0.025], [0, -0.015, 0.265], colors.dram, {
        roughness: 0.2,
        metalness: 0.18,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        emissive: colors.dram,
        emissiveIntensity: 0.12,
      }, 0.018, { color: 0xaac2ff, opacity: 0.34 });

      const inputTrace = tag(lineBetween(group, [-1.3, 0.26, 0.3], [0, 0.26, 0.3], colors.dram, 0.011, 0.46), `${prefix}.trace.input`);
      const outputTrace = tag(lineBetween(group, [0, 0.26, 0.3], [1.3, 0.26, 0.3], colors.dram, 0.011, 0.46), `${prefix}.trace.output`);
      const bankTraces = bankPositions.map((bankPosition, index) => tag(
        lineBetween(group, [bankPosition[0], 0.26, 0.3], [bankPosition[0], 0.12, 0.3], colors.dram, 0.008, 0.38),
        `${prefix}.trace.bank.${index}`
      ));
      const flowTraces = [inputTrace, ...bankTraces, outputTrace];

      return {
        group,
        body: payloadOverlay,
        board,
        boardInlay,
        edgeContacts,
        packages: memoryPackages,
        memoryPackages,
        packageCaps,
        spd,
        inputPort,
        outputPort,
        logicalBanks,
        payloadOverlay,
        flowTraces,
        flowTraceMap: {
          input: inputTrace,
          banks: bankTraces,
          output: outputTrace,
        },
        anchors: {
          board: [0, 0, 0.14],
          input: [-1.34, 0.26, 0.3],
          output: [1.34, 0.26, 0.3],
          payload: [0, -0.015, 0.3],
          bank: bankPositions[0],
          banks: bankPositions,
          packages: packagePositions,
          spd: [-1.18, 0.27, 0.2],
        },
      };
    }

    function createSsdAssembly(parent, options) {
      const opts = options || {};
      const prefix = `${opts.idPrefix || "lane"}.ssd`;
      const mirror = opts.mirror === -1 ? -1 : 1;
      const group = tag(new THREE.Group(), prefix);
      const position = opts.position || [0, 0, 0];
      group.position.set(position[0], position[1], position[2]);
      parent.add(group);

      const board = component(group, `${prefix}.pcb`, [3.18, 1.18, 0.11], [0, 0, 0], 0x153832, {
        roughness: 0.6,
        metalness: 0.2,
        clearcoat: 0.14,
      }, 0.025, { color: 0x46978b, opacity: 0.58 });
      const boardInlay = component(group, `${prefix}.pcb-inlay`, [2.92, 0.96, 0.025], [0, 0, 0.07], 0x214c45, {
        roughness: 0.7,
        metalness: 0.12,
      }, 0.008);

      const pcieContacts = [];
      const contactRows = [-0.43, -0.35, -0.27, -0.19, -0.11, 0.11, 0.19, 0.27, 0.35, 0.43];
      contactRows.forEach((y, index) => {
        pcieContacts.push(tag(box(
          group,
          [0.24, 0.055, 0.035],
          [-1.52 * mirror, y, 0.08],
          material(0xcf9f39, { roughness: 0.26, metalness: 0.78 }),
          `${prefix}.pcie-contact.${index}`
        ), `${prefix}.pcie-contact.${index}`));
      });

      const pcieEndpoint = component(group, `${prefix}.pcie-endpoint`, [0.34, 0.34, 0.14], [-1.23 * mirror, 0, 0.14], colors.request, {
        roughness: 0.28,
        metalness: 0.34,
        emissive: colors.request,
        emissiveIntensity: 0.06,
      }, 0.025);
      const controller = component(group, `${prefix}.controller`, [0.52, 0.54, 0.24], [-0.7 * mirror, 0, 0.17], colors.ssdDeep, {
        roughness: 0.31,
        metalness: 0.4,
        clearcoat: 0.42,
        emissive: colors.ssdDeep,
        emissiveIntensity: 0.08,
      }, 0.045, { color: 0x69dfd1, opacity: 0.62 });
      const controllerCap = component(group, `${prefix}.controller-cap`, [0.35, 0.35, 0.045], [-0.7 * mirror, 0, 0.315], colors.ssd, {
        roughness: 0.24,
        metalness: 0.5,
        emissive: colors.ssdDeep,
        emissiveIntensity: 0.04,
      }, 0.018);
      const commandQueue = component(group, `${prefix}.command-queue`, [0.4, 0.15, 0.11], [-0.26 * mirror, -0.38, 0.14], colors.request, {
        roughness: 0.28,
        metalness: 0.3,
        emissive: colors.request,
        emissiveIntensity: 0.07,
      }, 0.018);

      const flashChannelPositions = [[-0.12 * mirror, 0.27, 0.18], [-0.12 * mirror, -0.27, 0.18]];
      const flashChannels = flashChannelPositions.map((channelPosition, index) => component(
        group,
        `${prefix}.flash-channel.${index}`,
        [0.34, 0.1, 0.08],
        [channelPosition[0], channelPosition[1], 0.135],
        index === 0 ? 0x43a99e : 0x2f857e,
        {
          roughness: 0.3,
          metalness: 0.3,
          emissive: colors.ssd,
          emissiveIntensity: 0.04,
        },
        0.015
      ));

      const nandPositions = [
        [0.48 * mirror, 0.29, 0.2],
        [0.48 * mirror, -0.29, 0.2],
        [1.08 * mirror, 0.29, 0.2],
        [1.08 * mirror, -0.29, 0.2],
      ];
      const nandPackages = [];
      const nandDies = [];
      const nandDiePairs = [];
      nandPositions.forEach((nandPosition, packageIndex) => {
        nandPackages.push(component(group, `${prefix}.nand-package.${packageIndex}`, [0.5, 0.42, 0.2], [nandPosition[0], nandPosition[1], 0.145], 0x176b64, {
          roughness: 0.34,
          metalness: 0.34,
          clearcoat: 0.36,
          emissive: colors.ssdDeep,
          emissiveIntensity: 0.05,
        }, 0.035, { color: 0x72e3d6, opacity: 0.54 }));
        const diePair = [];
        [-0.11, 0.11].forEach((offset, dieIndex) => {
          const dieX = nandPosition[0] + offset * mirror;
          const globalDieIndex = packageIndex * 2 + dieIndex;
          const die = component(group, `${prefix}.nand-die.${globalDieIndex}`, [0.16, 0.27, 0.04], [dieX, nandPosition[1], 0.27], dieIndex === 0 ? 0x35b9aa : 0x54d4c5, {
            roughness: 0.24,
            metalness: 0.28,
            emissive: colors.ssd,
            emissiveIntensity: 0.05,
          }, 0.012);
          diePair.push(die);
          nandDies.push(die);
        });
        nandDiePairs.push(diePair);
      });

      const returnBuffer = component(group, `${prefix}.return-buffer`, [0.42, 0.16, 0.11], [-0.26 * mirror, 0.4, 0.14], colors.returnBlock, {
        roughness: 0.24,
        metalness: 0.34,
        emissive: colors.returnBlock,
        emissiveIntensity: 0.08,
      }, 0.018);
      const mountPad = component(group, `${prefix}.mount-pad`, [0.18, 0.2, 0.045], [1.47 * mirror, 0, 0.09], 0x9da7a3, {
        roughness: 0.3,
        metalness: 0.78,
      }, 0.025, { color: 0xd4dbd8, opacity: 0.38 });

      const pcieInputTrace = tag(lineBetween(group, [-1.2 * mirror, 0, 0.34], [-0.72 * mirror, 0, 0.34], colors.request, 0.012, 0.5), `${prefix}.trace.pcie-input`);
      const commandTrace = tag(lineBetween(group, [-0.68 * mirror, -0.14, 0.34], [-0.26 * mirror, -0.38, 0.34], colors.request, 0.01, 0.46), `${prefix}.trace.command-queue`);
      const channelRootTraces = flashChannelPositions.map((channelPosition, index) => tag(
        lineBetween(group, [-0.48 * mirror, 0, 0.34], [channelPosition[0], channelPosition[1], 0.34], colors.ssd, 0.01, 0.42),
        `${prefix}.trace.flash-channel.${index}.root`
      ));
      const channelNandTraces = [];
      flashChannelPositions.forEach((channelPosition, channelIndex) => {
        nandPositions.filter((_, packageIndex) => packageIndex % 2 === channelIndex).forEach((nandPosition, branchIndex) => {
          channelNandTraces.push(tag(
            lineBetween(group, [channelPosition[0], channelPosition[1], 0.34], [nandPosition[0], nandPosition[1], 0.34], colors.ssd, 0.009, 0.36),
            `${prefix}.trace.flash-channel.${channelIndex}.nand.${branchIndex}`
          ));
        });
      });
      const nandReturnTraces = nandPositions.map((nandPosition, index) => tag(
        lineBetween(group, [nandPosition[0], nandPosition[1], 0.35], [-0.26 * mirror, 0.4, 0.35], colors.returnBlock, 0.008, 0.32),
        `${prefix}.trace.nand-return.${index}`
      ));
      const returnPcieTrace = tag(lineBetween(group, [-0.26 * mirror, 0.4, 0.35], [-1.2 * mirror, 0.12, 0.35], colors.returnBlock, 0.011, 0.44), `${prefix}.trace.return-pcie`);
      const flowTraces = [
        pcieInputTrace,
        commandTrace,
        ...channelRootTraces,
        ...channelNandTraces,
        ...nandReturnTraces,
        returnPcieTrace,
      ];

      return {
        group,
        body: controller,
        board,
        boardInlay,
        pcieContacts,
        pcieEndpoint,
        controller,
        controllerCap,
        commandQueue,
        flashChannels,
        packages: nandPackages,
        nandPackages,
        nandDies,
        nandDiePairs,
        returnBuffer,
        mountPad,
        flowTraces,
        flowTraceMap: {
          pcieInput: pcieInputTrace,
          commandQueue: commandTrace,
          flashChannels: [...channelRootTraces, ...channelNandTraces],
          nandReturn: nandReturnTraces,
          returnPcie: returnPcieTrace,
        },
        anchors: {
          board: [0, 0, 0.16],
          input: [-1.22 * mirror, 0, 0.35],
          pcie: [-1.22 * mirror, 0, 0.35],
          controller: [-0.7 * mirror, 0, 0.35],
          commandQueue: [-0.26 * mirror, -0.38, 0.34],
          flashChannel: flashChannelPositions[0],
          flashChannels: flashChannelPositions,
          nand: nandPositions[0],
          nands: nandPositions,
          packages: nandPositions,
          return: [-0.26 * mirror, 0.4, 0.35],
          output: [-1.22 * mirror, 0.12, 0.35],
        },
      };
    }

    return Object.freeze({
      createCpuAssembly,
      createGpuAssembly,
      createDramAssembly,
      createSsdAssembly,
    });
  }

  window.createHardwareComponentFactory = createHardwareComponentFactory;
})();
