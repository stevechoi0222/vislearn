(function () {
  "use strict";

  const content = window.AISAQ_CONTENT;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const number = new Intl.NumberFormat("en-US");

  function table(id) { return content.benchmarkTables.find((item) => item.id === id); }
  function presetByLabel(label) { return content.blockPackingPresets.find((item) => item.label === label); }

  function datasetStats(label) {
    const memory = table("table-2").rows.find((row) => row[0] === label);
    const load = table("table-3").rows.find((row) => row[0] === label);
    const dataset = table("table-1");
    const col = dataset.columns.indexOf(label);
    const vectors = dataset.rows[0][col];
    const degree = Number(dataset.rows[4][col]);
    const preset = presetByLabel(label);
    return {
      label,
      vectors,
      vectorCount: Number(vectors.replaceAll(",", "")),
      degree,
      diskannMemory: Number(memory[2].replaceAll(",", "")),
      aisaqMemory: Number(memory[3].replaceAll(",", "")),
      diskannLoad: Number(load[1].replaceAll(",", "")),
      aisaqLoad: Number(load[2].replaceAll(",", "")),
      preset,
    };
  }

  function initRoute(sim) {
    const list = $("#route-list");
    content.stages.forEach((stage, index) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = String(index);
      button.innerHTML = `<span>${index + 1}</span><strong>${stage.navLabel || stage.short}</strong>`;
      button.addEventListener("click", () => sim.goTo(index));
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  function phasesFor(stage) {
    if (Array.isArray(stage.phases) && stage.phases.length) return stage.phases;
    return [{
      id: `${stage.id}-overview`,
      label: stage.navLabel || stage.short || stage.title,
      shared: stage.summary || stage.body,
      diskann: stage.body || stage.summary,
      aisaq: stage.body || stage.summary,
      difference: stage.learningGoal || "The methods use different data placement while following the same learning stop.",
      cue: "stage-overview",
    }];
  }

  function phaseIndexFor(sim, stage) {
    const phases = phasesFor(stage);
    const index = typeof sim.phaseIndex === "function" ? Number(sim.phaseIndex()) : 0;
    return Math.max(0, Math.min(phases.length - 1, Number.isFinite(index) ? index : 0));
  }

  function phaseFor(sim, stage) {
    const fromSimulation = typeof sim.currentPhase === "function" ? sim.currentPhase() : null;
    return fromSimulation || phasesFor(stage)[phaseIndexFor(sim, stage)];
  }

  function renderStage(state, stage) {
    $(".stage-wrap").dataset.stage = stage.id;
    $("#stage-count").textContent = `Stop ${state.stageIndex + 1} of ${content.stages.length}`;
    $("#stage-source-short").textContent = stage.sourceLabel.replace(/^Paper\s*/i, "").split("—")[0].trim();
    $("#stage-title").textContent = stage.title;
    $("#stage-short").textContent = stage.summary || stage.short;
    $("#stage-body").textContent = stage.body || stage.summary;
    $("#stage-source").href = stage.sourceUrl;
    $("#stage-source").innerHTML = `${stage.sourceLabel} <span aria-hidden="true">↗</span>`;
    $("#checkpoint-prompt").textContent = stage.checkpoint.prompt;
    $("#checkpoint-reveal-copy").textContent = stage.checkpoint.reveal;
    $("#checkpoint-hint").textContent = `If this is fuzzy: ${stage.checkpoint.confusionHint}`;
    $("#checkpoint-answer").hidden = true;
    $("#checkpoint").classList.remove("active");
    $("#checkpoint").removeAttribute("aria-current");
    $(".guide-body").scrollTop = 0;
    $$("#route-list button").forEach((button, index) => {
      if (index === state.stageIndex) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function renderActionList(state, stage, activeIndex, sim) {
    const list = $("#phase-list");
    const phases = phasesFor(stage);
    if (list.dataset.stage !== String(state.stageIndex)) {
      list.innerHTML = "";
      const stageIndex = state.stageIndex;
      phases.forEach((phase, index) => {
        const item = document.createElement("li");
        item.dataset.phaseIndex = String(index);
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<span>${index + 1}</span><strong></strong>`;
        $("strong", button).textContent = phase.label;
        button.addEventListener("click", () => {
          if (typeof sim.goToPhase === "function") sim.goToPhase(stageIndex, index);
        });
        item.appendChild(button);
        list.appendChild(item);
      });
      list.dataset.stage = String(state.stageIndex);
    }
    $$("li", list).forEach((item, index) => {
      const button = $("button", item);
      item.classList.toggle("active", index === activeIndex);
      if (index === activeIndex) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function renderPhase(state, stage, sim, announce) {
    const phases = phasesFor(stage);
    const index = phaseIndexFor(sim, stage);
    const phase = phaseFor(sim, stage);
    const progress = typeof sim.phaseProgress === "function" ? sim.phaseProgress() : state.progress;
    const count = phases.length;
    const actionCount = `Action ${index + 1} of ${count}`;

    $("#scene-action-count").textContent = `Stage ${state.stageIndex + 1} · Action ${index + 1}/${count}`;
    $("#scene-action-label").textContent = phase.label;
    $("#scene-shared-cue").textContent = phase.shared;
    $("#guide-action-count").textContent = actionCount;
    $("#guide-action-label").textContent = phase.label;
    $("#phase-common").textContent = phase.shared;
    $("#phase-diskann").textContent = phase.diskann;
    $("#phase-aisaq").textContent = phase.aisaq;
    $("#phase-difference").textContent = phase.difference;
    $("#learning-guide").dataset.cue = phase.cue;
    $("#learning-guide").style.setProperty("--action-progress", String(Math.min(1, Math.max(0, progress))));
    $("#canvas-phase-summary").textContent = `Visual summary. ${actionCount}: ${phase.label}. Common action: ${phase.shared} DiskANN: ${phase.diskann} AiSAQ: ${phase.aisaq} Why it differs: ${phase.difference}`;
    renderActionList(state, stage, index, sim);

    if (announce) {
      $("#phase-live").textContent = `Stage ${state.stageIndex + 1}, ${actionCount}: ${phase.label}. ${phase.shared}`;
    }
  }

  function renderPlayback(state, sim) {
    const label = state.playing ? "Pause" : "Play";
    $("#play-label").textContent = label;
    $("#play-icon").textContent = state.playing ? "Ⅱ" : "▶";
    $("#play").setAttribute("aria-label", `${label} simulation`);
    const actionProgress = typeof sim.phaseProgress === "function" ? sim.phaseProgress() : state.progress;
    $("#dwell-bar").style.transform = `scaleX(${Math.min(1, actionProgress)})`;
    $("#tour-progress").style.transform = `scaleX(${Math.min(1, sim.overallProgress())})`;
  }

  function renderDataset(label, syncLab) {
    const stats = datasetStats(label);
    const preset = stats.preset;
    $("#diskann-memory").textContent = `${number.format(stats.diskannMemory)} MB`;
    $("#aisaq-memory").textContent = `${number.format(stats.aisaqMemory)} MB`;
    $("#diskann-codes").textContent = `${number.format(stats.vectorCount)} PQ codes resident`;
    $("#aisaq-codes").textContent = `≤ R + n_ep codes · ${stats.degree + 1} if n_ep = 1`;
    $("#block-count").textContent = `${preset.derived.diskannBlocksPerNodeRead.value} → ${preset.derived.aisaqBlocksPerNodeRead.value}`;
    if (syncLab) setLabPreset(preset);
  }

  function initEvidence() {
    const memoryTable = table("table-2");
    const values = memoryTable.rows.flatMap((row) => [Number(row[2].replaceAll(",", "")), Number(row[3].replaceAll(",", ""))]);
    const maxLog = Math.log10(Math.max(...values) + 1);
    const target = $("#memory-bars");
    memoryTable.rows.forEach((row) => {
      const disk = Number(row[2].replaceAll(",", ""));
      const aisaq = Number(row[3].replaceAll(",", ""));
      const item = document.createElement("div");
      item.className = "memory-row";
      item.innerHTML = `
        <strong>${row[0]}</strong>
        <div class="bar-pair">
          <div class="bar-line diskann"><i style="width:${Math.max(2, Math.log10(disk + 1) / maxLog * 100)}%"></i><span><b>DiskANN</b><b>${number.format(disk)} MB</b></span></div>
          <div class="bar-line aisaq"><i style="width:${Math.max(2, Math.log10(aisaq + 1) / maxLog * 100)}%"></i><span><b>AiSAQ</b><b>${number.format(aisaq)} MB</b></span></div>
        </div>`;
      target.appendChild(item);
    });

    const loadBody = $("#load-time-body");
    table("table-3").rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${row[0]}</td><td>${row[1]} ms</td><td>${row[2]} ms</td>`;
      loadBody.appendChild(tr);
    });
  }

  function createBlockCell(blockIndex, totalBytes, baseBytes, blockSize, isAiSAQ) {
    const start = blockIndex * blockSize;
    const used = Math.max(0, Math.min(blockSize, totalBytes - start));
    const cell = document.createElement("div");
    cell.className = "block-cell";
    cell.setAttribute("aria-label", `Block ${blockIndex + 1}: ${number.format(used)} of ${number.format(blockSize)} bytes used`);
    const fill = document.createElement("i");
    fill.className = "block-fill";
    fill.style.width = `${used / blockSize * 100}%`;
    if (isAiSAQ && totalBytes > baseBytes) {
      const pqStart = Math.max(start, baseBytes);
      const pqEnd = Math.min(start + used, totalBytes);
      const pqUsed = Math.max(0, pqEnd - pqStart);
      if (pqUsed > 0) {
        const pq = document.createElement("i");
        pq.className = "pq-fill";
        pq.style.left = `${Math.max(0, (pqStart - start) / Math.max(used, 1) * 100)}%`;
        pq.style.width = `${pqUsed / Math.max(used, 1) * 100}%`;
        pq.style.right = "auto";
        fill.appendChild(pq);
      }
    }
    cell.appendChild(fill);
    return cell;
  }

  function renderBlocks(track, totalBytes, baseBytes, isAiSAQ) {
    track.innerHTML = "";
    const blockSize = 4096;
    const count = Math.max(1, Math.ceil(totalBytes / blockSize));
    for (let i = 0; i < count; i += 1) track.appendChild(createBlockCell(i, totalBytes, baseBytes, blockSize, isAiSAQ));
  }

  function updateLab() {
    const full = Number($("#full-bytes").value);
    const degree = Number($("#degree").value);
    const pq = Number($("#pq-bytes").value);
    const diskBytes = full + 4 * (degree + 1);
    const aisaqBytes = diskBytes + degree * pq;
    const diskBlocks = Math.ceil(diskBytes / 4096);
    const aisaqBlocks = Math.ceil(aisaqBytes / 4096);

    $("#full-bytes-output").textContent = number.format(full);
    $("#degree-output").textContent = String(degree);
    $("#pq-bytes-output").textContent = number.format(pq);
    $("#diskann-chunk").textContent = `${number.format(diskBytes)} B`;
    $("#aisaq-chunk").textContent = `${number.format(aisaqBytes)} B`;
    $("#diskann-blocks").textContent = `${diskBlocks} block${diskBlocks === 1 ? "" : "s"}`;
    $("#aisaq-blocks").textContent = `${aisaqBlocks} block${aisaqBlocks === 1 ? "" : "s"}`;
    renderBlocks($("#diskann-track"), diskBytes, diskBytes, false);
    renderBlocks($("#aisaq-track"), aisaqBytes, diskBytes, true);

    const difference = aisaqBlocks - diskBlocks;
    const verdict = $("#block-verdict");
    if (difference === 0) {
      verdict.innerHTML = `<strong>Same 4 KB block span.</strong> Inline PQ codes still fit in ${aisaqBlocks === 1 ? "one block" : `${aisaqBlocks} blocks`} for this layout.`;
    } else {
      verdict.innerHTML = `<strong>${difference} extra block${difference === 1 ? "" : "s"} per node chunk.</strong> Inline PQ codes expand the read from ${diskBlocks} to ${aisaqBlocks} blocks in this layout.`;
    }
  }

  function setLabPreset(preset) {
    if (!preset) return;
    $("#full-bytes").value = String(preset.derived.fullVectorBytes.value);
    $("#degree").value = String(preset.paperInputs.maximumOutdegreeR);
    $("#pq-bytes").value = String(preset.paperInputs.pqVectorBytes);
    $$("[data-preset]").forEach((button) => button.classList.toggle("active", button.dataset.preset === preset.label));
    updateLab();
  }

  function initLab() {
    ["#full-bytes", "#degree", "#pq-bytes"].forEach((selector) => $(selector).addEventListener("input", () => {
      $$("[data-preset]").forEach((button) => button.classList.remove("active"));
      updateLab();
    }));
    $$("[data-preset]").forEach((button) => button.addEventListener("click", () => setLabPreset(presetByLabel(button.dataset.preset))));
    setLabPreset(presetByLabel("SIFT1B"));
  }

  function initQuiz() {
    const form = $("#quiz-form");
    content.quiz.forEach((question) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "quiz-question";
      fieldset.dataset.question = question.id;
      const legend = document.createElement("legend");
      legend.textContent = question.prompt;
      const options = document.createElement("div");
      options.className = "quiz-options";
      question.options.forEach((option) => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="radio" name="${question.id}" value="${option.id}"><span>${option.text}</span>`;
        options.appendChild(label);
      });
      const feedback = document.createElement("p");
      feedback.className = "quiz-feedback";
      feedback.hidden = true;
      fieldset.append(legend, options, feedback);
      form.appendChild(fieldset);
    });

    $("#check-quiz").addEventListener("click", () => {
      let score = 0;
      content.quiz.forEach((question) => {
        const fieldset = $(`[data-question="${question.id}"]`);
        const choice = $(`input[name="${question.id}"]:checked`, fieldset);
        const feedback = $(".quiz-feedback", fieldset);
        $$(".quiz-options span", fieldset).forEach((span) => span.classList.remove("correct", "incorrect"));
        const correctInput = $(`input[value="${question.answerId}"]`, fieldset);
        correctInput.nextElementSibling.classList.add("correct");
        if (choice && choice.value === question.answerId) {
          score += 1;
          feedback.textContent = `Correct. ${question.explanation}`;
        } else {
          if (choice) choice.nextElementSibling.classList.add("incorrect");
          feedback.textContent = `${choice ? "Not quite." : "Choose an answer first."} ${question.explanation}`;
        }
        feedback.hidden = false;
      });
      $("#quiz-score").textContent = `${score} / ${content.quiz.length} correct`;
    });

    $("#reset-quiz").addEventListener("click", () => {
      form.reset();
      $$(".quiz-options span", form).forEach((span) => span.classList.remove("correct", "incorrect"));
      $$(".quiz-feedback", form).forEach((feedback) => { feedback.hidden = true; feedback.textContent = ""; });
      $("#quiz-score").textContent = "";
    });
  }

  function bindControls(sim) {
    $("#play").addEventListener("click", () => sim.playPause());
    $("#next").addEventListener("click", () => sim.next());
    $("#restart").addEventListener("click", () => sim.restart());
    $("#speed").addEventListener("input", (event) => sim.setSpeed(event.target.value));
    $("#dataset-select").addEventListener("change", (event) => sim.setDataset(event.target.value));
    $("#follow").addEventListener("change", (event) => sim.setToggle("follow", event.target.checked));
    $("#labels").addEventListener("change", (event) => sim.setToggle("labels", event.target.checked));
    $$('[data-view]').forEach((button) => button.addEventListener("click", () => sim.setView(button.dataset.view)));
    $("#checkpoint-reveal").addEventListener("click", () => {
      if (sim.state.playing) sim.playPause();
      $("#checkpoint-answer").hidden = false;
      $("#checkpoint").classList.add("active");
    });
    $("#checkpoint-continue").addEventListener("click", () => sim.resume());

    window.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); sim.playPause(); }
      else if (event.code === "ArrowRight") sim.next();
      else if (event.code === "ArrowLeft") sim.previous();
      else if (event.key.toLowerCase() === "r") sim.restart();
      else if (event.key.toLowerCase() === "f") { $("#follow").click(); }
      else if (event.key.toLowerCase() === "l") { $("#labels").click(); }
    });
  }

  function initMenu() {
    const button = $("#top-menu");
    const nav = $("#mobile-nav");
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      nav.hidden = open;
    });
    $$("a", nav).forEach((link) => link.addEventListener("click", () => {
      button.setAttribute("aria-expanded", "false");
      nav.hidden = true;
    }));
  }

  function renderView(state) {
    $(".stage-wrap").dataset.view = state.view;
    $("#learning-guide").dataset.view = state.view;
    $$("[data-method]").forEach((row) => {
      const prioritized = state.view !== "split" && row.dataset.method === state.view;
      row.classList.toggle("prioritized", prioritized);
    });
    $$('[data-view]').forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function bindAiSAQUI(sim) {
    initRoute(sim);
    initEvidence();
    initLab();
    initQuiz();
    initMenu();
    bindControls(sim);

    let lastPhaseKey = null;

    function surfaceCheckpoint(stage) {
      const checkpoint = $("#checkpoint");
      checkpoint.classList.add("active");
      checkpoint.setAttribute("aria-current", "step");
      $("#phase-live").textContent = `Checkpoint after ${stage.title}. ${stage.checkpoint.prompt}`;
      requestAnimationFrame(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const behavior = reduced ? "auto" : "smooth";
        if (window.matchMedia("(max-width: 1100px)").matches) {
          checkpoint.scrollIntoView({ behavior, block: "center" });
        } else {
          const guideBody = $(".guide-body");
          const bodyRect = guideBody.getBoundingClientRect();
          const checkpointRect = checkpoint.getBoundingClientRect();
          const centered = guideBody.scrollTop + checkpointRect.top - bodyRect.top - (guideBody.clientHeight - checkpointRect.height) / 2;
          guideBody.scrollTo({ top: Math.max(0, centered), behavior });
        }
        $("#checkpoint-reveal").focus({ preventScroll: true });
      });
    }

    sim.subscribe((state, stage, reason) => {
      if (["init", "stage", "restart", "complete"].includes(reason)) renderStage(state, stage);
      if (["init", "stage", "phase", "restart", "complete"].includes(reason)) {
        const phase = phaseFor(sim, stage);
        const phaseKey = `${state.stageIndex}:${phase.id}`;
        const isActualTransition = lastPhaseKey !== null && phaseKey !== lastPhaseKey;
        renderPhase(state, stage, sim, isActualTransition);
        lastPhaseKey = phaseKey;
      }
      if (reason === "checkpoint") surfaceCheckpoint(stage);
      renderPlayback(state, sim);
      if (["init", "dataset"].includes(reason)) renderDataset(state.dataset, reason === "dataset");
      if (["init", "speed"].includes(reason)) $("#speed-value").textContent = `${state.speed}×`;
      if (["init", "view"].includes(reason)) renderView(state);
    });

    return {
      updateProgress(state) {
        const actionProgress = typeof sim.phaseProgress === "function" ? sim.phaseProgress() : state.progress;
        $("#dwell-bar").style.transform = `scaleX(${Math.min(1, actionProgress)})`;
        $("#tour-progress").style.transform = `scaleX(${Math.min(1, sim.overallProgress())})`;
      },
    };
  }

  window.bindAiSAQUI = bindAiSAQUI;
})();
