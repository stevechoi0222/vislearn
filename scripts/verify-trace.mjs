import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const sandbox = {
  console,
  window: {
    matchMedia: () => ({ matches: false }),
  },
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, "js/content.js"), "utf8"), sandbox, { filename: "content.js" });
vm.runInContext(readFileSync(join(root, "js/sim.js"), "utf8"), sandbox, { filename: "sim.js" });

const content = sandbox.window.AISAQ_CONTENT;
const Simulation = sandbox.window.AiSAQSimulation;
const failures = [];
const require = (condition, message) => { if (!condition) failures.push(message); };

require(content?.schemaVersion >= 2, "Trace content schema must be version 2 or newer");
require(content?.meta?.traceScope?.primaryModel?.includes("full-inline"), "Missing full-inline paper scope");
require(content?.stages?.length === 7, "The guided trace must keep seven learning stops");

const allowedScenes = new Set(content?.traceContract?.sceneFamilies || []);
const allowedDirections = new Set(content?.traceContract?.directions || []);
const allowedStatuses = new Set(content?.traceContract?.factStatuses || []);
const allowedBeats = new Set(["inspect", "request", "nand-read", "block-return", "dram-join", "inline-unpack", "pq-score", "exact-score", "queue-commit", "scratch-release", "block-pack", "evidence"]);
const allowedMethods = new Set(["both", "diskann", "aisaq"]);
let phaseCount = 0;
let eventCount = 0;
let sawSeenSet = false;
let sawExactLedger = false;
let sawExpansionState = false;

content.stages.forEach((stage, stageIndex) => {
  require(Array.isArray(stage.phases) && stage.phases.length > 0, `Stage ${stageIndex + 1} has no phases`);
  stage.phases.forEach((phase, phaseIndex) => {
    phaseCount += 1;
    const trace = phase.trace;
    require(Boolean(trace), `${stage.id}/${phase.id} has no trace`);
    require(allowedScenes.has(trace?.sceneFamily), `${stage.id}/${phase.id} has an invalid scene family`);
    require(Boolean(trace?.stateLabel), `${stage.id}/${phase.id} has no state label`);
    require(Array.isArray(trace?.events) && trace.events.length > 0, `${stage.id}/${phase.id} has no events`);
    let previousAt = -1;
    (trace?.events || []).forEach((event, eventIndex) => {
      eventCount += 1;
      require(Number.isFinite(event.at) && event.at >= 0 && event.at <= 1, `${stage.id}/${phase.id} event ${eventIndex + 1} has an invalid time`);
      require(event.at > previousAt, `${stage.id}/${phase.id} events are not strictly ordered`);
      require(allowedDirections.has(event.direction), `${stage.id}/${phase.id}/${event.id} has an invalid direction`);
      require(allowedStatuses.has(event.factStatus), `${stage.id}/${phase.id}/${event.id} has an invalid fact status`);
      ["id", "label", "source", "destination", "payload"].forEach((key) => require(Boolean(event[key]), `${stage.id}/${phase.id} event ${eventIndex + 1} lacks ${key}`));
      require(!/\bLBA\s*[=:]\s*\d/i.test(`${event.source} ${event.destination} ${event.payload}`), `${stage.id}/${phase.id}/${event.id} invents a numeric LBA`);
      require(!/host\.visited/i.test(`${event.source} ${event.destination}`), `${stage.id}/${phase.id}/${event.id} conflates the exact-score ledger with a generic visited set`);
      sawSeenSet ||= /seen-ids/i.test(`${event.source} ${event.destination}`);
      sawExactLedger ||= /exact-score-ledger/i.test(`${event.source} ${event.destination}`);
      sawExpansionState ||= /expansion (?:flag|state)|unexpanded flag/i.test(event.payload);
      previousAt = event.at;
    });
  });
});

require(sawSeenSet, "Trace never exposes the separate seen-ID set");
require(sawExactLedger, "Trace never exposes the implementation exact-score ledger");
require(sawExpansionState, "Trace never exposes L's expansion state");

