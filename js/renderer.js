import { lightenColor, skillCooldowns } from "./physics.js";

import {
  MEMBERS,
  chemDLCEnabled,
  p1,
  p2,
  mode,
  onlineMode,
  onlineBlindTimer,
  PERFORMANCE_MODE,
  vfx,
} from "./game.js";

import {
  ELEMENT_DATA,
  getNeededElements,
  chemStates,
  getSkillData,
} from "../mod/chemistry.js";

// ==========================================
// ★ 八方位校正系統 (將各種起點的武器統一轉向「左側/前方」)
// ==========================================
const ORIGIN_ROTATION = {
  "中上": Math.PI / 2, // 握把在上，往下指 -> 校正轉向左
  "右上": Math.PI / 4, // 握把在右上，往左下指
  "右中": 0, // 握把在右，往左指 (不需校正)
  "右下": -Math.PI / 4, // 握把在右下，往左上指
  "中下": -Math.PI / 2, // 握把在下，往上指
  "左下": -Math.PI * 0.75, // 握把在左下，往右上指
  "左中": Math.PI, // 握把在左，往右指
  "左上": Math.PI * 0.75, // 握把在左上，往右下指
};

// ==========================================
// ★ 骨架節點設定字典 (Anchor Config) - 完整擴充版
// ==========================================
const ANCHORS = {
  body: {
    default: { shoulderX: -30, shoulderY: 0 },
    "🤖": { shoulderX: -35, shoulderY: 30 },
    "👾": { shoulderX: -40, shoulderY: 5 },
    "👽": { shoulderX: -45, shoulderY: 0 },
    "👹": { shoulderX: -40, shoulderY: 10 },
    "👺": { shoulderX: -40, shoulderY: 0 },
    "👿": { shoulderX: -45, shoulderY: 0 },
    "💀": { shoulderX: -45, shoulderY: 0 },
    "👁️": { shoulderX: -45, shoulderY: 0 },
    "🧿": { shoulderX: -45, shoulderY: 0 },
    "🧠": { shoulderX: -48, shoulderY: 0 },
    "🫀": { shoulderX: -40, shoulderY: 0 },
    "☢️": { shoulderX: -45, shoulderY: 0 },
    "⚙️": { shoulderX: -45, shoulderY: 0 },
    "🛸": { shoulderX: -40, shoulderY: 0 },
    "🦷": { shoulderX: -40, shoulderY: -10 },
    "🦠": { shoulderX: -40, shoulderY: 0 },
    "🌰": { shoulderX: -40, shoulderY: 5 },
    "🧄": { shoulderX: -40, shoulderY: 10 },
    "🍙": { shoulderX: -40, shoulderY: 10 },
    "🍥": { shoulderX: -45, shoulderY: 0 },
    "🍩": { shoulderX: -45, shoulderY: 0 },
    "🪨": { shoulderX: -40, shoulderY: 10 },
    "🎱": { shoulderX: -45, shoulderY: 0 },
    "💿": { shoulderX: -45, shoulderY: 0 },
    "🧫": { shoulderX: -40, shoulderY: 0 },
    "⚜️": { shoulderX: -40, shoulderY: 0 },
  },
  arm: {
    default: {
      body: { x: 11, y: 5 },
      weapon: { x: -4, y: -9 },
      flipX: false,
      flipY: false,
    },
    "🦾": {
      body: { x: 11, y: 5 },
      weapon: { x: -4, y: -9 },
      flipX: false,
      flipY: false,
    },
    "🦿": {
      body: { x: -8, y: -12 },
      weapon: { x: 6, y: 14 },
      flipX: true,
      flipY: false,
      lockPoseY: true,
    },
    "⛓️": {
      body: { x: 0, y: -13 },
      weapon: { x: 0, y: 11 },
      flipX: false,
      flipY: false,
      isChain: true,
    },
    "🪢": {
      body: { x: 12, y: -13 },
      weapon: { x: -12, y: 13 },
      flipX: false,
      flipY: false,
      isChain: true,
    },
    "🔩": {
      body: { x: -8, y: -8 },
      weapon: { x: 10, y: 12 },
      flipX: true,
      flipY: false,
    },
    "🔗": {
      body: { x: 10, y: -11 },
      weapon: { x: -10, y: 11 },
      flipX: false,
      flipY: false,
      isChain: true,
    },
    "♾️": {
      body: { x: 11, y: 0 },
      weapon: { x: -12, y: 0 },
      flipX: false,
      flipY: false,
      isChain: true,
    },
    "⚕️": {
      body: { x: 0, y: -14 },
      weapon: { x: 0, y: 13 },
      flipX: false,
      flipY: false,
      isChain: true,
    },
  },
  weapon: {
    default: { origin: "左下", handle: { x: 0, y: 0 } },
    "🗡️": { origin: "右上", handle: { x: 12, y: -15 } },
    "🪓": { origin: "右下", handle: { x: 9, y: 12 } },
    "🔨": { origin: "右下", handle: { x: 11, y: 13 } },
    "⛏️": { origin: "右下", handle: { x: 12, y: 13 } },
    "🪃": { origin: "右下", handle: { x: 12, y: 14 } },
    "🏹": { origin: "左下", handle: { x: -11, y: 12 } },
    "💣": { origin: "左下", handle: { x: -3, y: 2 } },
    "🔪": { origin: "左上", handle: { x: -13, y: -15 } },
    "🪚": { origin: "右下", handle: { x: 11, y: 13 } },
    "🪛": { origin: "右下", handle: { x: 11, y: 13 } },
    "🔧": { origin: "右下", handle: { x: 11, y: 13 } },
    "🪝": { origin: "中上", handle: { x: -6, y: -16 } },
    "💉": { origin: "左下", handle: { x: -12, y: 13 } },
  },
};

// ==========================================
// ★ 效能優化：預先渲染愛心 (Off-screen Canvas)
// 遊戲啟動時只畫一次，之後當作圖片「蓋印章」
// ==========================================
const cachedHeartCanvas = document.createElement("canvas");
cachedHeartCanvas.width = 60;
cachedHeartCanvas.height = 60;
const hCtx = cachedHeartCanvas.getContext("2d");

// 繪製純向量貝茲曲線愛心
hCtx.fillStyle = "#FF69B4"; // 亮粉色
hCtx.shadowColor = "rgba(255, 105, 180, 0.8)";
hCtx.shadowBlur = 8; // 加上一點點發光效果

hCtx.beginPath();
const hSize = 40;
const hx = 30; // 畫布中心 X
const hy = 15; // 畫布起始 Y
const topH = hSize * 0.3;

hCtx.moveTo(hx, hy + topH);
hCtx.bezierCurveTo(hx, hy, hx - hSize / 2, hy, hx - hSize / 2, hy + topH);
hCtx.bezierCurveTo(
  hx - hSize / 2,
  hy + (hSize + topH) / 2,
  hx,
  hy + hSize * 0.8,
  hx,
  hy + hSize,
);
hCtx.bezierCurveTo(
  hx,
  hy + hSize * 0.8,
  hx + hSize / 2,
  hy + (hSize + topH) / 2,
  hx + hSize / 2,
  hy + topH,
);
hCtx.bezierCurveTo(hx + hSize / 2, hy, hx, hy, hx, hy + topH);
hCtx.fill();

let currentBg = null;

const BG_PALETTES = [
  { name: "Pink Sky", colors: ["#F06FAE", "#FF9F7A", "#7CCBE8", "#D99BEA"] },
  { name: "Baby Blue", colors: ["#55BCE5", "#7ED8EA", "#F27FAE", "#B39BE8"] },
  {
    name: "Lavender Dream",
    colors: ["#A985DC", "#D58BCB", "#72BFE5", "#F09AB8"],
  },
  { name: "Mint Dream", colors: ["#58C99A", "#83DDB5", "#69C5E5", "#E88EBA"] },
  { name: "Lemon Candy", colors: ["#E8C83F", "#FF9F68", "#6EC8E5", "#DD8EC5"] },
  { name: "Candy Pop", colors: ["#EF6FA8", "#62C2E8", "#65D2A2", "#A98AE0"] },
];

function createRandomBackground() {
  const palette = BG_PALETTES[Math.floor(Math.random() * BG_PALETTES.length)];
  const positions = [
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.05, y: 0.95 },
    { x: 0.95, y: 0.9 },
  ];
  const glow = [];
  for (let i = 0; i < 4; i++) {
    glow.push({
      color: palette.colors[i],
      x: positions[i].x,
      y: positions[i].y,
      radius: 0.32 + Math.random() * 0.1,
    });
  }
  return { base: "#F4EDE7", glow };
}

function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==========================================
// ★ 效能優化：背景快取畫布
// ==========================================
const bgCacheCanvas = document.createElement("canvas");
const bgCacheCtx = bgCacheCanvas.getContext("2d");
let isBgCached = false;

export function drawGameBackground(ctx, cv) {
  if (!currentBg) {
    currentBg = createRandomBackground();
    isBgCached = false;
  }

  const blockSize = 20;

  // 偵測城市背景是否需要更新 (每 3 秒一次)
  if (
    !currentBg.cityLastUpdate
    || performance.now() - currentBg.cityLastUpdate > 3000
  ) {
    currentBg.cityLastUpdate = performance.now();
    currentBg.bgWindows = [];
    currentBg.fgWindows = [];
    let cols = Math.ceil(cv.width / blockSize) + 1;
    for (let i = 0; i < cols; i++) {
      let bgCol = [];
      for (let j = 0; j < 12; j++) bgCol.push(Math.random() > 0.8);
      currentBg.bgWindows.push(bgCol);
      let fgCol = [];
      for (let j = 0; j < 12; j++) {
        let active = Math.random() > 0.6;
        fgCol.push({
          left: active && Math.random() > 0.3,
          right: active && Math.random() > 0.3,
        });
      }
      currentBg.fgWindows.push(fgCol);
    }
    isBgCached = false; // 城市更新了，強制重畫快取
  }

  // ★ 效能核心：如果快取過期或尺寸改變，才重新運算那些超吃資源的漸層
  if (
    !isBgCached
    || bgCacheCanvas.width !== cv.width
    || bgCacheCanvas.height !== cv.height
  ) {
    bgCacheCanvas.width = cv.width;
    bgCacheCanvas.height = cv.height;

    bgCacheCtx.fillStyle = currentBg.base;
    bgCacheCtx.fillRect(0, 0, cv.width, cv.height);

    bgCacheCtx.save();
    for (const g of currentBg.glow) {
      const x = cv.width * g.x;
      const y = cv.height * g.y;
      const radius = Math.max(cv.width, cv.height) * g.radius;
      const gradient = bgCacheCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, hexToRgba(g.color, 0.95));
      gradient.addColorStop(0.35, hexToRgba(g.color, 0.65));
      gradient.addColorStop(0.75, hexToRgba(g.color, 0.25));
      gradient.addColorStop(1, hexToRgba(g.color, 0));
      bgCacheCtx.fillStyle = gradient;
      bgCacheCtx.fillRect(0, 0, cv.width, cv.height);
    }

    const center = bgCacheCtx.createRadialGradient(
      cv.width * 0.58,
      cv.height * 0.52,
      0,
      cv.width * 0.58,
      cv.height * 0.52,
      Math.max(cv.width, cv.height) * 0.65,
    );
    center.addColorStop(0, "rgba(255,255,255,0.4)");
    center.addColorStop(0.45, "rgba(255,255,255,0.15)");
    center.addColorStop(1, "rgba(255,255,255,0.0)");

    const vignette = bgCacheCtx.createRadialGradient(
      cv.width / 2,
      cv.height / 2,
      Math.min(cv.width, cv.height) * 0.25,
      cv.width / 2,
      cv.height / 2,
      Math.max(cv.width, cv.height) * 0.75,
    );
    vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
    vignette.addColorStop(0.65, "rgba(255, 255, 255, 0.1)");
    vignette.addColorStop(1, "rgba(200, 180, 200, 0.20)");

    bgCacheCtx.fillStyle = vignette;
    bgCacheCtx.fillRect(0, 0, cv.width, cv.height);

    bgCacheCtx.fillStyle = "rgba(0, 0, 0, 0.05)";
    bgCacheCtx.fillRect(0, 0, cv.width, cv.height);

    // 畫背景城市
    const bgHeights = [
      6, 8, 5, 9, 7, 4, 10, 6, 5, 8, 7, 4, 9, 5, 6, 8, 10, 5, 7, 6, 4, 8, 5, 9,
      6, 7, 4, 10, 5, 6, 8, 5, 7, 9, 4, 6, 8, 5, 10, 7,
    ];
    for (let i = 0; i < cv.width / blockSize; i++) {
      let blocks = bgHeights[i % bgHeights.length];
      let h = blocks * blockSize;
      let x = i * blockSize;
      let y = cv.height - h;
      bgCacheCtx.fillStyle = "rgba(138, 126, 156, 0.15)";
      bgCacheCtx.fillRect(x, y, blockSize, h);
      bgCacheCtx.fillStyle = "rgba(255, 255, 255, 0.25)";
      for (let j = 1; j < blocks - 1; j++) {
        if (currentBg.bgWindows[i] && currentBg.bgWindows[i][j]) {
          bgCacheCtx.fillRect(x + 6, y + j * blockSize + 6, 8, 8);
        }
      }
    }

    // 畫前景城市
    const fgHeights = [
      3, 4, 2, 5, 3, 2, 6, 4, 3, 5, 2, 4, 3, 2, 5, 3, 6, 4, 2, 3, 5, 2, 4, 3, 6,
      2, 4, 3, 5, 2, 4, 3, 6, 2, 5, 3, 4, 2, 6, 3,
    ];
    for (let i = 0; i < cv.width / blockSize; i++) {
      let blocks = fgHeights[i % fgHeights.length];
      let h = blocks * blockSize;
      let x = i * blockSize;
      let y = cv.height - h;
      bgCacheCtx.fillStyle = "rgba(93, 87, 107, 0.25)";
      bgCacheCtx.fillRect(x, y, blockSize, h);
      bgCacheCtx.fillStyle = "rgba(253, 224, 71, 0.35)";
      for (let j = 1; j < blocks; j++) {
        if (currentBg.fgWindows[i] && currentBg.fgWindows[i][j]) {
          if (currentBg.fgWindows[i][j].left)
            bgCacheCtx.fillRect(x + 3, y + j * blockSize + 6, 4, 8);
          if (currentBg.fgWindows[i][j].right)
            bgCacheCtx.fillRect(x + 13, y + j * blockSize + 6, 4, 8);
        }
      }
    }
    bgCacheCtx.restore();
    isBgCached = true;
  }

  // ★ 最終每幀只需要做這一步：把畫好的隱形畫布當作圖片貼上！
  ctx.drawImage(bgCacheCanvas, 0, 0);
}

