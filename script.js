(function () {
  "use strict";

  const STORAGE_NAME = "rsr_player_name";
  const DEVICE_KEY = "rsr_device_id";
  const GAME_KEY = "rsr_gamification_v2";
  const MAX_BOARD_ENTRIES = 30;
  const LIVE_WINDOW_MS = 3 * 60 * 1000;
  const BOARD_PAGE_SIZE = 200;
  const RECONNECT_MS = 30 * 1000;
  const DEPLOYED_URL = "https://reaction-speed-roulette.vercel.app/";
  const ROUND_SIZE = 5;

  // ---- elements ----
  const nameGate = document.getElementById("name-gate");
  const nameInput = document.getElementById("name-input");
  const nameSubmit = document.getElementById("name-submit");
  const nameError = document.getElementById("name-error");
  const nameAvatar = document.getElementById("name-avatar");

  const app = document.getElementById("app");
  const playerNameEl = document.getElementById("player-name");
  const playerAvatarMain = document.getElementById("player-avatar-main");

  const stage = document.getElementById("stage");
  const stageCanvas = document.getElementById("stage-canvas");
  const roundGameLabel = document.getElementById("round-game-label");
  const roundAvgVal = document.getElementById("round-avg-val");
  const roundSlots = Array.prototype.slice.call(document.querySelectorAll("#round-slots .round-slot"));
  const resultShare = document.getElementById("result-share");
  const resultNote = document.getElementById("result-note");
  const flash = document.getElementById("flash");
  const confettiCanvas = document.getElementById("confetti");
  const cursorAura = document.getElementById("cursor-aura");

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
  const boardTabTop = document.getElementById("board-tab-top");
  const boardTabAll = document.getElementById("board-tab-all");

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
  let mode = "idle"; // idle | waiting | ready | early | round
  let roundsDone = 0;
  let roundGames = []; // { ms, hitFrame, goFrame }
  let goAt = 0;
  let readyAt = 0;
  let lastRoundAvg = null;
  let sessionBest = null;
  let boardMode = "top10";
  let lastRank = null;
  let localMode = false;
  let frameCount = 0;
  let stagePhase = { title: "", sub: "" };
  let resultShow = null;
  let lastHitAvg = null;

  // ---- gamification state (localStorage) ----
  let game = loadGame();
  function loadGame() {
    try {
      const raw = localStorage.getItem(GAME_KEY);
      if (raw) {
        const g = Object.assign(defaultGame(), JSON.parse(raw));
        if (typeof g.rounds !== "number") g.rounds = g.totalHits || 0;
        return g;
      }
    } catch (_) {}
    return defaultGame();
  }
  function defaultGame() {
    return { xp: 0, streak: 0, bestStreak: 0, history: [], achievements: {}, challenge: dailyChallenge(), rounds: 0 };
  }
  function saveGame() { try { localStorage.setItem(GAME_KEY, JSON.stringify(game)); } catch (_) {} }
  function dailyChallenge() {
    const day = new Date().toISOString().slice(0, 10);
    const seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
    const goals = [
      { id: "sub300x3", label: "3× sub-300ms", target: 300, count: 3 },
      { id: "sub250x2", label: "2× sub-250ms", target: 250, count: 2 },
      { id: "sub350x5", label: "5× sub-350ms", target: 350, count: 5 },
      { id: "rounds10", label: "complete 10 rounds", target: 9999, count: 10 },
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
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> Number(c) / 4).toString(16));
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }
  const deviceId = getDeviceId();

  function vibrate(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (_) {} } }
  function tweetHref(t) { return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(t) + "&url=" + encodeURIComponent(DEPLOYED_URL); }
  function shareText(avg, isBest) {
    return isBest ? "New personal best: " + avg + "ms average on Reaction Speed Roulette. Beat it."
      : "I averaged " + avg + "ms across 5 games on Reaction Speed Roulette. Think you can beat me?";
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
    if (playerAvatarMain) {
      const p = avatarFor(playerName);
      playerAvatarMain.textContent = p.ch;
      playerAvatarMain.style.background = p.bg;
    }
  }

  function tierFor(ms) {
    if (ms < 200) return { label: "⚡ godlike", cls: "god" };
    if (ms < 250) return { label: "🔥 elite", cls: "elite" };
    if (ms < 350) return { label: "✦ solid", cls: "solid" };
    return { label: "keep pushing", cls: "meh" };
  }

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

  // ---- gamification: XP / levels / streaks / achievements (round averages) ----
  function levelFor(xp) { return Math.floor(Math.sqrt(xp / 100)) + 1; }
  function xpForLevel(lvl) { return Math.pow(lvl - 1, 2) * 100; }
  function xpGain(avg) {
    if (avg < 200) return 60;
    if (avg < 250) return 40;
    if (avg < 300) return 25;
    if (avg < 400) return 12;
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
  function applyGamification(avg, isBest) {
    const beforeLvl = levelFor(game.xp);
    game.xp += xpGain(avg);
    game.rounds++;
    const afterLvl = levelFor(game.xp);
    if (avg < 350) { game.streak++; game.bestStreak = Math.max(game.bestStreak, game.streak); }
    else game.streak = 0;
    const ch = game.challenge;
    if (!ch.done) {
      if (ch.id === "rounds10") ch.progress++;
      else if (avg <= ch.target) ch.progress++;
      if (ch.progress >= ch.count) { ch.done = true; game.xp += 50; toast("Daily complete! +50 XP 🎯", "🎯", ""); fireConfetti(50); }
    }
    renderGame();
    if (afterLvl > beforeLvl) { toast("Level up! You are now LVL " + afterLvl, "⚡", "toast--xp"); fireConfetti(110); }
    else if (isBest) toast("+" + xpGain(avg) + " XP", "✦", "toast--xp");
    if (game.streak === 3) toast("3-round streak! You're on fire 🔥", "🔥", "toast--streak");
    if (game.streak === 5) unlock("streak5", "Achievement: 5 streak! 🔥");
    if (game.streak === 10) unlock("streak10", "Achievement: 10 streak — unstoppable! 🔥");
    if (avg < 200) unlock("sub200", "Achievement: sub-200ms avg — godlike! ⚡");
    else if (avg < 250) unlock("sub250", "Achievement: sub-250ms avg elite! 🔥");
    if (game.rounds === 10) unlock("rounds10", "Achievement: 10 rounds completed! ◉");
    if (game.rounds === 50) unlock("rounds50", "Achievement: 50 rounds — grinder! ◉");
  }

  // ---- live feel ----
  let liveEvents = [];
  let liveChannel = null;
  function pushLive(html, fresh) {
    liveEvents.unshift({ html, t: Date.now(), fresh: !!fresh });
    liveEvents = liveEvents.slice(0, 12);
    renderTicker(); renderActivity();
  }
  function pruneLive() {
    const cutoff = Date.now() - LIVE_WINDOW_MS;
    const before = liveEvents.length;
    liveEvents = liveEvents.filter((e) => e.t >= cutoff);
    if (liveEvents.length !== before) { renderTicker(); renderActivity(); }
  }
  function renderTicker() {
    if (!ticker) return;
    const strip = ticker.closest(".live-strip");
    if (strip) strip.classList.toggle("hidden", !liveEvents.length);
    if (!liveEvents.length) return;
    ticker.innerHTML = liveEvents.map((e) => "<span>" + e.html + "</span>").join("&nbsp;&nbsp;◆&nbsp;&nbsp;");
  }
  function renderActivity() {
    if (!activityFeed) return;
    const section = document.getElementById("activity-section");
    activityFeed.innerHTML = "";
    liveEvents.slice(0, 3).forEach((e) => {
      const d = document.createElement("div");
      d.className = "activity-item" + (e.fresh && Date.now() - e.t < 12000 ? " fresh" : "");
      d.innerHTML = e.html;
      activityFeed.appendChild(d);
    });
    if (section) section.classList.toggle("hidden", !liveEvents.length);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  setInterval(() => { if (!document.hidden) pruneLive(); }, 30000);

  async function refreshOnlineCount() {
    if (!onlineCount) return;
    const pill = document.getElementById("live-pill");
    if (!supabase || localMode) {
      if (pill) pill.classList.add("hidden");
      onlineCount.textContent = "";
      return;
    }
    const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
    const { data, error } = await supabase.from("scores").select("name").gte("created_at", cutoff);
    if (error) { console.error("online count failed:", error.message); return; }
    const n = new Set((data || []).map((r) => r.name)).size;
    if (pill) pill.classList.remove("hidden");
    onlineCount.textContent = (n === 1 ? "1 online" : n + " online");
  }
  refreshOnlineCount();
  setInterval(() => { if (!document.hidden) refreshOnlineCount(); }, 15000);

  function enterLocalMode(cause) {
    if (localMode) return;
    localMode = true;
    console.error(cause || "Supabase unavailable — switched to local play.");
    toast("Leaderboard unreachable — playing locally.", "📴", "");
    refreshOnlineCount();
  }

  let probeRunning = false;
  async function checkSupabaseHealth() {
    if (!supabase || !localMode || probeRunning) return;
    probeRunning = true;
    try {
      const { error } = await supabase.from("scores").select("name").limit(1);
      if (error) { console.warn("still offline — staying on the local board:", error.message); return; }
      console.log("Supabase reachable — resuming shared leaderboard.");
      localMode = false;
      refreshOnlineCount();
      subscribeLive();
      toast("Leaderboard is back online — playing shared again.", "📶", "");
      if (!boardOverlay.classList.contains("hidden")) renderBoard();
    } finally { probeRunning = false; }
  }
  setInterval(() => { if (!document.hidden) checkSupabaseHealth(); }, RECONNECT_MS);

  // ---- leaderboard (shared + local fallback) ----
  function saveScoreLocal(name, avg) {
    const entries = loadLocalBoard();
    const ex = entries.find((e) => e.name === name);
    if (ex) { if (avg < ex.ms) ex.ms = avg; } else entries.push({ name, ms: avg });
    entries.sort((a, b) => a.ms - b.ms);
    saveLocalBoard(entries.slice(0, MAX_BOARD_ENTRIES));
    resultNote.textContent = "";
    return true;
  }
  async function submitScore(name, games, frames) {
    const avg = Math.round(games.reduce((a, b) => a + b, 0) / games.length);
    if (supabase && !localMode) {
      try {
        const res = await fetch(cfg.SUPABASE_URL + "/functions/v1/submit-score", {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": cfg.SUPABASE_ANON_KEY, "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY },
          body: JSON.stringify({ name, games, frames }),
        });
        if (!res.ok) {
          console.error("submit-score rejected:", res.status);
          if (res.status !== 429 && res.status !== 400) {
            enterLocalMode("submit-score failed: " + res.status);
            return saveScoreLocal(name, avg);
          }
          return false;
        }
        resultNote.textContent = "";
        return true;
      } catch (e) {
        console.error("submit-score failed:", e.message);
        enterLocalMode("submit-score failed: " + e.message);
        return saveScoreLocal(name, avg);
      }
    }
    return saveScoreLocal(name, avg);
  }

  async function fetchBoard() {
    if (supabase && !localMode) {
      const byName = new Map();
      let offset = 0, failed = false;
      while (true) {
        const res = await supabase
          .from("scores")
          .select("name, ms, created_at")
          .order("ms", { ascending: true })
          .range(offset, offset + BOARD_PAGE_SIZE - 1);
        if (res.error) { console.error("Supabase fetch failed:", res.error.message); failed = true; enterLocalMode("Supabase fetch failed"); break; }
        const page = res.data || [];
        for (const r of page) { const c = byName.get(r.name); if (c === undefined || r.ms < c) byName.set(r.name, r.ms); }
        if (page.length < BOARD_PAGE_SIZE) break;
        offset += page.length;
      }
      if (failed) return { entries: loadLocalBoard(), mode: "local" };
      let entries = Array.from(byName, ([name, ms]) => ({ name, ms })).sort((a, b) => a.ms - b.ms);
      if (boardMode === "top10") entries = entries.slice(0, 10);
      return { entries, mode: "shared" };
    }
    const local = loadLocalBoard();
    return { entries: boardMode === "top10" ? local.slice(0, 10) : local, mode: "local" };
  }

  function medal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1); }

  async function renderBoard() {
    boardList.innerHTML = '<div class="board-loading"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
    boardStatus.textContent = "";
    const { entries, mode } = await fetchBoard();
    lastEntries = entries || [];
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
        '<span class="board-name"></span><span class="board-time">' + entry.ms + 'ms avg</span>';
      li.querySelector(".board-name").textContent = entry.name + (entry.name === playerName ? " (you)" : "");
      boardList.appendChild(li);
    });
    const myIdx = entries.findIndex((e) => e.name === playerName);
    if (myIdx >= 0) {
      const rank = myIdx + 1;
      if (lastRank !== null && rank < lastRank) toast("You climbed to #" + rank + "! 🏆", "🏆", "toast--rank");
      lastRank = rank;
      const mine = entries[myIdx];
      boardTweet.href = tweetHref("I averaged " + mine.ms + "ms (#" + rank + ") on Reaction Speed Roulette. Think you can beat me?");
      boardTweet.classList.remove("hidden");
    } else boardTweet.classList.add("hidden");
  }

  // ---- name gate ----
  async function loadPersonalBest(name) {
    let best = null;
    const local = loadLocalBoard().find((e) => e.name === name);
    if (local) best = local.ms;
    if (supabase && !localMode) {
      const { data, error } = await supabase.from("scores").select("ms").eq("name", name).order("ms", { ascending: true }).limit(1);
      if (!error && data && data.length) best = best === null ? data[0].ms : Math.min(best, data[0].ms);
    }
    if (best !== null) {
      sessionBest = best;
      statBest.textContent = sessionBest + "ms";
      if (bestCrown) bestCrown.classList.remove("hidden");
    }
  }
  function showApp(name) {
    playerName = name;
    playerNameEl.textContent = name;
    paintAvatars();
    nameGate.classList.add("hidden");
    app.classList.remove("hidden");
    renderGame();
    loadPersonalBest(name);
    if (game.rounds > 0) {
      statRounds.textContent = game.rounds;
      roundsDone = game.rounds;
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
      enterLocalMode("players lookup failed, falling back to local play: " + error.message);
      return { ok: true, canonicalName: value };
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
          enterLocalMode("players claim failed, falling back to local play: " + updateError.message);
          return { ok: true, canonicalName: value };
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
      enterLocalMode("players insert failed, falling back to local play: " + insertError.message);
      return { ok: true, canonicalName: value };
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

  // ---- audio ----
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
  function soundArm() { tone(220, 0.1, "sine", 0.05); }
  function soundGo() { tone(880, 0.18, "square", 0.05); tone(1320, 0.22, "sine", 0.06, 0.02); }
  function soundBest() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "triangle", 0.09, i * 0.07)); }
  function soundEarly() { tone(160, 0.25, "sawtooth", 0.09); }

  function paintSound() { if (soundToggle) { soundToggle.textContent = audioOn ? "🔊" : "🔇"; soundToggle.classList.toggle("off", !audioOn); } }
  const soundToggle = document.getElementById("sound-toggle");
  if (soundToggle) soundToggle.addEventListener("click", (e) => { e.stopPropagation(); audioOn = !audioOn; localStorage.setItem("rsr_sound", audioOn ? "on" : "off"); paintSound(); if (audioOn) tone(660, 0.12, "sine", 0.1); });
  paintSound();

  // ---- canvas stage ----
  let sctx = null;
  function sizeCanvas() {
    if (!stageCanvas || !sctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = stageCanvas.clientWidth, h = stageCanvas.clientHeight;
    if (!w || !h) return;
    if (stageCanvas.width !== Math.round(w * dpr) || stageCanvas.height !== Math.round(h * dpr)) {
      stageCanvas.width = Math.round(w * dpr);
      stageCanvas.height = Math.round(h * dpr);
    }
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function setPhase(title, sub) { stagePhase.title = title; stagePhase.sub = sub; }

  function startGo() {
    mode = "ready";
    readyAt = performance.now();
    setPhase("GO!", "tap now!");
    soundGo();
    vibrate(10);
  }

  // ---- round + game flow ----
  function armRound() {
    if (roundGames.length >= ROUND_SIZE) roundGames = [];
    const fresh = roundGames.length === 0;
    resultShare.classList.add("hidden");
    resultNote.textContent = "";
    resultShow = null;
    mode = "waiting";
    setPhase("wait for it...", "don't tap yet");
    goAt = performance.now() + (900 + Math.random() * 2400);
    soundArm();
    if (fresh) resetRoundStrip();
    if (roundGameLabel) roundGameLabel.textContent = "game " + (roundGames.length + 1) + "/" + ROUND_SIZE;
  }

  function resetRoundStrip() {
    roundSlots.forEach((slot) => {
      slot.classList.remove("done", "low");
      const label = slot.querySelector("i");
      if (label) label.textContent = "–";
    });
    if (roundAvgVal) roundAvgVal.textContent = "–";
  }

  function registerEarlyTap() {
    mode = "idle";
    vibrate([80, 40, 80]);
    soundEarly();
    setPhase("too soon!", "tap to try again");
    toast("Too soon! Wait for green ✋", "✋", "");
  }

  function registerHit() {
    const ms = Math.max(1, Math.round(performance.now() - readyAt));
    const hitFrame = frameCount;
    const entry = { ms, hitFrame, goFrame: lastGoFrame };
    roundGames.push(entry);
    updateRoundStrip();
    mode = "idle";

    if (roundGames.length >= ROUND_SIZE) {
      completeRound();
    } else {
      const n = roundGames.length;
      const soFar = Math.round(roundGames.reduce((a, b) => a + b.ms, 0) / n);
      lastHitAvg = soFar;
      setPhase(n + "/" + ROUND_SIZE + " done", "your running avg is " + soFar + "ms — tap to arm next");
      if (roundGameLabel) roundGameLabel.textContent = "game " + (roundGames.length + 1) + "/" + ROUND_SIZE;
    }
  }

  function updateRoundStrip() {
    roundGames.forEach((g, i) => {
      const slot = roundSlots[i];
      if (!slot) return;
      const low = g.ms <= 5;
      slot.classList.remove("done", "low");
      slot.classList.add(low ? "low" : "done");
      slot.querySelector("i").textContent = g.ms + "ms";
    });
    const n = roundGames.length;
    if (roundAvgVal) roundAvgVal.textContent = n ? Math.round(roundGames.reduce((a, b) => a + b.ms, 0) / n) + "ms" : "–";
  }

  function completeRound() {
    const games = roundGames.map((g) => g.ms);
    const frames = roundGames.map((g) => Math.max(0, g.hitFrame - g.goFrame));
    const avg = Math.round(games.reduce((a, b) => a + b, 0) / games.length);

    roundsDone++;
    statRounds.textContent = roundsDone;
    game.rounds = roundsDone;

    const isBest = sessionBest === null || avg < sessionBest;
    const prevBest = sessionBest;
    if (isBest) {
      sessionBest = avg;
      countUp(statBest, prevBest || 0, avg);
      if (bestCrown) bestCrown.classList.remove("hidden");
    }
    countUp(statLast, lastRoundAvg || 0, avg);
    if (trendLast) {
      if (lastRoundAvg === null) trendLast.textContent = "";
      else if (avg < lastRoundAvg) { trendLast.textContent = "▲ " + (lastRoundAvg - avg) + "ms"; trendLast.className = "trend up"; }
      else if (avg > lastRoundAvg) { trendLast.textContent = "▼ +" + (avg - lastRoundAvg) + "ms"; trendLast.className = "trend down"; }
    }
    lastRoundAvg = avg;
    lastHitAvg = avg;

    game.history.push({ ms: avg, t: Date.now() });
    game.history = game.history.slice(-30);
    saveGame();

    if (isBest) {
      vibrate([40, 60, 40]);
      soundBest();
      fireConfetti(120);
      toast("New best average: " + avg + "ms! 👑", "👑", "toast--best");
    } else {
      vibrate(25);
    }
    resultShow = { label: isBest ? "NEW BEST" : "ROUND AVERAGE", from: lastRoundAvg || 0, target: avg, start: performance.now(), dur: 550, isBest };

    resultShare.href = tweetHref(shareText(avg, isBest));
    resultShare.classList.remove("hidden");
    doFlash();
    applyGamification(avg, isBest);
    pushLive("<b>" + escapeHtml(playerName) + "</b> just averaged <span class='ms'>" + avg + "ms</span> across 5 games" + (isBest ? " 👑" : ""), true);

    submitScore(playerName, games, frames).then((saved) => {
      if (saved === false) {
        resultNote.textContent = "couldn't record that round — tap to retry.";
      } else {
        resultNote.textContent = "";
      }
    });
  }

  function stageAction() {
    if (mode === "idle") armRound();
    else if (mode === "waiting") registerEarlyTap();
    else if (mode === "ready") registerHit();
  }

  // ---- canvas render loop ----
  let lastGoFrame = -1;
  function draw() {
    frameCount++;
    sizeCanvas();
    if (mode === "waiting" && performance.now() >= goAt) {
      lastGoFrame = frameCount;
      startGo();
    }
    renderStage();
    requestAnimationFrame(draw);
  }

  function renderStage() {
    if (!sctx) return;
    const W = stageCanvas.width / Math.min(2, window.devicePixelRatio || 1) || stageCanvas.clientWidth;
    const H = stageCanvas.height / Math.min(2, window.devicePixelRatio || 1) || stageCanvas.clientHeight;
    sctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;
    const cs = getComputedStyle(document.documentElement);

    let bgTop, bgBottom, glowColor, accent, ringColor, ringSpeed, titleFont, titleColor, pulse;
    if (mode === "waiting") { bgTop = "#5a1818"; bgBottom = "#2a0d0d"; glowColor = "rgba(255,92,92,0.45)"; accent = "#ff5c5c"; ringColor = "rgba(255,92,92,0.6)"; ringSpeed = 1.1; pulse = 0.9; }
    else if (mode === "ready") { bgTop = "#0f7a48"; bgBottom = "#08351f"; glowColor = "rgba(55,224,140,0.6)"; accent = "#37e08c"; ringColor = "rgba(55,224,140,0.85)"; ringSpeed = 0; pulse = 1.4; }
    else if (mode === "early") { bgTop = "#8a5210"; bgBottom = "#3d2208"; glowColor = "rgba(255,180,68,0.55)"; accent = "#ffb444"; ringColor = "rgba(255,180,68,0.7)"; ringSpeed = 0.8; pulse = 1; }
    else { bgTop = "#22263e"; bgBottom = "#12121e"; glowColor = "rgba(139,132,255,0.3)"; accent = cs.getPropertyValue("--accent") || "#8b84ff"; ringColor = "rgba(255,255,255,0.18)"; ringSpeed = 0.15; pulse = 1; }

    const g = sctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, bgTop); g.addColorStop(1, bgBottom);
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, W, H);

    // glow
    const rad = Math.max(W, H) * 0.6;
    const gg = sctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, rad);
    gg.addColorStop(0, glowColor); gg.addColorStop(1, "transparent");
    sctx.fillStyle = gg;
    sctx.fillRect(0, 0, W, H);

    // ring
    const ringR = Math.min(W, H) * 0.34;
    const rot = t * ringSpeed;
    sctx.save();
    sctx.translate(W / 2, H * 0.5);
    sctx.rotate(rot);
    sctx.strokeStyle = ringColor;
    sctx.lineWidth = 2;
    sctx.setLineDash(mode === "ready" ? [] : [2, 10]);
    sctx.beginPath();
    sctx.arc(0, 0, ringR, 0, Math.PI * 2);
    sctx.stroke();
    sctx.restore();

    // icon
    const ICONS = { idle: "◉", waiting: "⏳", ready: "⚡", early: "✋" };
    sctx.save();
    sctx.font = "44px Inter, sans-serif";
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    const iconScale = mode === "waiting" ? pulse + 0.18 * Math.sin(t * (ringSpeed / 0.9) * 7) : 1;
    sctx.translate(W / 2, H * 0.34);
    sctx.scale(iconScale, iconScale);
    sctx.fillStyle = accent;
    sctx.fillText(ICONS[mode] || "◉", 0, 0);
    sctx.restore();

    // title
    const titlePx = mode === "ready" ? Math.min(42, W / 6) : Math.min(30, W / 7);
    sctx.font = "800 " + titlePx + "px Unbounded, Inter, sans-serif";
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";

    if (resultShow) {
      const k = Math.min(1, (performance.now() - resultShow.start) / resultShow.dur);
      const e = 1 - Math.pow(1 - k, 3);
      const val = Math.round(resultShow.from + (resultShow.target - resultShow.from) * e);
      sctx.font = "700 12px Inter, sans-serif";
      sctx.shadowBlur = 0;
      sctx.fillStyle = resultShow.isBest ? "rgba(255,215,92,0.85)" : "rgba(255,255,255,0.6)";
      sctx.fillText(resultShow.label, W / 2, H * 0.38);
      const numPx = Math.min(58, W / 5, H * 0.24);
      sctx.font = "800 " + numPx + "px Unbounded, Inter, sans-serif";
      sctx.shadowColor = resultShow.isBest ? "rgba(255,215,92,0.55)" : "rgba(55,224,140,0.55)";
      sctx.shadowBlur = 30;
      sctx.fillStyle = resultShow.isBest ? "#ffd75c" : "#37e08c";
      sctx.fillText(val + "ms", W / 2, H * 0.54);
      sctx.shadowBlur = 0;
      sctx.font = "500 13px Inter, sans-serif";
      sctx.fillStyle = "rgba(255,255,255,0.7)";
      sctx.fillText("average of 5 games · tap to play again", W / 2, H * 0.67);
      return;
    }

    sctx.font = "800 " + titlePx + "px Unbounded, Inter, sans-serif";
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    if (mode === "ready") {
      const s = 1 + 0.03 * Math.sin(t * 14);
      sctx.save(); sctx.translate(W / 2, H * 0.5); sctx.scale(s, s);
    } else {
      sctx.save(); sctx.translate(W / 2, H * 0.5);
    }
    sctx.shadowColor = mode === "ready" ? "rgba(55,224,140,0.8)" : accent;
    sctx.shadowBlur = mode === "ready" ? 34 : 0;
    sctx.fillStyle = mode === "ready" ? "#d6ffe9" : "#f4f4f8";
    sctx.fillText(stagePhase.title || (roundGames.length ? "game on" : "tap to arm"), 0, 0);
    sctx.restore();

    // sub
    sctx.font = "500 13px Inter, sans-serif";
    sctx.shadowBlur = 0;
    sctx.fillStyle = "rgba(255,255,255,0.75)";
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillText(stagePhase.sub || (roundGames.length ? "average of 5 games is your score" : "then wait for green"), W / 2, Math.min(H * 0.42, 40) + titlePx * 0.35);
  }

  // ---- input ----
  function trustedInput(fn) {
    return function (e) {
      if (e && e.isTrusted === false) return;
      if (nameGate && !nameGate.classList.contains("hidden")) return;
      if (menuOverlay && !menuOverlay.classList.contains("hidden")) return;
      fn(e);
    };
  }
  stage.addEventListener("pointerdown", trustedInput(() => {
    if (mode === "idle" || mode === "waiting" || mode === "ready") stageAction();
  }));
  stage.addEventListener("click", trustedInput(() => { if (mode === "idle") stageAction(); }));
  document.addEventListener("keydown", trustedInput((e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    if (e.repeat) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
    e.preventDefault();
    stageAction();
  }));
  resultShare.addEventListener("click", (e) => e.stopPropagation());

  // ---- stage-effects ----
  if (stageCanvas) { sctx = stageCanvas.getContext("2d"); requestAnimationFrame(draw); }
  new MutationObserver(() => {
    const visible = !resultShare.classList.contains("hidden");
    if (resultActions) resultActions.classList.toggle("hidden", !visible);
  }).observe(resultShare, { attributes: true, attributeFilter: ["class"] });

  // ---- tilt + aura + press physics ----
  if (window.matchMedia("(pointer: fine)").matches) {
    stage.classList.add("tilting");
    const stageX = document.getElementById("stage");
    stageX.addEventListener("pointermove", (e) => {
      const r = stageX.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      stageX.style.transform = "perspective(900px) rotateY(" + (x * 5) + "deg) rotateX(" + (-y * 5) + "deg)";
      if (cursorAura) { cursorAura.style.left = ((x + 0.5) * 100) + "%"; cursorAura.style.top = ((y + 0.5) * 100) + "%"; }
    });
    stageX.addEventListener("pointerleave", () => { stageX.style.transform = ""; });
  }
  stage.addEventListener("pointerdown", () => stage.classList.add("pressing"));
  addEventListener("pointerup", () => stage.classList.remove("pressing"));

  // ---- leaderboard overlay ----
  function setBoardMode(mode) {
    boardMode = mode;
    boardTabTop.classList.toggle("is-active", mode === "top10");
    boardTabAll.classList.toggle("is-active", mode === "everyone");
    boardTabTop.setAttribute("aria-selected", mode === "top10" ? "true" : "false");
    boardTabAll.setAttribute("aria-selected", mode === "everyone" ? "true" : "false");
    renderBoard();
  }
  boardToggle.addEventListener("click", () => {
    boardOverlay.classList.remove("hidden");
    setBoardMode("top10");
  });
  boardTabTop.addEventListener("click", () => setBoardMode("top10"));
  boardTabAll.addEventListener("click", () => setBoardMode("everyone"));
  boardClose.addEventListener("click", () => boardOverlay.classList.add("hidden"));
  boardOverlay.addEventListener("click", (e) => { if (e.target === boardOverlay) boardOverlay.classList.add("hidden"); });

  // ---- menu (hamburger sheet) ----
  const menuOverlay = document.getElementById("menu");
  const menuToggle = document.getElementById("menu-toggle");
  const menuClose = document.getElementById("menu-close");
  function setMenu(open) {
    if (!menuOverlay) return;
    menuOverlay.classList.toggle("hidden", !open);
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
      menuToggle.classList.toggle("is-active", open);
    }
    if (open) { drawSpark(); } else { stage.focus(); }
  }
  if (menuToggle) menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(!!menuOverlay.classList.contains("hidden"));
  });
  if (menuClose) menuClose.addEventListener("click", () => setMenu(false));
  if (menuOverlay) menuOverlay.addEventListener("click", (e) => { if (e.target === menuOverlay) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOverlay && !menuOverlay.classList.contains("hidden")) setMenu(false);
  });

  // live refresh while board open
  setInterval(() => { if (!boardOverlay.classList.contains("hidden")) renderBoard(); }, 15000);
  function subscribeLive() {
    if (!supabase || liveChannel) return;
    try {
      liveChannel = supabase.channel("scores-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "scores" }, (payload) => {
        const r = payload.new;
        if (r && r.name !== playerName) pushLive("<b>" + escapeHtml(r.name) + "</b> averaged <span class='ms'>" + r.ms + "ms</span> across 5 games", true);
        if (!boardOverlay.classList.contains("hidden")) renderBoard();
      }).subscribe();
    } catch (_) {}
  }
  if (supabase && !localMode) subscribeLive();

  // ---- STATE OF ART: controls, themes, analytics, podium, share ----
  const themeToggle = document.getElementById("theme-toggle");
  const resultActions = document.getElementById("result-actions");
  const shareCardBtn = document.getElementById("share-card-btn");
  const rematchBtn = document.getElementById("rematch-btn");
  const analyticsAvg = document.getElementById("analytics-avg");
  const sparkline = document.getElementById("sparkline");
  const analyticsMeta = document.getElementById("analytics-meta");
  const podium = document.getElementById("podium");
  const shareModal = document.getElementById("share-modal");
  const shareClose = document.getElementById("share-close");
  const shareCanvas = document.getElementById("share-canvas");
  const shareTitle = document.getElementById("share-title");
  const shareDownload = document.getElementById("share-download");
  const shareNative = document.getElementById("share-native");
  let lastEntries = [];

  const THEMES = ["", "sunset", "ice"];
  let themeIdx = THEMES.indexOf(localStorage.getItem("rsr_theme") || "");
  if (themeIdx < 0) themeIdx = 0;
  function paintTheme() { document.body.dataset.theme = THEMES[themeIdx]; if (themeToggle) themeToggle.textContent = ["🌙", "🌅", "🧊"][themeIdx]; }
  if (themeToggle) themeToggle.addEventListener("click", (e) => { e.stopPropagation(); themeIdx = (themeIdx + 1) % THEMES.length; localStorage.setItem("rsr_theme", THEMES[themeIdx]); paintTheme(); tone(520 + themeIdx * 120, 0.12, "sine", 0.08); });
  paintTheme();

  // analytics sparkline (round averages)
  function drawSpark() {
    if (!sparkline) return;
    const ctx = sparkline.getContext("2d");
    const W = sparkline.width, H = sparkline.height;
    ctx.clearRect(0, 0, W, H);
    const h = game.history.map((x) => x.ms).slice(-20);
    if (!h.length) { ctx.fillStyle = "#7c7c92"; ctx.font = "22px Inter"; ctx.fillText("complete a round — your form shows here", 24, H / 2); return; }
    const min = Math.min(...h, sessionBest || 9999) * 0.9, max = Math.max(...h) * 1.1;
    const px = (i) => 16 + (i / Math.max(1, h.length - 1)) * (W - 32);
    const py = (v) => H - 14 - ((v - min) / Math.max(1, max - min)) * (H - 30);
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
    for (let g = 0; g < 3; g++) { const y = 14 + g * (H - 28) / 2; ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(W - 10, y); ctx.stroke(); }
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
  setInterval(() => { if (menuOverlay && !menuOverlay.classList.contains("hidden")) drawSpark(); }, 3000);

  // podium augmentation
  const _renderBoard = renderBoard;
  renderBoard = async function () {
    await _renderBoard();
    try {
      if (podium) {
        podium.innerHTML = "";
        if (lastEntries.length >= 2) {
          const order = [lastEntries[1], lastEntries[0], lastEntries[2]].filter(Boolean);
          const cls = ["p2", "p1", "p3"];
          order.forEach((e, k) => {
            const d = document.createElement("div");
            d.className = "podium-col " + cls[k];
            d.innerHTML = '<div class="podium-crown">' + (cls[k] === "p1" ? "👑" : cls[k] === "p2" ? "🥈" : "🥉") + '</div>' +
              '<div class="podium-name"></div><div class="podium-ms">' + e.ms + 'ms avg</div><div class="podium-bar"><i style="width:' + Math.max(18, 100 - (e.ms - lastEntries[0].ms) / 3) + '%"></i></div>';
            d.querySelector(".podium-name").textContent = e.name;
            podium.appendChild(d);
          });
        }
      }
    } catch (_) {}
  };

  if (rematchBtn) rematchBtn.addEventListener("click", (e) => { e.stopPropagation(); tone(700, 0.1, "sine", 0.08); stageAction(); });
  function drawShareCard() {
    const c = shareCanvas, ctx = c.getContext("2d");
    const avg = lastHitAvg || sessionBest || 248;
    const t = (avg < 200 ? "GODLIKE" : avg < 250 ? "ELITE" : avg < 350 ? "SOLID" : "WARMING UP");
    const g = ctx.createLinearGradient(0, 0, 900, 1120);
    g.addColorStop(0, "#171736"); g.addColorStop(0.55, "#0b0b14"); g.addColorStop(1, "#2a1030");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 1120);
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2;
    for (let y = 120; y < 1120; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke(); }
    ctx.fillStyle = "#8b84ff"; ctx.font = "700 30px Inter"; ctx.fillText("SPEED ◆ ROULETTE", 60, 90);
    ctx.fillStyle = "#ffd75c"; ctx.font = "700 26px Inter"; ctx.fillText("● LIVE CERTIFIED", 620, 90);
    ctx.fillStyle = "#fff"; ctx.font = "800 150px Unbounded, Inter, sans-serif";
    ctx.shadowColor = "#37e08c"; ctx.shadowBlur = 60;
    ctx.fillText(avg + "ms", 60, 330); ctx.shadowBlur = 0;
    ctx.fillStyle = "#37e08c"; ctx.font = "800 44px Inter";
    ctx.fillText("⚡ " + t + " — 5-GAME AVERAGE", 60, 400);
    ctx.fillStyle = "#fff"; ctx.font = "700 52px Inter"; ctx.fillText(playerName || "you", 60, 500);
    ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.font = "500 30px Inter";
    ctx.fillText("best avg " + (sessionBest || avg) + "ms · lvl " + levelFor(game.xp) + " · streak " + game.streak + "🔥", 60, 552);
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
  }
  if (shareCardBtn) shareCardBtn.addEventListener("click", (e) => {
    e.stopPropagation(); drawShareCard();
    if (shareTitle) shareTitle.textContent = (lastHitAvg || sessionBest || "—") + "ms ⚡";
    if (shareModal) shareModal.classList.remove("hidden");
    tone(760, 0.12, "triangle", 0.09);
  });
  if (shareClose) shareClose.addEventListener("click", () => shareModal.classList.add("hidden"));
  if (shareModal) shareModal.addEventListener("click", (e) => { if (e.target === shareModal) shareModal.classList.add("hidden"); });
  if (shareDownload) shareDownload.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = "reaction-" + (lastHitAvg || "best") + "ms.png";
    a.href = shareCanvas.toDataURL("image/png");
    a.click();
    toast("Card saved — flex it 🖼", "🖼", "");
  });
  if (shareNative) shareNative.addEventListener("click", async () => {
    try {
      const blob = await new Promise((res) => shareCanvas.toBlob(res, "image/png"));
      const file = new File([blob], "reaction.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My avg: " + lastHitAvg + "ms" });
      } else {
        await navigator.clipboard.writeText("I averaged " + lastHitAvg + "ms on Reaction Speed Roulette " + DEPLOYED_URL);
        toast("Link copied to clipboard 🔗", "🔗", "");
      }
    } catch (_) {}
  });

  // coach: first-run hint sequence
  if (!localStorage.getItem("rsr_coached")) {
    setTimeout(() => { if (!playerName) return; toast("Tap the big panel to arm…", "◉", ""); }, 1200);
    setTimeout(() => { if (roundsDone === 0 && playerName) toast("Play 5 games — your average is your score ⚡", "⏳", ""); }, 4500);
    localStorage.setItem("rsr_coached", "1");
  }

  renderGame();
})();