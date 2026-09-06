(function () {
  "use strict";

  const STORAGE_NAME = "rsr_player_name";
  const DEVICE_KEY = "rsr_device_id";
  const MAX_BOARD_ENTRIES = 10;
  const DEPLOYED_URL = "https://reaction-speed-roulette.vercel.app/";

  // ---- elements ----
  const nameGate = document.getElementById("name-gate");
  const nameInput = document.getElementById("name-input");
  const nameSubmit = document.getElementById("name-submit");
  const nameError = document.getElementById("name-error");

  const app = document.getElementById("app");
  const playerNameEl = document.getElementById("player-name");

  const stage = document.getElementById("stage");
  const stageText = document.getElementById("stage-text");
  const stageSub = document.getElementById("stage-sub");
  const resultShare = document.getElementById("result-share");
  const resultNote = document.getElementById("result-note");

  const statLast = document.getElementById("stat-last");
  const statBest = document.getElementById("stat-best");
  const statRounds = document.getElementById("stat-rounds");

  const boardToggle = document.getElementById("board-toggle");
  const boardOverlay = document.getElementById("leaderboard");
  const boardClose = document.getElementById("board-close");
  const boardList = document.getElementById("board-list");
  const boardStatus = document.getElementById("board-status");
  const boardTweet = document.getElementById("board-tweet");
  const boardExpand = document.getElementById("board-expand");

  // ---- game state ----
  let playerName = "";
  let gameState = "idle"; // idle | waiting | ready | early
  let armTimer = null;
  let readyAt = 0;
  let sessionBest = null;
  let rounds = 0;
  let boardExpanded = false;

  // ---- supabase client ----
  const cfg = window.RSR_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    cfg.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

  let supabase = null;
  if (configured) {
    if (window.supabase) {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } else {
      console.warn("Supabase JS SDK not loaded (CDN blocked?). Falling back to local.");
    }
  } else {
    console.warn("Supabase not configured. Falling back to local.");
  }

  // ---- leaderboard: shared (Supabase) with localStorage fallback ----
  const LOCAL_KEY = "rsr_leaderboard_local";

  function loadLocalBoard() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalBoard(entries) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  const deviceId = getDeviceId();

  function vibrate(pattern) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_) { }
    }
  }

  function tweetHref(text) {
    return (
      "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) +
      "&url=" + encodeURIComponent(DEPLOYED_URL)
    );
  }

  function shareText(ms, isBest) {
    if (isBest) {
      return "New personal best: " + ms + "ms on Reaction Speed Roulette. Beat it.";
    }
    return "I scored " + ms + "ms on Reaction Speed Roulette. Think you can beat me?";
  }

  async function submitScore(name, ms) {
    if (supabase) {
      const { error } = await supabase.from("scores").insert({ name, ms });
      if (error) {
        console.error("Supabase insert failed:", error.message);
        resultNote.textContent = "couldn't save your score — check your connection.";
        return false;
      }
      resultNote.textContent = "";
      return true;
    }
    const entries = loadLocalBoard();
    const existing = entries.find((e) => e.name === name);
    if (existing) {
      if (ms < existing.ms) existing.ms = ms;
    } else {
      entries.push({ name, ms });
    }
    entries.sort((a, b) => a.ms - b.ms);
    saveLocalBoard(entries.slice(0, MAX_BOARD_ENTRIES));
    resultNote.textContent = "";
    return true;
  }

  async function fetchBoard() {
    // Aggregates each player's best score client-side, then returns the list
    // sorted ascending by best time. We always fetch the full set so the
    // top-10 view isn't skewed by a player's worse attempts crowding out the
    // first rows; the expanded view is the same data without the cap.
    async function query() {
      return await supabase
        .from("scores")
        .select("name, ms")
        .order("ms", { ascending: true });
    }

    function aggregate(data) {
      const bestByName = new Map();
      for (const row of data) {
        const current = bestByName.get(row.name);
        if (current === undefined || row.ms < current) bestByName.set(row.name, row.ms);
      }
      return Array.from(bestByName, ([name, ms]) => ({ name, ms }))
        .sort((a, b) => a.ms - b.ms);
    }

    if (supabase) {
      const { data, error } = await query();
      if (error) {
        console.error("Supabase fetch failed:", error.message);
        return { entries: [], mode: "error" };
      }
      let entries = aggregate(data);
      if (!boardExpanded) entries = entries.slice(0, MAX_BOARD_ENTRIES);
      return { entries, mode: "shared" };
    }
    return { entries: loadLocalBoard(), mode: "local" };
  }

  async function renderBoard() {
    boardList.innerHTML = '<li class="board-empty">loading...</li>';
    boardStatus.textContent = "";
    const { entries, mode } = await fetchBoard();

    if (mode === "error") {
      boardStatus.textContent = "couldn't reach the leaderboard right now.";
    }

    boardList.innerHTML = "";
    if (entries.length === 0) {
      boardList.innerHTML = '<li class="board-empty">no scores yet. be the first.</li>';
      return;
    }
    entries.forEach((entry, i) => {
      const li = document.createElement("li");
      li.className = "board-row";
      li.innerHTML =
        '<span class="board-rank">' + (i + 1) + '</span>' +
        '<span class="board-name"></span>' +
        '<span class="board-time">' + entry.ms + 'ms</span>';
      li.querySelector(".board-name").textContent = entry.name;
      boardList.appendChild(li);
    });

    const mine = entries.find((e) => e.name === playerName);
    if (mine) {
      boardTweet.href = tweetHref(
        "I scored " + mine.ms + "ms on Reaction Speed Roulette. Think you can beat me?"
      );
      boardTweet.classList.remove("hidden");
    } else {
      boardTweet.classList.add("hidden");
    }
  }

  // ---- name gate ----
  async function loadPersonalBest(name) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("scores")
      .select("ms")
      .eq("name", name)
      .order("ms", { ascending: true })
      .limit(1);
    if (error) return;
    if (data && data.length > 0) {
      sessionBest = data[0].ms;
      statBest.textContent = sessionBest + "ms";
    }
  }

  function showApp(name) {
    playerName = name;
    playerNameEl.textContent = name;
    nameGate.classList.add("hidden");
    app.classList.remove("hidden");
    loadPersonalBest(name);
  }

  async function claimName(value) {
    const lower = value.toLowerCase();
    if (!supabase) return { ok: true };

    const { data, error } = await supabase
      .from("players")
      .select("name, device_id")
      .eq("name_lower", lower)
      .limit(1);
    if (error) {
      console.error("players lookup failed:", error.message);
      return { ok: false, error: true };
    }

    if (data && data.length > 0) {
      const existing = data[0];
      if (existing.device_id === deviceId) {
        return { ok: true, canonicalName: existing.name };
      }
      if (existing.device_id === null) {
        const { data: updated, error: updateError } = await supabase
          .from("players")
          .update({ device_id: deviceId })
          .eq("name_lower", lower)
          .is("device_id", null)
          .select("name");
        if (updateError) {
          console.error("players claim failed:", updateError.message);
          return { ok: false, error: true };
        }
        if (updated && updated.length > 0) {
          return { ok: true, canonicalName: updated[0].name };
        }
        return { ok: false, taken: true };
      }
      return { ok: false, taken: true };
    }

    const { error: insertError } = await supabase
      .from("players")
      .insert({ name: value, name_lower: lower, device_id: deviceId });
    if (insertError) {
      if (String(insertError.code) === "23505") {
        return { ok: false, taken: true };
      }
      console.error("players insert failed:", insertError.message);
      return { ok: false, error: true };
    }
    return { ok: true, canonicalName: value };
  }

  function handleNameSubmit() {
    const value = nameInput.value.trim();
    if (!value) {
      nameError.textContent = "enter a name to continue.";
      return;
    }
    if (value.length > 18) {
      nameError.textContent = "keep it under 18 characters.";
      return;
    }
    claimName(value).then((res) => {
      if (res.ok) {
        const name = res.canonicalName || value;
        nameError.textContent = "";
        localStorage.setItem(STORAGE_NAME, name);
        showApp(name);
        return;
      }
      nameError.textContent = res.taken
        ? "That name is taken — try another."
        : "couldn't check that name — try again.";
    });
  }

  nameSubmit.addEventListener("click", handleNameSubmit);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleNameSubmit();
  });

  const savedName = localStorage.getItem(STORAGE_NAME);
  if (savedName) {
    showApp(savedName);
  } else {
    nameInput.focus();
  }

  // ---- stage rendering ----
  function setStage(mode, title, sub) {
    stage.className = "stage stage--" + mode;
    stageText.textContent = title;
    stageSub.textContent = sub;
  }

  function armRound() {
    gameState = "waiting";
    resultShare.classList.add("hidden");
    resultNote.textContent = "";
    setStage("wait", "wait for it...", "don't tap yet");
    const delay = 800 + Math.random() * 2500;
    armTimer = setTimeout(() => {
      gameState = "ready";
      readyAt = performance.now();
      setStage("go", "tap now", "");
    }, delay);
  }

  async function registerHit() {
    const ms = Math.round(performance.now() - readyAt);
    const isBest = sessionBest === null || ms < sessionBest;
    rounds += 1;
    statRounds.textContent = rounds;
    statLast.textContent = ms + "ms";

    if (isBest) {
      sessionBest = ms;
      statBest.textContent = sessionBest + "ms";
      vibrate([40, 60, 40]);
      setStage("best", ms + "ms — new personal best", "tap to go again");
    } else {
      vibrate(25);
      setStage("idle", ms + "ms — tap to go again", "can you beat that?");
    }

    resultShare.href = tweetHref(shareText(ms, isBest));
    resultShare.classList.remove("hidden");

    gameState = "idle";
    await submitScore(playerName, ms);
  }

  function registerEarlyTap() {
    clearTimeout(armTimer);
    gameState = "idle";
    resultShare.classList.add("hidden");
    setStage("early", "too soon", "tap to try again");
  }

  function stageAction() {
    if (gameState === "idle") {
      armRound();
    } else if (gameState === "waiting") {
      registerEarlyTap();
    } else if (gameState === "ready") {
      registerHit();
    }
  }

  stage.addEventListener("click", stageAction);

  document.addEventListener("keydown", (e) => {
    if (nameGate.classList.contains("hidden") === false) return;
    if (e.key === " " || e.key === "Enter") {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
      e.preventDefault();
      stageAction();
    }
  });

  resultShare.addEventListener("click", (e) => e.stopPropagation());

  // ---- leaderboard overlay ----
  boardToggle.addEventListener("click", () => {
    boardOverlay.classList.remove("hidden");
    boardExpanded = false;
    boardExpand.textContent = "show all";
    renderBoard();
  });

  boardExpand.addEventListener("click", () => {
    boardExpanded = !boardExpanded;
    boardExpand.textContent = boardExpanded ? "top 10" : "show all";
    renderBoard();
  });

  boardClose.addEventListener("click", () => {
    boardOverlay.classList.add("hidden");
  });

  boardOverlay.addEventListener("click", (e) => {
    if (e.target === boardOverlay) boardOverlay.classList.add("hidden");
  });
})();