export function drawGameEntities(ctx, cv, gameState, loadedImages) {
  const { bricks, drops, particles, floatTexts, boss, p1, p2, activePlayers } =
    gameState;

  const neededSet =
    (
      typeof chemDLCEnabled !== "undefined"
      && chemDLCEnabled
      && typeof getNeededElements === "function"
    ) ?
      new Set(getNeededElements())
    : new Set();

  const now = performance.now();
  let hasToxic = false;
  let hasVoid = false;
  let nukeBuff = null;

  // 1. 偵測全域狀態與大招
  for (const pl of activePlayers) {
    if (!pl.activeBuffs) continue;
    for (const key in pl.activeBuffs) {
      const buff = pl.activeBuffs[key];
      if (buff.end > now) {
        if (
          ["global_corrosion", "global_damage_over_time"].includes(buff.action)
        )
          hasToxic = true;
        if (
          ["dispel_brick_effects", "disable_special_bricks"].includes(
            buff.action,
          )
        )
          hasVoid = true;
        if (["delayed_explosion", "charged_explosion"].includes(buff.action))
          nukeBuff = buff;
      }
    }
  }

  // 2. 虛空背景濾鏡 (拔除毒霧，改為磚塊獨立判定)
  if (hasVoid) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    const voidGrad = ctx.createRadialGradient(
      cv.width / 2,
      cv.height / 2,
      cv.height * 0.2,
      cv.width / 2,
      cv.height / 2,
      cv.height * 0.8,
    );
    voidGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    voidGrad.addColorStop(1, "rgba(20, 20, 40, 0.85)");
    ctx.fillStyle = voidGrad;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();
  }

  // ==========================================
  // ★ 新增：全域毒霧背景 - 腐蝕毛毛細雨 (紫綠交錯)
  // ==========================================
  if (hasToxic) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // 讓雨絲有微發光的螢光感

    // 將雨滴數量稍微增加到 120 滴，但變得極細小，營造綿密的細雨感
    for (let i = 0; i < 120; i++) {
      const p1 = Math.abs(Math.sin(i * 12.9898));
      const p2 = Math.abs(Math.sin(i * 78.233));
      const p3 = Math.abs(Math.sin(i * 45.123));

      const x = p1 * cv.width;

      // 【調整】大幅降低墜落速度與雨絲長度
      const speed = 0.2 + p2 * 0.3;
      const length = 8 + p3 * 15; // 長度縮短至 8~23 像素

      const y = ((now * speed + p3 * 3000) % (cv.height + length)) - length;

      const colorRGB = i % 2 === 0 ? "168, 85, 247" : "134, 239, 172";

      // 【調整】輕微的微風傾斜，細雨比較會隨風飄
      const windOffset = 2 + p2 * 4;

      // ★ 效能優化：拔除每幀 120 次的 createLinearGradient，改用單純的透明色碼！
      // 在極細且高速移動的雨絲中，肉眼根本看不出漸層與純透明色的差異，但效能差了上百倍。
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - windOffset, y + length);
      ctx.strokeStyle = `rgba(${colorRGB}, 0.3)`;
      ctx.lineWidth = 0.5 + p2 * 1.0;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. 瞬間大招視覺：巨型核爆震波
  if (
    vfx
    && vfx.flashTime > 0
    && (vfx.flashColor === "255, 80, 80" || vfx.flashColor === "255, 100, 100")
  ) {
    ctx.save();
    const flashRatio = 1 - vfx.flashTime / vfx.flashMax;
    const maxRadius = cv.width * 0.8;
    const currentRadius = maxRadius * Math.pow(flashRatio, 0.4);

    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.arc(cv.width / 2, cv.height / 2, currentRadius, 0, Math.PI * 2);
    ctx.lineWidth = 20 * (1 - flashRatio);
    ctx.strokeStyle = `rgba(255, 100, 100, ${1 - flashRatio})`;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cv.width / 2, cv.height / 2, currentRadius * 0.6, 0, Math.PI * 2);
    const expGrad = ctx.createRadialGradient(
      cv.width / 2,
      cv.height / 2,
      0,
      cv.width / 2,
      cv.height / 2,
      currentRadius * 0.6,
    );
    expGrad.addColorStop(0, `rgba(255, 255, 255, ${0.8 * (1 - flashRatio)})`);
    expGrad.addColorStop(1, "rgba(255, 100, 100, 0)");
    ctx.fillStyle = expGrad;
    ctx.fill();
    ctx.restore();
  }

  for (const b of bricks) {
    const set =
      b.hp >= 2 ? loadedImages.brickFull || [] : loadedImages.brickCrack || [];
    const img = set.length > 0 ? set[b.ci % set.length] : null;

    ctx.save();
    const member = MEMBERS[b.ci % MEMBERS.length];
    const paleColor = lightenColor(member.color, 0.55);
    if (!PERFORMANCE_MODE) {
      ctx.shadowColor = paleColor;
      ctx.shadowBlur = 10;
    }

    ctx.fillStyle = paleColor;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();

    // ★ 修正 1：劇毒腐蝕流 - 磚塊專屬毒霧遮罩 (隨血量減少而加深)
    if (hasToxic && b.hp > 0 && b.maxHp) {
      ctx.save();
      const toxicRatio = 1 - b.hp / b.maxHp; // 血越少，遮罩越濃
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fillStyle = `rgba(168, 85, 247, ${0.1 + toxicRatio * 0.85})`; // 逐漸吞噬的猛毒紫
      ctx.fill();

      // 附加綠色毒泡泡
      ctx.fillStyle = `rgba(134, 239, 172, ${0.5 + toxicRatio * 0.5})`;
      ctx.beginPath();
      ctx.arc(
        b.x + ((now + b.x) % b.w),
        b.y + b.h - ((now * 0.5 + b.y) % b.h),
        2 + toxicRatio * 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    // 血條與原版動態裂痕...
    if (b.hp > 0 && b.maxHp) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.clip();
      const hpRatio = Math.max(0, Math.min(1, b.hp / b.maxHp));
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(b.x, b.y, 4, b.h);
      ctx.fillStyle =
        hpRatio <= 0.3 ? "#d12323d0"
        : hpRatio <= 0.6 ? "#ffc73ad9"
        : "#ffffff";
      ctx.fillRect(b.x, b.y + (b.h - b.h * hpRatio), 4, b.h * hpRatio);
      ctx.restore();
    }

    if (b.maxHp && b.hp < b.maxHp) {
      const damageRatio = Math.min(1, Math.max(0, 1 - b.hp / b.maxHp));
      const seed = (b.minX || b.x) * 13.37 + b.y * 42.19;
      const rnd = (i) => Math.abs(Math.sin(seed + i) * 43758.5453) % 1;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.clip();
      ctx.beginPath();

      const clusters = 1 + Math.floor(damageRatio * 3);
      for (let c = 0; c < clusters; c++) {
        let startX = b.x + rnd(c * 10) * b.w;
        let startY = b.y + rnd(c * 11) * b.h;
        const branches = 1 + Math.floor(rnd(c * 12) * 3);
        for (let br = 0; br < branches; br++) {
          ctx.moveTo(startX, startY);
          let currentX = startX,
            currentY = startY;
          let angle = rnd(c * 20 + br) * Math.PI * 2;
          const segments =
            2 + Math.floor(damageRatio * 4) + Math.floor(rnd(c * 30 + br) * 2);
          for (let s = 0; s < segments; s++) {
            let angleShift =
              (rnd(c * 100 + br * 10 + s) > 0.5 ? 1 : -1)
              * (0.5 + rnd(c * 200 + br * 20 + s) * 0.8);
            angle += angleShift;
            let len = 5 + rnd(c * 300 + br * 30 + s) * 5;
            currentX += Math.cos(angle) * len;
            currentY += Math.sin(angle) * len;
            ctx.lineTo(currentX, currentY);
          }
        }
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "miter";
      ctx.miterLimit = 3;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.75 + damageRatio * 0.25})`;
      ctx.lineWidth = 1 + damageRatio * 1.2;
      ctx.stroke();
      ctx.strokeStyle = `rgba(192, 192, 192, ${0.15 + damageRatio * 0.15})`;
      ctx.lineWidth = 1;
      ctx.translate(0.5, 1);
      ctx.stroke();
      ctx.restore();
    }

    if (b.isMoving) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "14px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText("↔", b.x + b.w / 2, b.y - 8);
    }
    ctx.restore();
    // ★ 修正 6：實作弱點標記 (highlight_targets) 的視覺準星
    let hasHighlight = false;
    for (const pl of activePlayers) {
      if (
        pl.activeBuffs
        && Object.values(pl.activeBuffs).some(
          (buff) => buff.end > now && buff.action === "highlight_targets",
        )
      ) {
        hasHighlight = true;
        break;
      }
    }
    // 標記血量大於 1 或是帶有化學元素的「高價值目標」
    if (hasHighlight && b.hp > 0 && (b.maxHp > 1 || b.symbol)) {
      ctx.save();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.8)"; // 狙擊紅
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -(now / 30); // 動態旋轉感
      ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);

      // 繪製準星四角
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      const l = 6,
        t = 3;
      ctx.fillRect(b.x - 6, b.y - 6, l, t);
      ctx.fillRect(b.x - 6, b.y - 6, t, l); // 左上
      ctx.fillRect(b.x + b.w + 6 - l, b.y - 6, l, t);
      ctx.fillRect(b.x + b.w + 6 - t, b.y - 6, t, l); // 右上
      ctx.fillRect(b.x - 6, b.y + b.h + 6 - t, l, t);
      ctx.fillRect(b.x - 6, b.y + b.h + 6 - l, t, l); // 左下
      ctx.fillRect(b.x + b.w + 6 - l, b.y + b.h + 6 - t, l, t);
      ctx.fillRect(b.x + b.w + 6 - t, b.y + b.h + 6 - l, t, l); // 右下
      ctx.restore();
    }

    // 元素文字渲染
    ctx.save();
    ctx.textBaseline = "middle";

    if (b.symbol) {
      // ★ 新增：陷阱方塊的最高優先級專屬畫法
      if (b.symbol === "💣️") {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 20px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";

        // 加一點危險的紅色陰影
        if (!PERFORMANCE_MODE) {
          ctx.shadowColor = "#E0576B";
          ctx.shadowBlur = 10;
        }
        ctx.fillText("💣️", b.x + b.w / 2, b.y + b.h / 2); // 微調垂直位置
        ctx.shadowBlur = 0; // 恢復設定
      }
      // --- 化學 DLC 模式：渲染元素符號與中文 ---
      else if (chemDLCEnabled && ELEMENT_DATA[b.symbol]) {
        const zhName = ELEMENT_DATA[b.symbol][0];
        ctx.font = "900 14px Orbitron, sans-serif";
        const engWidth = ctx.measureText(b.symbol).width;
        ctx.font = "500 14px 'Noto Sans TC', sans-serif";
        const zhWidth = ctx.measureText(zhName).width;
        const gap = 5;
        const totalWidth = engWidth + gap + zhWidth;
        const startX = b.x + b.w / 2 - totalWidth / 2;

        if (neededSet.has(b.symbol)) {
          ctx.beginPath();
          ctx.arc(startX - 10, b.y + b.h / 2, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#F6D98B";
          if (!PERFORMANCE_MODE) {
            ctx.shadowColor = "#F6D98B";
            ctx.shadowBlur = 8;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.font = "900 14px Orbitron, sans-serif";
        ctx.fillStyle = "#FFFDFB";
        ctx.textAlign = "left";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.strokeText(b.symbol, startX, b.y + b.h / 2 + 1);
        ctx.fillText(b.symbol, startX, b.y + b.h / 2 + 1);

        ctx.font = "400 14px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = "#761c1c";
        ctx.fillText(zhName, startX + engWidth + gap, b.y + b.h / 2);
      }
      // 數學極限模式的畫法
      else if (!chemDLCEnabled) {
        // --- ★ 數學極限模式：渲染數字與運算符號 ---
        const isOperator = ["+", "-", "×", "÷", "( )", "x", "y"].includes(
          b.symbol,
        );

        ctx.font = "900 18px Orbitron, sans-serif"; // 數學符號稍微放大，增加打擊爽度
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";

        // 視覺區分：運算子顯示為亮黃色，數字維持純白色
        ctx.fillStyle = isOperator ? "#F6D98B" : "#FFFDFB";

        ctx.strokeText(b.symbol, b.x + b.w / 2, b.y + b.h / 2 + 1);
        ctx.fillText(b.symbol, b.x + b.w / 2, b.y + b.h / 2 + 1);
      }
    } else {
      // 防呆備用方案：若完全沒有 symbol 則畫原本的人名
      const name = member.name;
      ctx.font = "900 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(name, b.x + b.w / 2, b.y + b.h / 2);
      ctx.fillText(name, b.x + b.w / 2, b.y + b.h / 2);
    }

    // ==========================================
    // ★ 視覺強化 1：定時炸彈倒數數字與爆破預警
    // ==========================================
    if (b.bombCountdown !== undefined && b.bombCountdown > 0) {
      ctx.save();
      const nowTime = performance.now();
      const timeLeft = b.bombCountdown.toFixed(1); // 取得保留一位小數的秒數
      const pulse = Math.abs(Math.sin(nowTime / 80)); // 快節奏脈衝

      // 1. 磚塊本體覆蓋一層閃爍的危險紅光
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fillStyle = `rgba(224, 87, 107, ${0.3 + pulse * 0.4})`;
      ctx.fill();

      // 2. 磚塊正上方繪製帶有震動縮放的倒數秒數
      ctx.translate(b.x + b.w / 2, b.y - 10);
      const scale = 1 + pulse * 0.15;
      ctx.scale(scale, scale);

      ctx.font = "900 16px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 黑色描邊增加可讀性
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = 3;
      ctx.strokeText(`💣 ${timeLeft}s`, 0, 0);

      // 亮紅/黃色字體
      ctx.fillStyle = pulse > 0.5 ? "#FF4D4D" : "#FBBF24";
      ctx.shadowColor = "#FF4D4D";
      ctx.shadowBlur = PERFORMANCE_MODE ? 0 : 10;
      ctx.fillText(`💣 ${timeLeft}s`, 0, 0);

      ctx.restore();
    }

    ctx.restore();
  }

  if (boss.active) {
    ctx.save();
    let hpW = (Math.max(0, boss.hp) / boss.maxHp) * boss.w;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(boss.x, boss.y - 20, boss.w, 8);
    ctx.fillStyle = boss.phase === 3 ? "#E0576B" : "#2EB886";
    ctx.fillRect(boss.x, boss.y - 20, hpW, 8);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(boss.x, boss.y - 20, boss.w, 8);

    let cx = boss.x + boss.w / 2;
    let cy = boss.y + boss.h / 2;

    let auraColor =
      boss.phase === 3 ? "rgba(251,113,133,0.5)"
      : boss.phase === 2 ? "rgba(192,132,252,0.5)"
      : "rgba(125,211,252,0.5)";
    let grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, boss.w);
    grad.addColorStop(0, auraColor);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, boss.w, 0, Math.PI * 2);
    ctx.fill();

    // ==========================================
    // ★ Emoji Boss 具象化渲染 (進階幾何拼接版)
    // ==========================================
    ctx.save();
    ctx.translate(cx, cy); // 將畫布原點移到 Boss 正中心

    // 讓本體跟隨呼吸產生微小上下浮動
    const floatY = Math.sin(performance.now() / 200) * 3;
    ctx.translate(0, floatY);

    // 受擊閃白特效
    if (boss.flashTimer > 0) {
      ctx.shadowColor = "#FFF";
      ctx.shadowBlur = PERFORMANCE_MODE ? 0 : 20;
    } else {
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = PERFORMANCE_MODE ? 0 : 15;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (boss.parts.type === "bio") {
      // ==========================================
      // ★ 生物類 Boss：活體脈動與撲咬動畫 (Squash & Lunge)
      // ==========================================
      ctx.save();
      const now = performance.now();

      // A. 待機呼吸：果凍般的蠕動 (X 軸與 Y 軸交錯的微小形變)
      let bioScaleX = 1 + Math.sin(now / 300) * 0.04;
      let bioScaleY = 1 + Math.cos(now / 300) * 0.04;
      let bioRot = 0;

      // B. 攻擊撲咬：攔截攻擊冷卻時間 (2.0 ~ 1.7 之間觸發)
      if (boss.attackCooldown > 1.7) {
        const progress = (2.0 - boss.attackCooldown) / 0.3; // 算出 0 -> 1 的進度
        const attackIntensity = Math.sin(progress * Math.PI); // 鐘形曲線：0 -> 1 -> 0

        // 撲咬動作 1：瞬間巨大化 (衝向玩家的壓迫感)
        bioScaleX += attackIntensity * 0.25;
        bioScaleY += attackIntensity * 0.25;

        // 撲咬動作 2：狂暴抖動 (咆哮感)
        bioRot = Math.sin(now / 20) * 0.15 * attackIntensity;

        // 撲咬動作 3：本體猛然往下突進
        ctx.translate(0, attackIntensity * 15);
      }

      // 套用所有幾何變化
      ctx.rotate(bioRot);
      ctx.scale(bioScaleX, bioScaleY);

      ctx.font = "100px Arial";
      ctx.fillText(boss.parts.bioEmoji, 0, 0);

      ctx.restore();
    } else {
      // ==========================================
      // ★ 除錯開關：完成校準後改成 false
      // ==========================================
      const DEBUG_ANCHORS = false;

      function debugDot(color) {
        if (!DEBUG_ANCHORS) return;
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const bAnchor = ANCHORS.body[boss.parts.body] || ANCHORS.body.default;

      const drawArmAndWeapon = (
        armEmoji,
        weaponEmoji,
        isLeft,
        poseY,
        chainLen,
        wAngle,
      ) => {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 1. 右側統一鏡像處理
        if (!isLeft) ctx.scale(-1, 1);

        // 2. 移動到身體的「肩膀」節點
        ctx.translate(bAnchor.shoulderX, bAnchor.shoulderY);
        debugDot("red");

        // ==========================================
        // ★ 骨架動畫引擎 (Skeletal Procedural Animation)
        // ==========================================
        const now = performance.now();

        // A. 待機呼吸：利用 sin 波讓手臂與手腕產生微微的上下起伏
        const idleArmAngle = Math.sin(now / 400 + (isLeft ? 0 : 1)) * 0.15;
        const idleWeaponAngle = Math.cos(now / 400 + (isLeft ? 0 : 1)) * 0.2;

        // B. 攻擊揮砍：攔截 boss 的攻擊冷卻時間 (假設滿值為 2.0，重置時大於 1.7 觸發動畫)
        let attackArmAngle = 0;
        let attackWeaponAngle = 0;
        if (boss.attackCooldown > 1.7) {
          // 算出 0 到 1 的攻擊進度曲線
          const progress = (2.0 - boss.attackCooldown) / 0.3;
          // 利用 sin 做出「舉起 -> 重劈 -> 收回」的流暢打擊感
          attackArmAngle = Math.sin(progress * Math.PI) * 0.8;
          attackWeaponAngle = Math.sin(progress * Math.PI) * 1.2;
        }

        // ★ 核心技巧：在「肩膀節點」直接旋轉畫布，整隻手與武器就會跟著連動！
        ctx.rotate(idleArmAngle + attackArmAngle);
        // ==========================================

        const aAnchor = ANCHORS.arm[armEmoji] || ANCHORS.arm.default;
        const wAnchor = ANCHORS.weapon[weaponEmoji] || ANCHORS.weapon.default;
        const originAngle = ORIGIN_ROTATION[wAnchor.origin] || 0;

        if (aAnchor.isChain) {
          // --- 鎖鏈拼接 ---
          ctx.rotate((Math.PI / 4) * poseY);
          ctx.font = "30px Arial";
          for (let i = 0; i < chainLen; i++) {
            ctx.fillText(armEmoji, -15 - i * 18, 0);
          }
          ctx.translate(-15 - (chainLen - 1) * 18 - 20, 0);

          // ★ 在手腕節點旋轉武器 (加上動畫角度)
          ctx.rotate(
            originAngle + wAngle + idleWeaponAngle + attackWeaponAngle,
          );
          debugDot("green");

          ctx.font = "40px Arial";
          ctx.fillText(weaponEmoji, -wAnchor.handle.x, -wAnchor.handle.y);
        } else {
          // --- 實體關節 ---
          const scaleX = aAnchor.flipX ? -1 : 1;
          const baseY = aAnchor.lockPoseY ? 1 : poseY;
          const scaleY = aAnchor.flipY ? -baseY : baseY;

          const actualBodyX = aAnchor.body.x * scaleX;
          const actualBodyY = aAnchor.body.y * scaleY;

          ctx.translate(-actualBodyX, -actualBodyY);
          debugDot("blue");

          ctx.save();
          ctx.scale(scaleX, scaleY);
          ctx.font = "35px Arial";
          ctx.fillText(armEmoji, 0, 0);
          ctx.restore();

          const actualWeaponX = aAnchor.weapon.x * scaleX;
          const actualWeaponY = aAnchor.weapon.y * scaleY;
          ctx.translate(actualWeaponX, actualWeaponY);
          debugDot("green");

          // ★ 在手腕節點旋轉武器 (加上動畫角度)
          const holdPose = Math.PI / 4;
          ctx.rotate(
            originAngle
              + holdPose
              + wAngle
              + idleWeaponAngle
              + attackWeaponAngle,
          );

          ctx.font = "40px Arial";
          ctx.fillText(weaponEmoji, -wAnchor.handle.x, -wAnchor.handle.y);
        }
        ctx.restore();
      };

      drawArmAndWeapon(
        boss.parts.leftArm,
        boss.parts.leftWeapon,
        true,
        boss.parts.leftPoseY,
        boss.parts.leftChainLen,
        boss.parts.weaponAngle,
      );
      drawArmAndWeapon(
        boss.parts.rightArm,
        boss.parts.rightWeapon,
        false,
        boss.parts.rightPoseY,
        boss.parts.rightChainLen,
        boss.parts.weaponAngle,
      );

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "85px Arial";
      ctx.fillText(boss.parts.body, 0, 0);
      debugDot("purple");
    }

    ctx.restore(); // 結束 Boss 繪製

    for (const b of boss.bullets) {
      ctx.save();
      let bulletGlow =
        boss.phase === 3 ? "#fda4af"
        : boss.phase === 2 ? "#d8b4fe"
        : "#9DD9E8";

      ctx.fillStyle = b.c || bulletGlow;
      ctx.shadowColor = b.c || bulletGlow;
      ctx.shadowBlur = 10;
      if (b.type === "laser") {
        ctx.fillRect(b.x - 3, b.y - 10, 6, 20);
        ctx.fillStyle = "#FFFDFB";
        ctx.fillRect(b.x - 1, b.y - 8, 2, 16);
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFDFB";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // ==========================================
    // ★ 關鍵修復：補上 Boss 外層遺漏的 restore
    // 否則會造成記憶體堆疊錯亂，導致震動位移無法復原！
    // ==========================================
    ctx.restore();
  }

  for (const d of drops) {
    ctx.save();
    ctx.translate(d.x, d.y);
    const width = 56,
      height = 28,
      radius = 6;
    ctx.beginPath();
    ctx.moveTo(-width / 2 + radius, -height / 2);
    ctx.lineTo(width / 2 - radius, -height / 2);
    ctx.arc(width / 2 - radius, -height / 2 + radius, radius, -Math.PI / 2, 0);
    ctx.lineTo(width / 2, height / 2 - radius);
    ctx.arc(width / 2 - radius, height / 2 - radius, radius, 0, Math.PI / 2);
    ctx.lineTo(-width / 2 + radius, height / 2);
    ctx.arc(
      -width / 2 + radius,
      height / 2 - radius,
      radius,
      Math.PI / 2,
      Math.PI,
    );
    ctx.lineTo(-width / 2, -height / 2 + radius);
    ctx.arc(
      -width / 2 + radius,
      -height / 2 + radius,
      radius,
      Math.PI,
      (Math.PI * 3) / 2,
    );
    ctx.closePath();

    ctx.fillStyle =
      d.type === "star" ? "rgba(253, 224, 71, 0.85)" : "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = "#FFFDFB";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#5D576B";

    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-12, 6);
    ctx.lineTo(-9, 6);
    ctx.lineTo(-9, -6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-6, -3, 3, -Math.PI / 2, Math.PI / 2);
    ctx.arc(-6, 3, 3, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.fillRect(0, -6, 4, 12);
    ctx.fillRect(7, -6, 4, 12);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(4, -3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -6);
    ctx.lineTo(7, -6);
    ctx.lineTo(7, -3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, 6);
    ctx.lineTo(15, 6);
    ctx.lineTo(11, 2);
    ctx.fill();

    ctx.font = "18px serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let emoji = "";
    if (d.type === "slow") emoji = "❄️";
    if (d.type === "fire") emoji = "🔥";
    if (d.type === "grow") emoji = "✨";
    if (d.type === "star") emoji = "⭐";
    ctx.fillText(emoji, 16, 0);
    ctx.restore();
  }

  // 畫擋板的迴圈
  for (const pl of activePlayers) {
    ctx.save();

    // ★ 雙人同機專屬判定：將全畫面致盲轉換為「本體隱形」
    let isBlind = false;
    if (mode === 2 && !onlineMode && pl.timers && pl.timers.blind) {
      isBlind = true; // 真正中招的受害者身上會有這個盲目計時器！
    }

    if (isBlind) {
      // ★ 盲目狀態：80% 時間極度透明，20% 時間微微閃現
      ctx.globalAlpha = Math.random() > 0.8 ? 0.25 : 0.03;
    }

    const r = pl.h / 2;
    const capW = 24;

    // 1. 全局外發光 (隱形時不發光，以免露餡)
    if (!PERFORMANCE_MODE && !isBlind) {
      ctx.shadowColor = pl.lightColor;
      ctx.shadowBlur = 15;
    }

    // 2. 繪製中央玻璃管底色 (深紫灰)
    ctx.fillStyle = "rgba(93, 87, 107, 0.6)";
    ctx.beginPath();
    ctx.roundRect(pl.x, pl.y, pl.w, pl.h, r);
    ctx.fill();

    ctx.shadowBlur = 0;

    // --- 建立內部裁切遮罩 ---
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pl.x, pl.y, pl.w, pl.h, r);
    ctx.clip();

    // ==========================================
    // ★ 動態能量液體與波浪共鳴系統
    // ==========================================
    const nowTime = performance.now();
    let activeCat = null;
    let liquidColor = pl.color; // 預設液體顏色為玩家專屬色
    let waveStroke = "rgba(255, 255, 255, 0.95)";
    let waveGlow = pl.lightColor;
    let waveSpeed = pl.speedBuffRatio > 1 ? 60 : 120;
    let liquidBoil = 0; // 液體沸騰幅度 (0 代表平靜)

    // A. 偵測化學技能狀態
    if (pl.activeBuffs) {
      for (const key in pl.activeBuffs) {
        if (pl.activeBuffs[key].end > nowTime) {
          activeCat = pl.activeBuffs[key].category;
          // 依據技能分類變更液體顏色與沸騰幅度
          if (activeCat === "攻擊") {
            liquidColor = "#EF4444";
            waveGlow = "#FCA5A5";
            liquidBoil = 3;
            waveSpeed = 40;
          } else if (activeCat === "防禦") {
            liquidColor = "#3B82F6";
            waveGlow = "#93C5FD";
            liquidBoil = 2;
            waveSpeed = 60;
          } else if (activeCat === "輔助") {
            liquidColor = "#10B981";
            waveGlow = "#6EE7B7";
            liquidBoil = 2;
            waveSpeed = 50;
          } else if (activeCat === "控制") {
            liquidColor = "#F59E0B";
            waveGlow = "#FCD34D";
            liquidBoil = 3;
            waveSpeed = 40;
          } else if (activeCat === "特殊") {
            liquidColor = "#8B5CF6";
            waveGlow = "#C4B5FD";
            liquidBoil = 4;
            waveSpeed = 30;
          } else if (activeCat === "實驗") {
            liquidColor = "#ec4899";
            waveGlow = "#fbcfe8";
            liquidBoil = 5;
            waveSpeed = 20;
          }
          break;
        }
      }
    }

    // B. 偵測旋球與大招狀態 (最高優先權覆蓋)
    if (pl.ball) {
      if (pl.ball.isRasengan) {
        waveStroke = "#E0FFFF";
        waveGlow = "#38BDF8";
        liquidColor = "#0284C7"; // 螺旋丸引發深藍查克拉液體
        liquidBoil = 6; // 狂暴沸騰
        waveSpeed = 20;
      } else if (pl.ball.spinType === "left") {
        waveStroke = "#F3E8FF";
        waveGlow = "#A78BFA";
        waveSpeed = 40;
        liquidBoil = Math.max(liquidBoil, 2);
      } else if (pl.ball.spinType === "right") {
        waveStroke = "#FEF3C7";
        waveGlow = "#FBBF24";
        waveSpeed = 40;
        liquidBoil = Math.max(liquidBoil, 2);
      }
    }

    // 3. 繪製動態液體表面
    ctx.fillStyle = liquidColor;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y + pl.h); // 左下角
    ctx.lineTo(pl.x, pl.y + pl.h / 2); // 左中

    // 如果有技能，畫出海浪般的起伏；沒有則為平靜直線
    for (let wx = 0; wx <= pl.w; wx += 5) {
      let wy = pl.y + pl.h / 2;
      if (liquidBoil > 0) {
        // 雙重 sin 波疊加，讓液體看起來像滾水一樣不規則
        wy += Math.sin(wx * 0.15 + nowTime / 80) * liquidBoil;
        wy += Math.sin(wx * 0.3 - nowTime / 60) * (liquidBoil * 0.5);
      }
      ctx.lineTo(pl.x + wx, wy);
    }

    ctx.lineTo(pl.x + pl.w, pl.y + pl.h); // 右下角
    ctx.closePath();
    ctx.fill();

    // ★ 沸騰狀態下，管內產生浮動的能量氣泡
    if (liquidBoil > 0 && !PERFORMANCE_MODE) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (let b = 0; b < 6; b++) {
        // 利用時間差產生隨機上升的氣泡
        let bx = pl.x + capW + ((nowTime / (10 + b * 2)) % (pl.w - capW * 2));
        let by = pl.y + pl.h - ((nowTime / (15 + b * 3)) % (pl.h * 0.8));
        ctx.beginPath();
        ctx.arc(bx, by, 1.5 + (b % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. 核心升級：全局 3D 圓柱立體光影遮罩
    const cylinderGrad = ctx.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
    cylinderGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    cylinderGrad.addColorStop(0.2, "rgba(255, 255, 255, 0.15)");
    cylinderGrad.addColorStop(0.8, "rgba(0, 0, 0, 0.05)");
    cylinderGrad.addColorStop(1, "rgba(0, 0, 0, 0.4)");
    ctx.fillStyle = cylinderGrad;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);

    // 5. 繪製上半部的不規則電流波紋
    ctx.strokeStyle = waveStroke;
    ctx.shadowColor = waveGlow;
    ctx.shadowBlur = liquidBoil > 0 ? 12 : 6; // 有技能時增強發光
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();

    const timeOffset = nowTime / waveSpeed;

    for (let wx = capW - 5; wx <= pl.w - capW + 5; wx += 6) {
      const noise =
        Math.sin(wx * 0.4 + timeOffset * 2.5) * 2.5
        + Math.sin(wx * 0.1 - timeOffset) * 1.5;
      const wy = pl.y + pl.h / 3.2 + noise;

      if (wx === capW - 5) ctx.moveTo(pl.x + wx, wy);
      else ctx.lineTo(pl.x + wx, wy);
    }
    ctx.stroke();

    ctx.restore(); // 結束內部裁切

    // ==========================================
    // 6. 陣營專屬馬卡龍金屬蓋 (1P 粉系 / 2P 藍系)
    // ==========================================
    const isPlayerOne = pl === p1; // ★ 換個名字避免撞名
    const capLight = isPlayerOne ? "#FCE4EC" : "#E1F5FE"; // 亮部
    const capBase = isPlayerOne ? "#F48FB1" : "#81D4FA"; // 基礎色
    const capDark = isPlayerOne ? "#C2185B" : "#0288D1"; // 暗部
    const capStroke =
      isPlayerOne ? "rgba(233, 30, 99, 0.6)" : "rgba(3, 169, 244, 0.6)";

    const metalGrad = ctx.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
    metalGrad.addColorStop(0, "#FFFFFF");
    metalGrad.addColorStop(0.3, capLight);
    metalGrad.addColorStop(0.8, capBase);
    metalGrad.addColorStop(1, capDark);

    ctx.fillStyle = metalGrad;
    ctx.strokeStyle = capStroke;
    ctx.lineWidth = 1.5;

    // 左金屬蓋
    ctx.beginPath();
    ctx.roundRect(pl.x, pl.y, capW, pl.h, [r, 0, 0, r]);
    ctx.fill();
    ctx.stroke();

    // 右金屬蓋
    ctx.beginPath();
    ctx.roundRect(pl.x + pl.w - capW, pl.y, capW, pl.h, [0, r, r, 0]);
    ctx.fill();
    ctx.stroke();

    // 7. 蓋子上的高光小膠囊
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.roundRect(pl.x + 5, pl.y + 3, capW - 10, 4, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(pl.x + pl.w - capW + 5, pl.y + 3, capW - 10, 4, 2);
    ctx.fill();

    ctx.restore();
    // 結束擋板繪製

    if (pl.shrinkFx > 0) {
      ctx.globalAlpha = pl.shrinkFx;
      ctx.fillStyle = "#ff2200";
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      ctx.globalAlpha = 1;
      pl.shrinkFx -= 0.03;
    }
    // ==========================================
    // ★ 實裝：實體冰塊外框 (絕對凍結)
    // ==========================================
    if (pl.speed === 0) {
      ctx.save();
      ctx.fillStyle = "rgba(165, 243, 252, 0.55)"; // 半透明冰藍色
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(pl.x - 4, pl.y - 4, pl.w + 8, pl.h + 8, 6);
      ctx.fill();
      ctx.stroke();
      // 冰塊頂部高光反光
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.roundRect(pl.x + 2, pl.y, pl.w - 4, 4, 2);
      ctx.fill();
      ctx.restore();
    }

    // ==========================================
    // ★ 實裝：巨大霓虹旋轉符號 (方向反轉)
    // ==========================================
    if (pl.reversedTimer > 0) {
      ctx.save();
      ctx.translate(pl.x + pl.w / 2, pl.y + pl.h / 2); // 定位在擋板正中央
      ctx.rotate(performance.now() / 200); // 隨著時間不斷狂轉
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#d8b4fe"; // 霓虹紫
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 15;
      ctx.globalAlpha = 0.85;
      ctx.fillText("🔄", 0, 0);
      ctx.fillText("🔄", 0, 0); // 疊加字體增強發光感
      ctx.restore();
    }

    // ==========================================
    // ★ 實作 1：燃燒的狀態引信條與技能名稱輪播
    // ==========================================
    const now = performance.now();
    const pId = pl === p1 ? 0 : 1;
    const isP1 = pl === p1;

    if (pl.activeBuffs) {
      // 過濾出目前還在生效中的 Buff
      const activeKeys = Object.keys(pl.activeBuffs).filter(
        (k) => pl.activeBuffs[k].end > now,
      );

      if (activeKeys.length > 0) {
        let maxLeft = 0;
        let maxTotal = 1;
        // 找出剩餘時間最長的 Buff 來畫長條圖
        for (const key of activeKeys) {
          const buff = pl.activeBuffs[key];
          const left = buff.end - now;
          if (left > maxLeft) {
            maxLeft = left;
            maxTotal = buff.total;
          }
        }

        const barW = pl.w;
        const fillW = (maxLeft / maxTotal) * barW;
        const barY = pl.y - 12; // 浮在擋板上方

        ctx.save();

        // --- 繪製引信條 ---
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // 黑色底框
        ctx.fillRect(pl.x, barY, barW, 4);

        if (maxLeft <= 3000) {
          ctx.fillStyle =
            Math.floor(now / 150) % 2 === 0 ? "#EF4444" : "#FBBF24";
          ctx.shadowColor = "#EF4444";
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = "#34D399"; // 安全時間為螢光綠
          ctx.shadowColor = "#34D399";
          ctx.shadowBlur = 4;
        }
        ctx.fillRect(pl.x, barY, fillW, 4);

        ctx.restore();
      }
    }

    // ==========================================
    // ★ 實作：六角幾何護盾 (Hex-Shield)
    // ==========================================

    if (pl.shield > 0 || pl.invincibleTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      let sColor = "#9DD9E8";
      let shieldStrength = pl.shield;

      if (pl.invincibleTimer > 0) {
        // ★ 免疫狀態顯示為急速脈衝的金色加厚護盾
        sColor =
          Math.floor(performance.now() / 100) % 2 === 0 ? "#FBBF24" : "#FDE68A";
        shieldStrength = 4;
      } else {
        const shieldColors = ["#9DD9E8", "#86EFAC", "#FDBA74", "#D8B4FE"];
        sColor = shieldColors[Math.min(pl.shield - 1, shieldColors.length - 1)];
      }

      ctx.shadowColor = sColor;
      ctx.shadowBlur = 15;
      ctx.strokeStyle = sColor;
      ctx.lineWidth = 2 + pl.shield * 0.5; // 護盾越多層越粗

      // 畫出包覆擋板的菱角能量罩
      ctx.beginPath();
      ctx.moveTo(pl.x - 15, pl.y + pl.h / 2);
      ctx.lineTo(pl.x + 10, pl.y - 12);
      ctx.lineTo(pl.x + pl.w - 10, pl.y - 12);
      ctx.lineTo(pl.x + pl.w + 15, pl.y + pl.h / 2);
      ctx.lineTo(pl.x + pl.w - 10, pl.y + pl.h + 12);
      ctx.lineTo(pl.x + 10, pl.y + pl.h + 12);
      ctx.closePath();
      ctx.stroke();

      // 罩子內部的半透明能量感
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fill();
      ctx.restore();
    }

    // ==========================================
    // ★ 實作 1：擋板上方的 Emoji 狀態列
    // ==========================================
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "bold 18px 'Noto Sans TC', sans-serif";

    let statusEmoji = "";
    let statusText = "";
    let textColor = "#FFF";

    // 判斷玩家當前身上的 Debuff 或 Buff 狀態
    if (pl.speed === 0) {
      statusEmoji = "🧊";
      statusText = "絕對凍結";
      textColor = "#A5F3FC"; // 冰藍色
    } else if (pl.reversedTimer > 0) {
      statusEmoji = "😵‍💫";
      statusText = "方向反轉";
      textColor = "#D8B4FE"; // 混亂紫
    } else if (pl.chaosTimer > 0) {
      statusEmoji = "🌀";
      statusText = "軌跡混亂";
      textColor = "#F87171";
    } else if (pl.magneticDebuffTimer > 0) {
      statusEmoji = "🧲";
      statusText = "磁力偏移";
      textColor = "#A78BFA";
    } else if (pl.shield > 0) {
      statusEmoji = "🛡️";
      statusText = `${Math.round(pl.shield)}%`;
      textColor = "#86EFAC"; // 護盾綠
    } else if (pl.speedBuffRatio && pl.speedBuffRatio < 1) {
      statusEmoji = "🐢";
      statusText = "減速";
      textColor = "#FDBA74"; // 警告橘
    }

    // 如果有狀態，就在擋板正上方畫出來
    if (statusEmoji) {
      // 畫一點黑色半透明陰影讓文字更清楚
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = textColor;

      // Emoji 稍微大一點
      ctx.font = "22px Arial";
      ctx.fillText(statusEmoji, pl.x + pl.w / 2, pl.y - 25);

      // 狀態文字
      ctx.font = "900 13px 'Noto Sans TC', sans-serif";
      ctx.fillText(statusText, pl.x + pl.w / 2, pl.y - 8);
    }
    ctx.restore();
  }

  // 玩家彈珠與雷射/重球特效
  for (const pl of activePlayers) {
    if (!pl.ball) continue;
    const b = pl.ball;

    // ★ 新增與擋板相同的盲目判定
    let isBlind = false;
    if (mode === 2 && !onlineMode && pl.timers && pl.timers.blind) {
      isBlind = true; // 真正中招的受害者身上會有這個盲目計時器！
    }

    ctx.save(); // ★ 為整顆球的渲染加上最外層的 save

    // ==========================================
    // ★ 視覺強化 2：磁力牽引 / 導彈追蹤雷射線 (請貼在此處！)
    // ==========================================
    if (b.magTargetX && b.dy < 0) {
      // 尋找目標磚塊 (找到最接近 magTargetX 且活著的磚塊)
      const targetBr = bricks.find(
        (br) => br.hp > 0 && Math.abs(br.x + br.w / 2 - b.magTargetX) < 10,
      );

      if (targetBr) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const tx = targetBr.x + targetBr.w / 2;
        const ty = targetBr.y + targetBr.h / 2;
        const nowTime = performance.now();

        // 1. 畫出帶有虛線流光的雷射光束
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(tx, ty);

        ctx.strokeStyle = "rgba(56, 189, 248, 0.85)"; // 青藍色高能雷射
        ctx.lineWidth = 2;
        ctx.shadowColor = "#38BDF8";
        ctx.shadowBlur = PERFORMANCE_MODE ? 0 : 12;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -(nowTime / 15); // 向目標快速流動的光束效果
        ctx.stroke();

        // 2. 在目標磚塊正中央畫出動態旋轉準星 (Crosshair)
        ctx.translate(tx, ty);
        ctx.rotate(nowTime / 150); // 準星狂轉

        ctx.strokeStyle = "#FBBF24"; // 耀眼金準星
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);

        // 繪製圓形十字準星
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.moveTo(-16, 0);
        ctx.lineTo(-8, 0);
        ctx.moveTo(8, 0);
        ctx.lineTo(16, 0);
        ctx.moveTo(0, -16);
        ctx.lineTo(0, -8);
        ctx.moveTo(0, 8);
        ctx.lineTo(0, 16);
        ctx.stroke();

        ctx.restore();
      }
    }
    // ==========================================

    // 盲目狀態下，連球都會變成閃爍的幽靈！
    if (isBlind) {
      ctx.globalAlpha = Math.random() > 0.8 ? 0.3 : 0.02;
    }

    // ==========================================
    // ★ 旋球系統：完美時機「縮圈」視覺回饋
    // ==========================================
    // 只有在球往下掉，且距離擋板 180px 以內時才顯示縮圈
    if (b.dy > 0 && b.y > pl.y - 180 && b.y < pl.y) {
      ctx.save();
      ctx.translate(b.x, b.y);
      // 計算距離比例 (1.0 遠 -> 0.0 近)
      const distRatio = Math.max(0, Math.min(1, (pl.y - (b.y + b.r)) / 180));
      const ringRadius = b.r + distRatio * 40; // 圈圈隨著距離從大縮到小

      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - distRatio})`;
      ctx.lineWidth = 2 + (1 - distRatio) * 2;

      // 當圈圈縮到最完美時(極近)，變成高亮金色提示
      if (distRatio < 0.15) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
        ctx.shadowColor = "#FBBF24";
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.restore();
    }
    // ==========================================

    let activeAction = null;
    let ballEmoji = "";
    if (pl.activeBuffs) {
      for (const key in pl.activeBuffs) {
        if (pl.activeBuffs[key].end > now) {
          const buff = pl.activeBuffs[key];
          activeAction = buff.action;
          const cat = buff.category;
          if (cat === "攻擊") ballEmoji = "🔥";
          else if (cat === "輔助") ballEmoji = "❤️‍🔥";
          else if (cat === "控制") ballEmoji = "🪁";
          else if (cat === "防禦") ballEmoji = "🛡️";
          else if (cat === "特殊") ballEmoji = "🌟";
          else if (cat === "實驗") ballEmoji = "⚠️";
        }
      }
    }
    if (!ballEmoji) {
      if (b.isPiercing) ballEmoji = "☄️";
      // ★ 新增：根據左右旋顯示不同圖示
      else if (b.spinType === "left") ballEmoji = "🌪️";
      else if (b.spinType === "right") ballEmoji = "🪛";
      else if (pl.speedBuffRatio && pl.speedBuffRatio > 1) ballEmoji = "⚡";
      else if (b.fire) ballEmoji = "🔥";
    }

    // ==========================================
    // ★ 繪製左旋究極奧義：魔法矩陣 (安全防當出版)
    // ==========================================
    if (b.isMagicMatrix) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      let scale = b.magicScale || 1;
      let alpha = b.magicOpacity !== undefined ? b.magicOpacity : 1;

      // 設置畫布縮放與中心 (這會將 (0,0) 設為法陣中央)
      ctx.translate(b.magicCx, b.magicCy);
      ctx.scale(scale, scale);

      // ★ 繪製函數：傳入粗細與顏色，分段描繪法陣 (徹底避開 GPU 交叉路徑死鎖 Bug)
      const drawMatrix = (lineWidth, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 1. 畫外圈 (獨立繪製)
        let circleProgress =
          b.magicPhase >= 2 ? 1
          : b.magicPhase === 1 ? Math.min(1, b.magicTimer / 1.0)
          : 0;
        if (circleProgress > 0) {
          ctx.beginPath();
          ctx.arc(
            0,
            0,
            b.magicRadius,
            -Math.PI / 2,
            -Math.PI / 2 + circleProgress * Math.PI * 2,
          );
          ctx.stroke();
        }

        // 2. 畫五芒星 (將每條線拆開獨立畫，不再構成連環多邊形)
        if (b.magicPhase >= 2 && b.magicStarPoints) {
          let pentagramProgress =
            b.magicPhase >= 3 ? 5 : Math.min(5, (b.magicTimer / 1.2) * 5);
          let fullLines = Math.floor(pentagramProgress);
          let partial = pentagramProgress - fullLines;

          ctx.beginPath();
          // 已畫完的完整線條 (用 moveTo 切斷路徑關聯性)
          for (let i = 0; i < fullLines; i++) {
            let p1 = b.magicStarPoints[i];
            let p2 = b.magicStarPoints[i + 1];
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
          // 正在畫的這條線
          if (fullLines < 5 && partial > 0) {
            let p1 = b.magicStarPoints[fullLines];
            let p2 = b.magicStarPoints[fullLines + 1];
            let curX = p1.x + (p2.x - p1.x) * partial;
            let curY = p1.y + (p2.y - p1.y) * partial;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(curX, curY);
          }
          ctx.stroke();
        }
      };

      ctx.shadowBlur = 0; // 絕對禁止開啟 shadowBlur

      // 疊加四層光暈製造爆亮星雲感
      drawMatrix(26, `rgba(96, 165, 250, ${alpha * 0.15})`);
      drawMatrix(12, `rgba(167, 139, 250, ${alpha * 0.4})`);
      drawMatrix(5, `rgba(167, 139, 250, ${alpha})`);
      drawMatrix(2, `rgba(255, 255, 255, ${alpha * 0.9})`);

      // 繪製作為畫筆的高能球體 (爆破前才顯示)
      if (b.magicPhase < 3) {
        ctx.beginPath();
        // 將球體的絕對座標轉換為相對於 (0,0) 的局部座標
        ctx.arc(b.x - b.magicCx, b.y - b.magicCy, 18, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(b.x - b.magicCx, b.y - b.magicCy, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 176, 255, ${alpha})`;
        ctx.fill();
      }

      ctx.restore(); // 恢復座標縮放轉換
      ctx.restore(); // 釋放最外層保存的球體 ctx.save()
      continue; // 魔法陣期間直接跳過後續原本彈珠的繪製邏輯
    }

    if (activeAction === "laser_pierce") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const laserW = b.r * 2.5 + Math.random() * 6;
      const gradient = ctx.createLinearGradient(
        b.x - laserW / 2,
        0,
        b.x + laserW / 2,
        0,
      );
      gradient.addColorStop(0, "rgba(255, 100, 200, 0)");
      gradient.addColorStop(0.2, "rgba(255, 100, 200, 0.6)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.8, "rgba(255, 100, 200, 0.6)");
      gradient.addColorStop(1, "rgba(255, 100, 200, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(b.x - laserW / 2, 0, laserW, cv.height);
      ctx.restore();
    }

    b.history = b.history || [];
    b.history.push({ x: b.x, y: b.y });
    if (b.history.length > 12) b.history.shift();

    if (
      b.history.length > 0
      && (b.spin
        || b.isPiercing
        || (pl.speedBuffRatio && pl.speedBuffRatio > 1)
        || b.fire
        || b.isRasengan // ★ 加入螺旋丸殘影判定
        || (pl.scoreMultiplier && pl.scoreMultiplier > 1))
    ) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      let rgbColor =
        b.isRasengan ?
          "56, 189, 248" // ★ 螺旋丸青藍色查克拉
        : b.spinType === "left" ? "168, 85, 247"
        : b.spinType === "right" ?
          "251, 191, 36" // 電鑽金
        : activeAction === "laser_pierce" ? "255, 100, 200"
        : activeAction === "phase_piercing" ? "163, 158, 173"
        : b.isPiercing ? "216, 180, 254"
        : b.fire ? "249, 115, 22"
        : pl.scoreMultiplier && pl.scoreMultiplier > 1 ? "253, 224, 71"
        : "134, 239, 172";
      for (let i = 0; i < b.history.length; i++) {
        let pt = b.history[i];
        let ratio = i / b.history.length;
        ctx.beginPath();
        // 螺旋丸的殘影半徑擴大 1.8 倍
        let trailR =
          b.isRasengan ?
            b.r * 1.8 * (0.4 + 0.6 * ratio)
          : b.r * (0.4 + 0.6 * ratio);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, trailR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgbColor}, ${ratio * 0.6})`;
        ctx.shadowColor = `rgb(${rgbColor})`;
        ctx.shadowBlur = 10 * ratio;
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(b.x, b.y);

    if (activeAction === "phase_piercing") {
      ctx.globalAlpha = 0.35 + Math.sin(now / 100) * 0.25;
      ctx.globalCompositeOperation = "lighter";
    }

    if (b.isHeavy) {
      const blastRadius = 60 * (b.heavyPower || 1);
      const pulse = Math.abs(Math.sin(now / 150));
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, blastRadius * (0.9 + 0.1 * pulse), 0, Math.PI * 2);
      const radGrad = ctx.createRadialGradient(0, 0, b.r, 0, 0, blastRadius);
      radGrad.addColorStop(0, "rgba(224, 87, 107, 0.35)");
      radGrad.addColorStop(1, "rgba(224, 87, 107, 0)");
      ctx.fillStyle = radGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(224, 87, 107, ${0.4 + 0.3 * pulse})`;
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = now / -20;
      ctx.stroke();
      ctx.restore();
    }

    if (b.fire) {
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 18;
    } else {
      ctx.shadowColor = pl.lightColor;
      ctx.shadowBlur = 12;
    }

    const isP1 = pl === p1;

    // ==========================================
    // ★ 究極奧義：螺旋丸視覺重製 (長尾風遁查克拉)
    // ==========================================
    if (b.isRasengan) {
      ctx.save();
      const isLeft = b.spinType === "left";
      const rotDir = isLeft ? -1 : 1;
      const nowTime = performance.now();

      // 突破極限的本體轉速
      ctx.rotate(nowTime / (isLeft ? -8 : 8));

      const mainColor = "#38BDF8";
      const glowColor = "#0EA5E9";

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 30;

      // 1. 外部高速長尾氣旋 (大彎月鐮刀風刃)
      for (let i = 0; i < 5; i++) {
        ctx.save();
        // 讓氣旋尾巴交錯旋轉，製造狂暴感
        ctx.rotate(((Math.PI * 2) / 5) * i - (nowTime / 120) * rotDir);

        ctx.beginPath();
        // 起點：貼著球體邊緣
        ctx.moveTo(20, -4 * rotDir);

        // ==========================================
        // ★ 利用貝茲曲線畫出「先向外甩、再往內勾」的銳利彎月 (綠線效果)
        // 控制點1: 把曲線用力往右上方拉扯
        // 控制點2: 再從遠處往下方壓
        // 終點: 彎曲收尾在極端位置
        // ==========================================
        ctx.bezierCurveTo(80, -20 * rotDir, 30, 30 * rotDir, 10, 90 * rotDir);

        // 尾端切角：風刃末端的厚度
        ctx.lineTo(50, 90 * rotDir);

        // 內側弧線：順著極大的彎度拉回球體邊緣，形成銳利鐮刀
        ctx.bezierCurveTo(90, 40 * rotDir, 50, 10 * rotDir, 18, 4 * rotDir);
        ctx.closePath();

        // 填滿漸層：配合新的彎曲座標調整漸層方向
        const tailGrad = ctx.createLinearGradient(20, 0, 70, 90 * rotDir);
        tailGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        tailGrad.addColorStop(0.4, "rgba(56, 189, 248, 0.85)");
        tailGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.fillStyle = tailGrad;
        ctx.fill();
        ctx.restore();
      }

      // 2. 高密度外圍光罩
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
      ctx.fill();

      // 3. 核心壓縮查克拉球
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      const rGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      rGrad.addColorStop(0, "#FFFFFF");
      rGrad.addColorStop(0.6, "#ffea82");
      rGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = rGrad;
      ctx.fill();

      // 4. 核心內部的不穩定能量亂流
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          14,
          ((Math.PI * 2) / 6) * i,
          ((Math.PI * 2) / 6) * i + Math.PI / 1.5,
        );
        ctx.stroke();
      }

      ctx.restore();
    } else if (b.spinType === "left" || b.spinType === "right") {
      ctx.save();
      const isLeft = b.spinType === "left";

      // 轉速極大化：分母越小轉越快
      ctx.rotate(performance.now() / (isLeft ? -15 : 15));

      const mainColor = isLeft ? "#A78BFA" : "#FBBF24"; // 左旋紫，右旋金
      const glowColor = isLeft ? "#8B5CF6" : "#F59E0B";

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15;

      // 1. 高速旋轉的殘影底盤
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${isLeft ? "167, 139, 250" : "251, 191, 36"}, 0.4)`;
      ctx.fill();

      // 2. 齒輪邊緣 (短短的突出攻擊角，更有陀螺感)
      ctx.fillStyle = mainColor;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(((Math.PI * 2) / 6) * i);
        ctx.beginPath();
        ctx.moveTo(12, -3);
        ctx.lineTo(16, 0);
        ctx.lineTo(12, 3);
        ctx.fill();
        ctx.restore();
      }

      // 3. 陀螺金屬內核
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFDFB";
      ctx.shadowBlur = 0;
      ctx.fill();

      // 4. 核心裝甲線條
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    } else if (ballEmoji) {
      // 處理其他非旋球的狀態 (如火焰、雷射的 Emoji)
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ballEmoji, 0, 2);
    } else {
      // 正常狀態：畫出原本的球體與底色
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle =
        isP1 ? "rgba(255, 122, 166, 0.25)" : "rgba(0, 168, 210, 0.25)";
      ctx.fill();

      ctx.scale(0.85, 0.85);
      if (isP1) {
        ctx.fillStyle = "#A89CB8";
        ctx.fillRect(-3, 0, 6, 12);
        ctx.fillStyle = "#8B7F9E";
        ctx.fillRect(-2, 11, 4, 2);
        const grad = ctx.createRadialGradient(-1, -4, 1, 0, -4, 8);
        grad.addColorStop(0, "#FFFDFB");
        grad.addColorStop(0.7, "#FFFDFB");
        grad.addColorStop(1, "#cbd5e1");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -2, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ec4899";
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.quadraticCurveTo(-11, -14, -13, -8);
        ctx.quadraticCurveTo(-9, -5, -6, -8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6, -8);
        ctx.quadraticCurveTo(11, -14, 13, -8);
        ctx.quadraticCurveTo(9, -5, 6, -8);
        ctx.fill();
      } else {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#ffea61";
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(3, -2);
        ctx.lineTo(8, -2);
        ctx.lineTo(4, 1);
        ctx.lineTo(6, 6);
        ctx.lineTo(0, 3);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-4, 1);
        ctx.lineTo(-8, -2);
        ctx.lineTo(-3, -2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // ==========================================
    // ★ 關鍵修復：這裡補上原本遺漏的 ctx.restore()！
    // 解決倒數文字消失與飄浮字亂飛的 Bug
    // ==========================================
    ctx.restore();

    ctx.restore(); // ★ 這是我們剛剛在迴圈開頭為了「隱形球」加的 restore！
  }

  // ★ 修正 2：實體幽靈氣泡 (移除 lighter 避免融入白底消失)
  if (gameState.ghostBalls && gameState.ghostBalls.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (const gb of gameState.ghostBalls) {
      if (gb.dx || gb.dy) {
        ctx.beginPath();
        ctx.moveTo(gb.x, gb.y);
        ctx.lineTo(gb.x - gb.dx * 3, gb.y - gb.dy * 3);
        ctx.strokeStyle = `rgba(134, 239, 172, ${Math.min(0.8, gb.life)})`; // 綠色毒液拖尾
        ctx.lineWidth = gb.r * 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      // 氣泡本體
      ctx.beginPath();
      ctx.arc(gb.x, gb.y, gb.r, 0, Math.PI * 2);
      const bGrad = ctx.createRadialGradient(gb.x, gb.y, 0, gb.x, gb.y, gb.r);
      bGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.9, gb.life)})`);
      bGrad.addColorStop(0.5, `rgba(163, 158, 173, ${Math.min(0.9, gb.life)})`);
      bGrad.addColorStop(1, `rgba(100, 90, 120, ${Math.min(0.9, gb.life)})`);
      ctx.fillStyle = bGrad;
      ctx.shadowColor = "#86EFAC";
      ctx.shadowBlur = 10;
      ctx.fill();
      // 高光反光
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, gb.life)})`;
      ctx.beginPath();
      ctx.arc(
        gb.x - gb.r * 0.3,
        gb.y - gb.r * 0.3,
        gb.r * 0.25,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // ★ 修正 3：核彈大招倒數 UI
  if (nukeBuff) {
    const timeLeft = ((nukeBuff.end - now) / 1000).toFixed(1);
    if (timeLeft > 0) {
      ctx.save();
      const cx = cv.width / 2;
      const cy = cv.height / 2;
      const pulse = Math.abs(Math.sin(now / 150));

      ctx.fillStyle = `rgba(224, 87, 107, ${0.1 + pulse * 0.15})`;
      ctx.fillRect(0, 0, cv.width, cv.height);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.8 + pulse * 0.2;
      ctx.shadowColor = "#E0576B";
      ctx.shadowBlur = 30;
      ctx.font = "120px Arial";
      ctx.fillText("☢️", cx, cy - 40);

      ctx.font = "900 64px Orbitron";
      ctx.fillStyle = "#FFF";
      ctx.strokeStyle = "#E0576B";
      ctx.lineWidth = 6;
      ctx.strokeText(timeLeft, cx, cy + 60);
      ctx.fillText(timeLeft, cx, cy + 60);
      ctx.restore();
    }
  }

  for (const p of particles) {
    // ==========================================
    // ★ 新增：金錢掉落特效 (帶旋轉物理)
    // ==========================================
    if (p.type === "money") {
      ctx.save();
      // 接近壽命終點時漸漸變透明
      const progress = Math.max(0, p.life);
      ctx.globalAlpha = Math.min(1, progress * 2);

      // 更新旋轉角度 (雖然 renderer 不該改物理，但單純的視覺旋轉放這裡效能最好)
      p.rot = (p.rot || 0) + (p.rotSpeed || 0.1);

      // 移動到粒子的中心點並旋轉畫布
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      ctx.font = `${p.size}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 給金錢一點土豪金的光暈
      ctx.shadowColor = "#FBBF24";
      ctx.shadowBlur = 12;

      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
      continue;
    }

    if (p.type === "heal_heart") {
      ctx.save();
      // 隨著生命週期變淡 (確保有預設值避免報錯)
      ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 3));

      // 把離線畫好的「愛心印章」貼上來
      ctx.drawImage(
        cachedHeartCanvas,
        p.x - p.size / 2,
        p.y - p.size / 2,
        p.size,
        p.size,
      );
      ctx.restore();

      // ==========================================
      // ★ 關鍵修復：畫完愛心後立刻中斷！
      // 防止底層的 ctx.fillRect 又拿粉紅色方塊把它蓋住
      // ==========================================
      continue;
    }

    // ==========================================
    // ★ 新增：由上而下沖刷的強鹼海浪
    // ==========================================
    if (p.type === "alkali_wave") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter"; // 海浪自帶高亮發光

      const waveHeight = 180; // 海浪的厚度

      // 漸層：上方透明，下方是實心的高亮浪頭
      const grad = ctx.createLinearGradient(0, p.y, 0, p.y + waveHeight);
      grad.addColorStop(0, `rgba(${p.color}, 0)`);
      grad.addColorStop(0.6, `rgba(${p.color}, 0.5)`);
      grad.addColorStop(1, `rgba(255, 255, 255, 0.8)`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, p.y, cv.width, waveHeight);

      // 在浪頭繪製動態翻滾的泡沫
      ctx.fillStyle = `rgba(255, 255, 255, 0.95)`;
      const nowTime = performance.now();
      for (let w = 0; w < cv.width; w += 25) {
        // 利用三角函數製造波浪高低起伏
        const waveOffset = Math.sin((w + nowTime * 0.8) * 0.02) * 15;
        ctx.beginPath();
        ctx.arc(
          w + 12.5,
          p.y + waveHeight + waveOffset,
          6 + Math.random() * 10,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      ctx.restore();
      continue;
    }
    // ==========================================
    // ★ 新增：強鹼高溫泡沫特效
    // ==========================================
    if (p.type === "foam") {
      const progress = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      ctx.beginPath();
      const stretchY = 1 + p.vy * 0.2;
      const currentRadius = Math.max(0.1, p.radius * progress);
      ctx.ellipse(
        p.x,
        p.y,
        currentRadius,
        currentRadius * stretchY,
        0,
        0,
        Math.PI * 2,
      );

      ctx.fillStyle = `rgba(${p.color}, ${progress * 0.8})`;
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255, 255, 255, ${progress})`;
      ctx.stroke();

      ctx.restore();
      continue;
    }

    // 原本的普通粒子畫法
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c;
    const sz = p.size || 3;
    ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.life -= 0.02;

    if (f.life <= 0) {
      // ★ 效能優化：用 Swap & Pop 替換極度耗能的 .splice()
      floatTexts[i] = floatTexts[floatTexts.length - 1];
      floatTexts.pop();
      continue;
    }

    ctx.save();
    // 取得 0 到 1 的基礎壽命比例
    const rawAlpha = Math.max(0, f.life / (f.maxLife || 1));

    if (f.isCountdown) {
      // ==========================================
      // ★ 倒數特效升級：衝擊波急遽消散 + 破解 iOS 透明度 Bug
      // ==========================================
      // 透明度加入 3 次方衰減：讓它在放大的過程中「瞬間」變透明，不擋視線
      const alpha = Math.pow(rawAlpha, 3);
      const progress = 1 - rawAlpha;
      const scale = 1 + progress * 1.5;

      ctx.translate(f.x, f.y);
      ctx.scale(scale, scale);
      ctx.textBaseline = "middle";

      // ★ 強制將色碼轉換為 rgba，繞過 iOS globalAlpha 失效的 Bug
      const hex = f.c || "#E0576B";
      const r = parseInt(hex.slice(1, 3), 16) || 224;
      const g = parseInt(hex.slice(3, 5), 16) || 87;
      const b = parseInt(hex.slice(5, 7), 16) || 107;

      // 每一層塗料都親自餵給它透明度
      if (!PERFORMANCE_MODE) {
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.shadowBlur = 15;
      } else {
        ctx.shadowBlur = 0; // 效能模式下關閉陰影
      }
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 3;

      ctx.font = "900 100px 'Orbitron', 'Noto Sans TC', sans-serif";
      ctx.fillText(f.t, 0, 0);
      ctx.strokeText(f.t, 0, 0);
    } else {
      // ==========================================
      // ★ 一般傷害/加分文字：保持原樣向上飄動
      // ==========================================
      ctx.globalAlpha = rawAlpha;
      f.y -= 1;
      ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = f.c || "#D96C8E";
      ctx.font = f.big ? "bold 24px sans-serif" : "bold 18px sans-serif";
      ctx.fillText(f.t, f.x, f.y);
    }

    ctx.restore();
  }
  // ★ 迴圈到此結束
  ctx.globalAlpha = 1;

  // 視線遮蔽特效與 HTML HUD... (保持原樣即可)
  let isBlinded = false;
  let blindTarget = null;
  for (const pl of activePlayers) {
    if (pl.timers && pl.timers.blind) {
      isBlinded = true;
      blindTarget = pl;
      break;
    }
  }

  // ★ 修正：確保單機雙人模式下，絕對不會畫出全螢幕黑幕！
  if (isBlinded && blindTarget && (mode === 1 || onlineMode)) {
    ctx.save();
    const pulseRadius = 160 + Math.sin(performance.now() / 80) * 20;
    const cx = blindTarget.x + blindTarget.w / 2;
    const cy = blindTarget.y + blindTarget.h / 2;
    const grd = ctx.createRadialGradient(
      cx,
      cy,
      pulseRadius * 0.2,
      cx,
      cy,
      pulseRadius,
    );
    grd.addColorStop(0, "rgba(0, 0, 0, 0)");
    grd.addColorStop(0.5, "rgba(0, 0, 0, 0.75)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0.98)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cv.width, cv.height);

    if (blindTarget.ball) {
      const bx = blindTarget.ball.x;
      const by = blindTarget.ball.y;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(163, 158, 173, 0.5)";
      ctx.beginPath();
      ctx.arc(cv.width - bx, by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + 30, by - 30, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        bx + Math.cos(performance.now() / 150) * 70,
        by + Math.sin(performance.now() / 150) * 70,
        11,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // ★ HTML 狀態列與 HUD 更新 (DOM Overlay)
  // ==========================================
  const hud = document.getElementById("chem-bottom-hud");
  if (hud) {
    if (chemDLCEnabled && typeof chemStates !== "undefined" && chemStates) {
      hud.style.display = "flex";
      const p1El = document.getElementById("hud-1p");
      const p2El = document.getElementById("hud-2p");
      const topHudEl = document.getElementById("top-hud-buff-display");

      const categoryColors = {
        "攻擊": "#E0576B",
        "防禦": "#5FA8D3",
        "輔助": "#2EB886",
        "控制": "#DDA15E",
        "特殊": "#A985DC",
        "實驗": "#8A7E9C",
      };

      // 1. 生成技能 CD 狀態與餘額標籤
      const getStatusText = (pId) => {
        const eq = chemStates[pId]?.equipped || [];
        const inv = chemStates[pId]?.inventory || {};
        const validSkills = eq.filter((id) => id);

        if (validSkills.length === 0)
          return "<span style='opacity: 0.5;'>尚未裝備</span>";

        const now = performance.now();

        return validSkills
          .map((sId) => {
            const skill = getSkillData(sId);
            if (!skill) return "";

            let maxCasts = 999;
            if (skill.elements) {
              for (const [sym, req] of Object.entries(skill.elements)) {
                maxCasts = Math.min(
                  maxCasts,
                  Math.floor((inv[sym] || 0) / req),
                );
              }
            }
            if (maxCasts === 999) maxCasts = 0;

            const rawFormula = skill.formula || skill.name || "";
            const pureFormula = rawFormula.split("(")[0];
            const subscripted = pureFormula.replace(
              /\d/g,
              (d) => "₀₁₂₃₄₅₆₇₈₉"[d],
            );
            const color =
              categoryColors[skill.category] || categoryColors["實驗"];

            let cdRatio = 0;
            const cdKey = `${pId}_${sId}`;

            if (skillCooldowns[cdKey]) {
              const getElementGW = (sym) => {
                const gwMap = {
                  "O": 11.0,
                  "C": 11.0,
                  "N": 11.0,
                  "H": 11.0,
                  "Fe": 12.0,
                  "Cu": 11.8,
                  "Ti": 10.8,
                  "Mn": 10.8,
                  "Cr": 10.8,
                  "Co": 10.7,
                  "Ni": 10.7,
                  "Si": 11.2,
                  "S": 10.8,
                  "P": 11.1,
                  "Cl": 10.7,
                  "F": 11.3,
                  "Na": 10.0,
                  "Mg": 9.7,
                  "Ca": 10.0,
                  "K": 9.9,
                  "Al": 10.0,
                  "Zn": 10.7,
                  "Ag": 11.4,
                  "Pt": 12.0,
                  "Au": 12.4,
                  "Th": 11.5,
                  "U": 12.6,
                  "Pu": 12.8,
                };
                if (gwMap[sym]) return gwMap[sym];

                const atomicNum =
                  window.ATOMIC_NUMBER ? window.ATOMIC_NUMBER[sym] : 0;
                if (atomicNum >= 104) return 14.0;
                if (atomicNum >= 89 && atomicNum <= 103) return 13.5;
                if (
                  [
                    "Rb",
                    "Sr",
                    "Y",
                    "Zr",
                    "Nb",
                    "Mo",
                    "Ru",
                    "Rh",
                    "Pd",
                    "Cd",
                    "In",
                    "Sn",
                    "Sb",
                    "Te",
                    "I",
                    "Xe",
                  ].includes(sym)
                )
                  return 12.0;
                if (["Sc", "V", "Ga", "Ge"].includes(sym)) return 11.5;
                return 10.0;
              };

              let maxElementGW = 0;
              let totalAtoms = 0;
              for (const [sym, count] of Object.entries(skill.elements || {})) {
                const gw = getElementGW(sym);
                if (gw > maxElementGW) maxElementGW = gw;
                totalAtoms += count;
              }

              const baseSkillGW =
                maxElementGW + Math.log2(Math.max(1, totalAtoms)) * 0.5;

              let compoundValue = 1.0;
              const tier = skill.progression?.molecularWeightTier || "medium";
              if (tier === "heavy") compoundValue = 1.25;
              else if (tier === "medium") compoundValue = 1.1;
              else if (tier === "light") compoundValue = 0.9;

              const rarityBonus = 1 + Math.max(0, (maxElementGW - 10.5) * 0.08);
              const finalSkillValue = baseSkillGW * compoundValue * rarityBonus;

              let calculatedCD = 38 - finalSkillValue * 1.2;
              calculatedCD = Math.max(6, Math.min(25, calculatedCD));

              const levelMult = chemStates[pId]?.levels?.[sId] || 1;
              calculatedCD += (levelMult - 1) * 1.0;

              const totalCdMs = calculatedCD * 1000;
              const elapsed = now - skillCooldowns[cdKey];

              if (elapsed < totalCdMs) {
                cdRatio = 1 - elapsed / totalCdMs;
              }
            }

            const isCoolingDown = cdRatio > 0;
            const maskWidth = (cdRatio * 100).toFixed(1) + "%";
            const bgColor = isCoolingDown ? "#CBD5E1" : `${color}20`;
            const textColor = isCoolingDown ? "#64748B" : color;

            return `<span style="position: relative; display: inline-flex; align-items: center; background: ${bgColor}; color: ${textColor}; padding: 2px 10px; border-radius: 12px; margin: 0 4px; overflow: hidden;">
                    <span style="position: absolute; top: 0; left: 0; height: 100%; width: ${maskWidth}; background: rgba(0, 0, 0, 0.45); z-index: 1; transition: width 0.1s linear;"></span>
                    <span style="position: relative; z-index: 2; font-family: serif; font-weight: 900; letter-spacing: 0.5px; ${isCoolingDown ? "color: #FFF;" : ""}">${subscripted}</span>
                    <span style="position: relative; z-index: 2; font-size: 0.85em; margin-left: 4px; ${isCoolingDown ? "color: #E2E8F0;" : "color: #333; opacity: 0.85;"}">x${maxCasts}</span>
                  </span>`;
          })
          .join("");
      };

      // 2. 生成生效中技能的輪播顯示器
      const getActiveBuffHtml = (pl) => {
        if (!pl || !pl.activeBuffs) return "";
        const now = performance.now();
        const activeKeys = Object.keys(pl.activeBuffs).filter(
          (k) => pl.activeBuffs[k].end > now,
        );
        if (activeKeys.length === 0) return "";

        const cycleIndex = Math.floor(now / 1500) % activeKeys.length;
        const currentBuff = pl.activeBuffs[activeKeys[cycleIndex]];
        if (!currentBuff) return "";

        let catEmoji = "✨";
        if (currentBuff.category === "攻擊") catEmoji = "🔥";
        else if (currentBuff.category === "防禦") catEmoji = "🛡️";
        else if (currentBuff.category === "輔助") catEmoji = "❤️‍🔥";
        else if (currentBuff.category === "控制") catEmoji = "🪁";
        else if (currentBuff.category === "特殊") catEmoji = "🌟";

        return `<span style="display: inline-block; font-weight: 900; color: #444; padding: 0 10px 0 0; font-size: 20px;">
                  ${catEmoji}${currentBuff.name}
                </span>`;
      };

      // ==========================================
      // ★ 3. 根據模式智慧分流：完整版 vs 極簡版
      // ==========================================
      if (p1El) {
        const combo = gameState.comboCount || 0;
        const maxCombo = 30;
        const progress = Math.min(100, (combo / maxCombo) * 100);
        const isAwakened = combo >= maxCombo;

        if (mode === 1 || onlineMode) {
          // --- A. 單人與連線對戰：完整右靠齊設計 ---
          p1El.style.flex = "1";
          let comboWrap = document.getElementById("chakra-bar-container");

          if (!comboWrap) {
            p1El.innerHTML = `
                <div style="display: flex; align-items: center; width: 100%; justify-content: space-between; white-space: nowrap;">
                  <div style="display: flex; align-items: center; overflow: hidden;">
                    <span style="color: #d96c8e; margin-right: 8px; font-weight: 900;">1P</span> 
                    <div id="hud-skills-container" style="display: flex; align-items: center;">
                      ${getStatusText(0)}
                    </div>
                  </div>
                  
                  <div id="chakra-bar-container" style="display: flex; align-items: center; margin-left: auto; border: 2px solid rgba(193, 133, 255, 0.5); border-radius: 12px; padding: 0px 10px; background: rgb(222 222 222); transition: all 0.3s; flex-shrink: 0;">
                      <span id="chakra-title-text" style="font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 12px; color: ${isAwakened ? "#d96c8e" : "#8A7E9C"}; margin-right: 8px; transition: color 0.3s;">CHAKRA</span>
                      
                      <div style="width: 100px; height: 10px; background: rgb(255, 255, 255); border-radius: 5px; overflow: hidden; position: relative;">
                          <div id="chakra-fill-bar" style="width: ${progress}%; height: 100%; background: ${isAwakened ? "#E0FFFF" : "linear-gradient(90deg, #38BDF8, #818CF8)"}; transition: width 0.15s ease-out, background 0.3s;"></div>
                      </div>
                      
                      <span id="chakra-max-text" style="font-size: 12px; font-weight: 900; color: #0074a6; margin-left: 6px; display: ${isAwakened ? "inline" : "none"}; text-shadow: 0 0 5px #084f6d;">MAX!</span>
                  </div>
                </div>
              `;
          } else {
            // 平滑更新完整版
            document.getElementById("hud-skills-container").innerHTML =
              getStatusText(0);
            const fillBar = document.getElementById("chakra-fill-bar");
            const countText = document.getElementById("chakra-count-text");
            const maxText = document.getElementById("chakra-max-text");
            const titleText = document.getElementById("chakra-title-text");

            if (fillBar) fillBar.style.width = `${progress}%`;
            if (countText) countText.innerText = `${combo}/${maxCombo}`;

            if (isAwakened) {
              comboWrap.style.borderColor = "#38BDF8";
              comboWrap.style.boxShadow = "0 0 10px rgba(56, 189, 248, 0.6)";
              if (titleText) {
                titleText.style.color = "#38BDF8";
                titleText.style.textShadow = "0 0 5px #38BDF8";
              }
              if (fillBar) {
                fillBar.style.background = "#E0FFFF";
                fillBar.style.boxShadow = "0 0 10px #38BDF8";
              }
              if (countText) {
                countText.style.color = "#38BDF8";
                countText.style.textShadow = "0 0 5px #38BDF8";
              }
              if (maxText) maxText.style.display = "inline";
            } else {
              comboWrap.style.borderColor = "#c9b1e8";
              comboWrap.style.boxShadow = "none";
              if (titleText) {
                titleText.style.color = "#8A7E9C";
                titleText.style.textShadow = "none";
              }
              if (fillBar) {
                fillBar.style.background =
                  "linear-gradient(90deg, #38BDF8, #818CF8)";
                fillBar.style.boxShadow = "none";
              }
              if (countText) {
                countText.style.color = "#8A7E9C";
                countText.style.textShadow = "none";
              }
              if (maxText) maxText.style.display = "none";
            }
          }
        } else {
          // --- B. 雙人模式：底部維持乾淨，只顯示裝備技能 ---
          p1El.style.flex = "initial";
          p1El.innerHTML = `<div style="display: flex; align-items: center;"><span style="color: #d96c8e; margin-right: 8px;">1P</span> ${getStatusText(0)}</div>`;
        }
      }

      if (p2El) {
        if (mode === 1 || onlineMode) p2El.innerHTML = "";
        else
          p2El.innerHTML = `<div style="display: flex; align-items: center; justify-content: flex-end;">${getStatusText(1)} <span style="color: #5fa8d3; margin-left: 8px;">2P</span></div>`;
      }

      // 4. 寫入 Top HUD (紅圈處)
      if (topHudEl) {
        const buffHtml = getActiveBuffHtml(p1);
        if (buffHtml) {
          topHudEl.style.display = "flex";
          topHudEl.innerHTML = buffHtml;
        } else {
          topHudEl.style.display = "none";
          topHudEl.innerHTML = "";
        }
      }
    } else {
      hud.style.display = "none";
      const topHudEl = document.getElementById("top-hud-buff-display");
      if (topHudEl) topHudEl.style.display = "none";
    }
  }

  // ==========================================
  // ★ 4. 極簡版大招查克拉集氣條 (只在單機雙人模式生效)
  // ==========================================
  const currentCombo = gameState.comboCount || 0;
  const maxCombo = 30;
  const progress = Math.min(100, (currentCombo / maxCombo) * 100);
  const isAwakened = currentCombo >= maxCombo;

  ["p1", "p2"].forEach((p) => {
    const card = document.getElementById(`${p}-card`);
    const barWrapId = `${p}-chakra-wrap`;

    // ★ 若是單人或連線對戰，確保隱藏上方卡片的迷你進度條
    if (mode === 1 || onlineMode) {
      const existingWrap = document.getElementById(barWrapId);
      if (existingWrap) existingWrap.style.display = "none";
      return;
    }

    if (card && card.style.display !== "none") {
      // 確保卡片可以作為絕對定位的基準
      if (card.style.position !== "relative") {
        card.style.position = "relative";
        card.style.overflow = "hidden";
      }

      let barWrap = document.getElementById(barWrapId);
      if (!barWrap) {
        barWrap = document.createElement("div");
        barWrap.id = barWrapId;
        // 貼緊底部，高度 5px，無文字
        barWrap.style.cssText = `
          position: absolute; 
          bottom: 0; 
          left: 0; 
          width: 100%; 
          height: 5px; 
          background: rgba(0,0,0,0.15); 
          z-index: 10;
        `;

        const fillBar = document.createElement("div");
        fillBar.id = `${p}-chakra-fill`;
        fillBar.style.cssText = `
          width: 0%; 
          height: 100%; 
          background: linear-gradient(90deg, #38BDF8, #818CF8); 
          transition: width 0.15s ease-out, background 0.3s, box-shadow 0.3s;
        `;

        barWrap.appendChild(fillBar);
        card.appendChild(barWrap);
      }

      barWrap.style.display = "block"; // 確保雙人模式下正確顯示

      // 每一幀更新進度條寬度與發光狀態
      const fillEl = document.getElementById(`${p}-chakra-fill`);
      if (fillEl) {
        fillEl.style.width = `${progress}%`;
        if (isAwakened) {
          fillEl.style.background = "#E0FFFF";
          fillEl.style.boxShadow = "0 0 10px #38BDF8, inset 0 0 5px #38BDF8";
        } else {
          fillEl.style.background = "linear-gradient(90deg, #38BDF8, #818CF8)";
          fillEl.style.boxShadow = "none";
        }
      }
    }
  });
}

export function resetBackground() {
  currentBg = null;
  isBgCached = false;
}
