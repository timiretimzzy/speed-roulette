(function () {
  "use strict";

  const STORAGE_NAME = "rsr_player_name";
  const DEVICE_KEY = "rsr_device_id";
  const GAME_KEY = "rsr_gamification_v1";
  const MAX_BOARD_ENTRIES = 30;
  const DEPLOYED_URL = "https://reaction-speed-roulette.vercel.app/";

  // ---- elements (all original IDs preserved) ----
  const nameGate = document.getElementById("name-gate");
  const nameInput = document.getElementById("name-input");
  const nameSubmit = document.getElementById("name-submit");
  const nameError = document.getElementById("name-error");
  const nameAvatar = document.getElementById("name-avatar");

  const app = document.getElementById("app");
  const playerNameEl = document.getElementById("player-name");
  const playerAvatarMain = document.getElementById("player-avatar-main");

  const stage = document.getElementById("stage");
  const stageText = document.getElementById("stage-text");
  const stageSub = document.getElementById("stage-sub");
  const stageIcon = document.getElementById("stage-icon");
  const stageTier = document.getElementById("stage-tier");
  const resultShare = document.getElementById("result-share");
  const resultNote = document.getElementById("result-note");
  const flash = document.getElementById("flash");
  const confettiCanvas = document.getElementById("confetti");

  const statLast = document.getElementById("stat-last");
  const statBest = document.getElementById("stat-best");
  const statRounds = document.getElementById("stat-rounds");
  const trendLast = document.getElementById("trend-last");
  const bestCrown = document.getElementById("best-crown");

  const boardToggle = document.getElementById("board-toggle");
  const boardOverlay = document.getElementById("leaderboard");
  const boardClose = document.getElementById("board-close");
  const boardList = document.getElementById("board-list");
  const boardStatus = document.getElementById("board-status");
  const boardTweet = document.getElementById("board-tweet");
  const boardExpand = document.getElementById("board-expand");

  // ---- gamification elements ----
  const levelLabel = document.getElementById("level-label");
  const xpFill = document.getElementById("xp-fill");
  const xpLabel = document.getElementById("xp-label");
  const onlineCount = document.getElementById("online-count");
  const streakPill = document.getElementById("streak-pill");
  const streakCount = document.getElementById("streak-count");
  const challengePill = document.getElementById("challenge-pill");
  const challengeText = document.getElementById("challenge-text");
  const challengeProgress = document.getElementById("challenge-progress");
  const ticker = document.getElementById("ticker");
  const toasts = document.getElementById("toasts");
  const activityFeed = document.getElementById("activity-feed");

  // ---- game state ----
  let playerName = "";
  let gameState = "idle"; // idle | waiting | ready
  let armTimer = null;
  let readyAt = 0;
  let sessionBest = null;
  let rounds = 0;
  let lastMs = null;
  let boardExpanded = false;
  let lastRank = null;

  // ---- gamification state (localStorage) ----
  let game = loadGame();
  function loadGame() {
    try {
      const raw = localStorage.getItem(GAME_KEY);
      if (raw) return Object.assign(defaultGame(), JSON.parse(raw));
    } catch (_) {}
    return defaultGame();
  }
  function defaultGame() {
    return { xp: 0, streak: 0, bestStreak: 0, history: [], achievements: {}, challenge: dailyChallenge(), totalHits: 0 };
  }
  function saveGame() { try { localStorage.setItem(GAME_KEY, JSON.stringify(game)); } catch (_) {} }
  function dailyChallenge() {
    const day = new Date().toISOString().slice(0, 10);
    const seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
    const goals = [
      { id: "sub300x3", label: "3× sub-300ms", target: 300, count: 3 },
      { id: "sub250x2", label: "2× sub-250ms", target: 250, count: 2 },
      { id: "sub350x5", label: "5× sub-350ms", target: 350, count: 5 },
      { id: "rounds10", label: "play 10 rounds", target: 9999, count: 10 },
    ];
    const g = goals[seed % goals.length];
    return { day, ...g, progress: 0, done: false };
  }
  function ensureChallengeFresh() {
    const today = new Date().toISOString().slice(0, 10);
    if (game.challenge.day !== today) { game.challenge = dailyChallenge(); saveGame(); }
  }

  // ---- supabase ----
  const cfg = window.RSR_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL !== "YOUR_SUPABASE_URL" && cfg.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  let supabase = null;
  if (configured) {
    if (window.supabase) supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    else console.warn("Supabase JS SDK not loaded. Falling back to local.");
  }

  const LOCAL_KEY = "rsr_leaderboard_local";
  function loadLocalBoard() { try { const r = localStorage.getItem(LOCAL_KEY); return r ? JSON.parse(r) : []; } catch (_) { return []; } }
  function saveLocalBoard(e) { localStorage.setItem(LOCAL_KEY, JSON.stringify(e)); }
  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  }
  const deviceId = getDeviceId();

  function vibrate(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (_) {} } }
  function tweetHref(t) { return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(t) + "&url=" + encodeURIComponent(DEPLOYED_URL); }
  function shareText(ms, isBest) {
    return isBest ? "New personal best: " + ms + "ms on Reaction Speed Roulette. Beat it."
      : "I scored " + ms + "ms on Reaction Speed Roulette. Think you can beat me?";
  }

  // ---- helpers: avatar, tier, toast, confetti ----
  const AVATAR_GRADS = [
    "linear-gradient(135deg,#ffd75c,#ff5cd0)", "linear-gradient(135deg,#37e08c,#7f77dd)",
    "linear-gradient(135deg,#7f77dd,#ff5c5c)", "linear-gradient(135deg,#5cc8ff,#37e08c)",
    "linear-gradient(135deg,#ff9d5c,#ff5c5c)", "linear-gradient(135deg,#b28cff,#5cc8ff)",
  ];
  function avatarFor(name) {
    const ch = (name || "?").trim().charAt(0).toUpperCase() || "?";
    const idx = [...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADS.length;
    return { ch, bg: AVATAR_GRADS[idx] };
  }
  function paintAvatars() {
    const a = avatarFor(playerName || nameInput.value || "?");
    if (nameAvatar) { nameAvatar.textContent = a.ch; nameAvatar.style.background = a.bg; }
    if (playerAvatarMain) { playerAvatarMain.textContent = avatarFor(playerName).ch; playerAvatarMain.style.background = avatarFor(playerName).bg; }
  }

  function tierFor(ms) {
    if (ms < 200) return { label: "⚡ godlike", cls: "tier--god" };
    if (ms < 250) return { label: "🔥 elite", cls: "tier--elite" };
    if (ms < 350) return { label: "✦ solid", cls: "tier--solid" };
    return { label: "keep pushing", cls: "tier--meh" };
  }
  function showTier(ms) {
    if (!stageTier) return;
    const t = tierFor(ms);
    stageTier.className = "tier " + t.cls;
    stageTier.textContent = t.label + " · " + ms + "ms";
  }
  function hideTier() { if (stageTier) stageTier.className = "tier hidden"; }

  function toast(msg, ico, cls) {
    if (!toasts) return;
    const el = document.createElement("div");
    el.className = "toast " + (cls || "");
    el.innerHTML = '<span class="toast-ico"></span><span class="toast-msg"></span>';
    el.querySelector(".toast-ico").textContent = ico || "✦";
    el.querySelector(".toast-msg").textContent = msg;
    toasts.appendChild(el);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 2600);
  }

  function doFlash() {
    if (!flash) return;
    flash.classList.add("on");
    setTimeout(() => flash.classList.remove("on"), 90);
  }

  const confettiPieces = [];
  function fireConfetti(n) {
    if (!confettiCanvas) return;
    const ctx = confettiCanvas.getContext("2d");
    confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight;
    const colors = ["#37e08c", "#ffd75c", "#ff5cd0", "#8b84ff", "#5cc8ff", "#ffffff"];
    for (let i = 0; i < (n || 80); i++) {
      confettiPieces.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.4, vx: (Math.random() - 0.5) * 11, vy: Math.random() * -9 - 2, s: Math.random() * 7 + 3, c: colors[i % colors.length], r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, life: 90 + Math.random() * 40 });
    }
    if (!fireConfetti.running) { fireConfetti.running = true; requestAnimationFrame(tickConfetti); }
    function tickConfetti() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      for (let i = confettiPieces.length - 1; i >= 0; i--) {
        const p = confettiPieces[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.r += p.vr; p.life--;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.life / 100); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
        if (p.life <= 0 || p.y > innerHeight + 20) confettiPieces.splice(i, 1);
      }
      if (confettiPieces.length) requestAnimationFrame(tickConfetti);
      else { fireConfetti.running = false; ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
    }
  }

  function countUp(el, from, to, ms) {
    const dur = 450, t0 = performance.now();
    el.classList.add("counting");
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e) + "ms";
      if (k < 1) requestAnimationFrame(step); else el.classList.remove("counting");
    })(t0);
  }

  // ---- gamification: XP / levels / streaks / achievements ----
  function levelFor(xp) { return Math.floor(Math.sqrt(xp / 100)) + 1; }
  function xpForLevel(lvl) { return Math.pow(lvl - 1, 2) * 100; }
  function xpGain(ms) {
    if (ms < 200) return 60;
    if (ms < 250) return 40;
    if (ms < 300) return 25;
    if (ms < 400) return 12;
    return 6;
  }
  function renderGame() {
    ensureChallengeFresh();
    const lvl = levelFor(game.xp);
    const cur = xpForLevel(lvl), next = xpForLevel(lvl + 1);
    const pct = Math.min(100, ((game.xp - cur) / Math.max(1, next - cur)) * 100);
    if (levelLabel) levelLabel.textContent = "LVL " + lvl;
    if (xpFill) xpFill.style.width = pct + "%";
    if (xpLabel) xpLabel.textContent = game.xp + " XP";
    if (streakCount) streakCount.textContent = game.streak;
    if (streakPill) streakPill.classList.toggle("hot", game.streak >= 3);
    if (challengeText) challengeText.textContent = game.challenge.label;
    if (challengeProgress) challengeProgress.textContent = game.challenge.done ? "done ✓" : Math.min(game.challenge.progress, game.challenge.count) + "/" + game.challenge.count;
    if (challengePill) challengePill.classList.toggle("done", !!game.challenge.done);
  }
  function unlock(id, msg, ico) {
    if (game.achievements[id]) return;
    game.achievements[id] = Date.now();
    toast(msg, ico || "🏅", "");
    vibrate([30, 50, 30]);
  }
  function applyGamification(ms, isBest) {
    const beforeLvl = levelFor(game.xp);
    game.xp += xpGain(ms);
    game.totalHits++;
    const afterLvl = levelFor(game.xp);
    // streak = consecutive sub-350 hits
    if (ms < 350) { game.streak++; game.bestStreak = Math.max(game.bestStreak, game.streak); }
    else game.streak = 0;
    // challenge
    const ch = game.challenge;
    if (!ch.done) {
      if (ch.id === "rounds10") ch.progress++;
      else if (ms <= ch.target) ch.progress++;
      if (ch.progress >= ch.count) { ch.done = true; game.xp += 50; toast("Daily complete! +50 XP 🎯", "🎯", ""); fireConfetti(50); }
    }
    saveGame(); renderGame();
    if (afterLvl > beforeLvl) { toast("Level up! You are now LVL " + afterLvl, "⚡", "toast--xp"); fireConfetti(110); }
    else if (isBest) toast("+" + xpGain(ms) + " XP", "✦", "toast--xp");
    if (game.streak === 3) toast("3-hit streak! You're on fire 🔥", "🔥", "toast--streak");
    if (game.streak === 5) unlock("streak5", "Achievement: 5 streak! 🔥");
    if (game.streak === 10) unlock("streak10", "Achievement: 10 streak — unstoppable! 🔥");
    if (ms < 200) unlock("sub200", "Achievement: sub-200ms — godlike! ⚡");
    else if (ms < 250 && game.totalHits >= 1) unlock("sub250", "Achievement: sub-250ms elite! 🔥");
    if (game.totalHits === 10) unlock("rounds10", "Achievement: 10 rounds played! ◉");
    if (game.totalHits === 50) unlock("rounds50", "Achievement: 50 rounds — grinder! ◉");
  }

  // ---- live feel: ticker, activity, online count ----
  const FAKE_NAMES = ["Tawanda", "Rudo", "Tinashe", "Nyasha", "Kuda", "Anesu", "Tadiwa", "Rutendo", "Farai", "Simba", "Noku", "Tendai"];
  let liveEvents = [];
  function pushLive(html, fresh) {
    liveEvents.unshift({ html, t: Date.now(), fresh: !!fresh });
    liveEvents = liveEvents.slice(0, 8);
    renderTicker(); renderActivity();
  }
  function renderTicker() {
    if (!ticker) return;
    if (!liveEvents.length) { ticker.textContent = "warming up the roulette…"; return; }
    ticker.innerHTML = liveEvents.map((e) => "<span>" + e.html + "</span>").join("&nbsp;&nbsp;◆&nbsp;&nbsp;");
  }
  function renderActivity() {
    if (!activityFeed) return;
    activityFeed.innerHTML = "";
    liveEvents.slice(0, 3).forEach((e) => {
      const d = document.createElement("div");
      d.className = "activity-item" + (e.fresh && Date.now() - e.t < 12000 ? " fresh" : "");
      d.innerHTML = e.html;
      activityFeed.appendChild(d);
    });
  }
  function simulateLive() {
    const n = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    if (n === playerName) return;
    const ms = 170 + Math.floor(Math.random() * 220);
    pushLive("<b>" + escapeHtml(n) + "</b> just hit <span class='ms'>" + ms + "ms</span>");
    if (onlineCount) onlineCount.textContent = (9 + Math.floor(Math.random() * 22)) + " online";
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  setInterval(() => { if (!document.hidden) simulateLive(); }, 7000);
  setInterval(() => { if (onlineCount && !document.hidden) onlineCount.textContent = (9 + Math.floor(Math.random() * 22)) + " online"; }, 4000);
  pushLive("welcome to the <b>roulette</b> — tap to arm ⚡");
  setTimeout(simulateLive, 2500); setTimeout(simulateLive, 5000);

  // ---- leaderboard (shared + local fallback) ----
  async function submitScore(name, ms) {
    if (supabase) {
      const { error } = await supabase.from("scores").insert({ name, ms });
      if (error) { console.error("Supabase insert failed:", error.message); resultNote.textContent = "couldn't save your score — check your connection."; return false; }
      resultNote.textContent = "";
      return true;
    }
    const entries = loadLocalBoard();
    const ex = entries.find((e) => e.name === name);
    if (ex) { if (ms < ex.ms) ex.ms = ms; } else entries.push({ name, ms });
    entries.sort((a, b) => a.ms - b.ms);
    saveLocalBoard(entries.slice(0, MAX_BOARD_ENTRIES));
    resultNote.textContent = "";
    return true;
  }

  async function fetchBoard() {
    if (supabase) {
      const { data, error } = await supabase.from("scores").select("name, ms, created_at").order("ms", { ascending: true }).limit(200);
      if (error) { console.error("Supabase fetch failed:", error.message); return { entries: [], recent: [], mode: "error" }; }
      const best = new Map();
      for (const r of (data || [])) { const c = best.get(r.name); if (c === undefined || r.ms < c) best.set(r.name, r.ms); }
      let entries = Array.from(best, ([name, ms]) => ({ name, ms })).sort((a, b) => a.ms - b.ms);
      const recent = (data || []).slice(-6).reverse();
      if (!boardExpanded) entries = entries.slice(0, MAX_BOARD_ENTRIES);
      return { entries, recent, mode: "shared" };
    }
    return { entries: loadLocalBoard(), recent: [], mode: "local" };
  }

  function medal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1); }

  async function renderBoard() {
    boardList.innerHTML = '<div class="board-loading"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
    boardStatus.textContent = "";
    const { entries, recent, mode } = await fetchBoard();
    if (mode === "error") boardStatus.textContent = "couldn't reach the leaderboard right now.";
    if (mode === "local") boardStatus.textContent = "local board — connect Supabase for shared.";
    boardList.innerHTML = "";
    if (!entries.length) { boardList.innerHTML = '<li class="board-empty">no scores yet. be the first.</li>'; return; }
    entries.forEach((entry, i) => {
      const li = document.createElement("li");
      li.className = "board-row" + (entry.name === playerName ? " me" : "");
      const rankCls = i < 3 ? "board-rank r" + (i + 1) : "board-rank";
      const av = avatarFor(entry.name);
      li.innerHTML = '<span class="' + rankCls + '">' + medal(i) + '</span>' +
        '<span class="board-avatar" style="background:' + av.bg + '">' + escapeHtml(av.ch) + '</span>' +
        '<span class="board-name"></span><span class="board-time">' + entry.ms + 'ms</span>';
      li.querySelector(".board-name").textContent = entry.name + (entry.name === playerName ? " (you)" : "");
      boardList.appendChild(li);
    });
    // live rank toast
    const myIdx = entries.findIndex((e) => e.name === playerName);
    if (myIdx >= 0) {
      const rank = myIdx + 1;
      if (lastRank !== null && rank < lastRank) toast("You climbed to #" + rank + "! 🏆", "🏆", "toast--rank");
      lastRank = rank;
      const mine = entries[myIdx];
      boardTweet.href = tweetHref("I scored " + mine.ms + "ms (#" + rank + ") on Reaction Speed Roulette. Think you can beat me?");
      boardTweet.classList.remove("hidden");
    } else boardTweet.classList.add("hidden");
    // merge real recent scores into live feed
    (recent || []).slice(0, 3).forEach((r) => {
      if (r.name !== playerName) pushLive("<b>" + escapeHtml(r.name) + "</b> hit <span class='ms'>" + r.ms + "ms</span>");
    });
  }

  // ---- name gate ----
  async function loadPersonalBest(name) {
    if (!supabase) return;
    const { data, error } = await supabase.from("scores").select("ms").eq("name", name).order("ms", { ascending: true }).limit(1);
    if (error) return;
    if (data && data.length) { sessionBest = data[0].ms; statBest.textContent = sessionBest + "ms"; if (bestCrown) bestCrown.classList.remove("hidden"); }
  }
  function showApp(name) {
    playerName = name;
    playerNameEl.textContent = name;
    paintAvatars();
    nameGate.classList.add("hidden");
    app.classList.remove("hidden");
    renderGame();
    loadPersonalBest(name);
    if (game.totalHits > 0) {
      statRounds.textContent = game.totalHits;
      rounds = game.totalHits;
    }
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
    if (!value) { nameError.textContent = "enter a name to continue."; return; }
    if (value.length > 18) { nameError.textContent = "keep it under 18 characters."; return; }
    nameSubmit.disabled = true;
    claimName(value).then((res) => {
      nameSubmit.disabled = false;
      if (res.ok) {
        const name = res.canonicalName || value;
        nameError.textContent = "";
        localStorage.setItem(STORAGE_NAME, name);
        showApp(name);
        toast("Welcome, " + name + "! Tap to arm ⚡", "👋", "");
        return;
      }
      nameError.textContent = res.taken
        ? "That name is taken — try another."
        : "couldn't check that name — try again.";
    });
  }
  nameSubmit.addEventListener("click", handleNameSubmit);
  nameInput.addEventListener("input", paintAvatars);
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleNameSubmit(); });
  paintAvatars();

  const savedName = localStorage.getItem(STORAGE_NAME);
  if (savedName) showApp(savedName); else nameInput.focus();

  // ---- stage ----
  const ICONS = { idle: "◉", wait: "⏳", go: "⚡", early: "✋", best: "👑" };
  function setStage(mode, title, sub) {
    stage.className = "stage stage--" + mode;
    stageText.textContent = title;
    stageSub.textContent = sub;
    if (stageIcon) stageIcon.textContent = ICONS[mode] || "◉";
    if (mode === "wait" || mode === "go") hideTier();
  }

  function armRound() {
    gameState = "waiting";
    resultShare.classList.add("hidden");
    resultNote.textContent = "";
    hideTier();
    setStage("wait", "wait for it...", "don't tap yet");
    const delay = 800 + Math.random() * 2500;
    armTimer = setTimeout(() => {
      gameState = "ready";
      readyAt = performance.now();
      setStage("go", "tap now!", "as fast as you can");
      vibrate(10);
    }, delay);
  }

  async function registerHit() {
    const ms = Math.round(performance.now() - readyAt);
    gameState = "idle";
    const isBest = sessionBest === null || ms < sessionBest;
    const prevBest = sessionBest;
    rounds++; game.totalHits++;
    statRounds.textContent = game.totalHits;
    // trend vs last
    if (trendLast) {
      if (lastMs === null) trendLast.textContent = "";
      else if (ms < lastMs) { trendLast.textContent = "▲ " + (lastMs - ms) + "ms"; trendLast.className = "trend up"; }
      else if (ms > lastMs) { trendLast.textContent = "▼ +" + (ms - lastMs) + "ms"; trendLast.className = "trend down"; }
    }
    // count-up animation from lastMs or 0
    countUp(statLast, lastMs || 0, ms);
    lastMs = ms;
    doFlash();

    if (isBest) {
      sessionBest = ms;
      countUp(statBest, prevBest || 0, ms);
      if (bestCrown) bestCrown.classList.remove("hidden");
      vibrate([40, 60, 40]);
      setStage("best", ms + "ms — new best!", "tap to go again");
      showTier(ms);
      fireConfetti(120);
      toast("New personal best: " + ms + "ms! 👑", "👑", "toast--best");
    } else {
      vibrate(25);
      setStage("idle", ms + "ms — tap to go again", sessionBest ? "best " + sessionBest + "ms · can you beat it?" : "can you beat that?");
      showTier(ms);
    }
    resultShare.href = tweetHref(shareText(ms, isBest));
    resultShare.classList.remove("hidden");

    applyGamification(ms, isBest);
    pushLive("<b>" + escapeHtml(playerName) + "</b> just hit <span class='ms'>" + ms + "ms</span>" + (isBest ? " 👑" : ""), true);
    game.history.push({ ms, t: Date.now() });
    game.history = game.history.slice(-30);
    saveGame();
    await submitScore(playerName, ms);
  }

  function registerEarlyTap() {
    clearTimeout(armTimer);
    gameState = "idle";
    game.streak = 0; saveGame(); renderGame();
    resultShare.classList.add("hidden");
    hideTier();
    vibrate([80, 40, 80]);
    setStage("early", "too soon!", "tap to try again");
    toast("Too soon! Wait for green ✋", "✋", "");
  }

  function stageAction() {
    if (gameState === "idle") armRound();
    else if (gameState === "waiting") registerEarlyTap();
    else registerHit();
  }
  stage.addEventListener("click", stageAction);
  document.addEventListener("keydown", (e) => {
    if (!nameGate.classList.contains("hidden")) return;
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
    boardExpand.textContent = boardExpanded ? "top 30" : "show all";
    renderBoard();
  });
  boardClose.addEventListener("click", () => boardOverlay.classList.add("hidden"));
  boardOverlay.addEventListener("click", (e) => { if (e.target === boardOverlay) boardOverlay.classList.add("hidden"); });

  // live refresh while board open
  setInterval(() => { if (!boardOverlay.classList.contains("hidden")) renderBoard(); }, 15000);
  // realtime if supabase
  if (supabase) {
    try {
      supabase.channel("scores-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "scores" }, (payload) => {
        const r = payload.new;
        if (r && r.name !== playerName) pushLive("<b>" + escapeHtml(r.name) + "</b> hit <span class='ms'>" + r.ms + "ms</span>", true);
        if (!boardOverlay.classList.contains("hidden")) renderBoard();
      }).subscribe();
    } catch (_) {}
  }

  // ---- STATE OF ART: audio, tilt, analytics, rival, podium, share card, themes ----
  const soundToggle = document.getElementById("sound-toggle");
  const themeToggle = document.getElementById("theme-toggle");
  const rivalBanner = document.getElementById("rival-banner");
  const rivalName = document.getElementById("rival-name");
  const rivalGap = document.getElementById("rival-gap");
  const resultActions = document.getElementById("result-actions");
  const shareCardBtn = document.getElementById("share-card-btn");
  const rematchBtn = document.getElementById("rematch-btn");
  const analytics = document.getElementById("analytics");
  const analyticsAvg = document.getElementById("analytics-avg");
  const analyticsClose = document.getElementById("analytics-close");
  const sparkline = document.getElementById("sparkline");
  const analyticsMeta = document.getElementById("analytics-meta");
  const podium = document.getElementById("podium");
  const shareModal = document.getElementById("share-modal");
  const shareClose = document.getElementById("share-close");
  const shareCanvas = document.getElementById("share-canvas");
  const shareTitle = document.getElementById("share-title");
  const shareDownload = document.getElementById("share-download");
  const shareNative = document.getElementById("share-native");
  const cursorAura = document.getElementById("cursor-aura");
  let lastEntries = [];

  // audio: tiny synth, no assets
  let audioOn = localStorage.getItem("rsr_sound") !== "off";
  let actx = null;
  function tone(freq, dur, type, gain, when) {
    if (!audioOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + (when || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (_) {}
  }
  function paintSound() { if (soundToggle) { soundToggle.textContent = audioOn ? "🔊" : "🔇"; soundToggle.classList.toggle("off", !audioOn); } }
  if (soundToggle) soundToggle.addEventListener("click", (e) => { e.stopPropagation(); audioOn = !audioOn; localStorage.setItem("rsr_sound", audioOn ? "on" : "off"); paintSound(); if (audioOn) tone(660, 0.12, "sine", 0.1); });
  paintSound();
  // react to stage changes for sound + haptics depth
  new MutationObserver(() => {
    const c = stage.className;
    if (c.includes("stage--go")) { tone(880, 0.18, "square", 0.06); tone(1320, 0.22, "sine", 0.08, 0.02); }
    else if (c.includes("stage--best")) { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "triangle", 0.1, i * 0.07)); }
    else if (c.includes("stage--early")) { tone(160, 0.25, "sawtooth", 0.1); }
    else if (c.includes("stage--wait")) { tone(220, 0.1, "sine", 0.05); }
  }).observe(stage, { attributes: true, attributeFilter: ["class"] });

  // tilt + aura + press physics
  if (window.matchMedia("(pointer: fine)").matches) {
    stage.classList.add("tilting");
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      stage.style.transform = "perspective(900px) rotateY(" + (x * 5) + "deg) rotateX(" + (-y * 5) + "deg)";
      if (cursorAura) { cursorAura.style.left = ((x + 0.5) * 100) + "%"; cursorAura.style.top = ((y + 0.5) * 100) + "%"; }
    });
    stage.addEventListener("pointerleave", () => { stage.style.transform = ""; });
    stage.addEventListener("pointerdown", () => stage.classList.add("pressing"));
    addEventListener("pointerup", () => stage.classList.remove("pressing"));
  }

  // themes: midnight -> sunset -> ice
  const THEMES = ["", "sunset", "ice"];
  let themeIdx = THEMES.indexOf(localStorage.getItem("rsr_theme") || "");
  if (themeIdx < 0) themeIdx = 0;
  function paintTheme() { document.body.dataset.theme = THEMES[themeIdx]; if (themeToggle) themeToggle.textContent = ["🌙", "🌅", "🧊"][themeIdx]; }
  if (themeToggle) themeToggle.addEventListener("click", (e) => { e.stopPropagation(); themeIdx = (themeIdx + 1) % THEMES.length; localStorage.setItem("rsr_theme", THEMES[themeIdx]); paintTheme(); tone(520 + themeIdx * 120, 0.12, "sine", 0.08); });
  paintTheme();

  // analytics sparkline
  function toggleAnalytics(force) {
    const show = force !== undefined ? force : analytics.classList.contains("hidden");
    analytics.classList.toggle("hidden", !show);
    if (show) drawSpark();
  }
  ["stat-last-btn", "stat-best-btn", "stat-rounds-btn"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", (e) => { e.stopPropagation(); tone(500, 0.08, "sine", 0.06); toggleAnalytics(); });
  });
  if (analyticsClose) analyticsClose.addEventListener("click", (e) => { e.stopPropagation(); toggleAnalytics(false); });
  function drawSpark() {
    if (!sparkline) return;
    const ctx = sparkline.getContext("2d");
    const W = sparkline.width, H = sparkline.height;
    ctx.clearRect(0, 0, W, H);
    const h = game.history.map((x) => x.ms).slice(-20);
    if (!h.length) { ctx.fillStyle = "#7c7c92"; ctx.font = "22px Inter"; ctx.fillText("play a round — your form shows here", 24, H / 2); return; }
    const min = Math.min(...h, sessionBest || 9999) * 0.9, max = Math.max(...h) * 1.1;
    const px = (i) => 16 + (i / Math.max(1, h.length - 1)) * (W - 32);
    const py = (v) => H - 14 - ((v - min) / Math.max(1, max - min)) * (H - 30);
    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
    for (let g = 0; g < 3; g++) { const y = 14 + g * (H - 28) / 2; ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(W - 10, y); ctx.stroke(); }
    // area
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(55,224,140,0.4)"); grad.addColorStop(1, "rgba(55,224,140,0)");
    ctx.beginPath(); h.forEach((v, i) => i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)));
    ctx.strokeStyle = "#37e08c"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.stroke();
    ctx.lineTo(px(h.length - 1), H); ctx.lineTo(px(0), H); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    h.forEach((v, i) => { ctx.beginPath(); ctx.arc(px(i), py(v), i === h.length - 1 ? 6 : 3.5, 0, 7); ctx.fillStyle = i === h.length - 1 ? "#ffd75c" : "#37e08c"; ctx.fill(); });
    const avg = Math.round(h.reduce((a, b) => a + b, 0) / h.length);
    const sorted = [...h].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const variance = h.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / h.length;
    const consistency = Math.max(0, Math.round(100 - Math.sqrt(variance) / 4));
    if (analyticsAvg) analyticsAvg.textContent = "avg " + avg + "ms";
    if (analyticsMeta) analyticsMeta.textContent = "median " + med + "ms · consistency " + consistency + "% · n=" + h.length;
  }
  setInterval(() => { if (analytics && !analytics.classList.contains("hidden")) drawSpark(); }, 3000);

  // rival + podium augmentation (wrap renderBoard)
  const _renderBoard = renderBoard;
  renderBoard = async function () {
    await _renderBoard();
    lastEntries = lastEntries; // keep ref fresh via hook below
    // podium top 3
    try {
      const { entries } = await fetchBoard();
      lastEntries = entries || [];
      if (podium) {
        podium.innerHTML = "";
        if (lastEntries.length >= 2) {
          const order = [lastEntries[1], lastEntries[0], lastEntries[2]].filter(Boolean);
          const cls = ["p2", "p1", "p3"];
          order.forEach((e, k) => {
            const d = document.createElement("div");
            d.className = "podium-col " + cls[k];
            d.innerHTML = '<div class="podium-crown">' + (cls[k] === "p1" ? "👑" : cls[k] === "p2" ? "🥈" : "🥉") + '</div>' +
              '<div class="podium-name"></div><div class="podium-ms">' + e.ms + 'ms</div><div class="podium-bar"><i style="width:' + Math.max(18, 100 - (e.ms - lastEntries[0].ms) / 3) + '%"></i></div>';
            d.querySelector(".podium-name").textContent = e.name;
            podium.appendChild(d);
          });
        }
      }
      // rival: closest player above me
      const i = lastEntries.findIndex((e) => e.name === playerName);
      if (rivalBanner && i > 0) {
        const rival = lastEntries[i - 1];
        rivalBanner.classList.remove("hidden");
        rivalName.textContent = rival.name;
        rivalGap.textContent = "+" + (sessionBest - rival.ms > 0 ? sessionBest - rival.ms : rival.ms - (sessionBest || rival.ms)) + "ms to catch · #" + i;
        if (sessionBest !== null && sessionBest <= rival.ms) {
          rivalGap.textContent = "ahead! defend it 👑";
          if (!rivalBanner.dataset.celebrated) { rivalBanner.dataset.celebrated = "1"; toast("You passed " + rival.name + "! 👻", "👻", "toast--rank"); }
        }
      } else if (rivalBanner && i === 0 && lastEntries.length > 1) {
        rivalBanner.classList.remove("hidden");
        rivalName.textContent = "the world";
        rivalGap.textContent = "you lead by " + (lastEntries[1].ms - sessionBest) + "ms 👑";
      } else if (rivalBanner) rivalBanner.classList.add("hidden");
    } catch (_) {}
  };

  // result actions + share card
  const _obs = new MutationObserver(() => {
    const visible = !resultShare.classList.contains("hidden");
    if (resultActions) resultActions.classList.toggle("hidden", !visible);
  });
  if (resultShare && resultActions) _obs.observe(resultShare, { attributes: true, attributeFilter: ["class"] });
  if (rematchBtn) rematchBtn.addEventListener("click", (e) => { e.stopPropagation(); tone(700, 0.1, "sine", 0.08); stageAction(); });
  function drawShareCard() {
    const c = shareCanvas, ctx = c.getContext("2d");
    const ms = lastMs || sessionBest || 248;
    const t = (ms < 200 ? "GODLIKE" : ms < 250 ? "ELITE" : ms < 350 ? "SOLID" : "WARMING UP");
    const g = ctx.createLinearGradient(0, 0, 900, 1120);
    g.addColorStop(0, "#171736"); g.addColorStop(0.55, "#0b0b14"); g.addColorStop(1, "#2a1030");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 1120);
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2;
    for (let y = 120; y < 1120; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke(); }
    ctx.fillStyle = "#8b84ff"; ctx.font = "700 30px Inter"; ctx.fillText("SPEED ◆ ROULETTE", 60, 90);
    ctx.fillStyle = "#ffd75c"; ctx.font = "700 26px Inter"; ctx.fillText("● LIVE CERTIFIED", 620, 90);
    ctx.fillStyle = "#fff"; ctx.font = "800 150px Unbounded, Inter, sans-serif";
    ctx.shadowColor = "#37e08c"; ctx.shadowBlur = 60;
    ctx.fillText(ms + "ms", 60, 330); ctx.shadowBlur = 0;
    ctx.fillStyle = "#37e08c"; ctx.font = "800 44px Inter";
    ctx.fillText("⚡ " + t, 60, 400);
    const av = avatarFor(playerName);
    ctx.fillStyle = "#fff"; ctx.font = "700 52px Inter"; ctx.fillText(playerName || "you", 60, 500);
    ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.font = "500 30px Inter";
    ctx.fillText("best " + (sessionBest || ms) + "ms · lvl " + levelFor(game.xp) + " · streak " + game.streak + "🔥", 60, 552);
    // sparkline mini
    const h = game.history.map((x) => x.ms).slice(-14);
    if (h.length > 1) {
      ctx.strokeStyle = "#37e08c"; ctx.lineWidth = 6; ctx.beginPath();
      h.forEach((v, i) => { const x = 60 + i * (780 / (h.length - 1)), y = 760 - ((v - 150) / 400) * 220; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "500 28px Inter";
    ctx.fillText("Think you can beat me?", 60, 900);
    ctx.fillStyle = "#fff"; ctx.font = "700 30px Inter";
    ctx.fillText("reaction-speed-roulette.vercel.app", 60, 950);
    void av;
  }
  if (shareCardBtn) shareCardBtn.addEventListener("click", (e) => {
    e.stopPropagation(); drawShareCard();
    if (shareTitle) shareTitle.textContent = (lastMs || sessionBest || "—") + "ms ⚡";
    if (shareModal) shareModal.classList.remove("hidden");
    tone(760, 0.12, "triangle", 0.09);
  });
  if (shareClose) shareClose.addEventListener("click", () => shareModal.classList.add("hidden"));
  if (shareModal) shareModal.addEventListener("click", (e) => { if (e.target === shareModal) shareModal.classList.add("hidden"); });
  if (shareDownload) shareDownload.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = "reaction-" + (lastMs || "best") + "ms.png";
    a.href = shareCanvas.toDataURL("image/png");
    a.click();
    toast("Card saved — flex it 🖼", "🖼", "");
  });
  if (shareNative) shareNative.addEventListener("click", async () => {
    try {
      const blob = await new Promise((res) => shareCanvas.toBlob(res, "image/png"));
      const file = new File([blob], "reaction.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My reaction: " + lastMs + "ms" });
      } else {
        await navigator.clipboard.writeText("I scored " + lastMs + "ms on Reaction Speed Roulette " + DEPLOYED_URL);
        toast("Link copied to clipboard 🔗", "🔗", "");
      }
    } catch (_) {}
  });

  // coach: first-run hint sequence
  if (!localStorage.getItem("rsr_coached")) {
    setTimeout(() => { if (!playerName) return; toast("Tap the big panel to arm…", "◉", ""); }, 1200);
    setTimeout(() => { if (rounds === 0 && playerName) toast("Wait for GREEN, then smash it ⚡", "⏳", ""); }, 4500);
    localStorage.setItem("rsr_coached", "1");
  }

  renderGame();
})();
