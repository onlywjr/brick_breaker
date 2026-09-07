import {
  addAtom,
  updateInventoryUI,
  equippedSkills,
  getSkillData,
  tryConsumeRecipe,
  chemStates,
  skillLevels,
} from "../mod/chemistry.js";
import { playSfx } from "./audio.js";
import {
  MEMBERS,
  level,
  mode,
  onlineMode,
  p1,
  p2,
  drops,
  burst,
  endGame,
  onlineFinishLocalElimination,
  onlineChooseAttack,
  floatTexts,
  chemDLCEnabled,
} from "./game.js";
import { socket } from "./socket.js";

export function lightenColor(color, factor) {
  const num = parseInt(color.slice(1), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

const dropTable = [
  { img: "slow", type: "slow", w: 0.25 },
  { img: "fire", type: "fire", w: 0.3 },
  { img: "grow", type: "grow", w: 0.3 },
  { img: "star", type: "star", w: 0.15 },
];

export function maybeDrop(br, forceType = null, dropsArray) {
  let dropRate = Math.min(0.4, 0.25 + level * 0.02);
  if (forceType || Math.random() < dropRate) {
    let type = forceType,
      img = forceType;
    if (!forceType) {
      let t = Math.random(),
        acc = 0;
      for (const d of dropTable) {
        acc += d.w;
        if (t <= acc) {
          type = d.type;
          img = d.img;
          break;
        }
      }
    }
    dropsArray.push({
      x: br.x + br.w / 2,
      y: br.y + br.h / 2,
      vy: 3,
      img: img,
      type: type,
    });
  }
}

export function applyDrop(
  type,
  pl,
  cvWidth,
  cvHeight,
  bricksArray,
  p1EnergyWrapEl,
) {
  switch (type) {
    case "slow":
      [p1.ball, p2.ball].forEach((b) => {
        if (b) {
          b.dx *= 0.6;
          b.dy *= 0.6;
        }
      });
      setTimeout(
        () =>
          [p1.ball, p2.ball].forEach((b) => {
            if (b) {
              b.dx /= 0.6;
              b.dy /= 0.6;
            }
          }),
        5000,
      );
      break;
    case "fire":
      pl.ball.fire = true;
      setTimeout(() => {
        if (pl.ball) pl.ball.fire = false;
      }, 8000);
      break;
    case "grow":
      pl.w = Math.min(pl.maxW, pl.w + 50);
      break;
    case "star":
      pl.score += 300;
      bricksArray.length = 0;
      burst(cvWidth / 2, cvHeight / 2, "#DDA15E");
      floatTexts.push({
        t: "⭐ STAR POWER +300! 全場清除",
        life: 2,
        x: cvWidth / 2,
        y: cvHeight / 2,
        c: "#DDA15E",
        big: true,
      });
      break;
  }
  playSfx("bounce");
}

export function handleCollisions(dt, cv, gameState, p1EnergyWrapEl) {
  let { bricks, drops, activePlayers, boss, comboCount, comboTimer } =
    gameState;

  // Boss update
  if (boss.active) {
    boss.x += boss.dx * dt;
    if (boss.x < 50 || boss.x + boss.w > cv.width - 50) boss.dx *= -1;
    if (boss.flashTimer > 0) boss.flashTimer -= dt / 60;
    let hpPercent = boss.hp / boss.maxHp;
    if (hpPercent <= 0.33) boss.phase = 3;
    else if (hpPercent <= 0.66) boss.phase = 2;

    boss.attackCooldown -= dt / 60;
    if (boss.attackCooldown <= 0) {
      boss.attackCooldown = boss.phase === 3 ? 1.5 : 2.5;
      let bx = boss.x + boss.w / 2;
      let by = boss.y + boss.h;
      let diffFactor = Math.max(0, Math.floor((boss.level - 10) / 10));
      let bulletSpeed = 3 + diffFactor * 0.5;
      let bulletColor = `hsl(${boss.parts.hueMain}, 90%, 80%)`;

      if (boss.phase === 1) {
        boss.bullets.push({
          x: bx - 30,
          y: by,
          dx: 0,
          dy: bulletSpeed,
          type: "laser",
          c: bulletColor,
        });
        boss.bullets.push({
          x: bx + 30,
          y: by,
          dx: 0,
          dy: bulletSpeed,
          type: "laser",
          c: bulletColor,
        });
        if (diffFactor >= 2)
          boss.bullets.push({
            x: bx,
            y: by,
            dx: 0,
            dy: bulletSpeed,
            type: "laser",
            c: bulletColor,
          });
      } else if (boss.phase === 2) {
        let limit = 1 + Math.floor(diffFactor / 2);
        for (let a = -limit; a <= limit; a += 1) {
          boss.bullets.push({
            x: bx,
            y: by,
            dx: a * (2 + diffFactor * 0.2),
            dy: bulletSpeed * 0.8,
            type: "orb",
            c: bulletColor,
          });
        }
      } else {
        let limit = 2 + Math.floor(diffFactor / 2);
        for (let a = -limit; a <= limit; a += 1) {
          boss.bullets.push({
            x: bx,
            y: by,
            dx: a * (1.5 + diffFactor * 0.2),
            dy: bulletSpeed,
            type: "orb",
            c: "#E0576B",
          });
        }
      }
    }

    for (let i = boss.bullets.length - 1; i >= 0; i--) {
      let b = boss.bullets[i];
      b.x += b.dx * dt;
      b.y += b.dy * dt;
      if (b.y > cv.height) {
        boss.bullets.splice(i, 1);
        continue;
      }

      for (const pl of activePlayers) {
        if (
          b.y + 10 > pl.y
          && b.y < pl.y + pl.h
          && b.x + 10 > pl.x
          && b.x < pl.x + pl.w
        ) {
          boss.bullets.splice(i, 1);
          burst(b.x, b.y, b.c || "#E0576B");
          if (onlineMode && pl === p1) {
            onlineFinishLocalElimination();
            return;
          } else if (mode === 1) {
            pl.lives--;
            floatTexts.push({
              t: "被 BOSS 擊中! 失去一條命!",
              life: 1,
              x: cv.width / 2,
              y: pl.y - 30,
              c: "#E0576B",
            });
            if (pl.lives <= 0) endGame();
          } else {
            pl.score = Math.max(0, pl.score - 100);
            floatTexts.push({
              t: "BOSS 攻擊 -100 分!",
              life: 1.5,
              x: pl.x + pl.w / 2,
              y: pl.y - 30,
              c: "#E0576B",
            });
          }
          break;
        }
      }
    }
  }

  // Player loop
  for (const pl of activePlayers) {
    const b = pl.ball;
    if (!b) continue;
    b.x += b.dx * dt;
    b.y += b.dy * dt;

    if (b.x < b.r || b.x > cv.width - b.r) {
      b.dx *= -1;
      b.x = Math.max(b.r, Math.min(b.x, cv.width - b.r));
      playSfx("bounce");
    }
    if (b.y < b.r) {
      b.dy *= -1;
      playSfx("bounce");
    }

    for (const targetPl of activePlayers) {
      if (
        b.dy > 0
        && b.y + b.r > targetPl.y
        && b.y - b.r < targetPl.y + targetPl.h
        && b.x > targetPl.x
        && b.x < targetPl.x + targetPl.w
      ) {
        const hit = (b.x - (targetPl.x + targetPl.w / 2)) / (targetPl.w / 2);
        const sp = Math.hypot(b.dx, b.dy);
        b.dx = hit * sp * 0.85;
        b.dy = -Math.abs(Math.sqrt(Math.max(sp * sp - b.dx * b.dx, 4)));
        playSfx("bounce");

        if (targetPl !== b.owner && mode === 2) {
          targetPl.w = Math.max(targetPl.minW, targetPl.w - 25);
          targetPl.shrinkFx = 0.6;
          burst(b.x, targetPl.y, "#D96C8E");
          floatTexts.push({
            t: "接到對手球! 縮小",
            life: 1,
            x: b.x,
            y: targetPl.y - 10,
            c: "#D96C8E",
          });
        } else if (targetPl === b.owner) {
          if (targetPl.w < 120) {
            targetPl.w = Math.min(120, targetPl.w + 15);
            burst(b.x, targetPl.y, "#5FA8D3");
            floatTexts.push({
              t: "回復!",
              life: 0.8,
              x: b.x,
              y: targetPl.y - 10,
              c: "#5FA8D3",
            });
          }
          if (mode === 2 && !chemDLCEnabled) {
            targetPl.energy = Math.min(targetPl.maxEnergy, targetPl.energy + 1);
            if (targetPl.energy >= targetPl.maxEnergy) {
              const foe = targetPl === p1 ? p2 : p1;
              foe.reversed = true;
              foe.reversedTimer = 5;
              targetPl.energy = 0;
              foe.skillWarnFx = 3;
              floatTexts.push({
                t: "⚡ BABYMONSTER 技能發動：反轉 5 秒 ⚡",
                life: 3,
                x: cv.width / 2,
                y: cv.height / 2,
                c: targetPl.lightColor,
                big: true,
              });
              playSfx("brk");
            } else {
              burst(b.x, targetPl.y, targetPl.lightColor);
              floatTexts.push({
                t: "能量 +1 (" + targetPl.energy + "/10)",
                life: 0.8,
                x: b.x,
                y: targetPl.y - 20,
                c: targetPl.lightColor,
              });
            }
          }
        }
        break;
      }
    }

    if (boss.active) {
      if (
        b.x > boss.x - b.r
        && b.x < boss.x + boss.w + b.r
        && b.y > boss.y - b.r
        && b.y < boss.y + boss.h + b.r
      ) {
        b.dy *= -1;
        boss.hp -= b.fire ? 20 : 10;
        boss.flashTimer = 0.15;
        burst(b.x, b.y, "#5D576B");
        floatTexts.push({
          t: `-${b.fire ? 20 : 10}`,
          life: 0.8,
          x: b.x,
          y: boss.y - 10,
          c: "#5D576B",
        });
        playSfx("hit");
        if (boss.hp <= 0) {
          boss.active = false;
          pl.score += 500;
          burst(boss.x + boss.w / 2, boss.y + boss.h / 2, "#DDA15E");
          floatTexts.push({
            t: "BOSS DEFEATED! +500",
            life: 2,
            x: cv.width / 2,
            y: boss.y,
            c: "#DDA15E",
            big: true,
          });
          playSfx("brk");
          maybeDrop(
            { x: boss.x + boss.w / 2, y: boss.y + boss.h / 2, w: 0, h: 0 },
            "star",
            drops,
          );
        }
      }
    }

    for (const br of bricks) {
      if (!br.hp) continue;
      if (br.isMoving) {
        br.x += br.dx * dt;
        if (br.x < br.minX || br.x > br.maxX) br.dx *= -1;
      }
      if (
        b.x > br.x - b.r
        && b.x < br.x + br.w + b.r
        && b.y > br.y - b.r
        && b.y < br.y + br.h + b.r
      ) {
        if (!b.fire && !b.isPiercing) b.dy *= -1; // ★ 新增 isPiercing 判斷，穿透狀態不反彈
        br.hp--;
        burst(b.x, b.y);
        if (br.hp <= 0) {
          // ★ 新增：將原子加入庫存，並自動判定裝備技能
          if (br.symbol && chemDLCEnabled) {
            const pId = pl === p2 ? 1 : 0; // ★ 判斷是 1P 還是 2P 打破的
            addAtom(br.symbol, 1, pId);
            updateInventoryUI();
            checkAndFireEquippedSkills(pl, gameState, cv, pId); // ★ 傳遞 pId
          }

          if (!chemDLCEnabled) {
            maybeDrop(br, null, drops); // 只有關閉 DLC 時才掉落一般膠囊
          }
          playSfx("brk");
          comboCount++;
          comboTimer = 2.0;
          let baseScore = 10 * (pl.scoreMultiplier || 1);
          if (comboCount >= 3) {
            let bonus = Math.floor(baseScore * 0.2 * comboCount);
            pl.score += baseScore + bonus;
            floatTexts.push({
              t: `COMBO x${comboCount}! +20%`,
              life: 1,
              x: br.x,
              y: br.y - 15,
              c: "#DDA15E",
            });
          } else {
            pl.score += baseScore;
          }

          if (onlineMode && pl === p1 && !chemDLCEnabled) {
            // ★ 加上 !chemDLCEnabled
            p1.energy = Math.min(p1.maxEnergy, p1.energy + 1);
            if (p1EnergyWrapEl) {
              p1EnergyWrapEl.classList.toggle(
                "online-energy-ready",
                p1.energy >= p1.maxEnergy,
              );
            }
            if (p1.energy >= p1.maxEnergy) {
              onlineChooseAttack();
            }
          }
        } else {
          playSfx("hit");
        }
        break;
      }
    }

    // Remove dead bricks
    for (let i = bricks.length - 1; i >= 0; i--) {
      if (bricks[i].hp <= 0) bricks.splice(i, 1);
    }

    if (b.y > cv.height + b.r) {
      // ★ 新增護盾判定
      if (pl.shield > 0) {
        pl.shield--;
        b.y = cv.height - b.r - 5;
        b.dy *= -1;
        playSfx("bounce");
        floatTexts.push({
          t: "🛡️ 護盾發動!",
          life: 1,
          x: b.x,
          y: b.y - 20,
          c: "#9dd9e8",
        });
        continue; // 護盾救回一命，跳過掉命邏輯
      }
      if (onlineMode || mode === 1) {
        pl.lives--;
        if (pl.lives <= 0) {
          if (onlineMode) onlineFinishLocalElimination();
          else endGame();
          return;
        }
        b.x = pl.x + pl.w / 2;
        b.y = pl.y - 20;
        b.dx = (Math.random() > 0.5 ? 1 : -1) * 4;
        b.dy = -4;
        comboCount = 0;
        burst(cv.width / 2, cv.height - 20, "#666");
        floatTexts.push({
          t: "失去一條命!",
          life: 1,
          x: cv.width / 2,
          y: cv.height - 60,
          c: "#D96C8E",
        });
      } else {
        pl.score = Math.max(0, pl.score - 50);
        b.x = pl.x + pl.w / 2;
        b.y = pl.y - 20;
        b.dx = (Math.random() > 0.5 ? 1 : -1) * 4;
        b.dy = -4;
        comboCount = 0;
        burst(cv.width / 2, cv.height - 20, "#666");
        floatTexts.push({
          t: "掉球扣 50 分!",
          life: 1,
          x: cv.width / 2,
          y: cv.height - 60,
          c: "#D96C8E",
        });
      }
    }
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.vy * dt;
    if (d.y > cv.height) {
      drops.splice(i, 1);
      continue;
    }
    let taken = false;
    for (const pl of activePlayers) {
      if (d.y > pl.y && d.y < pl.y + pl.h && d.x > pl.x && d.x < pl.x + pl.w) {
        applyDrop(d.type, pl, cv.width, cv.height, bricks, p1EnergyWrapEl);
        taken = true;
        break;
      }
    }
    if (taken) drops.splice(i, 1);
  }

  // Update combo variables back to game state
  gameState.comboCount = comboCount;
  gameState.comboTimer = comboTimer;
}

// ★ 新增：用來記錄每個技能最後一次發動的時間戳記 (毫秒)
const skillCooldowns = {};

// ==========================================
// ★ 化學配方自動判定與 Action 執行引擎
// ==========================================
export function checkAndFireEquippedSkills(pl, gameState, cv, pId = 0) {
  const now = performance.now();
  const eq = chemStates[pId].equipped; // ★ 讀取該玩家專屬的裝備槽

  for (let i = 0; i < eq.length; i++) {
    const skillId = eq[i];
    if (!skillId) continue;

    // ★ 取得當前技能等級，準備做為乘數放大效果
    const levelMult = chemStates[pId].levels[skillId] || 1;

    const isMulti = mode === 2 || onlineMode;
    const effect = isMulti ? skill.effectMulti : skill.effectSingle;
    const durationSec = effect?.params?.durationSec || 0;
    const cdMs = Math.max(5000, (durationSec + 2) * 1000);

    if (skillCooldowns[skillId] && now - skillCooldowns[skillId] < cdMs) {
      continue;
    }

    if (tryConsumeRecipe(skill.elements, pId)) {
      // ★ 傳遞 pId 扣除專屬庫存
      updateInventoryUI();
      executeSkillAction(skill, pl, gameState, cv, levelMult);
      skillCooldowns[skillId] = now;
      break;
    }
  }
}

export function executeSkillAction(skill, pl, gameState, cv) {
  // ★ 修正：精準判斷多人模式 (連線模式的 mode 是 1，所以要加上 onlineMode 判斷)
  const isMulti = mode === 2 || onlineMode;
  const effect = isMulti ? skill.effectMulti : skill.effectSingle;
  if (!effect) return;

  const action = effect.action;
  const params = effect.params || {};

  // 畫面中央高亮提示發動的技能
  floatTexts.push({
    t: `✨ ${skill.name} ✨`,
    life: 2,
    x: cv.width / 2,
    y: pl.y - 80,
    c: "#F6D98B",
    big: true,
  });
  playSfx("star"); // 發動音效

  // --- 依照 Action 執行對應效果 ---
  switch (action) {
    // ---------------------------------
    // 單人模式 Buff & 物理效果
    // ---------------------------------
    case "enable_pierce":
      if (pl.ball) {
        pl.ball.isPiercing = true;
        setTimeout(
          () => {
            if (pl.ball) pl.ball.isPiercing = false;
          },
          (params.durationSec || 3) * 1000,
        );
      }
      break;
    case "modify_speed":
      if (pl.ball) {
        pl.ball.dx *= params.power;
        pl.ball.dy *= params.power;
        setTimeout(
          () => {
            if (pl.ball) {
              pl.ball.dx /= params.power;
              pl.ball.dy /= params.power;
            }
          },
          (params.durationSec || 3) * 1000,
        );
      }
      break;
    case "modify_width":
      const oldW = pl.w;
      pl.w = Math.min(pl.maxW, pl.w * params.power);
      setTimeout(
        () => {
          pl.w = oldW;
        },
        (params.durationSec || 4) * 1000,
      );
      break;
    case "heal_hp":
      if (isMulti) {
        pl.shield = (pl.shield || 0) + params.power; // 多人模式的補血轉為護盾
        floatTexts.push({
          t: `🛡️ 護盾 +${params.power}`,
          life: 1,
          x: pl.x + pl.w / 2,
          y: pl.y - 20,
          c: "#9dd9e8",
        });
      } else {
        pl.lives += params.power;
        floatTexts.push({
          t: `❤️ 生命 +${params.power}`,
          life: 1,
          x: pl.x + pl.w / 2,
          y: pl.y - 20,
          c: "#f6a6c1",
        });
      }
      break;
    case "add_shield":
      pl.shield = (pl.shield || 0) + params.power;
      floatTexts.push({
        t: `🛡️ 護盾 +${params.power}`,
        life: 1,
        x: pl.x + pl.w / 2,
        y: pl.y - 20,
        c: "#9dd9e8",
      });
      break;
    case "damage_all":
      gameState.bricks.forEach((b) => {
        b.hp = Math.max(0, b.hp - params.power);
        burst(b.x + b.w / 2, b.y + b.h / 2, "#9dd9e8");
      });
      break;
    case "clear_rows":
      const uniqueYs = [...new Set(gameState.bricks.map((b) => b.y))].sort(
        (a, b) => b - a,
      );
      const targetYs = uniqueYs.slice(0, params.power);
      gameState.bricks.forEach((b) => {
        if (targetYs.includes(b.y)) {
          b.hp = 0;
          burst(b.x + b.w / 2, b.y + b.h / 2, "#F6A6C1");
        }
      });
      break;
    case "multiply_score":
      pl.scoreMultiplier = params.power;
      setTimeout(
        () => {
          pl.scoreMultiplier = 1;
        },
        (params.durationSec || 5) * 1000,
      );
      break;

    // ---------------------------------
    // 多人模式 攻擊/干擾效果
    // ---------------------------------
    case "damage_hp":
    case "shrink_width":
    case "slow_speed":
    case "freeze":
    case "reverse_controls":
    case "blind_screen":
      if (onlineMode && socket && socket.connected) {
        // 1. 真實連線對戰：透過 Socket 發射給對手
        socket.emit("attackPlayer", {
          type: action,
          power: params.power || 1,
          durationSec: params.durationSec || 3,
          attackerName:
            document.getElementById("player-name-input")?.value || "對手",
          attackId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        floatTexts.push({
          t: `🚀 發射干擾: ${skill.name}`,
          life: 2,
          x: pl.x + pl.w / 2,
          y: pl.y - 40,
          c: "#E0576B",
        });
      } else if (mode === 2) {
        // 2. 單機雙人對戰：直接抓出畫面上另一個玩家，套用負面效果
        const opponent = pl === p1 ? p2 : p1;
        applyLocalDebuff(
          opponent,
          action,
          params.power || 1,
          params.durationSec || 3,
        );
        floatTexts.push({
          t: `🚀 發射干擾: ${skill.name}`,
          life: 2,
          x: pl.x + pl.w / 2,
          y: pl.y - 40,
          c: "#E0576B",
        });
      }
      break;
  }
}

// ★ 專給單機雙人模式用的在地受擊邏輯
function applyLocalDebuff(targetPl, type, power, duration) {
  if (type === "damage_hp") {
    targetPl.score = Math.max(0, targetPl.score - power * 5);
  } else if (type === "shrink_width") {
    targetPl.w = Math.max(targetPl.minW, targetPl.w * power);
    targetPl.shrinkFx = 1;
    setTimeout(() => {
      targetPl.w = 120;
    }, duration * 1000);
  } else if (type === "slow_speed") {
    targetPl.speed = 9 * power;
    setTimeout(() => {
      targetPl.speed = 9;
    }, duration * 1000);
  } else if (type === "freeze") {
    targetPl.speed = 0;
    setTimeout(() => {
      targetPl.speed = 9;
    }, duration * 1000);
  } else if (type === "reverse_controls") {
    targetPl.reversed = true;
    targetPl.reversedTimer = duration;
  } else if (type === "blind_screen") {
    const blindEl = document.getElementById("online-blind");
    if (blindEl) {
      blindEl.style.display = "block";
      setTimeout(() => {
        blindEl.style.display = "none";
      }, duration * 1000);
    }
  }
}