const simulation = new Simulation(content.stages);
const observedBeats = new Set();
const observedStorageProcessors = new Set();
content.stages.forEach((stage, stageIndex) => {
  stage.phases.forEach((phase, phaseIndex) => {
    simulation.goToPhase(stageIndex, phaseIndex);
    const span = simulation.phaseSpan();
    simulation.setProgress(span.start + (span.end - span.start) * 0.55);
    const snapshot = simulation.traceSnapshot();
    require(snapshot.stageId === stage.id, `${stage.id}/${phase.id} snapshot has wrong stage`);
    require(snapshot.phase?.id === phase.id, `${stage.id}/${phase.id} snapshot has wrong phase`);
    require(snapshot.sceneFamily === phase.trace.sceneFamily, `${stage.id}/${phase.id} snapshot has wrong scene`);
    require(snapshot.events.length === phase.trace.events.length, `${stage.id}/${phase.id} snapshot lost events`);
    require(snapshot.currentEvent || snapshot.completedEvents.length === snapshot.events.length, `${stage.id}/${phase.id} snapshot has no active/completed event`);
    const eventTimes = phase.trace.events.flatMap((event, eventIndex) => {
      const end = phase.trace.events[eventIndex + 1]?.at ?? 1;
      return [event.at + (end - event.at) * 0.25, event.at + (end - event.at) * 0.82];
    });
    eventTimes.forEach((phaseTime) => {
      simulation.setProgress(span.start + (span.end - span.start) * phaseTime);
      const hardware = simulation.hardwareSnapshot();
      observedBeats.add(hardware.beat);
      ["source", "destination", "payload", "cameraTarget", "factStatus"].forEach((key) => require(Boolean(hardware[key]), `${stage.id}/${phase.id} hardware snapshot lacks ${key}`));
      require(allowedBeats.has(hardware.beat), `${stage.id}/${phase.id} has invalid hardware beat ${hardware.beat}`);
      require(allowedMethods.has(hardware.method), `${stage.id}/${phase.id} has invalid hardware method ${hardware.method}`);
      require(hardware.progress >= 0 && hardware.progress <= 1, `${stage.id}/${phase.id} hardware progress is not normalized`);
      require(hardware.phaseProgress >= 0 && hardware.phaseProgress <= 1, `${stage.id}/${phase.id} phase progress is not normalized`);
      require(hardware.computePath === "paper", `${stage.id}/${phase.id} unexpectedly left the paper path`);
      require(hardware.gpu?.active === false && hardware.gpu?.reason === "not in evaluated AiSAQ query path", `${stage.id}/${phase.id} misstates GPU truth`);
      require(hardware.gpu?.stepCount === 6 && hardware.gpu?.route?.length === 7, `${stage.id}/${phase.id} lost the six-step illustrative GPU route metadata`);
      require(hardware.gpu?.representativeCoreCount === 1 && hardware.gpu?.representativeCoreId === "gpu.core-cluster.0", `${stage.id}/${phase.id} does not constrain GPU activity to one representative core cluster`);
      require(hardware.cpu?.componentFlow?.steps?.length === 4, `${stage.id}/${phase.id} lacks the CPU input → cache → unit → core → result metadata`);
      require(hardware.cpu?.representativeCoreCount === 1 && hardware.cpu?.representativeCoreId === "cpu.core.0", `${stage.id}/${phase.id} does not constrain CPU activity to one representative core cluster`);
      require(/not mapped one-to-one/i.test(hardware.cpu?.coreMapping || ""), `${stage.id}/${phase.id} CPU metadata may imply one core per neighbor`);
      require(hardware.cpu?.componentFlow?.steps?.every((step) => step.factStatus === "illustrative"), `${stage.id}/${phase.id} CPU microarchitecture is not scoped as illustrative`);
      const storageBeat = ["request", "nand-read", "block-return", "dram-join", "inline-unpack"].includes(hardware.beat);
      if (storageBeat) {
        const storage = hardware.storage;
        observedStorageProcessors.add(storage?.processor);
        require(storage?.active && storage?.componentFlow === hardware.componentFlow, `${stage.id}/${phase.id} storage beat did not win top-level componentFlow precedence`);
        require(storage?.operationFactStatus === hardware.factStatus && storage?.geometryStatus === "illustrative", `${stage.id}/${phase.id} conflates the canonical storage operation with illustrative geometry`);
        require(storage?.componentFlow?.steps?.every((step) => step.factStatus === "illustrative"), `${stage.id}/${phase.id} exposes a storage internal as paper-backed`);
        require(storage?.physicalAddressMapping === "not modeled" && storage?.ftlMapping === "not modeled", `${stage.id}/${phase.id} implies unverified DRAM address or SSD FTL mapping`);
        require(/illustrative/i.test(hardware.componentNote || ""), `${stage.id}/${phase.id} storage microtrace lacks an illustrative scope note`);
        if (["request", "nand-read", "block-return"].includes(hardware.beat)) {
          require(storage?.representativeNandPackageCount === 1 && storage?.representativeNandDieCount === 1, `${stage.id}/${phase.id} does not constrain SSD activity to one representative NAND package and die`);
        }
        if (["block-return", "dram-join", "inline-unpack"].includes(hardware.beat)) {
          require(storage?.representativeDramPackageCount === 1 && storage?.representativeLogicalBankCount === 1, `${stage.id}/${phase.id} does not constrain DRAM activity to one representative package and logical bank`);
        }
      }
      const transport = `${hardware.source} ${hardware.destination} ${hardware.payload}`;
      require(!/\bLBA\s*(?:[=:#]\s*|\s+)\d+\b/i.test(transport), `${stage.id}/${phase.id} hardware adapter leaks a numeric LBA`);
      require(!/\brequest(?:\s+id)?\s*(?:[=:#]\s*|\s+)\d+\b/i.test(transport), `${stage.id}/${phase.id} hardware adapter leaks a request ID`);
      require(!(/host\.query/i.test(hardware.source) && /(ssd|nand|lba\(p\)|gpu|vram|pcie)/i.test(hardware.destination)), `${stage.id}/${phase.id} moves q away from the host`);
      if (hardware.beat === "request") {
        require(/host|request-queue/i.test(hardware.source) && /ssd|lba\(p\)/i.test(hardware.destination), `${stage.id}/${phase.id} request does not travel down to SSD`);
        require(hardware.cacheMiss, `${stage.id}/${phase.id} request is not marked as a cache miss`);
      }
      if (hardware.beat === "nand-read") require(/ssd/i.test(hardware.source) && /nand/i.test(hardware.destination), `${stage.id}/${phase.id} NAND beat has the wrong path`);
      if (hardware.beat === "block-return") require(/ssd|nand|lba\(p\)/i.test(hardware.source) && /dram.*scratch/i.test(hardware.destination), `${stage.id}/${phase.id} block return does not travel up into DRAM scratch`);
      if (hardware.beat === "exact-score") require(/during expansion/i.test(hardware.payload), `${stage.id}/${phase.id} exact scoring is not expansion-time`);
      if (hardware.beat === "scratch-release") require(/ssd index copy is unchanged/i.test(hardware.payload) && /not deleted/i.test(hardware.payload), `${stage.id}/${phase.id} scratch release does not explicitly preserve SSD`);
    });
  });
});

allowedBeats.forEach((beat) => require(observedBeats.has(beat), `Hardware adapter never exposes ${beat}`));
require(["ssd", "dram", "storage"].every((processor) => observedStorageProcessors.has(processor)), "Trace did not expose SSD-only, DRAM-only, and combined SSD-to-DRAM component flows");

simulation.goToPhase(2, 1);
simulation.setDataset("KILT E5 22M");
const readSnapshot = simulation.traceSnapshot();
require(readSnapshot.dataset?.label === "KILT E5 22M", "Dataset-aware trace snapshot did not resolve KILT E5 22M");
require(JSON.stringify(readSnapshot).includes("LBA(p)"), "Node-read trace must retain symbolic LBA(p)");

simulation.goToPhase(3, 1);
const cpuPqSpan = simulation.phaseSpan();
simulation.setProgress(cpuPqSpan.start + (cpuPqSpan.end - cpuPqSpan.start) * 0.55);
const cpuPq = simulation.hardwareSnapshot();
require(cpuPq.cpu?.active && cpuPq.cpu?.unit === "cpu.lut-unit", "Paper PQ scoring did not activate the CPU LUT component path");
require(cpuPq.cpu?.route?.join("|") === "cpu.input-port|cpu.cache.north|cpu.lut-unit|cpu.core.0|cpu.result-port", "CPU PQ component route has the wrong order");
require(/PQ operand bytes.*q-derived lookup state/i.test(cpuPq.cpu?.componentFlow?.steps?.[0]?.payload || ""), "CPU PQ component input lost its operand metadata");

simulation.goToPhase(4, 0);
const cpuExactSpan = simulation.phaseSpan();
simulation.setProgress(cpuExactSpan.start + (cpuExactSpan.end - cpuExactSpan.start) * 0.2);
const cpuExact = simulation.hardwareSnapshot();
require(cpuExact.cpu?.active && cpuExact.cpu?.unit === "cpu.exact-unit", "Paper exact scoring did not activate the CPU exact component path");
require(cpuExact.cpu?.route?.join("|") === "cpu.input-port|cpu.cache.north|cpu.exact-unit|cpu.core.0|cpu.result-port", "CPU exact component route has the wrong order");
require(cpuExact.cpu?.operationFactStatus !== "illustrative" && cpuExact.cpu?.geometryStatus === "illustrative", "CPU operation truth and illustrative geometry were not kept separate");

simulation.goToPhase(2, 3);
const dramJoinSpan = simulation.phaseSpan();
simulation.setProgress(dramJoinSpan.start + (dramJoinSpan.end - dramJoinSpan.start) * 0.4);
const dramJoin = simulation.hardwareSnapshot();
require(dramJoin.beat === "dram-join" && dramJoin.cpu?.active && dramJoin.componentFlow?.processor === "dram", "DRAM join did not take componentFlow precedence over its CPU destination");
require(dramJoin.storage?.payloadRegion === "global-pq" && dramJoin.storage?.route?.join("|") === "dram.input-port|dram.package.0|dram.logical-bank.0|dram.payload-region|dram.output-port", "DRAM global-PQ component route is incomplete");
require(/resident PQ operands remain in DRAM and do not enter it anew/i.test(dramJoin.storage?.steps?.[0]?.payload || ""), "DRAM join incorrectly presents resident PQ operands as new DIMM ingress");
require(dramJoin.storage?.steps?.map((step) => step.cameraTarget).join("|") === "dram-package|dram-bank|dram-global-pq-region|dram-output", "DRAM global-PQ camera targets do not follow the active destinations");
simulation.setProgress(dramJoinSpan.start + (dramJoinSpan.end - dramJoinSpan.start) * 0.65);
const inlineUnpack = simulation.hardwareSnapshot();
require(inlineUnpack.beat === "inline-unpack" && inlineUnpack.cpu?.active && inlineUnpack.componentFlow?.processor === "dram", "Inline unpack did not keep DRAM componentFlow precedence over its CPU destination");
require(inlineUnpack.storage?.payloadRegion === "scratch", "Inline unpack did not target the logical DRAM scratch payload region");
require(/already held in scratch/i.test(inlineUnpack.storage?.steps?.[0]?.payload || ""), "Inline unpack incorrectly presents scratch-resident bytes as new DIMM ingress");

simulation.goToPhase(2, 1);
const canonicalStorageSpan = simulation.phaseSpan();
const storageProbes = [0.05, 0.27, 0.62];
const canonicalStorage = storageProbes.map((progress) => {
  simulation.setProgress(canonicalStorageSpan.start + (canonicalStorageSpan.end - canonicalStorageSpan.start) * progress);
  return simulation.hardwareSnapshot();
});
require(canonicalStorage.every((snapshot) => snapshot.computePath === "paper"), "Canonical storage comparison fixture unexpectedly left the paper path");
require(canonicalStorage[0].componentFlow?.processor === "ssd" && canonicalStorage[0].componentFlow?.steps?.length === 3, "Request must stop after the three-step SSD command-dispatch path");
require(canonicalStorage[0].storage?.route?.join("|") === "ssd.pcie-endpoint|ssd.controller|ssd.command-queue|ssd.flash-channel.0", "Request component route crosses its command-dispatch boundary");
require(!/nand-package|nand-die|return-buffer/i.test(JSON.stringify(canonicalStorage[0].componentFlow?.steps)), "Request component flow leaks into NAND access or data return");
require(canonicalStorage[1].componentFlow?.processor === "ssd" && canonicalStorage[1].componentFlow?.steps?.length === 3, "NAND read must use the three-step package/die/return-buffer path");
require(canonicalStorage[1].storage?.route?.join("|") === "ssd.flash-channel.0|ssd.nand-package.0|ssd.nand-die.0|ssd.return-buffer", "NAND-read component route has the wrong boundary");
require(!/command-queue/i.test(JSON.stringify(canonicalStorage[1].componentFlow?.steps)), "NAND-read component flow replays the request command queue");
require(canonicalStorage[2].componentFlow?.processor === "storage" && canonicalStorage[2].componentFlow?.steps?.length === 4, "Block return lacks the four-transition SSD-return-buffer-to-DRAM-scratch flow");
require(canonicalStorage[2].storage?.route?.join("|") === "ssd.return-buffer|dram.input-port|dram.package.0|dram.logical-bank.0|dram.payload-region", "Block return component route does not end at the canonical DRAM scratch destination");
require(!/nand-package|nand-die|flash-channel|command-queue/i.test(JSON.stringify(canonicalStorage[2].componentFlow?.steps)), "Block return component flow replays command dispatch or NAND access");
require(!/dram\.output-port/i.test(JSON.stringify(canonicalStorage[2].componentFlow?.steps)), "Block return incorrectly moves the returned bytes out of DRAM scratch");

let computeReason = null;
const unsubscribeCompute = simulation.subscribe((state, stage, reason) => { if (reason !== "init") computeReason = reason; });
simulation.setComputePath("gpu-assist");
require(computeReason === "computePath", "setComputePath emitted the wrong reason");
unsubscribeCompute();
simulation.goToPhase(2, 1);
const storageSpan = simulation.phaseSpan();
const storageBeats = [];
storageProbes.forEach((progress, probeIndex) => {
  simulation.setProgress(storageSpan.start + (storageSpan.end - storageSpan.start) * progress);
  const hardware = simulation.hardwareSnapshot();
  storageBeats.push(hardware.beat);
  require(hardware.computePath === "gpu-assist" && hardware.gpu?.active === false, "GPU assist hid or replaced a storage beat");
  require(hardware.factStatus !== "illustrative", "GPU assist relabeled a paper storage beat as illustrative");
  ["beat", "source", "destination", "payload", "cameraTarget", "factStatus"].forEach((key) => {
    require(hardware[key] === canonicalStorage[probeIndex][key], `GPU assist changed canonical storage field ${key}`);
  });
});
require(storageBeats.join("|") === "request|nand-read|block-return", "GPU assist does not preserve request → NAND → block-return");
simulation.goToPhase(3, 1);
const gpuSpan = simulation.phaseSpan();
const gpuHops = [];
[0.05, 0.2, 0.38, 0.55, 0.72, 0.9].forEach((progress) => {
  simulation.setProgress(gpuSpan.start + (gpuSpan.end - gpuSpan.start) * progress);
  const hardware = simulation.hardwareSnapshot();
  gpuHops.push(`${hardware.source}>${hardware.destination}`);
  require(hardware.computePath === "gpu-assist", "GPU assist snapshot lost its compute path");
  require(hardware.factStatus === "illustrative", "GPU assist must stay illustrative");
  require(hardware.gpu?.active === true, "GPU assist did not activate its separate route");
  require(hardware.queryResidency === "host", "GPU assist moved q away from the host");
  require(hardware.componentFlow?.activeStep?.id === hardware.componentStep, "GPU component summary lost its active step object");
  require(hardware.componentFlow?.activeStep?.source === hardware.source && hardware.componentFlow?.activeStep?.destination === hardware.destination, "GPU top-level route diverged from its component step");
});
require(gpuHops.join("|") === "host.dram>gpu.pcie-endpoint|gpu.pcie-endpoint>gpu.memory-controller.0|gpu.memory-controller.0>gpu.vram.0|gpu.vram.0>gpu.core-cluster.0|gpu.core-cluster.0>gpu.result-buffer|gpu.result-buffer>host.result", "GPU assist route is not DRAM → PCIe → memory controller → VRAM → representative core → result buffer → host");
const gpuPq = simulation.hardwareSnapshot();
require(gpuPq.gpu?.stepCount === 6 && gpuPq.componentFlow?.steps?.length === 6, "GPU component flow is not six steps");
require(gpuPq.gpu?.representativeCoreCount === 1 && /not mapped one-to-one/i.test(gpuPq.gpu?.coreMapping || ""), "GPU metadata may imply one core per neighbor");
require(JSON.stringify(gpuPq.componentFlow).includes("q-derived LUT copy"), "GPU PQ route lost the q-derived LUT copy");
require(gpuPq.componentFlow?.steps?.every((step) => step.factStatus === "illustrative"), "A GPU component step escaped illustrative scope");
simulation.goToPhase(4, 0);
const exactGpuSpan = simulation.phaseSpan();
simulation.setProgress(exactGpuSpan.start + (exactGpuSpan.end - exactGpuSpan.start) * 0.6);
const exactGpu = simulation.hardwareSnapshot();
require(exactGpu.beat === "exact-score" && exactGpu.factStatus === "illustrative" && /during expansion/i.test(exactGpu.payload), "GPU exact-score branch lost expansion-time truth");
require(JSON.stringify(exactGpu.componentFlow).includes("read-only q copy") && exactGpu.queryResidency === "host", "GPU exact-score branch lacks a read-only q copy while preserving canonical host q");
require(exactGpu.gpu?.resultTarget === "host.exact-score-ledger", "GPU exact-score result is not assigned to the host exact-score ledger");
simulation.setComputePath("paper");

const manualControls = [
  ["playPause", (sim) => sim.playPause()],
  ["next", (sim) => sim.next()],
  ["previous", (sim) => sim.previous()],
  ["goTo", (sim) => sim.goTo(2)],
  ["goToPhase", (sim) => sim.goToPhase(2, 1)],
  ["setProgress", (sim) => sim.setProgress(0.4)],
  ["replayPhase", (sim) => sim.replayPhase()],
];
manualControls.forEach(([name, operate]) => {
  const sim = new Simulation(content.stages);
  sim.runAll();
  operate(sim);
  require(sim.state.autoTour === false, `${name} did not cancel auto-tour`);
});

const nearlyEqual = (left, right, tolerance = 1e-7) => Math.abs(left - right) <= tolerance;

const held = new Simulation(content.stages);
const initialDwell = held.dwellSnapshot();
require(Object.isFrozen(initialDwell), "dwellSnapshot must be read-only");
require(initialDwell.active && initialDwell.kind === "stage", "Initial autoplay did not hold at the first stage boundary");
require(nearlyEqual(initialDwell.duration, 2.2) && nearlyEqual(initialDwell.remaining, 2.2), "Stage dwell is not 2.2 real-time seconds");
held.setSpeed(3);
held.update(0.6);
const speedIndependentDwell = held.dwellSnapshot();
require(held.state.progress === 0, "Stage dwell advanced simulation progress");
require(nearlyEqual(speedIndependentDwell.remaining, 1.6), "Playback speed scaled the reading dwell");
held.playPause();
const pausedRemaining = held.dwellSnapshot().remaining;
held.update(100);
require(nearlyEqual(held.dwellSnapshot().remaining, pausedRemaining), "Pausing did not preserve the remaining dwell");
held.playPause();
require(nearlyEqual(held.dwellSnapshot().remaining, pausedRemaining), "Resuming restarted the active dwell");
held.update(0.4);
require(nearlyEqual(held.dwellSnapshot().remaining, pausedRemaining - 0.4), "Resumed dwell did not continue from its remaining time");
const heldProgress = held.state.progress;
held.update(1e6);
require(!held.dwellSnapshot().active && nearlyEqual(held.state.progress, heldProgress), "A huge delta moved in the same update that completed a dwell");
held.update(1e6);
const firstPhaseDwell = held.dwellSnapshot();
require(firstPhaseDwell.active && firstPhaseDwell.kind === "phase", "Entering the next phase did not start a phase dwell");
require(nearlyEqual(firstPhaseDwell.duration, 1.4) && nearlyEqual(firstPhaseDwell.remaining, 1.4), "Phase dwell is not 1.4 real-time seconds");
require(held.phaseIndex() === 1 && nearlyEqual(held.phaseProgress(), 0), "Huge movement delta skipped the next phase boundary");

const dwellClearingControls = [
  ["next", (sim) => sim.next()],
  ["previous", (sim) => sim.previous()],
  ["goTo", (sim) => sim.goTo(2)],
  ["goToPhase", (sim) => sim.goToPhase(2, 1)],
  ["setProgress", (sim) => sim.setProgress(0.4)],
];
dwellClearingControls.forEach(([name, operate]) => {
  const sim = new Simulation(content.stages);
  require(sim.dwellSnapshot().active, `${name} fixture did not begin with an active dwell`);
  operate(sim);
  require(!sim.dwellSnapshot().active, `${name} did not clear the active dwell`);
});

const selectedPhase = new Simulation(content.stages);
selectedPhase.goToPhase(2, 1);
const selectedSpan = selectedPhase.phaseSpan();
require(!selectedPhase.state.playing && !selectedPhase.dwellSnapshot().active, "Manual phase selection unexpectedly kept a dwell active");
selectedPhase.playPause();
const selectedDwell = selectedPhase.dwellSnapshot();
require(selectedDwell.active && selectedDwell.kind === "phase", "Play at a manually selected phase start did not create a dwell");
selectedPhase.update(0.7);
require(nearlyEqual(selectedPhase.state.progress, selectedSpan.start), "Manual phase dwell advanced before its reading time elapsed");

const normalMatchMedia = sandbox.window.matchMedia;
sandbox.window.matchMedia = () => ({ matches: true });
const reducedMotion = new Simulation(content.stages);
require(!reducedMotion.state.playing && !reducedMotion.dwellSnapshot().active, "Reduced motion should not force autoplay");
reducedMotion.playPause();
require(reducedMotion.state.playing && reducedMotion.dwellSnapshot().active, "Reduced-motion playback lost its reading dwell after explicit Play");
reducedMotion.update(0.5);
require(nearlyEqual(reducedMotion.dwellSnapshot().remaining, 1.7), "Reduced-motion reading dwell did not use real time");
sandbox.window.matchMedia = normalMatchMedia;

const ordinary = new Simulation(content.stages);
let ordinarySafety = phaseCount * 3;
while (ordinary.state.playing && ordinarySafety > 0) {
  ordinary.update(1e6);
  ordinarySafety -= 1;
}
require(ordinarySafety > 0, "Manual checkpoint flow did not terminate deterministically");
require(ordinary.state.stageIndex === 0 && ordinary.state.checkpointPaused && !ordinary.state.playing, "Manual checkpoint flow no longer pauses at stage 1");

const tour = new Simulation(content.stages);
let runAllReason = null;
const tourPhaseEntries = [];
const tourStageEntries = [];
tour.subscribe((state, stage, reason) => {
  if (reason !== "init") runAllReason = reason;
  if (reason === "phase") tourPhaseEntries.push(`${state.stageIndex}:${tour.phaseIndex()}`);
  if (reason === "stage") tourStageEntries.push(state.stageIndex);
});
tour.runAll();
require(runAllReason === "runAll", "runAll emitted the wrong reason");
require(tour.state.stageIndex === 0 && tour.state.progress === 0 && tour.state.autoTour && tour.state.playing, "runAll did not start from stage 1");
require(tour.dwellSnapshot().active && tour.dwellSnapshot().kind === "stage", "runAll did not begin with a stage dwell");
let tourSafety = phaseCount * 3;
while (tour.state.playing && tourSafety > 0) {
  const beforeStage = tour.state.stageIndex;
  const beforePhase = tour.phaseIndex();
  const beforeProgress = tour.state.progress;
  const beforeDwell = tour.dwellSnapshot();
  tour.update(1e6);
  if (beforeDwell.active) {
    require(tour.state.stageIndex === beforeStage && nearlyEqual(tour.state.progress, beforeProgress), "Huge delta moved while completing a tour dwell");
  } else if (tour.state.stageIndex === beforeStage) {
    require(tour.phaseIndex() - beforePhase <= 1, "Huge delta skipped a phase boundary during the full tour");
  } else {
    require(tour.state.stageIndex === beforeStage + 1 && tour.state.progress === 0, "Huge delta skipped a stage boundary during the full tour");
  }
  if (tour.state.stageIndex < content.stages.length - 1) {
    require(tour.state.autoTour && tour.state.playing && !tour.state.checkpointPaused, `runAll paused at intermediate stage ${tour.state.stageIndex + 1}`);
  }
  tourSafety -= 1;
}
require(tourSafety > 0, "runAll did not terminate deterministically");
require(tour.state.stageIndex === content.stages.length - 1 && tour.state.progress === 1, "runAll did not finish the final stage");
require(!tour.state.autoTour && !tour.state.playing && tour.state.checkpointPaused, "runAll did not stop only at the final checkpoint");
require(tourPhaseEntries.length === phaseCount - content.stages.length, "runAll did not expose every newly entered non-initial phase");
require(tourStageEntries.length === content.stages.length - 1, "runAll did not expose every newly entered stage");

const unsafe = new Simulation([{
  id: "adapter-guard",
  duration: 1,
  phases: [{
    id: "unsafe-request",
    trace: {
      sceneFamily: "read",
      stateLabel: "GUARD",
      events: [{
        id: "unsafe",
        at: 0,
        lane: "shared",
        label: "Unsafe fixture",
        source: "host.query",
        destination: "shared.ssd.LBA=123",
        payload: "request id #42 carrying q",
        direction: "down",
        factStatus: "illustrative",
      }],
    },
  }],
}]);
unsafe.setProgress(0.1);
const guarded = unsafe.hardwareSnapshot();
require(!/LBA\s*[=:#]?\s*\d|request(?:\s+id)?\s*[=:#]?\s*\d/i.test(`${guarded.source} ${guarded.destination} ${guarded.payload}`), "Hardware adapter did not sanitize numeric transport identifiers");
require(!/host\.query/i.test(guarded.source) && /q remains host-side|canonical q remains at host\.query/i.test(guarded.payload), "Hardware adapter did not fail closed on q transport");

const fallback = new Simulation([{ id: "fallback", duration: 1, phases: [{ id: "missing-trace" }] }]).hardwareSnapshot();
require(fallback.beat === "inspect" && fallback.method === "both" && fallback.factStatus === "illustrative", "Hardware adapter phase fallback is not deterministic");

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log(`PASS trace contract (${content.stages.length} stages, ${phaseCount} phases, ${eventCount} events)`);
