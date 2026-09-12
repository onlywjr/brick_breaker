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
  isLevelClearing, // ★ 補上匯入
  levelStartTime, // ★ 補上匯入
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
      pl.timers = pl.timers || {};
      if (pl.timers.slowDrop) clearTimeout(pl.timers.slowDrop);

      if (pl.ball) {
        pl.ball.dx *= 0.6;
        pl.ball.dy *= 0.6;
      }

      pl.timers.slowDrop = setTimeout(() => {
        if (pl.ball) {
          pl.ball.dx /= 0.6;
          pl.ball.dy /= 0.6;
        }
        pl.timers.slowDrop = null;
      }, 5000);
      break;

    case "fire":
      pl.timers = pl.timers || {};
      if (pl.timers.fireDrop) clearTimeout(pl.timers.fireDrop);

      pl.ball.fire = true;

      // ★ 將火球狀態計時器註冊到 pl.timers 中
      pl.timers.fireDrop = setTimeout(() => {
        if (pl.ball) pl.ball.fire = false;
        pl.timers.fireDrop = null;
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
  let {
    bricks,
    drops,
    activePlayers,
    boss,
    comboCount,
    comboTimer,
    ghostBalls,
  } = gameState;
  const now = performance.now();

  // ★ 1. 全域 DOT 毒霧扣血
  if (globalDotState.active) {
    if (now > globalDotState.end) {
      globalDotState.active = false;
    } else if (now - globalDotState.lastTick > 1000) {
      globalDotState.lastTick = now;
      bricks.forEach((b) => {
        if (b.hp > 0) {
          b.hp = Math.max(0, b.hp - globalDotState.power);
          burst(b.x + b.w / 2, b.y + b.h / 2, "#9C27B0");
          // ★ 毒死磚塊照樣給予元素與分數
          if (b.hp <= 0) {
            b.killedBySkill = true; // ★ 新增：標記為技能擊殺
            if (b.symbol && chemDLCEnabled) {
              addAtom(b.symbol, 1, 0); // 毒霧擊殺統一給 1P
              updateInventoryUI();
            } else if (!chemDLCEnabled) {
              maybeDrop(b, null, drops);
            }
            p1.score += 10 * (p1.scoreMultiplier || 1);
          }
        }
      });
    }
  }

  // ★ 偵測是否有虛空結界生效
  let hasVoid = activePlayers.some(
    (pl) =>
      pl.activeBuffs
      && Object.values(pl.activeBuffs).some(
        (buff) =>
          buff.end > now
          && ["dispel_brick_effects", "disable_special_bricks"].includes(
            buff.action,
          ),
      ),
  );

  // 獨立更新磚塊移動 (移出玩家迴圈，避免雙人模式雙倍速)
  for (const br of bricks) {
    if (!br.hp) continue;
    // ★ 結界生效時，強制剝奪方塊的移動能力
    if (br.isMoving && !hasVoid) {
      br.x += br.dx * dt;
      if (br.x < br.minX || br.x > br.maxX) {
        br.dx *= -1;
        br.x = Math.max(br.minX, Math.min(br.x, br.maxX));
      }
    }
  }

  // ★ 3. 幽靈球單次碰撞與反彈
  if (ghostBalls) {
    for (let i = ghostBalls.length - 1; i >= 0; i--) {
      let gb = ghostBalls[i];
      gb.x += gb.dx * dt;
      gb.y += gb.dy * dt;
      gb.life -= dt / 60;

      // ★ 修正 2：時間到才死亡。把掉出畫面的判定改為「撞擊地板反彈」
      if (gb.life <= 0) {
        ghostBalls.splice(i, 1);
        continue;
      }

      // 左右牆壁反彈
      if (gb.x < gb.r || gb.x > cv.width - gb.r) {
        gb.dx *= -1;
        gb.x = Math.max(gb.r, Math.min(gb.x, cv.width - gb.r));
      }
      // 天花板反彈
      if (gb.y < gb.r) {
        gb.dy *= -1;
        gb.y = gb.r;
      }
      // ★ 新增：地板反彈 (讓幽靈球在場上盡情破壞，直到壽命結束)
      if (gb.y > cv.height - gb.r) {
        gb.dy *= -1;
        gb.y = cv.height - gb.r;
      }

      // ★ 修正 1：讓幽靈球可以被擋板接住反彈，否則它們掉出畫面就永遠消失了！
      for (const targetPl of activePlayers) {
        if (
          gb.dy > 0
          && gb.y + gb.r > targetPl.y
          && gb.y - gb.r < targetPl.y + targetPl.h
          && gb.x > targetPl.x
          && gb.x < targetPl.x + targetPl.w
        ) {
          gb.dy *= -1;
          gb.y = targetPl.y - gb.r;
          playSfx("bounce"); // 加上接球音效
        }
      }

      for (const br of bricks) {
        if (br.hp <= 0 || gb.hitBricks.has(br)) continue;
        if (
          gb.x > br.x - gb.r
          && gb.x < br.x + br.w + gb.r
          && gb.y > br.y - gb.r
          && gb.y < br.y + br.h + gb.r
        ) {
          br.hp--;
          gb.hitBricks.add(br); // 記憶已撞擊，避免卡進去瘋狂扣血
          burst(gb.x, gb.y, "rgba(200,200,200,0.5)");
          // ★ 補上幽靈球擊殺收益
          if (br.hp <= 0) {
            br.killedBySkill = true;
            if (br.symbol && chemDLCEnabled)
              addAtom(br.symbol, 1, gb.owner === p2 ? 1 : 0);
            gb.owner.score += 10 * (gb.owner.scoreMultiplier || 1);
          }
        }
      }
    }
  }

  activePlayers.forEach((pl) => {
    if (pl.invincibleTimer > 0) pl.invincibleTimer -= dt / 60;
  });

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
    // ★ 新增：遞減專屬干擾計時器
    if (pl.chaosTimer > 0) pl.chaosTimer -= dt / 60;
    if (pl.magneticDebuffTimer > 0) pl.magneticDebuffTimer -= dt / 60;

    if (chemDLCEnabled) {
      const pId = pl === p1 ? 0 : 1;
      checkAndFireEquippedSkills(pl, gameState, cv, pId);
    }

    const b = pl.ball;
    if (!b) continue;

    // ★ 修正 4：實裝高能雷射實際物理熔毀判定
    if (pl.activeBuffs) {
      for (const key in pl.activeBuffs) {
        const buff = pl.activeBuffs[key];
        // 偵測雷射狀態是否生效
        if (buff.end > now && buff.action === "laser_pierce") {
          const laserW = b.r * 2.5; // 雷射判定寬度與視覺一致
          bricks.forEach((br) => {
            // 只要磚塊與雷射光柱 (X軸) 重疊，就每幀持續熔毀
            if (
              br.hp > 0
              && b.x + laserW > br.x
              && b.x - laserW < br.x + br.w
            ) {
              br.laserDamagePool =
                (br.laserDamagePool || 0) + buff.power * dt * 0.15;
              if (br.laserDamagePool >= 1) {
                const dmg = Math.floor(br.laserDamagePool);
                br.hp = Math.max(0, br.hp - dmg);
                br.laserDamagePool %= 1;
                burst(br.x + br.w / 2, br.y + br.h / 2, "#F6A6C1"); // 觸發雷射火花

                // 擊破結算
                if (br.hp <= 0) {
                  br.killedBySkill = true;
                  if (br.symbol && chemDLCEnabled)
                    addAtom(br.symbol, 1, pl === p1 ? 0 : 1);
                  pl.score += 10 * (pl.scoreMultiplier || 1);
                }
              }
            }
          });
        }
      }
    }

    // ★ 1. 計算混亂與被動磁力干擾 (改變 dx, dy)
    if (pl.chaosTimer > 0) {
      b.dx += (Math.random() - 0.5) * 2 * dt;
      b.dy += (Math.random() - 0.5) * 2 * dt;
    }
    if (pl.magneticDebuffTimer > 0) {
      b.dx += (b.x > cv.width / 2 ? 0.6 : -0.6) * dt;
    }

    // ★2. 補上 magnetic_trajectory 磁力牽引判定
    let hasMagnetic = Object.values(pl.activeBuffs || {}).some(
      (buff) =>
        buff.end > now
        && (buff.action === "trajectory_guide"
          || buff.action === "magnetic_trajectory"),
    );
    if (hasMagnetic && bricks.length > 0) {
      let nearest = null;
      let minDist = Infinity;
      bricks.forEach((br) => {
        if (br.y < b.y) {
          let d = Math.hypot(br.x - b.x, br.y - b.y);
          if (d < minDist) {
            minDist = d;
            nearest = br;
          }
        }
      });
      if (nearest && b.dy < 0) {
        b.dx += (nearest.x + nearest.w / 2 - b.x) * 0.005 * dt;
      }
    }

    // ★ 3. 統一更新最終位置 (整個迴圈只在這裡寫這兩行)
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
        const overlapX = Math.abs(boss.x + boss.w / 2 - b.x) / boss.w;
        const overlapY = Math.abs(boss.y + boss.h / 2 - b.y) / boss.h;
        if (overlapX > overlapY) b.dx *= -1;
        else b.dy *= -1;

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

      if (
        b.x > br.x - b.r
        && b.x < br.x + br.w + b.r
        && b.y > br.y - b.r
        && b.y < br.y + br.h + b.r
      ) {
        if (!b.fire && !b.isPiercing && !b.isHeavy) {
          const overlapX = Math.abs(br.x + br.w / 2 - b.x) / br.w;
          const overlapY = Math.abs(br.y + br.h / 2 - b.y) / br.h;
          if (overlapX > overlapY) b.dx *= -1;
          else b.dy *= -1;
        }

        // ★ 重擊爆炸附加經濟系統
        if (b.isHeavy) {
          triggerVFX(5);
          const explosionRadius = 60 * (b.heavyPower || 1);
          bricks.forEach((otherBr) => {
            if (
              otherBr !== br
              && otherBr.hp > 0
              && Math.hypot(
                otherBr.x + otherBr.w / 2 - b.x,
                otherBr.y + otherBr.h / 2 - b.y,
              ) < explosionRadius
            ) {
              otherBr.hp -= 2;
              burst(
                otherBr.x + otherBr.w / 2,
                otherBr.y + otherBr.h / 2,
                "#5D576B",
              );
              // 補發範圍傷害造成的掉落物
              if (otherBr.hp <= 0) {
                otherBr.killedBySkill = true; // ★ 新增：標記為技能擊殺
                if (otherBr.symbol && chemDLCEnabled) {
                  addAtom(otherBr.symbol, 1, pl === p2 ? 1 : 0);
                  updateInventoryUI();
                } else if (!chemDLCEnabled) {
                  maybeDrop(otherBr, null, drops);
                }
                pl.score += 10 * (pl.scoreMultiplier || 1);
              }
            }
          });
        } else {
          // ★ 實裝真實物理增傷與撞擊震波 (shockwave / area_damage)
          let hitDmg = 1;
          let isShockwave = false;
          let shockPower = 0;

          if (pl.activeBuffs) {
            for (const key in pl.activeBuffs) {
              const buff = pl.activeBuffs[key];
              if (buff.end > now) {
                // ★ 將能量過載與強力加速一併納入物理增傷
                if (
                  [
                    "increase_brick_damage",
                    "energy_overcharge",
                    "power_speed_boost",
                  ].includes(buff.action)
                )
                  hitDmg = buff.power;
                if (["shockwave", "area_damage"].includes(buff.action)) {
                  isShockwave = true;
                  shockPower = buff.power;
                }
              }
            }
          }

          br.hp -= hitDmg;

          if (isShockwave) {
            triggerVFX(4);
            const swRadius = 70;
            bricks.forEach((otherBr) => {
              if (
                otherBr !== br
                && otherBr.hp > 0
                && Math.hypot(otherBr.x - br.x, otherBr.y - br.y) < swRadius
              ) {
                otherBr.hp -= shockPower;
                burst(
                  otherBr.x + otherBr.w / 2,
                  otherBr.y + otherBr.h / 2,
                  "#9DD9E8",
                );
                if (otherBr.hp <= 0) {
                  otherBr.killedBySkill = true;
                  if (otherBr.symbol && chemDLCEnabled)
                    addAtom(otherBr.symbol, 1, pl === p2 ? 1 : 0);
                  pl.score += 10 * (pl.scoreMultiplier || 1);
                }
              }
            });
          }
        }

        // ★ 球在貫穿狀態下擊碎磚塊，產生連續微震動
        if (b.isPiercing) triggerVFX(3);
        burst(b.x, b.y);
        if (br.hp <= 0) {
          // ★ 新增：將原子加入庫存，或收集數學符號
          const targetPlayer = pl === p2 ? p2 : p1; // 確認是 1P 或 2P 打破的

          if (br.symbol) {
            if (chemDLCEnabled) {
              addAtom(br.symbol, 1, targetPlayer === p1 ? 0 : 1);
              updateInventoryUI();
            } else {
              // ★ 數學極限模式：將打破的符號收集到專屬題庫中
              targetPlayer.mathInventory.push(br.symbol);
            }
          }

          if (!chemDLCEnabled) {
            maybeDrop(br, null, drops); // 只有關閉 DLC 時才掉落一般膠囊
          }
          playSfx("brk");
          comboCount++;
          comboTimer = 2.0;
          let baseScore = 10 * (pl.scoreMultiplier || 1);

          // ★ 新增：當積分倍率生效時，打碎每一塊磚都觸發大字體的金色爆分飄字！
          if (pl.scoreMultiplier && pl.scoreMultiplier > 1) {
            floatTexts.push({
              t: `+${baseScore}`,
              life: 0.8,
              x: br.x + br.w / 2,
              y: br.y,
              c: "#FBBF24", // 耀眼金
              big: true,
            });
          }

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

  // ==========================================
  // ★ 技能擊破的排程掉落特效 (Row-by-Row Falling)
  // ==========================================
  let recentlyKilled = bricks.filter(
    (b) => b.hp <= 0 && b.killedBySkill && !b.isFalling,
  );
  if (recentlyKilled.length > 0) {
    // 取出所有被幹掉磚塊的 Y 座標，由大到小排序 (從最下排開始崩塌)
    let uniqueYs = [...new Set(recentlyKilled.map((b) => b.y))].sort(
      (a, b) => b - a,
    );
    recentlyKilled.forEach((b) => {
      b.isFalling = true;
      b.isMoving = false; // 停止水平移動

      let rowIndex = uniqueYs.indexOf(b.y);

      // ★ 在原本的「排數延遲」之上，額外疊加 0 ~ 0.2 秒的隨機時間差
      // 這樣同一排的方塊就會有先有後地零碎崩落
      b.fallDelay = rowIndex * 0.3 + Math.random() * 0.2;

      // (可選) 讓每個方塊往上彈的初速也帶點隨機性，重量感會更真實
      b.vy = -2 - Math.random() * 2;
    });
  }

  // ★ 統一在影格最後清理與更新掉落中的磚塊
  for (let i = bricks.length - 1; i >= 0; i--) {
    let b = bricks[i];
    if (b.hp <= 0) {
      if (b.isFalling) {
        if (b.fallDelay > 0) {
          b.fallDelay -= dt / 60; // 等待排程
        } else {
          b.vy += 0.8 * dt; // 重力加速度
          b.y += b.vy * dt;
        }
        // 只有徹底掉出畫面底部，才真正從陣列中移除
        if (b.y > cv.height) {
          bricks.splice(i, 1);
        }
      } else {
        // 非技能擊破 (被球直接打爆的)，維持瞬間爆散移除
        bricks.splice(i, 1);
      }
    }
  }

  // Update combo variables back to game state
  gameState.comboCount = comboCount;
  gameState.comboTimer = comboTimer;

  // ==========================================
  // ★ UI 特效：技能發動期間的動態光暈外框
  // ==========================================
  let activeGlowColor = null;
  const nowTime = performance.now();

  // 檢查 1P 身上是否有還在持續時間內的技能
  if (p1 && p1.activeBuffs) {
    for (const key in p1.activeBuffs) {
      if (p1.activeBuffs[key].end > nowTime) {
        const cat = p1.activeBuffs[key].category;
        // 根據技能分類賦予不同的光暈顏色 (使用 RGBA 以利發光疊加)
        if (cat === "攻擊")
          activeGlowColor = "rgba(229, 115, 115, 0.85)"; // 熱血紅
        else if (cat === "防禦")
          activeGlowColor = "rgba(157, 217, 232, 0.85)"; // 護盾藍
        else if (cat === "輔助")
          activeGlowColor = "rgba(246, 166, 193, 0.85)"; // 治癒粉
        else if (cat === "控制")
          activeGlowColor = "rgba(134, 239, 172, 0.85)"; // 劇毒/牽制綠
        else if (cat === "特殊")
          activeGlowColor = "rgba(246, 217, 139, 0.85)"; // 傳說黃
        else if (cat === "實驗") activeGlowColor = "rgba(201, 177, 232, 0.85)"; // 不穩定紫
        break; // 抓到一個生效中的技能就顯示該顏色
      }
    }
  }

  // 透過 CSS 變數即時渲染到 #wrap 外框
  const wrapEl = document.getElementById("wrap");
  if (wrapEl) {
    if (activeGlowColor) {
      wrapEl.style.setProperty("--glow-color", activeGlowColor);
      if (!wrapEl.classList.contains("skill-active-glow")) {
        wrapEl.classList.add("skill-active-glow");
      }
    } else {
      if (wrapEl.classList.contains("skill-active-glow")) {
        wrapEl.classList.remove("skill-active-glow");
        wrapEl.style.removeProperty("--glow-color");
      }
    }
  }
}

export const skillCooldowns = {};
export let globalDotState = { active: false, power: 0, end: 0, lastTick: 0 };

// ==========================================
// ★ 化學配方自動判定與 Action 執行引擎
// ==========================================
export function checkAndFireEquippedSkills(pl, gameState, cv, pId = 0) {
  const now = performance.now();

  // ★ 修正 1：防止「假延續」錯覺！結算過關期間，與剛開局的 1.5 秒內，嚴禁自動施法
  if (isLevelClearing || now - levelStartTime < 1500) return;

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

    // ★ 修正 3：加入 pId 作為複合 Key，避免 1P/2P 技能互相干擾
    const cdKey = `${pId}_${skillId}`;

    // ★ 修正：統一使用 cdKey 判斷與寫入
    if (skillCooldowns[cdKey] && now - skillCooldowns[cdKey] < cdMs) {
      continue;
    }

    if (tryConsumeRecipe(skill.elements, pId)) {
      updateInventoryUI();
      executeSkillAction(skill, pl, gameState, cv, levelMult);
      skillCooldowns[cdKey] = now;
      break;
    }
  }
}

// ★ 修正 4：建立專屬的 Cooldown 重置函式
export function resetSkillCooldowns() {
  for (let key in skillCooldowns) {
    delete skillCooldowns[key];
  }
}

// ★ 新增：重置全域 DOT 狀態的函式
export function resetGlobalDotState() {
  globalDotState = { active: false, power: 0, end: 0, lastTick: 0 };
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
  // Apply Scaling based on the EXACT action
  // ==========================================
  if (
    [
      "damage_hp",
      "damage_all",
      "heal_hp",
      "add_shield",
      "clear_rows",
      "massive_explosion",
      "charged_explosion",
      "global_damage_over_time",
      "increase_brick_damage",
      "global_corrosion",
      "heavy_ball", // ★ 新增：重球倍率縮放
      "delayed_explosion", // ★ 新增：延遲爆炸傷害縮放
    ].includes(action)
  ) {
    power = Math.round(power * levelMult);
  } else if (
    [
      "modify_speed",
      "modify_width",
      "multiply_score",
      "power_speed_boost",
      "speed_boost",
      "speed_and_randomize",
      "berserk_boost",
      "energy_overcharge",
      "energy_boost",
    ].includes(action)
    && power >= 1
  ) {
    power = 1 + (power - 1) * levelMult;
  } else if (
    ["shrink_width", "slow_speed", "modify_speed"].includes(action)
    && power < 1
  ) {
    power = Math.max(0.2, 1 - (1 - power) * levelMult);
  } else if (["create_ghost_ball"].includes(action)) {
    // Ghost balls count scales with level
    power = Math.round(power + (levelMult - 1));
  }

  if (duration > 0) {
    duration = duration + (levelMult - 1) * 1;
  }

  pl.timers = pl.timers || {};
  pl.activeBuffs = pl.activeBuffs || {};

  const uiDisplayDuration = duration > 0 ? duration : 3;

  pl.activeBuffs[skill.id] = {
    end: performance.now() + uiDisplayDuration * 1000,
    total: uiDisplayDuration * 1000,
    category: skill.category,
    name: skill.name,
    action: action, // Store action for renderer to use
    power: power, // Store power for continuous effects
  };

  // ==========================================
  // Execute Core Physics Actions
  // ==========================================
  switch (action) {
    // --- Standard Actions ---
    case "enable_pierce":
    case "add_piercing":
    case "phase_piercing":
    case "laser_pierce":
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
    case "power_speed_boost":
    case "speed_boost":
    case "speed_and_randomize":
    case "berserk_boost":
    case "energy_overcharge":
    case "energy_boost":
      if (pl.ball) {
        if (pl.timers.speed) clearTimeout(pl.timers.speed);
        else pl.speedBuffRatio = 1;

        pl.ball.dx /= pl.speedBuffRatio;
        pl.ball.dy /= pl.speedBuffRatio;

        pl.speedBuffRatio = power;
        pl.ball.dx *= pl.speedBuffRatio;
        pl.ball.dy *= pl.speedBuffRatio;

        // Add some randomization for specific skills
        if (action === "speed_and_randomize" || action === "chaos_trajectory") {
          pl.ball.dx += (Math.random() - 0.5) * 2;
        }

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
      const pIdHeal = pl === p1 ? 0 : 1;
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
      if (power >= 10) triggerVFX(15, "255, 80, 80", 0.6);
      else triggerVFX(8, "255, 255, 255", 0.3);

      gameState.bricks.forEach((b) => {
        if (b.hp > 0) {
          b.hp = Math.max(0, b.hp - power);
          if (b.hp <= 0) b.killedBySkill = true;
          burst(
            b.x + b.w / 2,
            b.y + b.h / 2,
            power >= 10 ? "#e57373" : "#9dd9e8",
          );
        }
      });
      break;

    case "massive_explosion":
      // ★ 修正 1：強制指定為 255, 100, 100 觸發紅色閃光，確保 renderer 畫出核爆衝擊波
      triggerVFX(15, "255, 100, 100", 0.6);
      gameState.bricks.forEach((b) => {
        if (b.hp > 0) {
          b.hp = Math.max(0, b.hp - power);
          if (b.hp <= 0) b.killedBySkill = true;
          burst(b.x + b.w / 2, b.y + b.h / 2, "#e57373");
        }
      });
      break;

    case "clear_rows":
      if (power >= 5) triggerVFX(12, "253, 186, 116", 0.4);
      else triggerVFX(5);

      const uniqueYs = [...new Set(gameState.bricks.map((b) => b.y))].sort(
        (a, b) => b - a,
      );
      const targetYs = uniqueYs.slice(0, power);
      gameState.bricks.forEach((b) => {
        if (targetYs.includes(b.y) && b.hp > 0) {
          b.hp = 0;
          b.killedBySkill = true;
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

    case "dispel_brick_effects":
    case "disable_special_bricks":
    case "shockwave":
    case "area_damage":
    case "highlight_targets":
    case "increase_brick_damage":
    case "magnetic_trajectory":
      // ★ 修正 2：將依賴 buff 的獨立技能與清除機制解綁
      triggerVFX(5, "168, 85, 247", 0.3); // 閃紫光代表狀態附加成功
      break;

    // --- New Heavy Element Actions ---
    case "heavy_ball":
      if (pl.ball) {
        pl.ball.isHeavy = true;
        pl.ball.heavyPower = power;
        if (pl.timers.heavy) clearTimeout(pl.timers.heavy);
        pl.timers.heavy = setTimeout(() => {
          if (pl.ball) pl.ball.isHeavy = false;
          pl.timers.heavy = null;
        }, duration * 1000);
      }
      break;

    case "create_ghost_ball":
      let ghostCount = Math.max(3, Math.round(Number(power) || 3));

      // ★ 修正 2：計算完美的扇形擴散角度 (避免貼齊 180 度平飛)
      let angleStep = Math.PI / (ghostCount + 1);

      for (let i = 0; i < ghostCount; i++) {
        let angle = Math.PI + angleStep * (i + 1); // 均勻分佈在 180~360度之間 (往上發射)
        let spd = 5 + Math.random() * 3; // 提升速度差異，確保軌跡錯開

        gameState.ghostBalls.push({
          x: pl.ball.x, // 直接從母球中心散開
          y: pl.ball.y - 10,
          r: 8,
          dx: Math.cos(angle) * spd,
          dy: Math.sin(angle) * spd,
          life: duration,
          owner: pl,
          hitBricks: new Set(),
        });
      }
      triggerGameEvent(
        `👻 產生 ${ghostCount} 顆幽靈球！`,
        false,
        pl === p1 ? 0 : 1,
      );
      break;

    case "temporary_immunity":
      pl.invincibleTimer = duration;
      triggerGameEvent(
        `🛡️ 絕對免疫 ${duration} 秒！`,
        false,
        pl === p1 ? 0 : 1,
      );
      break;

    // Debuffs directed at opponent
    case "damage_hp":
    case "shrink_width":
    case "slow_speed":
    case "freeze":
    case "reverse_controls":
    case "blind_screen":
    case "unstable_countdown":
    case "radiation_debuff":
    case "unstable_debuff":
    case "chaos_trajectory":
    case "magnetic_pull":
    case "fake_ball_illusion":
    case "storm_disruption":
    case "visual_distortion":
    case "fog_blind":
      const attackerId = pl === p1 ? 0 : 1;
      if (onlineMode && socket && socket.connected) {
        socket.emit("attackPlayer", {
          type: action, // Send the specific action
          power: power,
          durationSec: duration,
          attackerName:
            document.getElementById("player-name-input")?.value || "對手",
          attackId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        triggerGameEvent(`🚀 發射: ${skill.name}`, false, attackerId);
      } else if (mode === 2) {
        const opponent = pl === p1 ? p2 : p1;
        applyLocalDebuff(opponent, action, power, duration);
        triggerGameEvent(`🚀 發射: ${skill.name}`, false, attackerId);
      }
      break;

    case "global_damage_over_time":
    case "global_corrosion":
      globalDotState = {
        power: power,
        end: performance.now() + duration * 1000,
        active: true,
        lastTick: performance.now(), // 初始化計時
      };
      break;

    case "delayed_explosion":
    case "charged_explosion":
      // ★ 將延遲爆炸註冊到 pl.timers 裡，確保換關/死亡時能被精準清除
      if (pl.timers.delayed) clearTimeout(pl.timers.delayed);
      pl.timers.delayed = setTimeout(() => {
        triggerVFX(10, "255, 100, 100", 0.4);
        gameState.bricks.forEach((b) => {
          if (b.hp > 0) {
            // ★ 避免鞭屍
            b.hp = Math.max(0, b.hp - power);
            if (b.hp <= 0) b.killedBySkill = true; // ★ 標記
            burst(b.x + b.w / 2, b.y + b.h / 2, "#e57373");
          }
        });
        pl.timers.delayed = null;
      }, duration * 1000);
      break;
  }
}

// ★ 專給單機雙人模式用的在地受擊邏輯
export function applyLocalDebuff(targetPl, type, power, duration) {
  targetPl.timers = targetPl.timers || {};

  // Check Immunity
  if (targetPl.invincibleTimer > 0) {
    triggerGameEvent("🛡️ 免疫攻擊！", false, targetPl === p1 ? 0 : 1);
    return;
  }

  if (
    [
      "damage_hp",
      "radiation_debuff",
      "unstable_debuff",
      "unstable_countdown",
    ].includes(type)
  ) {
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
    targetPl.reversedTimer = duration;
  } else if (type === "chaos_trajectory") {
    targetPl.chaosTimer = duration;
  } else if (type === "magnetic_pull") {
    targetPl.magneticDebuffTimer = duration;
  } else if (
    [
      "blind_screen",
      "visual_distortion",
      "fog_blind",
      "fake_ball_illusion",
      "storm_disruption",
    ].includes(type)
  ) {
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
