import { lightenColor } from "./physics.js";
import { MEMBERS } from "./game.js";

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
    ctx.fillRect(b.x, b.y, b.w, b.h);

    if (b.isMoving) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
      ctx.font = "14px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText("↔", b.x + b.w / 2, b.y - 8);
    }
    ctx.restore();

    ctx.save();
    ctx.font = "900 12px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const name = member.name;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(name, b.x + b.w / 2, b.y + b.h / 2);
    ctx.fillStyle = "#FFFDFB";
    ctx.fillText(name, b.x + b.w / 2, b.y + b.h / 2);
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
  }

  for (const pl of activePlayers) {
    if (!pl.ball) continue;
    const b = pl.ball;

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
      ctx.arc(0, -4, 9, 0, Math.PI * 2);
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
      ctx.strokeStyle = "#9DD9E8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#eab308";
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
      ctx.fillStyle = "#FFFDFB";
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
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
}

export function resetBackground() {
  currentBg = null;
}
