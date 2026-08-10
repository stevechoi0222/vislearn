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
  });
});

simulation.goToPhase(2, 1);
simulation.setDataset("KILT E5 22M");
const readSnapshot = simulation.traceSnapshot();
require(readSnapshot.dataset?.label === "KILT E5 22M", "Dataset-aware trace snapshot did not resolve KILT E5 22M");
require(JSON.stringify(readSnapshot).includes("LBA(p)"), "Node-read trace must retain symbolic LBA(p)");

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log(`PASS trace contract (${content.stages.length} stages, ${phaseCount} phases, ${eventCount} events)`);
