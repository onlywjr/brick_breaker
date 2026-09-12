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
      const damageRatio = 1 - b.hp / b.maxHp;
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
    if (b.symbol && ELEMENT_DATA[b.symbol]) {
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
    } else {
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
      ctx.shadowBlur = 20;
    } else {
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 15;
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
      if (!PERFORMANCE_MODE) {
        ctx.shadowColor = pl.lightColor;
        ctx.shadowBlur = 18;
      }

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

  // 玩家彈珠與雷射/重球特效
  for (const pl of activePlayers) {
    if (!pl.ball) continue;
    const b = pl.ball;

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
      else if (pl.speedBuffRatio && pl.speedBuffRatio > 1) ballEmoji = "⚡";
      else if (b.fire) ballEmoji = "🔥";
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
      && (b.isPiercing
        || (pl.speedBuffRatio && pl.speedBuffRatio > 1)
        || b.fire
        || (pl.scoreMultiplier && pl.scoreMultiplier > 1))
    ) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      let rgbColor =
        activeAction === "laser_pierce" ? "255, 100, 200"
        : activeAction === "phase_piercing" ? "163, 158, 173"
        : b.isPiercing ? "216, 180, 254"
        : b.fire ? "249, 115, 22"
        : pl.scoreMultiplier && pl.scoreMultiplier > 1 ? "253, 224, 71"
        : "134, 239, 172";
      for (let i = 0; i < b.history.length; i++) {
        let pt = b.history[i];
        let ratio = i / b.history.length;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, b.r * (0.4 + 0.6 * ratio), 0, Math.PI * 2);
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
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle =
      isP1 ? "rgba(255, 122, 166, 0.25)" : "rgba(0, 168, 210, 0.25)";
    ctx.fill();

    if (ballEmoji) {
      ctx.font = "18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ballEmoji, 0, 1);
    } else {
      ctx.save();
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
    ctx.restore();
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

  if (isBlinded && blindTarget) {
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

        return `<span style="display: inline-block; font-weight: 900; color: #444; padding: 0 10px 0 0; font-size: 20px;">
                  ${catEmoji}${currentBuff.name}
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
