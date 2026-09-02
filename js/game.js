import { loadAudio, loadedAudio } from "./audio.js";
import {
  drawGameBackground,
  drawGameEntities,
  resetBackground,
} from "./renderer.js";
import { handleCollisions, maybeDrop } from "./physics.js";
import {
  setupVirtualControls,
  updateVirtualButtonsVisibility,
  resizeGame,
  formatTime,
  onlineShowStatus,
  escapeHtml,
} from "./ui.js";
import {
  socket,
  currentRoomCode,
  setRoomStatus,
  lobbyState,
} from "./socket.js";
import { onlineRenderPlayers } from "./lobby.js";

export const MEMBERS = [
  { name: "AHYEON", color: "#ec4899", light: "#F6A6C1" },
  { name: "RUKA", color: "#a855f7", light: "#C9B1E8" },
  { name: "CHIQUITA", color: "#eab308", light: "#F6D98B" },
  { name: "ASA", color: "#06b6d4", light: "#9DD9E8" },
  { name: "RAMI", color: "#10b981", light: "#34d399" },
  { name: "PHARITA", color: "#f97316", light: "#fb923c" },
  { name: "RORA", color: "#E79AAA", light: "#fb7185" },
];

export const loadedImages = {};
export const keys = {};

// Game State globals
export let mode = 1;
export let level = 1;
export let running = false;
export let animId = null;
export let showVirtual = false;
export let gameTimeRemaining = 180;
export let comboCount = 0;
export let comboTimer = 0;

export let p1, p2;
export let bricks = [];
export let drops = [];
export let particles = [];
export let floatTexts = [];
export let boss = {
  active: false,
  level: 10,
  x: 400,
  y: 150,
  w: 160,
  h: 100,
  hp: 100,
  maxHp: 100,
  phase: 1,
  dx: 2,
  attackCooldown: 0,
  bullets: [],
  flashTimer: 0,
  parts: {},
};

// Online globals
export let onlineMode = false;
export let myPlayerId = null;
export let onlinePlayers = {};
export let onlineLastStateSend = 0;
export let onlineBlindTimer = 0;
export let onlineSpeedTimer = 0;
export let onlineEliminated = false;
export let onlineMatchFinished = false;
export let onlineAttackCooldown = 0;
export let onlineAttackPending = false;

const IMG = {
  padS: "assets/png/pad_s.png",
  padM: "assets/png/pad_m.png",
  padL: "assets/png/pad_l.png",
};

export function loadImages() {
  const jobs = [];
  for (const [k, src] of Object.entries(IMG)) {
    jobs.push(
      new Promise((res) => {
        const im = new Image();
        im.src = src;
        const done = (img) => {
          loadedImages[k] = img;
          res();
        };
        im.onload = () => done(im);
        im.onerror = () => done(null);
        setTimeout(() => {
          if (!loadedImages[k]) done(null);
        }, 8000);
      }),
    );
  }
  return Promise.all(jobs);
}

function makePlayer(color, lightColor) {
  return {
    x: 0,
    y: 556,
    w: 120,
    h: 22,
    speed: 9,
    minW: 50,
    maxW: 320,
    color,
    lightColor,
    score: 0,
    ball: { x: 400, y: 300, r: 11, dx: 0, dy: 0, fire: false, owner: null },
    shrinkFx: 0,
    energy: 0,
    maxEnergy: 10,
    reversed: false,
    reversedTimer: 0,
    lives: 3,
  };
}

