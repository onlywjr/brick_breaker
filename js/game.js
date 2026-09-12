// ==========================================
// ★ 新增：效能模式與優化開關
// ==========================================
// 將其設為 true 則會關閉所有高耗能的陰影光暈與粒子，解決輸入延遲
export let PERFORMANCE_MODE = true;

// 紀錄前一幀的 DOM 狀態，避免每秒 60 次的無效重繪
let lastP1Score = -1;
let lastP2Score = -1;
let lastP1W = -1;
let lastP2W = -1;
let lastP1Energy = -1;
let lastP2Energy = -1;

import { loadAudio, loadedAudio, playSfx } from "./audio.js";

import { onlineRenderPlayers } from "./lobby.js";

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

import {
  drawGameBackground,
  drawGameEntities,
  resetBackground,
} from "./renderer.js";

import {
  handleCollisions,
  maybeDrop,
  resetSkillCooldowns,
  resetGlobalDotState,
  applyLocalDebuff,
} from "./physics.js";

import {
  initChemistrySystem,
  setChemistryMode,
  openChemistryShop,
  equippedSkills,
  wishlist,
  chemSkills,
  calculateBrickHP,
  levelStats,
  resetLevelStats,
  ELEMENT_DATA,
  resetChemistryState,
  DIFFICULTY_CONFIG,
} from "../mod/chemistry.js";

window.setChemistryMode = setChemistryMode; // 讓 HTML 可以呼叫
export let chemDLCEnabled = true; // ★ 新增 DLC 全域開關

window.openChemistryShop = openChemistryShop;

window.proceedToNextLevel = () => {
  clearInterval(nextLevelTimer); // ★ 清除計時器
  document.getElementById("level-clear-overlay").style.display = "none";

  // ★ 離開商店，恢復顯示全域離開按鈕
  const leaveBtn = document.getElementById("global-leave-btn");
  if (leaveBtn) leaveBtn.style.display = "block";

  level++;
  buildLevel(level, document.getElementById("game"));
  resetRound(document.getElementById("game"));
  running = true;
  // ★ 修復卡死：重新喚醒遊戲迴圈引擎
  loop.last = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame((ts) =>
    loop(ts, document.getElementById("game")),
  );
};

window.enterShopFromLevelClear = () => {
  clearInterval(nextLevelTimer);
  document.getElementById("level-clear-overlay").style.display = "none";
  // ★ 進入商店前，先將全域離開按鈕隱藏
  const leaveBtn = document.getElementById("global-leave-btn");
  if (leaveBtn) leaveBtn.style.display = "none";

  // ★ 單人模式永遠是 1P (0)
  openChemistryShop("配方商店", 0, window.proceedToNextLevel);
};

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
export let isLevelClearing = false; // ★ 新增：過關緩衝狀態
export let levelStartTime = 0; // ★ 新增：關卡開始時間紀錄
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
export let ghostBalls = [];

// ==========================================
// ★ 新增：全域視覺特效控制器 (VFX)
// ==========================================
export let vfx = {
  shakeTime: 0,
  shakeMag: 0,
  flashTime: 0,
  flashMax: 0,
  flashColor: "255,255,255", // RGB 格式字串
};

export function triggerVFX(shakeMagnitude, flashC = null, flashDuration = 0) {
  if (shakeMagnitude > 0) {
    vfx.shakeTime = 0.5; // 固定震動 0.5 秒
    vfx.shakeMag = shakeMagnitude;
  }
  if (flashC && flashDuration > 0) {
    vfx.flashColor = flashC;
    vfx.flashTime = flashDuration;
    vfx.flashMax = flashDuration;
  }
}

export let boss = {
  active: false,
  level: 10,
  x: 400,
  y: 150,
  w: 160,
  h: 100,
  hp: 0, // 初始化設為 0，生成時再賦值
  maxHp: 0,
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
    invincibleTimer: 0,
    lives: 3,
    mathInventory: [],
  };
}

function generateBrickSymbol(gameMode, currentLevel) {
  // ★ 新增：未開啟化學 DLC 時，改為生成數學符號
  if (!chemDLCEnabled) {
    const operators = ["+", "-"];
    if (currentLevel >= 4) operators.push("×", "÷");

    let numMax = 9;
    if (currentLevel >= 4) numMax = 50;
    if (currentLevel >= 7) numMax = 99;

    // 70% 機率生成數字，30% 機率生成運算子
    if (Math.random() < 0.7) {
      return Math.floor(Math.random() * numMax + 1).toString();
    } else {
      return operators[Math.floor(Math.random() * operators.length)];
    }
  }

  // --- 以下保留原本的化學 DLC 邏輯 ---
  const basicPool = ["H", "C", "O", "N"];
  let rarePool = [];

  equippedSkills.forEach((skillId) => {
    if (!skillId) return;
    const skill = chemSkills.find((s) => s.id === skillId);
    if (skill)
      Object.keys(skill.elements).forEach((sym) => {
        if (!basicPool.includes(sym)) rarePool.push(sym);
      });
  });

  if (gameMode === 1) {
    wishlist.forEach((skillId) => {
      const skill = chemSkills.find((s) => s.id === skillId);
      if (skill)
        Object.keys(skill.elements).forEach((sym) => {
          if (!basicPool.includes(sym)) rarePool.push(sym);
        });
    });
  }

  rarePool = [...new Set(rarePool)];
  rarePool = rarePool.filter((sym) => {
    const category = ELEMENT_DATA[sym] ? ELEMENT_DATA[sym][1] : "unknown";
    if (["lanthanide", "actinide", "unknown"].includes(category))
      return currentLevel >= DIFFICULTY_CONFIG.UNLOCK_HEAVY;
    if (["transition"].includes(category))
      return currentLevel >= DIFFICULTY_CONFIG.UNLOCK_TRANSITION;
    if (["alkali", "alkaline", "main-metal", "metalloid"].includes(category))
      return currentLevel >= DIFFICULTY_CONFIG.UNLOCK_MAIN_METALS;
    return true;
  });

  if (rarePool.length === 0) rarePool = ["Na", "Cl", "Mg"];
  if (Math.random() < 0.7)
    return basicPool[Math.floor(Math.random() * basicPool.length)];
  else return rarePool[Math.floor(Math.random() * rarePool.length)];
}

