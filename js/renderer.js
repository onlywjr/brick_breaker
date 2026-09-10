import { lightenColor, skillCooldowns } from "./physics.js";

import {
  MEMBERS,
  chemDLCEnabled,
  p1,
  p2,
  mode,
  onlineMode,
  onlineBlindTimer,
} from "./game.js";

import {
  ELEMENT_DATA,
  getNeededElements,
  chemStates,
  getSkillData,
} from "../mod/chemistry.js";

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

export function drawGameBackground(ctx, cv) {
  if (!currentBg) currentBg = createRandomBackground();

  ctx.fillStyle = currentBg.base;
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.save();
  for (const g of currentBg.glow) {
    const x = cv.width * g.x;
    const y = cv.height * g.y;
    const radius = Math.max(cv.width, cv.height) * g.radius;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, hexToRgba(g.color, 0.95));
    gradient.addColorStop(0.35, hexToRgba(g.color, 0.65));
    gradient.addColorStop(0.75, hexToRgba(g.color, 0.25));
    gradient.addColorStop(1, hexToRgba(g.color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  const center = ctx.createRadialGradient(
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

  const vignette = ctx.createRadialGradient(
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

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, 0, cv.width, cv.height);

  const blockSize = 20;

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
  }

  const bgHeights = [
    6, 8, 5, 9, 7, 4, 10, 6, 5, 8, 7, 4, 9, 5, 6, 8, 10, 5, 7, 6, 4, 8, 5, 9, 6,
    7, 4, 10, 5, 6, 8, 5, 7, 9, 4, 6, 8, 5, 10, 7,
  ];
  for (let i = 0; i < cv.width / blockSize; i++) {
    let blocks = bgHeights[i % bgHeights.length];
    let h = blocks * blockSize;
    let x = i * blockSize;
    let y = cv.height - h;
    ctx.fillStyle = "rgba(138, 126, 156, 0.15)";
    ctx.fillRect(x, y, blockSize, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (let j = 1; j < blocks - 1; j++) {
      if (currentBg.bgWindows[i] && currentBg.bgWindows[i][j]) {
        ctx.fillRect(x + 6, y + j * blockSize + 6, 8, 8);
      }
    }
  }

  const fgHeights = [
    3, 4, 2, 5, 3, 2, 6, 4, 3, 5, 2, 4, 3, 2, 5, 3, 6, 4, 2, 3, 5, 2, 4, 3, 6,
    2, 4, 3, 5, 2, 4, 3, 6, 2, 5, 3, 4, 2, 6, 3,
  ];
  for (let i = 0; i < cv.width / blockSize; i++) {
    let blocks = fgHeights[i % fgHeights.length];
    let h = blocks * blockSize;
    let x = i * blockSize;
    let y = cv.height - h;
    ctx.fillStyle = "rgba(93, 87, 107, 0.25)";
    ctx.fillRect(x, y, blockSize, h);
    ctx.fillStyle = "rgba(253, 224, 71, 0.35)";
    for (let j = 1; j < blocks; j++) {
      if (currentBg.fgWindows[i] && currentBg.fgWindows[i][j]) {
        if (currentBg.fgWindows[i][j].left)
          ctx.fillRect(x + 3, y + j * blockSize + 6, 4, 8);
        if (currentBg.fgWindows[i][j].right)
          ctx.fillRect(x + 13, y + j * blockSize + 6, 4, 8);
      }
    }
  }
  ctx.restore();
}

export function drawGameEntities(ctx, cv, gameState, loadedImages) {
  const { bricks, drops, particles, floatTexts, boss, p1, p2, activePlayers } =
    gameState;

  // ★ 效能優化：在迴圈外提前計算當前幀的願望清單，並轉為 Set 提升查詢效能至 O(1)
  const neededSet =
    (
      typeof chemDLCEnabled !== "undefined"
      && chemDLCEnabled
      && typeof getNeededElements === "function"
    ) ?
      new Set(getNeededElements())
    : new Set();

  for (const b of bricks) {
    const set =
      b.hp >= 2 ? loadedImages.brickFull || [] : loadedImages.brickCrack || [];
    const img = set.length > 0 ? set[b.ci % set.length] : null;

    ctx.save();
    const member = MEMBERS[b.ci % MEMBERS.length];
    const paleColor = lightenColor(member.color, 0.55);
    ctx.shadowColor = paleColor;
    ctx.shadowBlur = 10;

    ctx.fillStyle = paleColor;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();

    if (b.isMoving) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      // ★ 將虛線外框也改為圓角
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "14px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText("↔", b.x + b.w / 2, b.y - 8);
    }
    ctx.restore();

    ctx.save();
    ctx.textBaseline = "middle";

    if (b.symbol && ELEMENT_DATA[b.symbol]) {
      const zhName = ELEMENT_DATA[b.symbol][0];

      // 1. 量測中英文寬度，計算置中起點
      ctx.font = "900 14px Orbitron, sans-serif";
      const engWidth = ctx.measureText(b.symbol).width;

      ctx.font = "500 14px 'Noto Sans TC', sans-serif";
      const zhWidth = ctx.measureText(zhName).width;

      const gap = 5;
      const totalWidth = engWidth + gap + zhWidth;
      const startX = b.x + b.w / 2 - totalWidth / 2;

      // ★ 效能優化：直接向迴圈外建立的 Set 進行高效查詢
      if (neededSet.has(b.symbol)) {
        ctx.beginPath();
        // 位置放在英文起點向左推 10px，半徑 3px
        ctx.arc(startX - 10, b.y + b.h / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#F6D98B"; // 亮黃色
        ctx.shadowColor = "#F6D98B";
        ctx.shadowBlur = 8; // 光暈效果
        ctx.fill();
        ctx.shadowBlur = 0; // 畫完馬上歸零，以免影響旁邊文字
      }

      // ★ 新增：如果此元素是願望清單目標，在文字左邊畫一個發光小圓點
      const needed = getNeededElements();
      if (needed.includes(b.symbol)) {
        ctx.beginPath();
        // 位置放在英文起點向左推 10px，半徑 3px
        ctx.arc(startX - 10, b.y + b.h / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#F6D98B"; // 亮黃色
        ctx.shadowColor = "#F6D98B";
        ctx.shadowBlur = 8; // 光暈效果
        ctx.fill();
        ctx.shadowBlur = 0; // 畫完馬上歸零，以免影響旁邊文字
      }

      // 2. 繪製英文 (粗體 + 黑體描邊)
      ctx.font = "900 14px Orbitron, sans-serif";
      ctx.fillStyle = "#FFFDFB";
      ctx.textAlign = "left";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(b.symbol, startX, b.y + b.h / 2 + 1);
      ctx.fillText(b.symbol, startX, b.y + b.h / 2 + 1);

      // 3. 繪製中文 (一般黑體 + 微弱陰影)
      ctx.font = "400 14px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#761c1c";
      ctx.fillText(zhName, startX + engWidth + gap, b.y + b.h / 2);
    } else {
      // 預設沒有化學元素的磚塊維持原樣
      const name = member.name;
      ctx.font = "900 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(name, b.x + b.w / 2, b.y + b.h / 2);
      ctx.fillText(name, b.x + b.w / 2, b.y + b.h / 2);
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

    ctx.translate(cx, cy);

    let colorBody =
      boss.flashTimer > 0 ? "#FFFDFB" : `hsl(${boss.parts.hueMain}, 85%, 82%)`;
    let strokeBody = `hsl(${boss.parts.hueMain}, 75%, 65%)`;
    let colorArmor =
      boss.flashTimer > 0 ? "#FFFDFB" : `hsl(${boss.parts.hueArmor}, 85%, 80%)`;
    let strokeArmor = `hsl(${boss.parts.hueArmor}, 75%, 65%)`;
    let colorAcc =
      boss.flashTimer > 0 ? "#FFFDFB" : `hsl(${boss.parts.hueAcc}, 85%, 75%)`;
    let strokeAcc = `hsl(${boss.parts.hueAcc}, 75%, 60%)`;

    ctx.lineWidth = 4;
    ctx.lineJoin = "round";

    const drawArm = (side, type, isWeapon) => {
      let sign = side === "left" ? -1 : 1;
      ctx.fillStyle = colorArmor;
      ctx.strokeStyle = strokeArmor;
      ctx.beginPath();
      if (!isWeapon) {
        let xOff = sign * 60;
        if (type === 0) {
          ctx.rect(xOff - 10, -10, 20, 60);
        } else if (type === 1) {
          ctx.arc(xOff, 10, 25, 0, Math.PI * 2);
        } else {
          ctx.moveTo(xOff - 20 * sign, -30);
          ctx.lineTo(xOff + 30 * sign, -10);
          ctx.lineTo(xOff, 40);
        }
      } else {
        let xOff = sign * 80;
        if (type === 0) {
          ctx.rect(xOff - 15, 30, 30, 40);
          ctx.fillStyle = colorAcc;
          ctx.fillRect(xOff - 10, 70, 20, 15);
        } else if (type === 1) {
          ctx.moveTo(xOff - 15, 20);
          ctx.lineTo(xOff - 25, 60);
          ctx.lineTo(xOff, 40);
          ctx.lineTo(xOff + 25, 60);
          ctx.lineTo(xOff + 15, 20);
        } else {
          ctx.moveTo(xOff - 20, 20);
          ctx.lineTo(xOff + 20, 20);
          ctx.lineTo(xOff, 70);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    drawArm("left", boss.parts.leftArm, false);
    drawArm("right", boss.parts.rightArm, false);
    drawArm("left", boss.parts.leftWeapon, true);
    drawArm("right", boss.parts.rightWeapon, true);

    ctx.fillStyle = colorBody;
    ctx.strokeStyle = strokeBody;
    ctx.beginPath();
    if (boss.parts.body === 0) {
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
    } else if (boss.parts.body === 1) {
      ctx.moveTo(-40, -50);
      ctx.lineTo(40, -50);
      ctx.lineTo(60, 40);
      ctx.lineTo(-60, 40);
    } else {
      ctx.moveTo(0, -60);
      ctx.lineTo(60, 0);
      ctx.lineTo(0, 60);
      ctx.lineTo(-60, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorArmor;
    ctx.strokeStyle = strokeArmor;
    ctx.beginPath();
    if (boss.parts.hat === 0) {
      ctx.moveTo(-30, -40);
      ctx.lineTo(-50, -80);
      ctx.lineTo(-10, -50);
      ctx.moveTo(30, -40);
      ctx.lineTo(50, -80);
      ctx.lineTo(10, -50);
    } else if (boss.parts.hat === 1) {
      ctx.moveTo(-40, -40);
      ctx.lineTo(-30, -70);
      ctx.lineTo(-15, -45);
      ctx.lineTo(0, -75);
      ctx.lineTo(15, -45);
      ctx.lineTo(30, -70);
      ctx.lineTo(40, -40);
    } else {
      ctx.rect(-5, -70, 10, 30);
      ctx.arc(0, -75, 12, 0, Math.PI, true);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    let coreGlow =
      boss.phase === 3 ? "#E0576B"
      : boss.phase === 2 ? "#C9B1E8"
      : "#9DD9E8";
    ctx.fillStyle = colorAcc;
    ctx.strokeStyle = coreGlow;
    ctx.shadowColor = coreGlow;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    if (boss.parts.core === 0) {
      ctx.arc(0, 5, 15, 0, Math.PI * 2);
    } else if (boss.parts.core === 1) {
      ctx.moveTo(-30, -10);
      ctx.lineTo(30, -10);
      ctx.lineTo(0, 20);
    } else {
      ctx.rect(-40, 0, 80, 15);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();

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

  // 找到負責畫擋板的迴圈，並將其內容替換如下：
  for (const pl of activePlayers) {
    const pim =
      pl.w <= 90 ? loadedImages.padS
      : pl.w >= 200 ? loadedImages.padL
      : loadedImages.padM;
    const hasImg = pim && pim.complete && pim.naturalWidth > 0;

    if (hasImg) {
      ctx.save();
      ctx.shadowColor = pl.lightColor;
      ctx.shadowBlur = 18;

      // 使用另一個小畫布將圖片填上玩家專屬的馬卡龍色
      const tempCv = document.createElement("canvas");
      tempCv.width = pl.w;
      tempCv.height = pl.h;
      const tCtx = tempCv.getContext("2d");
      tCtx.drawImage(pim, 0, 0, pl.w, pl.h);
      tCtx.globalCompositeOperation = "source-in";
      tCtx.fillStyle = pl.color;
      tCtx.fillRect(0, 0, pl.w, pl.h);

      ctx.drawImage(tempCv, pl.x, pl.y);
      ctx.restore();
    } else {
      // 圖片載入失敗時的備用純色方案
      ctx.save();
      ctx.shadowColor = pl.lightColor;
      ctx.shadowBlur = 18;
      ctx.fillStyle = pl.color;
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      ctx.restore();
    }

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
      statusText = `x${pl.shield}`;
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

  for (const pl of activePlayers) {
    if (!pl.ball) continue;
    const b = pl.ball;

    // ==========================================
    // ★ 實作：動態殘影拖尾 (Trail Effect)
    // ==========================================
    b.history = b.history || [];
    b.history.push({ x: b.x, y: b.y });
    if (b.history.length > 12) b.history.shift(); // 保持最多 12 幀的殘影

    // 只有在 穿透、加速 或 火球 狀態下才繪製拖尾
    if (
      b.history.length > 0
      && (b.isPiercing
        || (pl.speedBuffRatio && pl.speedBuffRatio > 1)
        || b.fire
        || (pl.scoreMultiplier && pl.scoreMultiplier > 1)) // ★ 判定積分倍率
    ) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // 穿透=紫電，火球=橘焰，加速=綠芒
      let rgbColor =
        b.isPiercing ? "216, 180, 254"
        : b.fire ? "249, 115, 22"
        : pl.scoreMultiplier && pl.scoreMultiplier > 1 ? "253, 224, 71"
        : "134, 239, 172";

      // 從最舊的歷史座標畫到最新，產生漸隱效果
      for (let i = 0; i < b.history.length; i++) {
        let pt = b.history[i];
        let ratio = i / b.history.length; // 0 到 1 的淡出比例

        ctx.beginPath();
        // 殘影由小變大
        ctx.arc(pt.x, pt.y, b.r * (0.4 + 0.6 * ratio), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgbColor}, ${ratio * 0.6})`;
        ctx.shadowColor = `rgb(${rgbColor})`;
        ctx.shadowBlur = 10 * ratio;
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    if (b.fire) {
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 18;
    } else {
      ctx.shadowColor = pl.lightColor;
      ctx.shadowBlur = 12;
    }

    const isP1 = pl === p1;
    ctx.translate(b.x, b.y);

    // ==========================================
    // 1. 優先計算：當前是否帶有技能 Emoji
    // ==========================================
    let ballEmoji = "";
    if (pl.activeBuffs) {
      const now = performance.now();
      for (const key in pl.activeBuffs) {
        if (pl.activeBuffs[key].end > now) {
          const cat = pl.activeBuffs[key].category;
          if (cat === "攻擊") ballEmoji = "🔥";
          else if (cat === "輔助") ballEmoji = "❤️‍🔥";
          else if (cat === "控制") ballEmoji = "🪁";
          else if (cat === "防禦") ballEmoji = "🛡️";
          else if (cat === "特殊") ballEmoji = "🌟";
          else if (cat === "實驗") ballEmoji = "⚠️";
        }
      }
    }
    // 若無化學分類，退回舊版物理狀態圖示
    if (!ballEmoji) {
      if (b.isPiercing) ballEmoji = "☄️";
      else if (pl.speedBuffRatio && pl.speedBuffRatio > 1) ballEmoji = "⚡";
      else if (b.fire) ballEmoji = "🔥";
    }

    // ==========================================
    // 2. 畫出專屬的 1P/2P 圓形背景光環框
    // ==========================================
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2); // 半徑 14 剛剛好包覆球體
    // 1P 為粉紅色系，2P 為藍色系
    ctx.fillStyle =
      isP1 ? "rgba(255, 122, 166, 0.25)" : "rgba(0, 168, 210, 0.25)";
    ctx.fill();

    // ==========================================
    // 3. 決定內容：用 Emoji 取代，或畫出預設圖形
    // ==========================================
    if (ballEmoji) {
      // 有技能時，直接將 Emoji 置中畫在圓框內，取代預設圖形
      ctx.font = "18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ballEmoji, 0, 1); // Y 軸微調 1px 讓視覺絕對置中
    } else {
      // 沒技能時，畫原本的 1P / 2P 專屬圖形
      ctx.save();
      ctx.scale(0.85, 0.85); // 稍微縮小 85%，讓它完美塞進圓框裡

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

    ctx.restore();
  }

  // ★ 繪製半透明幽靈球
  if (gameState.ghostBalls) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const gb of gameState.ghostBalls) {
      ctx.beginPath();
      ctx.arc(gb.x, gb.y, gb.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(163, 158, 173, ${Math.min(0.6, gb.life)})`; // 隨時間淡出
      ctx.shadowColor = "#A39EAD";
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.restore();
  }

  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.c;
    const sz = p.size || 3;
    ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  for (const f of floatTexts) {
    f.life -= 0.02;
    f.y -= 1;
    ctx.globalAlpha = f.life;
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = f.c || "#D96C8E";
    ctx.font = f.big ? "bold 24px sans-serif" : "bold 18px sans-serif";
    ctx.fillText(f.t, f.x, f.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // ==========================================
  // ★ Phase 4 實作：終極視覺干擾 (探照燈視野與幻影假球)
  // ==========================================
  let isBlinded = false;
  let blindTarget = null;

  // 判斷致盲目標 (連線模式看全域計時器，單機雙人看 pl.timers)
  if (
    onlineMode
    && typeof onlineBlindTimer !== "undefined"
    && onlineBlindTimer > 0
  ) {
    isBlinded = true;
    blindTarget = p1;
  } else if (mode === 2) {
    if (p1.timers && p1.timers.blind) {
      isBlinded = true;
      blindTarget = p1;
    } else if (p2.timers && p2.timers.blind) {
      isBlinded = true;
      blindTarget = p2;
    }
  }

  if (isBlinded && blindTarget) {
    ctx.save();

    // 1. 畫出「探照燈/迷霧」視野 (Vignette)
    // 讓可見半徑隨著時間急促收縮脈動，製造極大的心理壓迫感
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
    grd.addColorStop(0, "rgba(0, 0, 0, 0)"); // 擋板周圍完全透明
    grd.addColorStop(0.5, "rgba(0, 0, 0, 0.75)"); // 邊緣半透明漸層
    grd.addColorStop(1, "rgba(0, 0, 0, 0.98)"); // 外圍近乎全黑

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cv.width, cv.height);

    // 2. 製造「幻影假球 (Fake Ball Illusion)」
    // 利用真球的座標作動態偏移與鏡像，欺騙對手視覺
    if (blindTarget.ball) {
      const bx = blindTarget.ball.x;
      const by = blindTarget.ball.y;

      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(163, 158, 173, 0.5)"; // 灰白色的幻影

      // 假球 A：X 軸完美鏡像 (玩家往左接，它就往右跑)
      ctx.beginPath();
      ctx.arc(cv.width - bx, by, 11, 0, Math.PI * 2);
      ctx.fill();

      // 假球 B：緊隨其後的疊影殘留
      ctx.beginPath();
      ctx.arc(bx + 30, by - 30, 11, 0, Math.PI * 2);
      ctx.fill();

      // 假球 C：隨機亂竄的干擾源
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
      const topHudEl = document.getElementById("top-hud-buff-display"); // 抓取上方紅圈容器

      const categoryColors = {
        "攻擊": "#E0576B",
        "防禦": "#5FA8D3",
        "輔助": "#2EB886",
        "控制": "#DDA15E",
        "特殊": "#A985DC",
        "實驗": "#8A7E9C",
      };

      // 1. 生成技能 CD 狀態與餘額標籤 (給 Bottom Status Bar 使用)
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

            // 計算 CD 比例 (0 到 1)
            let cdRatio = 0;
            if (skillCooldowns[sId]) {
              const levelMult = chemStates[pId]?.levels?.[sId] || 1;
              const effect =
                mode === 2 || onlineMode ?
                  skill.effectMulti
                : skill.effectSingle;
              const baseDuration = effect?.params?.durationSec || 0;
              const actualDuration =
                baseDuration > 0 ? baseDuration + (levelMult - 1) * 1 : 0;
              const totalCdMs = Math.max(5000, (actualDuration + 2) * 1000);

              const elapsed = now - skillCooldowns[sId];
              if (elapsed < totalCdMs) cdRatio = 1 - elapsed / totalCdMs;
            }

            const isCoolingDown = cdRatio > 0;
            const maskWidth = (cdRatio * 100).toFixed(1) + "%";
            const bgColor = isCoolingDown ? "#CBD5E1" : `${color}20`;
            const textColor = isCoolingDown ? "#64748B" : color;

            return `<span style="position: relative; display: inline-flex; align-items: center; background: ${bgColor}; color: ${textColor}; padding: 2px 10px; border-radius: 12px; margin: 0 4px; overflow: hidden;">
                    <!-- ★ 更深色的黑底遮罩層，縮減時平滑過渡 -->
                    <span style="position: absolute; top: 0; left: 0; height: 100%; width: ${maskWidth}; background: rgba(0, 0, 0, 0.45); z-index: 1; transition: width 0.1s linear;"></span>
                    <span style="position: relative; z-index: 2; font-family: serif; font-weight: 900; letter-spacing: 0.5px; ${isCoolingDown ? "color: #FFF;" : ""}">${subscripted}</span>
                    <span style="position: relative; z-index: 2; font-size: 0.85em; margin-left: 4px; ${isCoolingDown ? "color: #E2E8F0;" : "color: #333; opacity: 0.85;"}">x${maxCasts}</span>
                  </span>`;
          })
          .join("");
      };

      // 2. 生成生效中技能的輪播顯示器 (給 Top HUD 使用)
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

        return `<span style="display: inline-block; font-weight: 900; color: #fff; background: rgba(0,0,0,0.65); padding: 4px 16px; border-radius: 16px; box-shadow: 0 0 8px rgba(255,255,255,0.2); font-size: 14px;">
                  ${catEmoji} ${currentBuff.name}
                </span>`;
      };

      // 3. 寫入 Bottom Status Bar
      if (p1El)
        p1El.innerHTML = `<div style="display: flex; align-items: center;"><span style="color: #d96c8e; margin-right: 8px;">1P</span> ${getStatusText(0)}</div>`;
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
}

export function resetBackground() {
  currentBg = null;
}