function buildLevel(lv, cv) {
  bricks.length = 0;
  drops.length = 0;
  boss.active = false;
  boss.bullets.length = 0;
  resetBackground();
  document.getElementById("level-txt").textContent = lv >= 5 ? `∞ ${lv}` : lv;
  const bw = 72,
    bh = 24,
    pad = 8;

  function push(c, r, hp, isMoving = false, forceOffT = null) {
    const cols = 9,
      offL = (cv.width - cols * (bw + pad) - pad) / 2;
    const offT =
      forceOffT !== null ? forceOffT
      : mode === 2 ? 80
      : 50;
    const memberIndex = (r * cols + c) % MEMBERS.length;
    let bX = c * (bw + pad) + offL;
    bricks.push({
      x: bX,
      y: r * (bh + pad) + offT,
      w: bw,
      h: bh,
      hp,
      maxHp: hp,
      ci: memberIndex,
      isMoving: isMoving,
      dx: isMoving ? (Math.random() > 0.5 ? 1 : -1) * 1.5 : 0,
      minX: bX - 30,
      maxX: bX + 30,
    });
  }

  if (lv % 10 === 0) {
    spawnBoss(lv, cv);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 9; c += 2) {
        push(c, r, Math.min(6, 3 + Math.floor(lv / 10)), true, 260);
      }
    }
    return;
  }
  if (lv === 1) {
    for (let r = 0; r < 5; r++)
      for (let c = r; c < 9 - r; c++) push(c, r, r === 0 ? 2 : 1);
  } else if (lv === 2) {
    const heart = [
      [0, 1, 1, 0, 0, 0, 1, 1, 0],
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
    ];
    heart.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) push(c, r, r < 2 ? 2 : 1);
      }),
    );
  } else if (lv === 3) {
    const ship = [
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 2, 1, 0, 0, 0],
      [0, 1, 1, 1, 2, 1, 1, 1, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 1],
    ];
    ship.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v > 0) push(c, r, v);
      }),
    );
  } else {
    let rows = Math.min(8, 4 + Math.floor(lv / 3));
    let movingRatio = Math.min(0.4, (lv - 4) * 0.05);
    let patternType = (lv - 4) % 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 9; c++) {
        let place = false;
        switch (patternType) {
          case 0:
            place = true;
            break;
          case 1:
            place = (r + c) % 2 === 0;
            break;
          case 2:
            place = r === 0 || r === rows - 1 || c === 0 || c === 8;
            break;
          case 3:
            place = c >= r && c < 9 - r;
            break;
          case 4:
            place = c === r || c === 8 - r;
            break;
          case 5:
            place = Math.random() > 0.3;
            break;
        }
        if (place)
          push(
            c,
            r,
            Math.min(5, 1 + Math.floor(Math.random() * (lv / 2))),
            lv >= 5 && Math.random() < movingRatio,
          );
      }
    }
    if (bricks.length === 0) push(4, 0, 1);
  }
}

function spawnBoss(lv, cv) {
  boss.active = true;
  boss.level = lv;
  boss.hp = 100 + (lv - 10) * 15;
  boss.maxHp = boss.hp;
  boss.w = 160;
  boss.h = 100;
  boss.x = cv.width / 2 - boss.w / 2;
  boss.y = mode === 2 ? 100 : 70;
  boss.phase = 1;
  boss.attackCooldown = 2;
  boss.bullets.length = 0;
  let baseHue = Math.floor(Math.random() * 360);
  boss.parts = {
    hueMain: baseHue,
    hueArmor: (baseHue + 60) % 360,
    hueAcc: (baseHue + 300) % 360,
    body: Math.floor(Math.random() * 3),
    hat: Math.floor(Math.random() * 3),
    leftArm: Math.floor(Math.random() * 3),
    rightArm: Math.floor(Math.random() * 3),
    leftWeapon: Math.floor(Math.random() * 3),
    rightWeapon: Math.floor(Math.random() * 3),
    core: Math.floor(Math.random() * 3),
  };
  floatTexts.push({
    t: `⚠ BOSS STAGE ${lv} ⚠`,
    life: 2.5,
    x: cv.width / 2,
    y: cv.height / 2,
    c: "#D96C8E",
    big: true,
  });
}

function resetRound(cv) {
  p1.w = 120;
  p1.x = mode === 1 ? (cv.width - p1.w) / 2 : 120 - p1.w / 2;
  p1.shrinkFx = 0;
  p1.ball = null;
  if (mode === 2) {
    p2.w = 120;
    p2.x = cv.width - 120 - p2.w / 2;
    p2.shrinkFx = 0;
    let spd = 4 + Math.min(3, level * 0.2);
    p2.ball = {
      x: p2.x + p2.w / 2,
      y: p2.y - 20,
      r: 11,
      dx: (Math.random() > 0.5 ? 1 : -1) * spd,
      dy: -spd,
      fire: false,
      owner: p2,
    };
  } else {
    p2.ball = null;
  }
  let spd = 4 + Math.min(3, level * 0.2);
  p1.ball = {
    x: p1.x + p1.w / 2,
    y: p1.y - 20,
    r: 11,
    dx: (Math.random() > 0.5 ? 1 : -1) * spd,
    dy: -spd,
    fire: false,
    owner: p1,
  };
}

