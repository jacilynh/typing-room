(function () {
  "use strict";

  const canvas = document.getElementById("roomCanvas");
  const ctx = canvas.getContext("2d");

  const els = {
    wpm: document.getElementById("wpm"),
    accuracyTop: document.getElementById("accuracyTop"),
    timer: document.getElementById("timer"),
    modeKicker: document.getElementById("modeKicker"),
    passageLabel: document.getElementById("passageLabel"),
    passage: document.getElementById("passage"),
    paper: document.getElementById("paper"),
    caretNote: document.getElementById("caretNote"),
    ribbonMeter: document.querySelector("#ribbonMeter span"),
    overlay: document.getElementById("overlay"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    start: document.getElementById("startButton"),
    restart: document.getElementById("restartButton"),
    pause: document.getElementById("pauseButton"),
    modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
    durationButtons: Array.from(document.querySelectorAll("[data-duration]")),
    passageButtons: Array.from(document.querySelectorAll("[data-passage]")),
    sound: document.getElementById("soundToggle"),
    daily: document.getElementById("dailyButton"),
    currentReadout: document.getElementById("currentReadout"),
    rawWpm: document.getElementById("rawWpm"),
    streak: document.getElementById("streak"),
    errors: document.getElementById("errors"),
    bestWpm: document.getElementById("bestWpm"),
    rank: document.getElementById("rankBadge"),
    notesList: document.getElementById("notesList"),
    resetStats: document.getElementById("resetStats"),
    keys: Array.from(document.querySelectorAll(".key-row span"))
  };

  const storeKey = "typing-room-state-v1";
  const modes = {
    sprint: {
      label: "Classic Sprint",
      readyTitle: "Warm up the keys",
      readyText: "Type as quickly and cleanly as you can before the timer runs out."
    },
    accuracy: {
      label: "Accuracy Garden",
      readyTitle: "Let precision set the pace",
      readyText: "Mistakes cost more here. Keep the line clean and grow a careful streak."
    },
    typewriter: {
      label: "Typewriter Room",
      readyTitle: "Make the page sing",
      readyText: "A tactile typewriter simulation with carriage motion, paper lift, and a ribbon meter."
    }
  };
  const passages = {
    literary: [
      "The quiet office glows at the edge of evening, and every sentence arrives like a small lamp being switched on.",
      "A page can hold a whole weather system: bright clauses, soft pauses, and the sudden thunder of a well-placed word.",
      "She typed slowly at first, then faster, until the room seemed to breathe in time with the keys."
    ],
    notes: [
      "Make tea. Open the window. Type one clean paragraph. Save the good line before the day gets too loud.",
      "The best desk has a lamp, a notebook, a patient keyboard, and enough quiet to hear an idea become real.",
      "Begin with one sentence. Let the next one follow. Momentum is often just attention with its sleeves rolled up."
    ],
    code: [
      "const words = draft.trim().split(/\\s+/); return words.filter(Boolean).length;",
      "function measureAccuracy(input, target) { return input.length ? correct / input.length : 1; }",
      "await buildRoom({ mode: 'typewriter', sound: true, paper: 'warm', focus: 'accuracy' });"
    ]
  };
  const ranks = [
    [0, "Copyist"],
    [35, "Typesetter"],
    [55, "Editor"],
    [75, "Correspondent"],
    [95, "Master Printer"]
  ];

  const state = {
    running: false,
    paused: false,
    finished: false,
    daily: false,
    mode: "sprint",
    duration: 60,
    timeLeft: 60,
    passageSet: "literary",
    target: "",
    typed: "",
    cursor: 0,
    correctChars: 0,
    errors: 0,
    streak: 0,
    bestStreak: 0,
    startedAt: 0,
    lastFrame: 0,
    elapsedMs: 0,
    strikes: [],
    dust: [],
    lampPhase: 0,
    activeKey: "",
    stats: loadStats()
  };

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(storeKey)) || { bestWpm: 0, runs: [] };
    } catch {
      return { bestWpm: 0, runs: [] };
    }
  }

  function saveStats() {
    localStorage.setItem(storeKey, JSON.stringify(state.stats));
  }

  function mulberry32(seed) {
    return function rand() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cssColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function selectedMode() {
    return els.modeButtons.find((button) => button.classList.contains("active"))?.dataset.mode || "sprint";
  }

  function selectedDuration() {
    const selected = els.durationButtons.find((button) => button.classList.contains("active"));
    return Number(selected?.dataset.duration || 60);
  }

  function selectedPassageSet() {
    return els.passageButtons.find((button) => button.classList.contains("active"))?.dataset.passage || "literary";
  }

  function pickPassage(daily) {
    const set = selectedPassageSet();
    const options = passages[set] || passages.literary;
    if (!daily) return options[Math.floor(Math.random() * options.length)];
    const dateSeed = Number(new Date().toISOString().slice(0, 10).replaceAll("-", ""));
    const rand = mulberry32(dateSeed + set.length + selectedMode().length);
    return options[Math.floor(rand() * options.length)];
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawRoom(0);
  }

  function logicalSize() {
    const rect = canvas.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  function setOverlay(show, title, text, kicker = "Ready") {
    els.overlay.classList.toggle("hidden", !show);
    if (title) els.overlayTitle.textContent = title;
    if (text) els.overlayText.textContent = text;
    els.overlayKicker.textContent = kicker;
  }

  function startRun(daily = false) {
    state.running = true;
    state.paused = false;
    state.finished = false;
    state.daily = daily;
    state.mode = selectedMode();
    state.duration = selectedDuration();
    state.timeLeft = state.duration;
    state.passageSet = selectedPassageSet();
    state.target = pickPassage(daily);
    state.typed = "";
    state.cursor = 0;
    state.correctChars = 0;
    state.errors = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.startedAt = performance.now();
    state.lastFrame = performance.now();
    state.elapsedMs = 0;
    state.strikes = [];
    state.dust = [];
    els.passage.focus();
    setOverlay(false);
    renderPassage();
    updateHud();
    requestAnimationFrame(loop);
  }

  function finishRun() {
    if (!state.running) return;
    state.running = false;
    state.finished = true;
    const stats = currentStats();
    state.stats.bestWpm = Math.max(state.stats.bestWpm || 0, Math.round(stats.wpm));
    state.stats.runs = [
      {
        date: new Date().toISOString(),
        mode: state.mode,
        passageSet: state.passageSet,
        wpm: Math.round(stats.wpm),
        accuracy: Math.round(stats.accuracy * 1000) / 10,
        errors: state.errors
      },
      ...(state.stats.runs || [])
    ].slice(0, 5);
    saveStats();
    updateHud();
    renderNotes();
    setOverlay(
      true,
      `${Math.round(stats.wpm)} WPM at ${Math.round(stats.accuracy * 100)}%`,
      `Best streak: ${state.bestStreak}. Errors: ${state.errors}. The page is ready for another pass.`,
      "Session complete"
    );
  }

  function togglePause() {
    if (!state.running || state.finished) return;
    state.paused = !state.paused;
    els.pause.textContent = state.paused ? ">" : "II";
    if (state.paused) {
      setOverlay(true, "Paused at the desk", "Press Escape or the pause button to continue.", "Paused");
    } else {
      state.lastFrame = performance.now();
      setOverlay(false);
      requestAnimationFrame(loop);
      els.passage.focus();
    }
  }

  function currentStats() {
    const elapsedMinutes = Math.max(state.elapsedMs / 60000, 1 / 60000);
    const typedChars = state.typed.length;
    const correctChars = countCorrect();
    const rawWpm = typedChars / 5 / elapsedMinutes;
    const wpm = correctChars / 5 / elapsedMinutes;
    const accuracy = typedChars ? correctChars / typedChars : 1;
    return { rawWpm, wpm, accuracy, progress: state.target ? state.cursor / state.target.length : 0 };
  }

  function countCorrect() {
    let count = 0;
    for (let i = 0; i < state.typed.length; i += 1) {
      if (state.typed[i] === state.target[i]) count += 1;
    }
    return count;
  }

  function handleInput(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (!state.running) {
      if (event.key === " ") {
        event.preventDefault();
        startRun(false);
      }
      return;
    }
    if (state.paused) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      if (!state.typed.length) return;
      state.typed = state.typed.slice(0, -1);
      state.cursor = Math.max(0, state.cursor - 1);
      state.streak = Math.max(0, state.streak - 1);
      renderPassage();
      updateHud();
      return;
    }
    if (event.key === "Enter") {
      if (state.mode !== "typewriter") return;
      event.preventDefault();
      typeCharacter("\n");
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      typeCharacter(event.key);
    }
  }

  function typeCharacter(char) {
    if (state.cursor >= state.target.length) return;
    const expected = state.target[state.cursor];
    const correct = char === expected;
    state.typed += char;
    state.cursor += 1;
    state.activeKey = char.toUpperCase();
    if (correct) {
      state.correctChars += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.errors += 1;
      state.streak = state.mode === "accuracy" ? 0 : Math.max(0, state.streak - 3);
    }
    addStrike(correct);
    playTap(correct);
    renderPassage();
    updateHud();
    window.setTimeout(() => {
      state.activeKey = "";
      updateKeys();
    }, 120);
    if (state.cursor >= state.target.length) finishRun();
  }

  function addStrike(correct) {
    const { w, h } = logicalSize();
    state.strikes.push({
      x: w * (0.48 + Math.random() * 0.06),
      y: h * (0.49 + Math.random() * 0.06),
      age: 0,
      correct
    });
    state.dust.push({
      x: w * (0.5 + Math.random() * 0.1 - 0.05),
      y: h * (0.64 + Math.random() * 0.05),
      vx: -12 + Math.random() * 24,
      vy: -18 - Math.random() * 18,
      age: 0
    });
  }

  function playTap(correct) {
    if (!els.sound.checked || !window.AudioContext) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!playTap.ctx) playTap.ctx = new AudioContext();
    const audio = playTap.ctx;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = correct ? 720 + Math.random() * 90 : 190;
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.04);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.045);
  }

  function renderPassage() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < state.target.length; i += 1) {
      const span = document.createElement("span");
      const typed = state.typed[i];
      const target = state.target[i];
      span.textContent = target;
      if (typed !== undefined) span.className = typed === target ? "correct" : "wrong";
      if (i === state.cursor) span.classList.add("current");
      frag.append(span);
    }
    els.passage.replaceChildren(frag);
    const stats = currentStats();
    els.ribbonMeter.style.width = `${Math.min(100, stats.progress * 100)}%`;
    els.paper.style.setProperty("--paper-rise", state.mode === "typewriter" ? `${-Math.floor(state.cursor / 42) * 4}px` : "0px");
    els.modeKicker.textContent = modes[state.mode].label;
    els.passageLabel.textContent = state.daily ? "Daily" : labelForPassage(state.passageSet);
    els.caretNote.textContent = state.running ? nextHint() : "Press Start, then type here";
    els.currentReadout.textContent = state.target[state.cursor] || "_";
    updateKeys();
  }

  function nextHint() {
    const next = state.target[state.cursor];
    if (next === " ") return "Space";
    if (next === "\n") return "Return";
    return next ? `Next: ${next}` : "Complete";
  }

  function labelForPassage(set) {
    return set === "code" ? "Code-ish" : set[0].toUpperCase() + set.slice(1);
  }

  function updateHud() {
    const stats = currentStats();
    els.wpm.textContent = Math.round(stats.wpm);
    els.rawWpm.textContent = Math.round(stats.rawWpm);
    els.accuracyTop.textContent = `${Math.round(stats.accuracy * 100)}%`;
    els.timer.textContent = Math.ceil(state.timeLeft);
    els.streak.textContent = state.streak;
    els.errors.textContent = state.errors;
    els.bestWpm.textContent = state.stats.bestWpm || 0;
    els.rank.textContent = rankFor(stats.wpm);
  }

  function rankFor(wpm) {
    return ranks.reduce((label, rank) => (wpm >= rank[0] ? rank[1] : label), ranks[0][1]);
  }

  function updateKeys() {
    els.keys.forEach((key) => {
      key.classList.toggle("active", key.textContent === state.activeKey);
    });
  }

  function renderNotes() {
    const runs = state.stats.runs || [];
    if (!runs.length) {
      els.notesList.innerHTML = '<div class="note-item"><header><span>No runs yet</span><strong>Start typing</strong></header><div class="meter"><span style="width: 0%"></span></div></div>';
      return;
    }
    els.notesList.replaceChildren(...runs.slice(0, 4).map((run) => {
      const item = document.createElement("div");
      item.className = "note-item";
      const header = document.createElement("header");
      const label = document.createElement("span");
      label.textContent = `${modes[run.mode]?.label || "Run"} / ${labelForPassage(run.passageSet)}`;
      const score = document.createElement("strong");
      score.textContent = `${run.wpm} WPM`;
      const meter = document.createElement("div");
      const fill = document.createElement("span");
      meter.className = "meter";
      fill.style.width = `${Math.min(100, run.accuracy)}%`;
      header.append(label, score);
      meter.append(fill);
      item.append(header, meter);
      return item;
    }));
  }

  function drawRoom(dt) {
    const { w, h } = logicalSize();
    state.lampPhase += dt * 0.001;
    ctx.clearRect(0, 0, w, h);
    const wall = ctx.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, cssColor("--room-wall-top"));
    wall.addColorStop(0.66, cssColor("--room-wall-low"));
    wall.addColorStop(1, cssColor("--wood-dark"));
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);

    drawWindow(w, h);
    drawShelves(w, h);
    drawLamp(w, h);
    drawDesk(w, h);
    drawTypewriter(w, h);
    drawParticles(dt);
  }

  function drawWindow(w, h) {
    const x = w * 0.07;
    const y = h * 0.1;
    const ww = w * 0.2;
    const wh = h * 0.28;
    ctx.fillStyle = "rgba(58, 34, 71, 0.18)";
    ctx.fillRect(x - 8, y - 8, ww + 16, wh + 16);
    ctx.fillStyle = "rgba(253, 247, 246, 0.32)";
    ctx.fillRect(x, y, ww, wh);
    ctx.strokeStyle = "rgba(184, 147, 90, 0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, ww, wh);
    ctx.beginPath();
    ctx.moveTo(x + ww / 2, y);
    ctx.lineTo(x + ww / 2, y + wh);
    ctx.moveTo(x, y + wh / 2);
    ctx.lineTo(x + ww, y + wh / 2);
    ctx.stroke();
  }

  function drawShelves(w, h) {
    ctx.fillStyle = "rgba(101, 65, 51, 0.55)";
    ctx.fillRect(w * 0.69, h * 0.16, w * 0.2, 8);
    ctx.fillRect(w * 0.72, h * 0.29, w * 0.16, 8);
    const colors = [cssColor("--rose"), cssColor("--orchid"), cssColor("--champagne"), cssColor("--moss")];
    for (let i = 0; i < 11; i += 1) {
      ctx.fillStyle = colors[i % colors.length];
      const shelf = i < 6 ? 0 : 1;
      const x = w * (shelf ? 0.735 : 0.705) + (i % 6) * 18;
      const y = h * (shelf ? 0.235 : 0.105);
      ctx.fillRect(x, y, 12, h * 0.055);
    }
  }

  function drawLamp(w, h) {
    const x = w * 0.19;
    const y = h * 0.62;
    const glow = ctx.createRadialGradient(x, y - h * 0.2, 10, x, y - h * 0.16, h * (0.28 + Math.sin(state.lampPhase) * 0.01));
    glow.addColorStop(0, "rgba(255, 228, 170, 0.5)");
    glow.addColorStop(1, "rgba(255, 228, 170, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = cssColor("--champagne");
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.06, y - h * 0.22);
    ctx.lineTo(x + w * 0.12, y - h * 0.14);
    ctx.stroke();
    ctx.fillStyle = cssColor("--lamp");
    ctx.beginPath();
    ctx.ellipse(x + w * 0.13, y - h * 0.14, w * 0.055, h * 0.045, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDesk(w, h) {
    const deskY = h * 0.72;
    const wood = ctx.createLinearGradient(0, deskY, 0, h);
    wood.addColorStop(0, cssColor("--wood"));
    wood.addColorStop(1, cssColor("--wood-dark"));
    ctx.fillStyle = wood;
    ctx.fillRect(0, deskY, w, h - deskY);
    ctx.fillStyle = "rgba(253, 247, 246, 0.12)";
    for (let i = 0; i < 8; i += 1) {
      ctx.fillRect(i * w * 0.15 - 30, deskY + 24 + Math.sin(i) * 8, w * 0.12, 2);
    }
  }

  function drawTypewriter(w, h) {
    const x = w * 0.5;
    const y = h * 0.73;
    const progress = state.target ? state.cursor / state.target.length : 0;
    const carriage = (progress - 0.5) * w * 0.15;
    ctx.fillStyle = "rgba(58, 34, 71, 0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.08, w * 0.24, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cssColor("--ink");
    roundRect(x - w * 0.18, y - h * 0.04, w * 0.36, h * 0.13, 10);
    ctx.fill();
    ctx.fillStyle = cssColor("--panel-2");
    roundRect(x - w * 0.12 + carriage, y - h * 0.1, w * 0.24, h * 0.045, 5);
    ctx.fill();
    ctx.fillStyle = cssColor("--rose");
    roundRect(x - w * 0.11, y + h * 0.005, w * 0.22, h * 0.016, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(253, 247, 246, 0.72)";
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 10 - row; col += 1) {
        ctx.beginPath();
        ctx.arc(x - w * 0.115 + col * w * 0.026 + row * w * 0.012, y + h * (0.04 + row * 0.022), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    state.strikes.forEach((strike) => {
      ctx.globalAlpha = Math.max(0, 1 - strike.age / 260);
      ctx.strokeStyle = strike.correct ? cssColor("--champagne") : cssColor("--error");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.035);
      ctx.lineTo(strike.x, strike.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  function drawParticles(dt) {
    state.strikes.forEach((strike) => {
      strike.age += dt;
    });
    state.strikes = state.strikes.filter((strike) => strike.age < 260);
    state.dust.forEach((dot) => {
      dot.age += dt;
      dot.x += dot.vx * dt / 1000;
      dot.y += dot.vy * dt / 1000;
      dot.vy += 30 * dt / 1000;
      ctx.globalAlpha = Math.max(0, 1 - dot.age / 600);
      ctx.fillStyle = cssColor("--champagne");
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    state.dust = state.dust.filter((dot) => dot.age < 600);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function loop(now) {
    const dt = Math.min(50, now - state.lastFrame);
    state.lastFrame = now;
    if (state.running && !state.paused) {
      state.elapsedMs += dt;
      state.timeLeft = Math.max(0, state.duration - state.elapsedMs / 1000);
      if (state.timeLeft <= 0) finishRun();
      updateHud();
    }
    drawRoom(dt);
    if (state.running && !state.paused) requestAnimationFrame(loop);
  }

  function setActive(buttons, clicked) {
    buttons.forEach((button) => button.classList.toggle("active", button === clicked));
  }

  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActive(els.modeButtons, button);
      const mode = modes[button.dataset.mode];
      setOverlay(true, mode.readyTitle, mode.readyText);
    });
  });
  els.durationButtons.forEach((button) => {
    button.addEventListener("click", () => setActive(els.durationButtons, button));
  });
  els.passageButtons.forEach((button) => {
    button.addEventListener("click", () => setActive(els.passageButtons, button));
  });
  els.start.addEventListener("click", () => startRun(false));
  els.restart.addEventListener("click", () => startRun(false));
  els.daily.addEventListener("click", () => startRun(true));
  els.pause.addEventListener("click", togglePause);
  els.resetStats.addEventListener("click", () => {
    state.stats = { bestWpm: 0, runs: [] };
    saveStats();
    renderNotes();
    updateHud();
  });
  window.addEventListener("keydown", handleInput);
  window.addEventListener("resize", resizeCanvas);

  state.target = passages.literary[0];
  renderPassage();
  renderNotes();
  updateHud();
  resizeCanvas();
  setOverlay(true, modes.sprint.readyTitle, modes.sprint.readyText);
}());
