import { escapeHtml } from "./ui.js";
import { socket } from "./socket.js";
import { p1, myPlayerId, onlinePlayers, onlineEliminated } from "./game.js";

export function renderLobbyPlayers(
  players,
  playerListEl,
  roomStatusEl,
  lobbyState,
) {
  if (!playerListEl) return;
  const list = Array.isArray(players) ? players : Object.values(players || {});

  if (!list.length) {
    playerListEl.innerHTML =
      '<div style="grid-column: 1 / -1; text-align:center; color:#7A728A; padding: 20px;">等待玩家加入…</div>';
    return;
  }

  playerListEl.innerHTML = list
    .map((p, index) => {
      const me = p.id === socket.id;
      const host = p.host ? "👑" : "";
      const name = escapeHtml(p.name || `玩家 ${index + 1}`);
      const statusColor = p.ready ? "#2EB886" : "#A39EAD";
      const statusIcon = p.ready ? "✔" : "⋯";

      return `
      <div class="lobby-player-item" style="border-color: ${me ? "#DDA15E" : "rgba(201, 177, 232, 0.5)"}; box-shadow: ${me ? "0 0 10px rgba(221, 161, 94, 0.4)" : "none"};">
        <span style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;">
          ${host} ${name}
        </span>
        <span style="color:${statusColor}; font-weight:900; margin-left:8px; flex-shrink:0;">
          ${statusIcon}
        </span>
      </div>`;
    })
    .join("");

  const readyCount = list.filter((p) => p.ready).length;
  const countText = `${list.length}/99 人 ｜ ${readyCount}/${list.length} 已準備`;
  if (roomStatusEl && lobbyState?.status === "waiting") {
    roomStatusEl.style.display = "block";
    roomStatusEl.innerText = countText;
    roomStatusEl.style.color = "#DDA15E";
  }
}

export function onlineMakeMiniPlayer(id, p) {
  const w = document.createElement("div");
  w.className = "online-opponent";
  w.dataset.playerId = id;
  // ★ 強制覆寫樣式，確保外觀緊湊、間距縮小
  w.style.cssText =
    "display: flex; flex-direction: column; align-items: center; padding: 10px; background: rgba(255,255,255,0.85); border-radius: 12px; border: 2px solid #c9b1e8; width: 100%; box-sizing: border-box; box-shadow: 0 4px 6px rgba(0,0,0,0.05); gap: 6px;";

  w.innerHTML = `
    <!-- 第 1 行：玩家名稱 -->
    <div class="opp-name" style="font-size: 15px; font-weight: 900; color: #5d576b; width: 100%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
    
    <!-- 第 2 行：愛心與血量 -->
    <div class="opp-hp" style="font-size: 14px; font-weight: 900; color: #d96c8e;"></div>
  
    <!-- 第 3 行：剩餘磚塊進度條 -->
    <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
      <div class="opp-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #c9b1e8, #f6a6c1); transition: width 0.2s;"></div>
    </div> 

    <!-- 第 4 行：等級與其他資訊 -->
    <div class="opp-info" style="font-size: 11px; font-weight: 900; color: #8a7e9c;"></div> 

    <!-- ★ 第 5 行：擋板畫布 (拔除舊 class，高度設為 160，並用 CSS 鎖定完美的 5:1 比例) -->
    <canvas width="800" height="160" style="display: block; width: 100%; height: auto; aspect-ratio: 5 / 1; border-radius: 6px; background: rgba(0,0,0,0.05); margin-top: 2px;"></canvas>
  `;
  return w;
}