export function burst(x, y, c) {
  for (let i = 0; i < 15; i++)
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1,
      c: c || ["#F6A6C1", "#F6D98B", "#9DD9E8"][i % 3],
    });
}

export function startGameGlobal(selectedMode, cv) {
  onlineMode = false;
  document.getElementById("p1-label").style.display = "inline";
  document.body.classList.remove("online-battle-mode");
  if (selectedMode === 1) document.body.classList.add("single-layout");
  else document.body.classList.remove("single-layout");
  onlineEliminated = false;
  document.getElementById("online-opponents-left").style.display = "none";
  document.getElementById("online-opponents-right").style.display = "none";
  document.getElementById("online-opponents-bottom").style.display = "none";
  document.getElementById("online-blind").style.display = "none";
  document.getElementById("online-attack-status").style.display = "none";
  onlineMatchFinished = false;
  myPlayerId = socket?.id || null;
  mode = selectedMode;
  document.getElementById("overlay").style.display = "none";
  cv.style.display = "block";
  document.getElementById("status").style.display = "flex";

  const inputLv = parseInt(document.getElementById("start-level").value, 10);
  level = isNaN(inputLv) || inputLv < 1 ? 1 : inputLv;
  p1 = makePlayer("#F6A6C1", "#f9a8d4");
  p2 = makePlayer("#9DD9E8", "#9DD9E8");
  comboCount = 0;

  if (mode === 1) {
    document.getElementById("p2-card").style.display = "none";
    document.getElementById("p1-energy-wrap").style.display = "none";
    document.getElementById("p2-energy-wrap").style.display = "none";
    document.getElementById("timer-container").style.display = "none";
  } else {
    document.getElementById("p2-card").style.display = "flex";
    document.getElementById("p1-energy-wrap").style.display = "block";
    document.getElementById("p2-energy-wrap").style.display = "block";
    document.getElementById("timer-container").style.display = "flex";
    gameTimeRemaining = 180;
  }

  buildLevel(level, cv);
  resetRound(cv);
  running = true;
  loop.last = performance.now();
  updateVirtualButtonsVisibility(showVirtual, running, mode);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame((ts) => loop(ts, cv));
  loadedAudio.music?.play().catch(() => {});
}

export function startOnlineGame(state, cv) {
  onlineMode = true;
  mode = 1;
  myPlayerId = socket.id;
  Object.keys(onlinePlayers).forEach((k) => delete onlinePlayers[k]);
  onlineEliminated = false;
  onlineMatchFinished = false;
  onlineLastStateSend = 0;
  onlineBlindTimer = 0;
  onlineSpeedTimer = 0;
  onlineAttackCooldown = 0;
  onlineAttackPending = false;
  document.getElementById("overlay").style.display = "none";
  document.body.classList.add("online-battle-mode", "single-layout");
  document.getElementById("p1-label").style.display = "none";
  cv.style.display = "block";
  document.getElementById("status").style.display = "flex";
  document.getElementById("p2-card")?.style.setProperty("display", "none");
  document
    .getElementById("p1-energy-wrap")
    ?.style.setProperty("display", "block");
  document
    .getElementById("p2-energy-wrap")
    ?.style.setProperty("display", "none");
  document.getElementById("timer-container").style.display = "none";

  const inputLv = parseInt(document.getElementById("start-level").value, 10);
  level = isNaN(inputLv) || inputLv < 1 ? 1 : inputLv;
  p1 = makePlayer("#F6A6C1", "#f9a8d4");
  p2 = makePlayer("#9DD9E8", "#9DD9E8");
  p1.lives = 3;
  p1.energy = 0;
  comboCount = 0;
  comboTimer = 0;
  buildLevel(level, cv);
  resetRound(cv);
  running = true;
  loop.last = performance.now();
  updateVirtualButtonsVisibility(showVirtual, running, mode);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame((ts) => loop(ts, cv));
  loadedAudio.music?.play().catch(() => {});
  for (const p of state?.players || [])
    onlinePlayers[p.id] = {
      ...p,
      alive: p.id === myPlayerId ? true : p.alive !== false,
    };
  onlineShowStatus("⚔️ 大亂鬥開始！集滿能量自動干擾對手。", 2200);
}

