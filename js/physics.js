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
  triggerGameEvent,
  triggerVFX,
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
    // ★ 修正 1：將技能觸發改為「每幀自動檢查」
    // 只要冷卻完畢且包包裡元素足夠，就算沒打到新磚塊也會自動扣除並施放！
    if (chemDLCEnabled) {
      const pId = pl === p1 ? 0 : 1;
      checkAndFireEquippedSkills(pl, gameState, cv, pId);
    }

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
          // ★ 改用 HUD 播報
          const pId = targetPl === p1 ? 0 : 1;
          triggerGameEvent("接到對手球! 縮小", false, pId);
        } else if (targetPl === b.owner) {
          if (targetPl.w < 120) {
            targetPl.w = Math.min(120, targetPl.w + 15);
            burst(b.x, targetPl.y, "#5FA8D3");

            // ★ 改用 HUD 顯示回復
            const pId = targetPl === p1 ? 0 : 1;
            triggerGameEvent("🛡️ 回復！", false, pId);
          }
          if (mode === 2 && !chemDLCEnabled) {
            targetPl.energy = Math.min(targetPl.maxEnergy, targetPl.energy + 1);
            if (targetPl.energy >= targetPl.maxEnergy) {
              const foe = targetPl === p1 ? p2 : p1;
              foe.reversed = true;
              foe.reversedTimer = 5;
              targetPl.energy = 0;
              foe.skillWarnFx = 3;

              // ★ 改用 HUD 顯示舊版技能發動
              const pId = targetPl === p1 ? 0 : 1;
              triggerGameEvent("⚡ 技能發動：反轉 5 秒！", false, pId);
              playSfx("brk");
            } else {
              burst(b.x, targetPl.y, targetPl.lightColor);
              const pId = targetPl === p1 ? 0 : 1;
              triggerGameEvent(
                `⚡ 能量 +1 (${targetPl.energy}/10)`,
                false,
                pId,
              );
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
        // ★ 球在貫穿狀態下擊碎磚塊，產生連續微震動
        if (b.isPiercing) triggerVFX(3);
        burst(b.x, b.y);
        if (br.hp <= 0) {
          // ★ 新增：將原子加入庫存，並自動判定裝備技能
          if (br.symbol && chemDLCEnabled) {
            const pId = pl === p2 ? 1 : 0; // ★ 判斷是 1P 還是 2P 打破的
            addAtom(br.symbol, 1, pId);
            updateInventoryUI();
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
            // ★ 改用 HUD 播報
            const pId = pl === p1 ? 0 : 1;
            triggerGameEvent(`COMBO x${comboCount}!`, false, pId);
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
      // ★ 護盾碎裂特效
      if (pl.shield > 0) {
        pl.shield--;
        b.y = cv.height - b.r - 5;
        b.dy *= -1;
        playSfx("bounce");

        // 觸發綠色粒子爆發與螢幕微震動/閃綠光
        burst(b.x, pl.y, "#86EFAC");
        triggerVFX(5, "134, 239, 172", 0.3);

        const pId = pl === p1 ? 0 : 1;
        triggerGameEvent("🛡️ 護盾抵擋!", false, pId);
        continue;
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
        // ★ 改為一般 HUD 播報
        const pId = pl === p1 ? 0 : 1;
        triggerGameEvent("失去一條命!", false, pId);
      } else {
        pl.score = Math.max(0, pl.score - 50);
        b.x = pl.x + pl.w / 2;
        b.y = pl.y - 20;
        b.dx = (Math.random() > 0.5 ? 1 : -1) * 4;
        b.dy = -4;
        comboCount = 0;
        burst(cv.width / 2, cv.height - 20, "#666");
        // ★ 改為扣分廣播
        const pId = pl === p1 ? 0 : 1;
        triggerGameEvent("⚠️ 漏球扣 50 分！", false, pId);
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

export const skillCooldowns = {};

// ==========================================
// ★ 化學配方自動判定與 Action 執行引擎
// ==========================================
export function checkAndFireEquippedSkills(pl, gameState, cv, pId = 0) {
  const now = performance.now();
  const eq = chemStates[pId].equipped;

  for (let i = 0; i < eq.length; i++) {
    const skillId = eq[i];
    if (!skillId) continue;

    const skill = getSkillData(skillId);
    if (!skill) continue;

    const levelMult = chemStates[pId].levels[skillId] || 1;
    const isMulti = mode === 2 || onlineMode;
    const effect = isMulti ? skill.effectMulti : skill.effectSingle;

    // ★ 修正：冷卻時間必須把「等級加成的延長秒數」一併算進去，避免覆蓋
    const baseDuration = effect?.params?.durationSec || 0;
    const actualDuration =
      baseDuration > 0 ? baseDuration + (levelMult - 1) * 1 : 0;
    const cdMs = Math.max(5000, (actualDuration + 2) * 1000);

    if (skillCooldowns[skillId] && now - skillCooldowns[skillId] < cdMs) {
      continue;
    }

    if (tryConsumeRecipe(skill.elements, pId)) {
      updateInventoryUI();
      executeSkillAction(skill, pl, gameState, cv, levelMult);
      skillCooldowns[skillId] = now;
      break;
    }
  }
}

export function executeSkillAction(skill, pl, gameState, cv, levelMult = 1) {
  const isMulti = mode === 2 || onlineMode;
  const effect = isMulti ? skill.effectMulti : skill.effectSingle;
  if (!effect) return;

  const params = effect.params || {};
  const action = effect.action;

  let power = params.power || 1;
  let duration = params.durationSec || 0;

  // ==========================================
  // ★ 關鍵修正：將「技能映射 (Alias Map)」移到最前面！
  // 必須先將 36 種新技能轉為底層代碼，後續的數值放大公式才能成功攔截
  // ==========================================
  let mappedAction = action;

  if (
    [
      "add_piercing",
      "phase_piercing",
      "laser_pierce",
      "heavy_ball",
      "charge_next_hit",
    ].includes(action)
  )
    mappedAction = "enable_pierce";
  if (
    [
      "power_speed_boost",
      "speed_boost",
      "speed_and_randomize",
      "berserk_boost",
      "energy_overcharge",
      "energy_boost",
    ].includes(action)
  )
    mappedAction = "modify_speed";
  if (
    [
      "shockwave",
      "delayed_explosion",
      "area_damage",
      "massive_explosion",
      "charged_explosion",
      "global_damage_over_time",
      "global_corrosion",
    ].includes(action)
  )
    mappedAction = "damage_all";
  if (["temporary_immunity"].includes(action)) mappedAction = "add_shield";
  if (
    [
      "visual_distortion",
      "flash_blind",
      "fake_ball_illusion",
      "fog_blind",
      "storm_disruption",
    ].includes(action)
  )
    mappedAction = "blind_screen";
  if (
    ["unstable_countdown", "radiation_debuff", "unstable_debuff"].includes(
      action,
    )
  )
    mappedAction = "damage_hp";
  if (["chaos_trajectory", "magnetic_pull"].includes(action))
    mappedAction = "reverse_controls";
  if (
    [
      "create_ghost_ball",
      "highlight_targets",
      "magnetic_trajectory",
      "trajectory_guide",
      "increase_brick_damage",
    ].includes(action)
  )
    mappedAction = "multiply_score";
  if (["dispel_brick_effects", "disable_special_bricks"].includes(action))
    mappedAction = "clear_rows";

  // ==========================================
  // ★ 根據不同屬性，套用安全的升級成長公式 (改用 mappedAction 判定)
  // ==========================================
  if (
    ["damage_hp", "damage_all", "heal_hp", "add_shield", "clear_rows"].includes(
      mappedAction,
    )
  ) {
    power = Math.round(power * levelMult);
  } else if (
    ["modify_speed", "modify_width", "multiply_score"].includes(mappedAction)
    && power >= 1
  ) {
    power = 1 + (power - 1) * levelMult;
  } else if (
    ["shrink_width", "slow_speed", "modify_speed"].includes(mappedAction)
    && power < 1
  ) {
    power = Math.max(0.2, 1 - (1 - power) * levelMult);
  }

  // 狀態持續時間 (致盲、反轉、凍結)：每升級 1 次延長 1 秒
  if (duration > 0) {
    duration = duration + (levelMult - 1) * 1;
  }

  pl.timers = pl.timers || {};

  // ==========================================
  // ★ 關鍵修正：讓「所有類型」的技能（包含瞬間攻擊與干擾）都進入 HUD 輪播陣列
  // ==========================================
  pl.activeBuffs = pl.activeBuffs || {};

  // 即使是瞬間爆發技能，也強制讓它在上方 HUD 顯示輪播 3 秒
  const uiDisplayDuration = duration > 0 ? duration : 3;

  // 改用 skill.id 作為獨立 Key，這樣同時發動 3 個技能才不會互相覆蓋！
  pl.activeBuffs[skill.id] = {
    end: performance.now() + uiDisplayDuration * 1000,
    total: uiDisplayDuration * 1000,
    category: skill.category,
    name: skill.name,
  };

  // ==========================================
  // ★ 使用算好的倍率與時間執行底層物理邏輯
  // ==========================================
  switch (mappedAction) {
    case "enable_pierce":
      if (pl.ball) {
        pl.ball.isPiercing = true;
        if (pl.timers.pierce) clearTimeout(pl.timers.pierce);
        pl.timers.pierce = setTimeout(() => {
          if (pl.ball) pl.ball.isPiercing = false;
          pl.timers.pierce = null;
        }, duration * 1000);
      }
      break;

    case "modify_speed":
      if (pl.ball) {
        if (pl.timers.speed) clearTimeout(pl.timers.speed);
        else pl.speedBuffRatio = 1;

        pl.ball.dx /= pl.speedBuffRatio;
        pl.ball.dy /= pl.speedBuffRatio;

        pl.speedBuffRatio = power;
        pl.ball.dx *= pl.speedBuffRatio;
        pl.ball.dy *= pl.speedBuffRatio;

        pl.timers.speed = setTimeout(() => {
          if (pl.ball) {
            pl.ball.dx /= pl.speedBuffRatio;
            pl.ball.dy /= pl.speedBuffRatio;
          }
          pl.speedBuffRatio = 1;
          pl.timers.speed = null;
        }, duration * 1000);
      }
      break;

    case "modify_width":
      if (pl.timers.width) clearTimeout(pl.timers.width);
      else pl.widthBuffOffset = 0;

      pl.w -= pl.widthBuffOffset;
      let targetW = pl.w * power;
      let finalW = Math.min(pl.maxW, targetW);
      pl.widthBuffOffset = finalW - pl.w;
      pl.w += pl.widthBuffOffset;

      pl.timers.width = setTimeout(() => {
        pl.w -= pl.widthBuffOffset;
        pl.widthBuffOffset = 0;
        pl.timers.width = null;
      }, duration * 1000);
      break;

    case "heal_hp":
      const pIdHeal = pl === p1 ? 0 : 1; // 取得發動者 ID
      if (isMulti) {
        pl.shield = (pl.shield || 0) + power;
        triggerGameEvent(`🛡️ 護盾 +${power}`, false, pIdHeal);
      } else {
        pl.lives += power;
        triggerGameEvent(`❤️ 生命 +${power}`, false, pIdHeal);
      }
      break;

    case "add_shield":
      const pIdShield = pl === p1 ? 0 : 1;
      pl.shield = (pl.shield || 0) + power;
      triggerGameEvent(`🛡️ 護盾 +${power}`, false, pIdShield);
      break;

    case "damage_all":
      // ★ 全場爆發：依據威力決定震動強度與閃光顏色
      if (power >= 10)
        triggerVFX(15, "255, 80, 80", 0.6); // 核爆級別 (紅閃光 + 強震)
      else triggerVFX(8, "255, 255, 255", 0.3); // 一般爆發 (白閃光 + 中震)

      gameState.bricks.forEach((b) => {
        b.hp = Math.max(0, b.hp - power);
        burst(
          b.x + b.w / 2,
          b.y + b.h / 2,
          power >= 10 ? "#e57373" : "#9dd9e8",
        );
      });
      break;

    case "clear_rows":
      // ★ 地裂崩塌：清除底排時產生強烈物理震動感
      if (power >= 5)
        triggerVFX(12, "253, 186, 116", 0.4); // 橘色閃光 + 大震動
      else triggerVFX(5); // 只有微震動，不閃光

      const uniqueYs = [...new Set(gameState.bricks.map((b) => b.y))].sort(
        (a, b) => b - a,
      );
      const targetYs = uniqueYs.slice(0, power);
      gameState.bricks.forEach((b) => {
        if (targetYs.includes(b.y)) {
          b.hp = 0;
          burst(b.x + b.w / 2, b.y + b.h / 2, "#F6A6C1");
        }
      });
      break;

    case "multiply_score":
      if (pl.timers.score) clearTimeout(pl.timers.score);
      pl.scoreMultiplier = power;

      pl.timers.score = setTimeout(() => {
        pl.scoreMultiplier = 1;
        pl.timers.score = null;
      }, duration * 1000);
      break;

    case "damage_hp":
    case "shrink_width":
    case "slow_speed":
    case "freeze":
    case "reverse_controls":
    case "blind_screen":
      const attackerId = pl === p1 ? 0 : 1;
      if (onlineMode && socket && socket.connected) {
        socket.emit("attackPlayer", {
          type: mappedAction,
          power: power,
          durationSec: duration,
          attackerName:
            document.getElementById("player-name-input")?.value || "對手",
          attackId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        // ★ 移至 HUD
        triggerGameEvent(`🚀 發射: ${skill.name}`, false, attackerId);
      } else if (mode === 2) {
        const opponent = pl === p1 ? p2 : p1;
        applyLocalDebuff(opponent, mappedAction, power, duration);
        // ★ 移至 HUD
        triggerGameEvent(`🚀 發射: ${skill.name}`, false, attackerId);
      }
      break;
  }
}

// ★ 專給單機雙人模式用的在地受擊邏輯
function applyLocalDebuff(targetPl, type, power, duration) {
  targetPl.timers = targetPl.timers || {};

  if (type === "damage_hp") {
    targetPl.score = Math.max(0, targetPl.score - power * 5);
  } else if (type === "shrink_width") {
    if (targetPl.timers.shrink) clearTimeout(targetPl.timers.shrink);
    else targetPl.shrinkOffset = 0;

    targetPl.w -= targetPl.shrinkOffset;
    let finalW = Math.max(targetPl.minW, targetPl.w * power);
    targetPl.shrinkOffset = finalW - targetPl.w;
    targetPl.w += targetPl.shrinkOffset;
    targetPl.shrinkFx = 1;

    targetPl.timers.shrink = setTimeout(() => {
      targetPl.w -= targetPl.shrinkOffset;
      targetPl.shrinkOffset = 0;
      targetPl.timers.shrink = null;
    }, duration * 1000);
  } else if (type === "slow_speed") {
    if (targetPl.timers.slow) clearTimeout(targetPl.timers.slow);
    targetPl.speed = 9 * power;
    targetPl.timers.slow = setTimeout(() => {
      targetPl.speed = 9;
      targetPl.timers.slow = null;
    }, duration * 1000);
  } else if (type === "freeze") {
    if (targetPl.timers.freeze) clearTimeout(targetPl.timers.freeze);
    targetPl.speed = 0;
    targetPl.timers.freeze = setTimeout(() => {
      targetPl.speed = 9;
      targetPl.timers.freeze = null;
    }, duration * 1000);
  } else if (type === "reverse_controls") {
    targetPl.reversed = true;
    targetPl.reversedTimer = duration; // 原本就是逐幀遞減，不需 clearTimeout
  } else if (type === "blind_screen") {
    const blindEl = document.getElementById("online-blind");
    if (blindEl) {
      blindEl.style.display = "block";
      if (targetPl.timers.blind) clearTimeout(targetPl.timers.blind);

      targetPl.timers.blind = setTimeout(() => {
        blindEl.style.display = "none";
        targetPl.timers.blind = null;
      }, duration * 1000);
    }
  }
}