export function onlineRenderPlayers(leftEl, rightEl, bottomEl) {
  if (!leftEl || !rightEl || !bottomEl) return;

  leftEl.style.display = "flex";
  rightEl.style.display = "flex";
  bottomEl.style.display = "flex";

  let opps = Object.keys(onlinePlayers)
    .filter((id) => id !== myPlayerId)
    .map((id) => ({ id, ...onlinePlayers[id] }));
  opps.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return (b.score || 0) - (a.score || 0);
  });

  const currentIds = new Set(opps.map((o) => o.id));
  document
    .querySelectorAll(".online-opponent, .bottom-opponent-tag")
    .forEach((el) => {
      if (!currentIds.has(el.dataset.playerId)) el.remove();
    });

  opps.forEach((p, index) => {
    // ==========================================
    // ★ 共用邏輯：計算對手的真實血量與護盾顯示字串
    // ==========================================
    const hpVal = p.paddle?.hp !== undefined ? p.paddle.hp : 100;
    const shieldVal = p.paddle?.shield || 0;

    // 超過 100% 顯示金心，低於 30% 顯示紅心
    const hpEmoji =
      hpVal > 100 ? "💛"
      : hpVal <= 30 ? "💔"
      : "💗";
    let hpDisplay = `${hpEmoji} ${hpVal}%`;
    if (shieldVal > 0) {
      hpDisplay += ` 🛡️${shieldVal}%`; // 若有護盾則附加在後面
    }

    if (index < 8) {
      let tag = bottomEl?.querySelector(
        `[data-player-id="${CSS.escape(p.id)}"]`,
      );
      if (tag) tag.remove();

      let w = document.querySelector(
        `.online-opponent[data-player-id="${CSS.escape(p.id)}"]`,
      );
      if (!w) w = onlineMakeMiniPlayer(p.id, p);

      const targetContainer = index < 4 ? leftEl : rightEl;
      if (w.parentElement !== targetContainer) targetContainer.appendChild(w);

      w.classList.toggle("eliminated", p.alive === false);

      // ==========================================
      // ★ 將接收到的資料寫入緊湊版 HTML 中
      // ==========================================
      const nameEl = w.querySelector(".opp-name");
      const hpEl = w.querySelector(".opp-hp");
      const progEl = w.querySelector(".opp-progress");
      const infoEl = w.querySelector(".opp-info");

      if (nameEl) nameEl.textContent = p.name || "玩家";

      if (hpEl) {
        if (p.alive === false) {
          hpEl.textContent = "💀 淘汰";
          hpEl.style.color = "#7A728A";
        } else {
          hpEl.textContent = hpDisplay;
          hpEl.style.color = hpVal <= 30 ? "#E0576B" : "#d96c8e";
        }
      }

      // 解析磚塊數量
      let bCount = 0;
      if (
        p.bricks
        && p.bricks.length === 1
        && p.bricks[0].x === 0
        && p.bricks[0].y === 0
      ) {
        bCount = p.bricks[0].ci;
      } else if (p.bricks) {
        bCount = p.bricks.filter((b) => b.hp > 0).length;
      }

      let maxBricks = 50;
      const realPlayer = onlinePlayers[p.id];
      if (realPlayer) {
        if (realPlayer._trackedLevel !== p.level) {
          realPlayer._trackedLevel = p.level;
          realPlayer._maxBricks = Math.max(1, bCount);
        } else {
          realPlayer._maxBricks = Math.max(realPlayer._maxBricks || 1, bCount);
        }
        maxBricks = realPlayer._maxBricks;
      }

      if (progEl) {
        const fillW = Math.min(1, bCount / maxBricks) * 100;
        progEl.style.width = `${fillW}%`;
      }

      if (infoEl) {
        infoEl.innerHTML = `Lv.${p.level || 1} <span style="opacity:0.5; margin: 0 4px;">|</span> 殘留方塊: ${bCount}`;
      }

      // ==========================================
      // ★ 更新裁切版畫布 (只畫下半部擋板區域)
      // ==========================================
      const c = w.querySelector("canvas"); // ★ 改用直接抓取 canvas 標籤
      if (c) {
        const x = c.getContext("2d");
        x.clearRect(0, 0, c.width, c.height);

        // 畫背景漸層
        const g = x.createLinearGradient(0, 0, c.width, c.height);
        g.addColorStop(0, "#FDF4F6");
        g.addColorStop(1, "#E6F3FA");
        x.fillStyle = g;
        x.fillRect(0, 0, c.width, c.height);

        if (p.alive === false) {
          x.fillStyle = "rgba(255,255,255,.65)";
          x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#E0576B";
          x.font = "900 40px sans-serif";
          x.textAlign = "center";
          x.textBaseline = "middle";
          x.fillText("ELIMINATED", c.width / 2, c.height / 2);
        } else {
          x.save();
          // ★ 鏡頭偏移魔法：把整個世界往上提 440 像素！
          // 這樣原本在 Y=556 的擋板，就會出現在 160px 畫布的下方，上方保留空間給球掉落
          x.translate(0, -440);

          // 畫擋板
          if (p.paddle && p.paddle.x !== undefined) {
            x.fillStyle = "#9DD9E8";
            x.beginPath();
            const pw = p.paddle.w || 120;
            const ph = p.paddle.h || 22;
            x.roundRect(p.paddle.x, p.paddle.y || 556, pw, ph, ph / 2);
            x.fill();
          }

          // 畫球
          if (p.ball && p.ball.x !== undefined && p.ball.y !== undefined) {
            x.fillStyle = "#5D576B";
            x.beginPath();
            x.arc(p.ball.x, p.ball.y, 11, 0, Math.PI * 2);
            x.fill();
          }
          x.restore();
        }
      }
    } else {
      let w = document.querySelector(
        `.online-opponent[data-player-id="${CSS.escape(p.id)}"]`,
      );
      if (w) w.remove();

      let tag = bottomEl?.querySelector(
        `[data-player-id="${CSS.escape(p.id)}"]`,
      );
      if (!tag) {
        tag = document.createElement("div");
        tag.className = "bottom-opponent-tag";
        tag.dataset.playerId = p.id;
        if (bottomEl) bottomEl.appendChild(tag);
      }
      tag.style.opacity = p.alive === false ? "0.4" : "1";

      // ★ 更新底部的文字名牌
      tag.innerText =
        p.alive === false ?
          `💀 Lv.${p.level || 1} ${p.name || "玩家"}`
        : `Lv.${p.level || 1} ${p.name || "玩家"} - ${hpDisplay}`;
    }
  });
}