export function endGame() {
  running = false;
  cancelAnimationFrame(animId);
  updateVirtualButtonsVisibility(showVirtual, running, mode);
  let msg = "";
  if (mode === 2) {
    if (p1.score > p2.score)
      msg = `<div class="victory-screen"><div class="trophy">🏆</div><div class="victory-title" style="color:#D96C8E">1P 獲勝！</div><div class="winner-score">得分: ${p1.score}</div><div class="vs-score">vs ${p2.score}</div><button class="menu-item-macaron macaron-pink" style="margin-top:20px;" onclick="window.backToMainMenu()">返回首頁</button></div>`;
    else if (p2.score > p1.score)
      msg = `<div class="victory-screen"><div class="trophy">🏆</div><div class="victory-title" style="color:#5FA8D3">2P 獲勝！</div><div class="winner-score">得分: ${p2.score}</div><div class="vs-score">vs ${p1.score}</div><button class="menu-item-macaron macaron-blue" style="margin-top:20px;" onclick="window.backToMainMenu()">返回首頁</button></div>`;
    else
      msg = `<div class="victory-screen"><div class="trophy">🤝</div><div class="victory-title" style="color:#5D576B">平手！</div><div class="winner-score">${p1.score} : ${p2.score}</div><button class="menu-item-macaron macaron-yellow" style="margin-top:20px;" onclick="window.backToMainMenu()">返回首頁</button></div>`;
  } else {
    msg = `<div class="victory-screen"><div class="winner-score" style="color:#D96C8E; font-size:48px;">最終得分: ${p1.score}</div><div class="vs-score">剩餘生命: ${Math.max(0, p1.lives)}</div><button class="menu-item-macaron macaron-pink" style="margin-top:20px;" onclick="window.backToMainMenu()">返回首頁</button></div>`;
  }
  document.getElementById("title").innerHTML = msg;
  document.getElementById("menu-btns").style.display = "none";
  document.getElementById("bottom-status-bar").style.display = "none";
  document.getElementById("overlay").style.display = "flex";
  document.getElementById("game").style.display = "none";
  document.getElementById("status").style.display = "none";
}

export function showOnlineMatchOver(result) {
  if (!onlineMode || onlineMatchFinished) return;
  onlineMatchFinished = true;
  running = false;
  const winner = result?.winner,
    me = (result?.players || []).find((p) => p.id === myPlayerId),
    won = winner?.id === myPlayerId;
  const ranking = (result?.players || [])
    .slice()
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .map(
      (p) =>
        `<div class="ranking-item"><span>#${p.rank || "?"} ${escapeHtml(p.name || "玩家")}</span><span style="color:#DDA15E; font-family:'Orbitron', sans-serif; font-weight:800;">${p.score || 0}</span></div>`,
    )
    .join("");
  document.getElementById("title").innerHTML =
    `<div class="victory-screen"><div class="trophy">${won ? "🏆" : "💀"}</div><div class="victory-title" style="color:${won ? "#DDA15E" : "#E0576B"}">${won ? "VICTORY!" : "ELIMINATED"}</div><div class="winner-score" style="font-size:24px;">${winner ? escapeHtml(winner.name || "玩家") + " 獲勝" : "對戰結束"}</div><div class="ranking-container">${ranking}</div><div class="vs-score" style="margin-top: 15px;">你的最終排名：#${me?.rank || "?"}</div><button class="menu-item-macaron macaron-blue" style="margin-top:20px;" onclick="window.returnToLobby()">返回大廳</button></div>`;
  document.getElementById("menu-btns").style.display = "none";
  document.getElementById("overlay").style.display = "flex";
  document.getElementById("game").style.display = "none";
  document.getElementById("status").style.display = "none";
  document.getElementById("lobby-screen").style.display = "none";
  document.getElementById("room-status").style.display = "none";
  document.getElementById("bottom-status-bar").style.display = "none";
  document.getElementById("online-attack-status").style.display = "none";
  document.getElementById("online-opponents-left").style.display = "none";
  document.getElementById("online-opponents-right").style.display = "none";
  document.getElementById("online-opponents-bottom").style.display = "none";
}