function buildLevel(lv, cv) {
  if (chemDLCEnabled && typeof resetLevelStats === "function")
    resetLevelStats(); // ★ 關卡開始時重置統計
  bricks.length = 0;
  drops.length = 0;
  ghostBalls.length = 0;
  boss.active = false;
  boss.bullets.length = 0;
  resetBackground();
  document.getElementById("level-txt").textContent = lv >= 5 ? `∞ ${lv}` : lv;
  const bw = 80,
    bh = 28,
    pad = 8;

  function push(c, r, hp, isMoving = false, forceOffT = null) {
    const cols = 9,
      offL = (cv.width - (cols * bw + (cols - 1) * pad)) / 2;
    const offT =
      forceOffT !== null ? forceOffT
      : mode === 2 ? 80
      : 50;
    const memberIndex = (r * cols + c) % MEMBERS.length;
    let bX = c * (bw + pad) + offL;

    // 產生當前磚塊的化學/數學元素符號
    const currentBrickSymbol = generateBrickSymbol(mode, lv); // ★ 移除三元運算子，直接呼叫

    // ★ 修正：先將最終的 HP 結算出來，確保上下限一致
    const finalBrickHp =
      chemDLCEnabled ? calculateBrickHP(currentBrickSymbol, level) : hp;

    bricks.push({
      x: bX,
      y: r * (bh + pad) + offT,
      w: bw,
      h: bh,
      // ★ 修正：將 hp 與 maxHp 完全同步
      hp: finalBrickHp,
      maxHp: finalBrickHp,
      ci: memberIndex,
      isMoving: isMoving,
      dx: isMoving ? (Math.random() > 0.5 ? 1 : -1) * 1.5 : 0,
      minX: bX - 30,
      maxX: bX + 30,
      symbol: currentBrickSymbol,
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
  // ★ 定義 Emoji 圖庫
  const EMOJI_POOLS = {
    body: [
      "🤖",
      "👾",
      "👽",
      "👹",
      "👺",
      "👿",
      "💀",
      "👁️",
      "🧿",
      "🧠",
      "🫀",
      "☢️",
      "⚙️",
      "🛸",
      "🦷",
      "🦠",
      "🌰",
      "🧄",
      "🍙",
      "🍥",
      "🍩",
      "🪨",
      "🎱",
      "💿",
      "🧫",
      "⚜️",
    ],
    arm: ["🦾", "🦿", "⛓️", "🪢", "🔩", "🔗", "♾️", "⚕️"],
    weapon: [
      "🗡️",
      "🪓",
      "🔨",
      "⛏️",
      "🪃",
      "🏹",
      "💣",
      "🔪",
      "🪚",
      "🪛",
      "🔧",
      "🪝",
      "💉",
    ],
    bio: [
      "🐙",
      "🦑",
      "🦀",
      "🦞",
      "🦂",
      "🕷️",
      "🐍",
      "🐲",
      "🐉",
      "🦖",
      "😽",
      "🙈",
      "🐶",
      "🦁",
      "🐯",
      "🦥",
      "🐣",
      "🐸",
      "🐳",
      "🦪",
    ],
  };

  let baseHue = Math.floor(Math.random() * 360);

  // ★ 以 40% 機率決定是否為「單體生物 Boss」
  const isBioBoss = Math.random() < 0.4;

  if (isBioBoss) {
    // --- 生物類：不需組合 ---
    boss.parts = {
      type: "bio",
      hueMain: baseHue,
      bioEmoji:
        EMOJI_POOLS.bio[Math.floor(Math.random() * EMOJI_POOLS.bio.length)],
    };
  } else {
    // --- 機甲類：共用鏡像參數 ---
    const sharedArm =
      EMOJI_POOLS.arm[Math.floor(Math.random() * EMOJI_POOLS.arm.length)];
    const sharedPoseY = Math.random() > 0.5 ? 1 : -1;
    const sharedChainLen = 2 + Math.floor(Math.random() * 3);

    boss.parts = {
      type: "mech",
      hueMain: baseHue,
      body: EMOJI_POOLS.body[
        Math.floor(Math.random() * EMOJI_POOLS.body.length)
      ],
      leftArm: sharedArm,
      rightArm: sharedArm,
      leftWeapon:
        EMOJI_POOLS.weapon[
          Math.floor(Math.random() * EMOJI_POOLS.weapon.length)
        ],
      rightWeapon:
        EMOJI_POOLS.weapon[
          Math.floor(Math.random() * EMOJI_POOLS.weapon.length)
        ],
      leftPoseY: sharedPoseY,
      rightPoseY: sharedPoseY,
      leftChainLen: sharedChainLen,
      rightChainLen: sharedChainLen,
      weaponAngle: ((Math.random() - 0.5) * Math.PI) / 3,
    };
  }

  // 如果你希望左右手連拿的武器都一模一樣，可以把武器也抽出來
  // const sharedWeapon = EMOJI_POOLS.weapon[Math.floor(Math.random() * EMOJI_POOLS.weapon.length)];

  floatTexts.push({
    t: `☣️ BOSS - LEVEL：${lv} ☣️`,
    life: 2.5,
    x: cv.width / 2,
    y: cv.height / 2,
    c: "#690021",
    big: true,
  });
}

function resetRound(cv) {
  isLevelClearing = false; // ★ 重置過關狀態
  levelStartTime = performance.now(); // ★ 重置開局時間，防止技能瞬間連發

  // ★ 確保換關或重新開始時，強制解除殘留的光暈外框
  const wrapEl = document.getElementById("wrap");
  if (wrapEl) {
    wrapEl.classList.remove("skill-active-glow");
    wrapEl.style.removeProperty("--glow-color");
  }

  // ★ 強制清洗跨關卡的 Global DOT 毒霧狀態
  if (typeof resetGlobalDotState === "function") {
    resetGlobalDotState();
  }

  // ★ 確保換關或死亡時，強制解除畫面迷霧
  const blindEl = document.getElementById("online-blind");
  if (blindEl) blindEl.style.display = "none";

  // ★ 徹底清空雙方所有跨回合/跨關卡的殘留技能狀態與計時器
  [p1, p2].forEach((pl) => {
    if (!pl) return;

    // 取消所有尚未引爆或結束的 setTimeout
    if (pl.timers) {
      Object.values(pl.timers).forEach((timer) => clearTimeout(timer));
      pl.timers = {};
    }

    // 強制重置物理與視覺狀態
    pl.activeBuffs = {};
    pl.speedBuffRatio = 1;
    pl.scoreMultiplier = 1;
    pl.shield = 0;
    pl.reversed = false;
    pl.reversedTimer = 0;
    pl.chaosTimer = 0;
    pl.magneticDebuffTimer = 0;
    pl.invincibleTimer = 0;
    pl.speed = 9; // 確保冰凍/減速被解除
    pl.mathInventory = [];
  });
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
  chemDLCEnabled = document.getElementById("enable-dlc").checked;
  setChemistryMode(selectedMode);

  // ★ 修正：在進入商店「之前」清空進度，而不是之後
  if (chemDLCEnabled && typeof resetChemistryState === "function") {
    resetChemistryState();
    resetSkillCooldowns();
  }

  if (selectedMode === 2 && chemDLCEnabled) {
    // 依序傳入 0 與 1
    openChemistryShop("1P 配方商店", 0, () => {
      openChemistryShop("2P 配方商店", 1, () => {
        executeStartGame(selectedMode, cv);
      });
    });
  } else {
    executeStartGame(selectedMode, cv);
  }
}

// 這裡不要加 export，作為內部呼叫使用
function executeStartGame(selectedMode, cv) {
  // 在 executeStartGame 開頭加入：
  chemDLCEnabled = document.getElementById("enable-dlc").checked;
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

  // ★ 確保模式正確設定 (這非常重要，物理引擎依賴這個)
  mode = selectedMode;

  // ★ 啟動並設定 Event HUD 佈局
  setupEventHUDs();
  const centerHud = document.getElementById("center-event-hud");
  const p1Hud = document.getElementById("p1-event-hud");
  const p2Hud = document.getElementById("p2-event-hud");

  if (centerHud)
    centerHud.style.display = mode === 1 || onlineMode ? "flex" : "none"; // 改為 flex 以維持垂直置中
  if (p1Hud) p1Hud.style.display = mode === 2 && !onlineMode ? "block" : "none";
  if (p2Hud) p2Hud.style.display = mode === 2 && !onlineMode ? "block" : "none";

  document.getElementById("overlay").style.display = "none";
  cv.style.display = "block";
  document.getElementById("status").style.display = "flex";
  document.getElementById("global-leave-btn").style.display = "block";

  const inputLv = parseInt(document.getElementById("start-level").value, 10);
  level = isNaN(inputLv) || inputLv < 1 ? 1 : inputLv;

  // ★ 絕對不能加上 let！必須修改上方宣告的全域 p1, p2
  p1 = makePlayer("#F6A6C1", "#f9a8d4");
  p2 = makePlayer("#9DD9E8", "#9DD9E8");
  comboCount = 0;

  document.getElementById("p1-width-bar").parentElement.style.display = "none";
  if (mode === 1) {
    document.getElementById("p2-card").style.display = "none";
    document.getElementById("p1-energy-wrap").style.display = "none";
    document.getElementById("p2-energy-wrap").style.display = "none";
    // ★ 隱藏單人無用的血條
    document.getElementById("timer-container").style.display = "none";
  } else {
    document.getElementById("p2-card").style.display = "flex";
    // ★ 化學模式下隱藏能量條，一般模式顯示
    document.getElementById("p1-energy-wrap").style.display =
      chemDLCEnabled ? "none" : "block";
    document.getElementById("p2-energy-wrap").style.display =
      chemDLCEnabled ? "none" : "block";
    document.getElementById("timer-container").style.display = "flex";
    gameTimeRemaining = 180;
  }

  // 依序呼叫生成關卡與重新設定回合
  buildLevel(level, cv);
  resetRound(cv);

  running = true;
  loop.last = performance.now();
  updateVirtualButtonsVisibility(showVirtual, running, mode);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame((ts) => loop(ts, cv));
  playSfx("music");
}

// ==========================================
// ★ 乾淨的 HTML Event HUD 播報系統
// ==========================================
let eventTimers = { center: null, p1: null, p2: null };

export function triggerGameEvent(msg, isMajor = false, pId = 0) {
  if (isMajor) {
    floatTexts.push({
      t: msg,
      life: 2.5,
      x: 400,
      y: 300,
      c: pId === 1 ? "#5FA8D3" : "#E0576B",
      big: true,
    });
    return;
  }

  const isLocalMulti = mode === 2 && !onlineMode;
  // ★ 修正：單人模式改抓取內部的文字 span 進行淡入淡出，保留白底外框
  const targetId =
    isLocalMulti ?
      pId === 0 ?
        "p1-event-hud"
      : "p2-event-hud"
    : "center-event-text";
  const timerKey =
    isLocalMulti ?
      pId === 0 ?
        "p1"
      : "p2"
    : "center";

  const hud = document.getElementById(targetId);
  if (hud) {
    hud.innerText = msg;
    hud.style.opacity = "1";

    clearTimeout(eventTimers[timerKey]);
    eventTimers[timerKey] = setTimeout(() => {
      hud.style.opacity = "0";
    }, 2000);
  }
}

function setupEventHUDs() {
  const statusDiv = document.getElementById("status");

  if (statusDiv) {
    statusDiv.style.display = "flex";
    //statusDiv.style.justifyContent = "space-between";
    // 確保整體頂部欄向上對齊，避免互相拉扯高度
    statusDiv.style.alignItems = "flex-start";
  }

  // ★ 修正 2 & 3：強制統整 1P/2P 面板的高度、間距與內距
  ["p1-card", "p2-card"].forEach((id) => {
    const card = document.getElementById(id);
    if (card) {
      card.style.display = "flex";
      card.style.justifyContent = "center";
      card.style.gap = "4px"; // 縮小上下行距
      card.style.padding = "9px 16px"; // 縮小左右內距
      card.style.boxSizing = "border-box";
      card.style.height = "48px";
      if (mode === 2) {
        card.style.flexDirection = "column";
        card.style.height = "80px"; // 強制固定高度，確保 1P/2P 絕對一致
      }
    }
  });

  // ★ 徹底解決雙人模式 1P 卡片偏高的問題：隱藏無用的愛心容器
  const livesEl = document.getElementById("p1-lives");
  if (livesEl) {
    livesEl.style.display = mode === 1 ? "flex" : "none";
  }

  // A. 單人 / 連線模式：中央上方 HUD
  if (statusDiv && !document.getElementById("center-event-hud")) {
    const centerHud = document.createElement("div");
    centerHud.id = "center-event-hud";

    // ★ 放寬 max-width 讓左右雙欄有足夠空間，並使用 flex 佈局
    centerHud.style.cssText =
      "background: rgba(255, 255, 255, 0.75); border-radius: 30px; padding: 0; margin: 0 15px; flex: 1; max-width: 400px; height: 48px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; font-size: 14px; font-weight: 900; color: #DDA15E; z-index: 10; box-sizing: border-box; overflow: hidden;";

    // ★ 切分左右雙欄：
    // 左欄用來放「系統事件 (Combo / 回復等)」
    // 右欄用來放「技能輪播 (top-hud-buff-display)」
    // 中間加上一條淡淡的紫色分隔線
    centerHud.innerHTML = `
      <div style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: center;  padding: 0 10px;">
        <span id="center-event-text" style="opacity: 0; transition: opacity 0.3s; white-space: nowrap; pointer-events: none; text-shadow: 0 2px 4px rgba(255,255,255,0.8);"></span>
      </div>
      <div style="height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 10px;">
        <div id="top-hud-buff-display" style="display: none; align-items: center; justify-content: center; width: 100%;"></div>
      </div>
    `;

    // 確保它獨立於玩家卡片之外，插在 1P 卡片與 Level 區塊的正中間
    const p1Card = document.getElementById("p1-card");
    if (p1Card) {
      p1Card.insertAdjacentElement("afterend", centerHud);
    } else {
      statusDiv.appendChild(centerHud);
    }
  }

  // B. 單機雙人模式：1P / 2P 獨立 HUD (包含能量回復)
  ["p1", "p2"].forEach((p, idx) => {
    if (!document.getElementById(`${p}-event-hud`)) {
      const energyWrap = document.getElementById(`${p}-energy-wrap`);
      const card = document.getElementById(`${p}-card`);

      const hud = document.createElement("div");
      hud.id = `${p}-event-hud`;
      hud.style.cssText = `font-size: 12px; font-weight: 900; color: ${idx === 0 ? "#d96c8e" : "#5fa8d3"}; text-align: center; margin-top: 2px; opacity: 0; transition: opacity 0.3s; height: 16px; min-height: 16px; line-height: 16px; pointer-events: none; white-space: nowrap;`;

      if (energyWrap) {
        energyWrap.insertAdjacentElement("afterend", hud);
      } else if (card) {
        card.appendChild(hud);
      }
    }
  });
}

export let nextLevelTimer = null; // ★ 宣告倒數計時器

export function startOnlineGame(state, cv) {
  onlineMode = true;
  mode = 1; // 底層模式
  // ★ 強制讀取大廳同步好的 DLC 狀態
  chemDLCEnabled = document.getElementById("enable-dlc").checked;
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
  document.getElementById("global-leave-btn").style.display = "block";

  // ★ 正確補上：在連線模式中啟動並顯示中央 HUD
  if (typeof setupEventHUDs === "function") setupEventHUDs();
  const centerHud = document.getElementById("center-event-hud");
  if (centerHud) centerHud.style.display = "flex";
  const p1Hud = document.getElementById("p1-event-hud");
  if (p1Hud) p1Hud.style.display = "none";
  const p2Hud = document.getElementById("p2-event-hud");
  if (p2Hud) p2Hud.style.display = "none";

  document.getElementById("p2-card")?.style.setProperty("display", "none");
  document
    .getElementById("p1-energy-wrap")
    ?.style.setProperty("display", "block");

  document
    .getElementById("p1-width-bar")
    ?.parentElement.style.setProperty("display", "none"); // ★ 隱藏單人血條
  document
    .getElementById("p1-energy-wrap")
    ?.style.setProperty("display", chemDLCEnabled ? "none" : "block"); // ★ 化學模式隱藏能量條

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
  playSfx("music");
  for (const p of state?.players || [])
    onlinePlayers[p.id] = {
      ...p,
      alive: p.id === myPlayerId ? true : p.alive !== false,
    };
  triggerGameEvent("⚔️ 大亂鬥開始！", true);
}

export function endGame() {
  running = false;
  cancelAnimationFrame(animId);
  updateVirtualButtonsVisibility(showVirtual, running, mode);

  // ★ 強制解除殘留的光暈外框，防止帶入大廳
  const wrapEl = document.getElementById("wrap");
  if (wrapEl) {
    wrapEl.classList.remove("skill-active-glow");
    wrapEl.style.removeProperty("--glow-color");
  }

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
  if (document.getElementById("global-leave-btn"))
    document.getElementById("global-leave-btn").style.display = "none";
}

export function showOnlineMatchOver(result) {
  if (!onlineMode || onlineMatchFinished) return;
  onlineMatchFinished = true;
  running = false;

  // ★ 強制解除殘留的光暈外框，防止帶入大廳
  const wrapEl = document.getElementById("wrap");
  if (wrapEl) {
    wrapEl.classList.remove("skill-active-glow");
    wrapEl.style.removeProperty("--glow-color");
  }

  const winner = result?.winner,
    me = (result?.players || []).find((p) => p.id === myPlayerId),
    won = winner?.id === myPlayerId;
  const ranking = (result?.players || [])
    .slice()
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .map(
      (p) =>
        `<div class="ranking-item"><span style="width:100%; text-align:center;">#${p.rank || "?"} ${escapeHtml(p.name || "玩家")}</span></div>`,
    )
    .join("");
  document.getElementById("title").innerHTML =
    `<div class="victory-screen"><div class="trophy">${won ? "🏆" : "💀"}</div><div class="victory-title" style="color:${won ? "#DDA15E" : "#E0576B"}">${won ? "VICTORY!" : "ELIMINATED"}</div><div class="winner-score" style="font-size:24px;">${winner ? escapeHtml(winner.name || "玩家") + " 獲勝" : "對戰結束"}</div><div class="ranking-container">${ranking}</div><div class="vs-score" style="margin-top: 15px;">你的最終排名：#${me?.rank || "?"}</div><button class="menu-item-macaron macaron-blue" style="margin-top:20px;" onclick="window.returnToLobby()">返回大廳</button></div>`;
  document.getElementById("menu-btns").style.display = "none";
  document.getElementById("overlay").style.display = "flex";
  document.getElementById("game").style.display = "none";
  document.getElementById("status").style.display = "none";
  if (document.getElementById("global-leave-btn"))
    document.getElementById("global-leave-btn").style.display = "none";
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
  // ★ 替換為與 DLC 共通的標準 action 命名
  const pool = [
    "reverse_controls",
    "shrink_width",
    "damage_hp",
    "blind_screen",
    "slow_speed",
  ];
  const type = pool[Math.floor(Math.random() * pool.length)];
  const power =
    type === "damage_hp" ?
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
  const type = d?.type;
  const power = Number(d?.power) || 1;
  const duration = Number(d?.durationSec) || 3;
  const name = d?.attackerName || "對手";

  burst(400, 300, "#D96C8E"); // 畫面震動爆點

  // ★ 1. 統一呼叫底層處理物理狀態 (扣血、減速、計時器等都在這裡處理)
  applyLocalDebuff(p1, type, power, duration);

  // ★ 2. 保留您生動的 Switch 播報設計 (拿掉物理運算，只留文字)
  switch (type) {
    case "damage_hp":
    case "radiation_debuff":
    case "unstable_debuff":
    case "unstable_countdown":
      triggerGameEvent(`💥 ${name} 扣除了 ${power * 5} 分！`, false);
      break;

    case "shrink_width":
      triggerGameEvent(`⚠️ ${name} 使你擋板縮小！`, false);
      break;

    case "slow_speed":
      triggerGameEvent(`🐢 ${name} 使你減速！`, false);
      break;

    case "freeze":
      triggerGameEvent(`❄️ ${name} 將你完全凍結！`, false);
      break;

    case "reverse_controls":
      triggerGameEvent(`🔄 ${name} 反轉了你的操作！`, false);
      break;

    case "blind_screen":
    case "visual_distortion":
    case "fog_blind":
      triggerGameEvent(`👁 ${name} 遮蔽了你的視線！`, false);
      break;

    case "chaos_trajectory":
      triggerGameEvent(`🌀 ${name} 擾亂了球的軌跡！`, false);
      break;

    case "magnetic_pull":
      triggerGameEvent(`🧲 ${name} 發動了磁力干擾！`, false);
      break;

    default:
      // ★ 您提議的完美兜底：沒寫到專屬文字的，統一用這句
      triggerGameEvent(`⚠️ ${name} 發動了干擾！`, false);
      break;
  }
}

// ==========================================
// ★ 數學極限模式：出題引擎 (10秒挑戰)
// ==========================================
function startMathQuiz(pl, onComplete) {
  const overlay = document.getElementById("math-quiz-overlay");
  const questionEl = document.getElementById("math-quiz-question");
  const optionsEl = document.getElementById("math-quiz-options");
  const timerEl = document.getElementById("math-quiz-timer");

  if (!overlay) {
    onComplete();
    return;
  }

  // 1. 從玩家本局打破的方塊中萃取數字與運算符號
  let nums = pl.mathInventory.filter((s) => !isNaN(s));
  let ops = pl.mathInventory.filter(
    (s) => isNaN(s) && ["+", "-", "×", "÷"].includes(s),
  );

  // 系統防呆：如果玩家打太快沒收集到足夠符號，給予預設難度
  if (nums.length < 2) nums.push("7", "9", "15", "20");
  if (ops.length < 1) ops.push("+", "-", "×");

  let n1 = parseInt(nums[Math.floor(Math.random() * nums.length)]);
  let n2 = parseInt(nums[Math.floor(Math.random() * nums.length)]);
  let op = ops[Math.floor(Math.random() * ops.length)];

  // 2. 確保運算合理化 (避免負數與無法整除)
  if (op === "-" && n1 < n2) {
    [n1, n2] = [n2, n1];
  }
  if (op === "÷") {
    n1 = n1 * Math.max(1, n2);
  } // 反向相乘確保能被完美整除

  let ans = 0;
  if (op === "+") ans = n1 + n2;
  else if (op === "-") ans = n1 - n2;
  else if (op === "×") ans = n1 * n2;
  else if (op === "÷") ans = n1 / n2;

  questionEl.innerText = `${n1} ${op} ${n2} = ?`;

  // 3. 產生 1 個正確選項 + 3 個隨機誘答
  let options = [ans];
  while (options.length < 4) {
    let fake = ans + (Math.floor(Math.random() * 21) - 10); // 誤差範圍 +- 10
    if (fake !== ans && fake >= 0 && !options.includes(fake))
      options.push(fake);
  }
  options.sort(() => Math.random() - 0.5); // 洗牌

  optionsEl.innerHTML = "";
  let quizTimer = null;
  let timeLeft = 10.0;
  let isAnswered = false;

  const finishQuiz = () => {
    isAnswered = true;
    clearInterval(quizTimer);
    overlay.style.display = "none";
    onComplete(); // 結束後呼叫原本的換關/商店邏輯
  };

  options.forEach((opt) => {
    let btn = document.createElement("button");
    btn.className = "menu-item-macaron macaron-blue";
    btn.style.width = "100%";
    btn.style.fontSize = "28px";
    btn.style.fontFamily = "'Orbitron', sans-serif";
    btn.innerText = opt;
    btn.onclick = () => {
      if (isAnswered) return;
      if (opt === ans) {
        // ★ 答對：正向增強 (加命、加分、華麗特效)
        playSfx("music");
        pl.lives++;
        pl.score += 500;
        burst(400, 300, "#FBBF24");
        floatTexts.push({
          t: "❤️ +1  &  +500 PT!",
          life: 2,
          x: 400,
          y: 300,
          c: "#F6A6C1",
          big: true,
        });
      } else {
        // ★ 答錯：無懲罰，僅提示
        floatTexts.push({
          t: "答錯了！",
          life: 1.5,
          x: 400,
          y: 300,
          c: "#8A7E9C",
          big: true,
        });
      }
      finishQuiz();
    };
    optionsEl.appendChild(btn);
  });

  overlay.style.display = "flex";

  // 4. 啟動 10 秒倒數
  quizTimer = setInterval(() => {
    timeLeft -= 0.1;
    timerEl.innerText = timeLeft.toFixed(1) + "s";
    if (timeLeft <= 0) {
      floatTexts.push({
        t: "TIME UP!",
        life: 1.5,
        x: 400,
        y: 300,
        c: "#8A7E9C",
        big: true,
      });
      finishQuiz();
    }
  }, 100);
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
    ghostBalls,
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

  // ★ 優化：只在數值改變時才觸發 DOM 更新，解除 CPU 瓶頸
  if (p1.score !== lastP1Score) {
    document.getElementById("p1-score").textContent = p1.score;
    lastP1Score = p1.score;
  }

  const p1WidthPercent = Math.round((p1.w / 120) * 100);
  if (p1WidthPercent !== lastP1W) {
    document.getElementById("p1-width-bar").style.width = p1WidthPercent + "%";
    lastP1W = p1WidthPercent;
  }

  const p1EnergyPercent = (p1.energy / 10) * 100;
  if (p1EnergyPercent !== lastP1Energy) {
    document.getElementById("p1-energy-bar").style.width =
      p1EnergyPercent + "%";
    lastP1Energy = p1EnergyPercent;
  }

  if (mode === 2) {
    if (p2.score !== lastP2Score) {
      document.getElementById("p2-score").textContent = p2.score;
      lastP2Score = p2.score;
    }

    const p2WidthPercent = Math.round((p2.w / 120) * 100);
    if (p2WidthPercent !== lastP2W) {
      document.getElementById("p2-width-bar").style.width =
        p2WidthPercent + "%";
      lastP2W = p2WidthPercent;
    }

    const p2EnergyPercent = (p2.energy / 10) * 100;
    if (p2EnergyPercent !== lastP2Energy) {
      document.getElementById("p2-energy-bar").style.width =
        p2EnergyPercent + "%";
      lastP2Energy = p2EnergyPercent;
    }
  }

  // ★ 1. 將 1P 的生命改為「❤️ x 數字」格式 (適用於單人與連線對戰)
  const livesEl = document.getElementById("p1-lives");
  if (livesEl && (mode === 1 || onlineMode)) {
    livesEl.style.display = "flex";
    livesEl.style.alignItems = "center";
    livesEl.innerHTML = `<span style="font-size: 16px; margin-left: 15px; color: #ffb0b0">💗</span><span style="font-size: 16px; font-weight: 900; color: #d96c8e;">x ${Math.max(0, p1.lives)}</span>`;
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

  if (bricks.length === 0 && !boss.active && !isLevelClearing) {
    isLevelClearing = true;

    floatTexts.push({
      t: "✨ 全場爆破!! ✨",
      life: 1.5,
      x: cv.width / 2,
      y: cv.height / 2,
      c: "#F6D98B",
      big: true,
    });

    setTimeout(() => {
      for (const pl of activePlayers) pl.score += 200;

      // === 將原本的過關換波與商店邏輯打包 ===
      const proceedWithLevelClear = () => {
        if (mode === 1 && !onlineMode) {
          running = false;
          const overlay = document.getElementById("level-clear-overlay");
          const buttons = Array.from(overlay.querySelectorAll("button"));
          const shopBtn = buttons.find(
            (b) =>
              b.innerText.includes("商店")
              || b.getAttribute("onclick")?.includes("Shop"),
          );
          const nextBtn = buttons.find(
            (b) =>
              b.innerText.includes("下一關")
              || b.getAttribute("onclick")?.includes("proceedToNextLevel"),
          );

          if (shopBtn)
            shopBtn.style.display = chemDLCEnabled ? "inline-block" : "none";
          overlay.style.display = "flex";

          let statsDiv = document.getElementById("level-chem-stats");
          // ... 原本創建 statsDiv 的防呆邏輯 ...
          if (!statsDiv) {
            statsDiv = document.createElement("div");
            statsDiv.id = "level-chem-stats";
            statsDiv.style.margin = "15px auto";
            statsDiv.style.padding = "15px";
            statsDiv.style.background = "rgba(255,255,255,0.85)";
            statsDiv.style.border = "2px solid rgba(201, 177, 232, 0.4)";
            statsDiv.style.borderRadius = "12px";
            statsDiv.style.fontSize = "14px";
            statsDiv.style.textAlign = "left";
            statsDiv.style.width = "80%";
            statsDiv.style.maxWidth = "300px";
            statsDiv.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";

            const btnsContainer =
              shopBtn ? shopBtn.parentNode
              : nextBtn ? nextBtn.parentNode
              : overlay;
            btnsContainer.parentNode.insertBefore(statsDiv, btnsContainer);
          }

          if (chemDLCEnabled && typeof levelStats !== "undefined") {
            const { gained, used } = levelStats;
            const formatElements = (obj, color) => {
              const entries = Object.entries(obj).filter(([_, qty]) => qty > 0);
              if (entries.length === 0)
                return `<span style="color:#8a7e9c;">無</span>`;
              return entries
                .map(
                  ([sym, qty]) =>
                    `<span style="display:inline-block; margin-right:8px; color:${color}; font-family:serif; font-weight:900;">${sym} <span style="font-size:0.9em; opacity:0.8;">x${qty}</span></span>`,
                )
                .join("");
            };
            statsDiv.innerHTML = `
              <div style="font-weight:900; margin-bottom:10px; color:#5D576B; text-align:center; font-size:16px;">📊 結算</div>
              <div style="margin-bottom:6px;">📥 獲得：${formatElements(gained, "#2EB886")}</div>
              <div>🔥 消耗：${formatElements(used, "#E0576B")}</div>
            `;
            statsDiv.style.display = "block";
          } else {
            statsDiv.style.display = "none";
          }

          // 如果沒開 DLC，自動倒數 3 秒進入下一關
          if (!chemDLCEnabled && nextBtn) {
            let count = 3;
            if (!nextBtn.dataset.originalText)
              nextBtn.dataset.originalText = nextBtn.innerText
                .split("(")[0]
                .trim();
            const baseText = nextBtn.dataset.originalText;
            nextBtn.innerHTML = `${baseText} <span style="font-size:14px; opacity:0.8;">(${count}s)</span>`;

            clearInterval(nextLevelTimer);
            nextLevelTimer = setInterval(() => {
              count--;
              nextBtn.innerHTML = `${baseText} <span style="font-size:14px; opacity:0.8;">(${count}s)</span>`;
              if (count <= 0) window.proceedToNextLevel();
            }, 1000);
          }
        } else {
          // 雙人/連線模式：直接無縫進入下一波
          level++;
          buildLevel(level, cv);
          resetRound(cv);
          floatTexts.push({
            t: "NEXT WAVE!",
            life: 1.5,
            x: cv.width / 2,
            y: cv.height / 2 - 50,
            c: "#5FA8D3",
            big: true,
          });
        }
      };

      // ★ 核心路由：如果有開化學 DLC 就照舊；沒開 DLC 就觸發數學極限挑戰！
      if (!chemDLCEnabled) {
        startMathQuiz(p1, proceedWithLevelClear);
      } else {
        proceedWithLevelClear();
      }
    }, 1500);
  }

  if (onlineMode) {
    if (performance.now() - onlineLastStateSend >= 200) {
      onlineLastStateSend = performance.now();

      // ★ 1. 同時計算「殘留數量」與「本關總數量」
      const activeBrickCount = bricks.filter((b) => b.hp > 0).length;
      const totalBrickCount = Math.max(1, bricks.length); // 避免除以 0

      socket.emit("playerState", {
        score: p1.score,
        alive: !onlineEliminated,
        energy: p1.energy,
        level: level,
        paddle: {
          x: Math.round(p1.x),
          y: Math.round(p1.y),
          w: p1.w,
          h: p1.h,
          lives: p1.lives,
        },
        ball:
          p1.ball ?
            { x: Math.round(p1.ball.x), y: Math.round(p1.ball.y) }
          : null,

        // ★ 終極 Hack：將「總數」藏在 w，「殘留數」藏在 ci
        bricks: [
          { x: 0, y: 0, w: totalBrickCount, h: 0, hp: 1, ci: activeBrickCount },
        ],
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

    ctx.save(); // ★ 1. 儲存原始畫布座標

    // ★ 2. 處理螢幕震動 (Screen Shake)
    if (vfx.shakeTime > 0) {
      vfx.shakeTime -= dt / 60;
      // 產生隨機位移量
      let dx = (Math.random() - 0.5) * vfx.shakeMag * 2;
      let dy = (Math.random() - 0.5) * vfx.shakeMag * 2;
      ctx.translate(dx, dy);
    }

    drawGameBackground(ctx, cv);
    drawGameEntities(
      ctx,
      cv,
      {
        bricks,
        drops,
        particles,
        floatTexts,
        ghostBalls,
        boss,
        p1,
        p2,
        activePlayers: mode === 2 ? [p1, p2] : [p1],
      },
      loadedImages,
    );

    ctx.restore(); // ★ 3. 震動結束，還原畫布座標以免影響 UI

    // ★ 4. 處理全畫面閃光特效 (Screen Flash)
    if (vfx.flashTime > 0) {
      vfx.flashTime -= dt / 60;
      let alpha = Math.max(0, vfx.flashTime / vfx.flashMax);
      ctx.fillStyle = `rgba(${vfx.flashColor}, ${alpha * 0.7})`; // 最高 70% 不透明度
      ctx.fillRect(0, 0, cv.width, cv.height);
    }

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
  // 嚴格偵測：必須是沒有游標(滑鼠)且主要為觸控(手指)的裝置
  const isMobileTouch = window.matchMedia(
    "(hover: none) and (pointer: coarse)",
  ).matches;
  if (isMobileTouch) {
    showVirtual = true;
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    keys[e.key] = true;
    if (e.key === "*") {
      if (running) {
        bricks.length = 0;
        boss.active = false;
        /*
        floatTexts.push({
          t: "⚡ 跳關成功 ⚡",
          life: 1,
          x: 400,
          y: 300,
          c: "#DDA15E",
          big: true,
        });
        */
      }
    }
    if (e.key === "-" || e.key === "_") {
      if (running) {
        level = Math.ceil((level + 1) / 10) * 10;
        buildLevel(level, document.getElementById("game"));
        resetRound(document.getElementById("game"));
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
  // ★ 確保每次重置連線房間狀態時，立刻清空化學系統
  if (chemDLCEnabled && typeof resetChemistryState === "function") {
    resetChemistryState();
    resetSkillCooldowns();
  }
}

export function clearAttackPending() {
  onlineAttackPending = false;
}

// ==========================================
// ★ 開發者測試專用：乾淨畫面凍結 (按 P 鍵)
// ==========================================
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (e.key.toLowerCase() === "p") {
    const cv = document.getElementById("game");
    if (!cv || cv.style.display === "none") return;

    running = !running;

    if (running) {
      // 恢復遊戲
      loop.last = performance.now();
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame((ts) => loop(ts, cv));
      console.log("▶ 遊戲恢復運行");
    } else {
      // 凍結遊戲 (拔除所有畫布覆蓋效果，保持 100% 原畫面)
      cancelAnimationFrame(animId);
      console.log("⏸ 遊戲已完美凍結，可自由檢視畫面細節");
    }
  }
});

// ==========================================
// ★ 攔截 UI 導航：離開遊戲退回大廳/首頁時，強制提早洗白化學數據與特效
// ==========================================
function wipeGameUIState() {
  if (chemDLCEnabled && typeof resetChemistryState === "function") {
    resetChemistryState();
    resetSkillCooldowns();
  }

  // 1. 強制清除技能發光外框
  const wrapEl = document.getElementById("wrap");
  if (wrapEl) {
    wrapEl.classList.remove("skill-active-glow");
    wrapEl.style.removeProperty("--glow-color");
  }

  // 2. ★ 強制洗白玩家殘留的 Buff，避免卡在 HTML HUD 輪播上
  if (p1) p1.activeBuffs = {};
  if (p2) p2.activeBuffs = {};

  // 3. ★ 強制清空殘存的幽靈球
  ghostBalls.length = 0;

  // 4. ★ 強制隱藏與清空所有 DOM 狀態列，解決大廳殘影問題
  const topHud = document.getElementById("top-hud-buff-display");
  if (topHud) {
    topHud.style.display = "none";
    topHud.innerHTML = "";
  }
  const centerText = document.getElementById("center-event-text");
  if (centerText) {
    centerText.style.opacity = "0";
    centerText.innerText = "";
  }
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.style.display = "none";
}

const originalBackToMain = window.backToMainMenu;
window.backToMainMenu = function (...args) {
  wipeGameUIState();
  if (originalBackToMain) originalBackToMain(...args);
};

const originalReturnToLobby = window.returnToLobby;
window.returnToLobby = function (...args) {
  wipeGameUIState();
  if (originalReturnToLobby) originalReturnToLobby(...args);
};

// ==========================================
// ★ 終極攔截器：偵測玩家建立或加入大廳的瞬間，強制洗白
// ==========================================
if (socket) {
  const originalEmit = socket.emit;
  socket.emit = function (eventName, ...args) {
    // 只要系統一發送「建房」或「加房」等相關網路請求，瞬間將化學背包清零！
    if (
      ["createRoom", "joinRoom", "hostRoom", "join", "host"].includes(eventName)
    ) {
      if (chemDLCEnabled && typeof resetChemistryState === "function") {
        resetChemistryState();
        resetSkillCooldowns();
      }
    }
    return originalEmit.apply(this, [eventName, ...args]);
  };
}
