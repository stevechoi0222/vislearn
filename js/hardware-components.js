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

    return Object.freeze({
      createCpuAssembly,
      createGpuAssembly,
    });
  }

  window.createHardwareComponentFactory = createHardwareComponentFactory;
})();