export function onlineFinishLocalElimination() {
  if (!onlineMode || onlineEliminated || onlineMatchFinished) return;
  onlineEliminated = true;
  running = false;
  if (socket?.connected) {
    socket.emit("playerEliminated", {
      score: p1?.score || 0,
      energy: p1?.energy || 0,
      level,
    });
    socket.emit("playerState", {
      score: p1?.score || 0,
      alive: false,
      rank: null,
      energy: 0,
      level,
      paddle: p1 ? { x: p1.x, y: p1.y, w: p1.w, h: p1.h } : null,
      ball: null,
      bricks: [],
    });
  }
  onlineShowStatus("💀 你已被淘汰，等待對戰結果…", 999999);
  updateVirtualButtonsVisibility(showVirtual, running, mode);
}

export function onlineChooseAttack() {
  if (
    !onlineMode
    || !socket?.connected
    || !p1
    || onlineAttackCooldown > 0
    || onlineAttackPending
    || p1.energy < p1.maxEnergy
  )
    return;
  const pool = ["reverse", "shrink", "garbage", "blind", "speed"],
    type = pool[Math.floor(Math.random() * pool.length)],
    power =
      type === "garbage" ?
        Math.random() < 0.55 ?
          1
        : 2
      : 1;
  onlineAttackPending = true;
  socket.emit("attackPlayer", {
    type,
    power,
    energy: p1.energy,
    attackId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  onlineAttackCooldown = 0.5;
  document
    .getElementById("p1-energy-wrap")
    ?.classList.remove("online-energy-ready");
  onlineShowStatus(`⚡ 發動 ${type.toUpperCase()}！`, 900);
}

export function onlineReceiveAttack(d) {
  if (!onlineMode || onlineEliminated) return;
  const type = d?.type || "reverse",
    power = Math.max(1, Number(d?.power) || 1),
    name = d?.attackerName || "對手";
  if (type === "shrink") {
    p1.w = Math.max(p1.minW, p1.w - 25 * power);
    p1.shrinkFx = 1;
    onlineShowStatus(`💥 ${name}：擋板縮小！`);
  } else if (type === "reverse") {
    p1.reversed = true;
    p1.reversedTimer = Math.max(3, 5 + power - 1);
    onlineShowStatus(
      `🔄 ${name}：操作反轉 ${Math.ceil(p1.reversedTimer)} 秒！`,
      1800,
    );
  } else if (type === "garbage") {
    /* inline garbage function logic to keep simple */ const bw = 72,
      bh = 24,
      pad = 8,
      cols = 9,
      offL = (800 - cols * (bw + pad) - pad) / 2;
    for (const b of bricks) b.y -= power * (bh + pad);
    for (let r = 0; r < power; r++)
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.18) continue;
        const x = c * (bw + pad) + offL;
        bricks.push({
          x,
          y: 600 - (power - r) * (bh + pad) - 8,
          w: bw,
          h: bh,
          hp: 4,
          maxHp: 4,
          ci: (c + r * cols) % MEMBERS.length,
          isMoving: false,
          dx: 0,
          minX: x,
          maxX: x,
          interference: true,
        });
      }
    burst(400, 530, "#E0576B");
    onlineShowStatus(`🧱 ${name}：垃圾磚 ×${Math.min(2, power)}！`, 1600);
  } else if (type === "blind") {
    onlineBlindTimer = 2.8;
    onlineShowStatus(`👁 ${name}：視線干擾！`, 1400);
  } else if (type === "speed") {
    if (p1.ball) {
      p1.ball.dx *= 1.5;
      p1.ball.dy *= 1.5;
    }
    onlineSpeedTimer = 3;
    onlineShowStatus(`⚡ ${name}：球速 ×1.5！`, 1600);
  }
  burst(400, 300, "#D96C8E");
  const blindEl = document.getElementById("online-blind");
  if (blindEl) blindEl.style.display = onlineBlindTimer > 0 ? "block" : "none";
}

