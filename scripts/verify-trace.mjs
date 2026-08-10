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

simulation.goToPhase(2, 1);
simulation.setDataset("KILT E5 22M");
const readSnapshot = simulation.traceSnapshot();
require(readSnapshot.dataset?.label === "KILT E5 22M", "Dataset-aware trace snapshot did not resolve KILT E5 22M");
require(JSON.stringify(readSnapshot).includes("LBA(p)"), "Node-read trace must retain symbolic LBA(p)");

let computeReason = null;
const unsubscribeCompute = simulation.subscribe((state, stage, reason) => { if (reason !== "init") computeReason = reason; });
simulation.setComputePath("gpu-assist");
require(computeReason === "computePath", "setComputePath emitted the wrong reason");
unsubscribeCompute();
simulation.goToPhase(2, 1);
const storageSpan = simulation.phaseSpan();
const storageBeats = [];
[0.05, 0.27, 0.62].forEach((progress) => {
  simulation.setProgress(storageSpan.start + (storageSpan.end - storageSpan.start) * progress);
  const hardware = simulation.hardwareSnapshot();
  storageBeats.push(hardware.beat);
  require(hardware.computePath === "gpu-assist" && hardware.gpu?.active === false, "GPU assist hid or replaced a storage beat");
  require(hardware.factStatus !== "illustrative", "GPU assist relabeled a paper storage beat as illustrative");
});
require(storageBeats.join("|") === "request|nand-read|block-return", "GPU assist does not preserve request → NAND → block-return");
simulation.goToPhase(3, 1);
const gpuSpan = simulation.phaseSpan();
const gpuHops = [];
[0.05, 0.3, 0.6, 0.9].forEach((progress) => {
  simulation.setProgress(gpuSpan.start + (gpuSpan.end - gpuSpan.start) * progress);
  const hardware = simulation.hardwareSnapshot();
  gpuHops.push(`${hardware.source}>${hardware.destination}`);
  require(hardware.computePath === "gpu-assist", "GPU assist snapshot lost its compute path");
  require(hardware.factStatus === "illustrative", "GPU assist must stay illustrative");
  require(hardware.gpu?.active === true, "GPU assist did not activate its separate route");
  require(hardware.queryResidency === "host", "GPU assist moved q away from the host");
});
require(gpuHops.join("|") === "host.dram>host.pcie|host.pcie>gpu.vram|gpu.vram>gpu.compute|gpu.compute>host.result", "GPU assist route is not DRAM → PCIe → VRAM → GPU → host result");
simulation.goToPhase(4, 0);
const exactGpuSpan = simulation.phaseSpan();
simulation.setProgress(exactGpuSpan.start + (exactGpuSpan.end - exactGpuSpan.start) * 0.6);
const exactGpu = simulation.hardwareSnapshot();
require(exactGpu.beat === "exact-score" && exactGpu.factStatus === "illustrative" && /during expansion/i.test(exactGpu.payload), "GPU exact-score branch lost expansion-time truth");
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

const ordinary = new Simulation(content.stages);
ordinary.update(1e6);
require(ordinary.state.stageIndex === 0 && ordinary.state.checkpointPaused && !ordinary.state.playing, "Manual checkpoint flow no longer pauses at stage 1");

const tour = new Simulation(content.stages);
let runAllReason = null;
tour.subscribe((state, stage, reason) => { if (reason !== "init") runAllReason = reason; });
tour.runAll();
require(runAllReason === "runAll", "runAll emitted the wrong reason");
require(tour.state.stageIndex === 0 && tour.state.progress === 0 && tour.state.autoTour && tour.state.playing, "runAll did not start from stage 1");
for (let index = 0; index < content.stages.length - 1; index += 1) {
  tour.update(1e6);
  require(tour.state.stageIndex === index + 1, `runAll did not advance after stage ${index + 1}`);
  require(tour.state.autoTour && tour.state.playing && !tour.state.checkpointPaused, `runAll paused at intermediate stage ${index + 1}`);
}
tour.update(1e6);
require(tour.state.stageIndex === content.stages.length - 1 && tour.state.progress === 1, "runAll did not finish the final stage");
require(!tour.state.autoTour && !tour.state.playing && tour.state.checkpointPaused, "runAll did not stop only at the final checkpoint");

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
