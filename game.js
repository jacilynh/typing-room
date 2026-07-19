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
    roomLevel: document.getElementById("roomLevel"),
    roomPoints: document.getElementById("roomPoints"),
    roomMeter: document.getElementById("roomMeter"),
    unlockList: document.getElementById("unlockList"),
    questReward: document.getElementById("questReward"),
    questText: document.getElementById("questText"),
    finishedPage: document.getElementById("finishedPage"),
    finishedStamp: document.getElementById("finishedStamp"),
    finishedStats: document.getElementById("finishedStats"),
    finishedText: document.getElementById("finishedText"),
    downloadPage: document.getElementById("downloadPage"),
    nextQuest: document.getElementById("nextQuestButton"),
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
    correspondence: {
      label: "Correspondence",
      readyTitle: "Send a note from the desk",
      readyText: "Type a small letter cleanly enough to seal it, stamp it, and add it to the stack."
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
    letters: [
      "Dear friend,\n\nThe lamp is on, the rain is polite, and I am sending this small proof that practice can feel like a room instead of a chore.\n\nWarmly,",
      "Postcard from the desk:\n\nToday I learned that a sentence typed carefully has its own weather. The keys made a little music. I stayed for one more page.",
      "Dear future self,\n\nKeep the good tools close. Keep the window cracked. Keep typing until the line begins to trust you."
    ],
    code: [
      "const words = draft.trim().split(/\\s+/); return words.filter(Boolean).length;",
      "function measureAccuracy(input, target) { return input.length ? correct / input.length : 1; }",
      "await buildRoom({ mode: 'typewriter', sound: true, paper: 'warm', focus: 'accuracy' });"
    ]
  };
  const unlocks = [
    [0, "Lamp lit"],
    [90, "Window plant"],
    [210, "Porcelain teacup"],
    [380, "Framed print"],
    [620, "Brass letter opener"]
  ];
  const quests = [
    {
      label: "Finish one page.",
      reward: 20,
      test: (run) => run.finished
    },
    {
      label: "Keep accuracy at 96% or better.",
      reward: 35,
      test: (run) => run.accuracy >= 96
    },
    {
      label: "Type a Correspondence page.",
      reward: 30,
      test: (run) => run.mode === "correspondence"
    },
    {
      label: "Finish with fewer than three errors.",
      reward: 35,
      test: (run) => run.errors < 3
    },
    {
      label: "Reach a 30-character streak.",
      reward: 40,
      test: (run) => run.bestStreak >= 30
    }
  ];
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
      const saved = JSON.parse(localStorage.getItem(storeKey)) || {};
      return {
        bestWpm: saved.bestWpm || 0,
        runs: saved.runs || [],
        points: saved.points || 0,
        questIndex: saved.questIndex || 0,
        pages: saved.pages || 0
      };
    } catch {
      return { bestWpm: 0, runs: [], points: 0, questIndex: 0, pages: 0 };
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
    const mode = selectedMode();
    const set = mode === "correspondence" ? "letters" : selectedPassageSet();
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
    state.passageSet = state.mode === "correspondence" ? "letters" : selectedPassageSet();
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
    els.finishedPage.classList.add("hidden");
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
    const run = {
      date: new Date().toISOString(),
      mode: state.mode,
      passageSet: state.passageSet,
      wpm: Math.round(stats.wpm),
      accuracy: Math.round(stats.accuracy * 1000) / 10,
      errors: state.errors,
      bestStreak: state.bestStreak,
      finished: state.cursor >= state.target.length
    };
    const quest = currentQuest();
    const questComplete = quest.test(run);
    const basePoints = Math.max(8, Math.round(run.wpm / 3)) + Math.round(run.accuracy / 6);
    const earned = basePoints + (questComplete ? quest.reward : 0);
    state.stats.bestWpm = Math.max(state.stats.bestWpm || 0, Math.round(stats.wpm));
    state.stats.pages = (state.stats.pages || 0) + 1;
    state.stats.points = (state.stats.points || 0) + earned;
    if (questComplete) state.stats.questIndex = ((state.stats.questIndex || 0) + 1) % quests.length;
    state.stats.runs = [run, ...(state.stats.runs || [])].slice(0, 5);
    saveStats();
    updateHud();
    renderNotes();
    renderRoomProgress();
    renderFinishedPage(run, earned, questComplete);
    setOverlay(
      true,
      `${Math.round(stats.wpm)} WPM at ${Math.round(stats.accuracy * 100)}%`,
      `${questComplete ? "Quest complete. " : ""}+${earned} desk points. The finished page is waiting below the keyboard.`,
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
      if (event.key === " " && !state.finished) {
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
    if (set === "letters") return "Letters";
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
    renderRoomProgress();
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

  function currentQuest() {
    return quests[state.stats.questIndex % quests.length];
  }

  function roomLevel() {
    const points = state.stats.points || 0;
    return unlocks.reduce((level, unlock, index) => (points >= unlock[0] ? index + 1 : level), 1);
  }

  function nextUnlock() {
    const points = state.stats.points || 0;
    return unlocks.find((unlock) => unlock[0] > points);
  }

  function renderRoomProgress() {
    const points = state.stats.points || 0;
    const level = roomLevel();
    const upcoming = nextUnlock();
    const previousThreshold = unlocks[level - 1]?.[0] || 0;
    const nextThreshold = upcoming?.[0] || Math.max(points, previousThreshold + 1);
    const span = Math.max(1, nextThreshold - previousThreshold);
    const progress = upcoming ? ((points - previousThreshold) / span) * 100 : 100;
    const quest = currentQuest();

    els.roomLevel.textContent = `Level ${level}`;
    els.roomPoints.textContent = upcoming
      ? `${points} desk points · ${nextThreshold - points} to ${upcoming[1]}`
      : `${points} desk points · room complete`;
    els.roomMeter.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    els.questText.textContent = quest.label;
    els.questReward.textContent = `+${quest.reward}`;
    els.unlockList.replaceChildren(...unlocks.map(([threshold, label]) => {
      const item = document.createElement("div");
      item.className = "unlock-item";
      const name = document.createElement("span");
      name.textContent = label;
      const status = document.createElement("strong");
      status.textContent = points >= threshold ? "Unlocked" : `${threshold}`;
      item.append(name, status);
      return item;
    }));
  }

  function renderFinishedPage(run, earned, questComplete) {
    els.finishedPage.classList.remove("hidden");
    els.finishedStamp.textContent = questComplete ? "Quest complete" : "Finished page";
    els.finishedStats.textContent = `${run.wpm} WPM · ${run.accuracy}% · +${earned}`;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < state.target.length; i += 1) {
      const span = document.createElement("span");
      span.textContent = state.typed[i] || state.target[i];
      if (state.typed[i] !== undefined && state.typed[i] !== state.target[i]) {
        span.className = "wrong-mark";
      }
      frag.append(span);
    }
    els.finishedText.replaceChildren(frag);
  }

  function downloadFinishedPage() {
    const stats = currentStats();
    const exportCanvas = document.createElement("canvas");
    const ratio = 2;
    exportCanvas.width = 1200 * ratio;
    exportCanvas.height = 1500 * ratio;
    const out = exportCanvas.getContext("2d");
    out.scale(ratio, ratio);
    out.fillStyle = "#fffaf4";
    out.fillRect(0, 0, 1200, 1500);
    out.fillStyle = "rgba(184, 147, 90, 0.16)";
    for (let y = 170; y < 1320; y += 44) out.fillRect(120, y, 960, 1);
    out.fillStyle = "#b8935a";
    out.font = "22px Georgia";
    out.fillText("The Typing Room", 120, 110);
    out.font = "18px Courier New";
    out.fillText(`${Math.round(stats.wpm)} WPM · ${Math.round(stats.accuracy * 100)}% · ${state.errors} errors`, 120, 145);
    out.fillStyle = "#33223d";
    out.font = "28px Courier New";
    wrapCanvasText(out, state.typed || state.target, 120, 230, 960, 44);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.download = `typing-room-${date}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }

  function wrapCanvasText(out, text, x, y, maxWidth, lineHeight) {
    const paragraphs = text.split("\n");
    let currentY = y;
    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(" ");
      let line = "";
      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (out.measureText(test).width > maxWidth && line) {
          out.fillText(line, x, currentY);
          currentY += lineHeight;
          line = word;
        } else {
          line = test;
        }
      });
      out.fillText(line, x, currentY);
      currentY += lineHeight * 1.3;
    });
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
    drawUnlocks(w, h);
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

  function hasUnlock(label) {
    const found = unlocks.find((unlock) => unlock[1] === label);
    return found ? (state.stats.points || 0) >= found[0] : false;
  }

  function drawUnlocks(w, h) {
    const deskY = h * 0.72;
    if (hasUnlock("Window plant")) {
      ctx.fillStyle = cssColor("--moss");
      ctx.beginPath();
      ctx.ellipse(w * 0.83, deskY - h * 0.055, w * 0.028, h * 0.08, -0.6, 0, Math.PI * 2);
      ctx.ellipse(w * 0.87, deskY - h * 0.055, w * 0.028, h * 0.08, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cssColor("--champagne");
      roundRect(w * 0.825, deskY - h * 0.025, w * 0.065, h * 0.06, 5);
      ctx.fill();
    }
    if (hasUnlock("Porcelain teacup")) {
      ctx.strokeStyle = "rgba(253, 247, 246, 0.7)";
      ctx.lineWidth = 3;
      ctx.fillStyle = "rgba(253, 247, 246, 0.82)";
      roundRect(w * 0.08, deskY - h * 0.005, w * 0.07, h * 0.045, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.15, deskY + h * 0.017, 10, -1.2, 1.2);
      ctx.stroke();
    }
    if (hasUnlock("Framed print")) {
      ctx.fillStyle = "rgba(253, 247, 246, 0.14)";
      ctx.strokeStyle = "rgba(184, 147, 90, 0.55)";
      ctx.lineWidth = 2;
      ctx.fillRect(w * 0.39, h * 0.1, w * 0.14, h * 0.16);
      ctx.strokeRect(w * 0.39, h * 0.1, w * 0.14, h * 0.16);
      ctx.beginPath();
      ctx.moveTo(w * 0.415, h * 0.215);
      ctx.lineTo(w * 0.455, h * 0.155);
      ctx.lineTo(w * 0.49, h * 0.205);
      ctx.stroke();
    }
    if (hasUnlock("Brass letter opener")) {
      ctx.strokeStyle = cssColor("--champagne");
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.67, deskY + h * 0.08);
      ctx.lineTo(w * 0.78, deskY + h * 0.035);
      ctx.stroke();
      ctx.fillStyle = cssColor("--champagne");
      ctx.beginPath();
      ctx.arc(w * 0.665, deskY + h * 0.082, 5, 0, Math.PI * 2);
      ctx.fill();
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
      if (button.dataset.mode === "correspondence") {
        const letters = els.passageButtons.find((passageButton) => passageButton.dataset.passage === "letters");
        if (letters) setActive(els.passageButtons, letters);
      }
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
  els.downloadPage.addEventListener("click", downloadFinishedPage);
  els.nextQuest.addEventListener("click", () => startRun(false));
  els.resetStats.addEventListener("click", () => {
    state.stats = { bestWpm: 0, runs: [], points: 0, questIndex: 0, pages: 0 };
    saveStats();
    renderNotes();
    renderRoomProgress();
    updateHud();
  });
  window.addEventListener("keydown", handleInput);
  window.addEventListener("resize", resizeCanvas);

  state.target = passages.literary[0];
  renderPassage();
  renderNotes();
  renderRoomProgress();
  updateHud();
  resizeCanvas();
  setOverlay(true, modes.sprint.readyTitle, modes.sprint.readyText);
}());