export function updateGameState(dt, cv) {
  if (mode === 2) {
    gameTimeRemaining -= (dt * 16.6) / 1000;
    document.getElementById("timer-txt").textContent = formatTime(
      Math.max(0, gameTimeRemaining),
    );
    if (gameTimeRemaining <= 0) {
      endGame();
      return;
    }
  }
  // ==========================================
  // 補回遺失的擋板移動邏輯
  // ==========================================
  let p1Left =
    p1.reversed ? keys["d"]
    : mode === 2 ? keys["a"]
    : keys.ArrowLeft;
  let p1Right =
    p1.reversed ? keys["a"]
    : mode === 2 ? keys["d"]
    : keys.ArrowRight;
  if (p1Right && p1.x + p1.w < cv.width) p1.x += p1.speed * dt;
  if (p1Left && p1.x > 0) p1.x -= p1.speed * dt;

  if (mode === 2) {
    const p2Left = p2.reversed ? keys.ArrowRight : keys.ArrowLeft;
    const p2Right = p2.reversed ? keys.ArrowLeft : keys.ArrowRight;
    if (p2Right && p2.x + p2.w < cv.width) p2.x += p2.speed * dt;
    if (p2Left && p2.x > 0) p2.x -= p2.speed * dt;
  }
  // ==========================================
  const activePlayers = mode === 2 ? [p1, p2] : [p1];
  let gameState = {
    bricks,
    drops,
    particles,
    floatTexts,
    boss,
    p1,
    p2,
    activePlayers,
    comboCount,
    comboTimer,
  };

  handleCollisions(
    dt,
    cv,
    gameState,
    document.getElementById("p1-energy-wrap"),
  );

  comboCount = gameState.comboCount;
  comboTimer = gameState.comboTimer;
  particles = particles.filter((p) => (p.life -= 0.03 * dt) > 0);
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });

  if (onlineMode && !onlineEliminated) {
    let myRank = 1;
    for (const id in onlinePlayers) {
      if (id !== myPlayerId && onlinePlayers[id].alive !== false) {
        if ((onlinePlayers[id].score || 0) > p1.score) myRank++;
      }
    }
    const p1RankEl = document.getElementById("p1-rank");
    if (p1RankEl) p1RankEl.textContent = `🏆 #${myRank}`;
  }

  document.getElementById("p1-score").textContent = p1.score;
  document.getElementById("p1-width-bar").style.width =
    Math.round((p1.w / 120) * 100) + "%";
  document.getElementById("p1-energy-bar").style.width =
    (p1.energy / 10) * 100 + "%";
  if (mode === 2) {
    document.getElementById("p2-score").textContent = p2.score;
    document.getElementById("p2-width-bar").style.width =
      Math.round((p2.w / 120) * 100) + "%";
    document.getElementById("p2-energy-bar").style.width =
      (p2.energy / 10) * 100 + "%";
  }
  if (mode === 1) {
    const livesEl = document.getElementById("p1-lives");
    if (livesEl) {
      livesEl.style.display = "flex";
      livesEl.innerHTML = "";
      for (let i = 0; i < p1.lives; i++) {
        const heart = document.createElement("div");
        heart.className = "life-heart";
        livesEl.appendChild(heart);
      }
    }
  }
  if (p1.reversedTimer > 0) {
    p1.reversedTimer -= dt / 60;
    if (p1.reversedTimer <= 0) {
      p1.reversed = false;
      p1.reversedTimer = 0;
    }
  }
  if (mode === 2 && p2.reversedTimer > 0) {
    p2.reversedTimer -= dt / 60;
    if (p2.reversedTimer <= 0) {
      p2.reversed = false;
      p2.reversedTimer = 0;
    }
  }
  if (bricks.length === 0 && !boss.active) {
    level++;
    buildLevel(level, cv);
    resetRound(cv);
    for (const pl of activePlayers) pl.score += 200;
    floatTexts.push({
      t: "STAGE CLEAR! +200!",
      life: 1.5,
      x: cv.width / 2,
      y: cv.height / 2 - 50,
      c: "#5FA8D3",
    });
  }
  if (onlineMode) {
    if (performance.now() - onlineLastStateSend >= 100) {
      onlineLastStateSend = performance.now();
      socket.emit("playerState", {
        score: p1.score,
        alive: !onlineEliminated,
        rank: null,
        energy: p1.energy,
        level,
        paddle: { x: p1.x, y: p1.y, w: p1.w, h: p1.h },
        ball:
          p1.ball ?
            {
              x: p1.ball.x,
              y: p1.ball.y,
              r: p1.ball.r,
              dx: p1.ball.dx,
              dy: p1.ball.dy,
              fire: !!p1.ball.fire,
            }
          : null,
        bricks: bricks
          .slice(0, 180)
          .map((b) => ({
            x: Math.round(b.x),
            y: Math.round(b.y),
            w: b.w,
            h: b.h,
            hp: b.hp,
            ci: b.ci || 0,
            interference: !!b.interference,
          })),
      });
    }
  }
}

export function loop(ts, cv) {
  const dt = Math.min((ts - loop.last) / 16.6, 3);
  loop.last = ts;
  if (!running) return;
  try {
    updateGameState(dt, cv);
    const ctx = cv.getContext("2d");
    drawGameBackground(ctx, cv);
    drawGameEntities(
      ctx,
      cv,
      {
        bricks,
        drops,
        particles,
        floatTexts,
        boss,
        p1,
        p2,
        activePlayers: mode === 2 ? [p1, p2] : [p1],
      },
      loadedImages,
    );

    if (onlineMode) {
      onlineRenderPlayers(
        document.getElementById("online-opponents-left"),
        document.getElementById("online-opponents-right"),
        document.getElementById("online-opponents-bottom"),
      );
      if (onlineBlindTimer > 0) {
        onlineBlindTimer -= dt / 60;
        const blindEl = document.getElementById("online-blind");
        if (onlineBlindTimer <= 0 && blindEl) blindEl.style.display = "none";
      }
      if (onlineAttackCooldown > 0) onlineAttackCooldown -= dt / 60;
    }
  } catch (e) {
    console.error("Game loop error:", e);
  }
  animId = requestAnimationFrame((nTs) => loop(nTs, cv));
}

export function initGlobalBindings() {
  const touchCapable = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const coarsePointer =
    window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches;

  // 只要設備支援觸控且指標不精確（如手指），就自動開啟虛擬按鍵
  if (touchCapable && coarsePointer) {
    showVirtual = true;
  }
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    keys[e.key] = true;
    if (e.key === "*") {
      if (running) {
        bricks.length = 0;
        boss.active = false;
        floatTexts.push({
          t: "⚡ 跳關成功 ⚡",
          life: 1,
          x: 400,
          y: 300,
          c: "#DDA15E",
          big: true,
        });
      }
    }
    if (e.key === "-" || e.key === "_") {
      if (running) {
        level = Math.ceil((level + 1) / 10) * 10;
        buildLevel(level, document.getElementById("game"));
        resetRound(document.getElementById("game"));
        floatTexts.push({
          t: `⚠ 召喚 BOSS (第 ${level} 關)! ⚡`,
          life: 1.5,
          x: 400,
          y: 300,
          c: "#E0576B",
          big: true,
        });
      }
    }
    if (e.key === "+" || e.key === "=") {
      showVirtual = !showVirtual;
      updateVirtualButtonsVisibility(showVirtual, running, mode);
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.key] = false;
  });
  window.addEventListener("resize", resizeGame);
  window.addEventListener("orientationchange", resizeGame);
}

export function resetMatchState() {
  onlineEliminated = false;
  onlineMatchFinished = false;
}