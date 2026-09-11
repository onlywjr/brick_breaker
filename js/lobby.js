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
  const h = document.createElement("div");
  h.className = "online-opponent-head";
  const n = document.createElement("span");
  const i = document.createElement("span");
  h.append(n, i);
  const c = document.createElement("canvas");
  c.className = "online-mini";
  c.width = 360;
  c.height = 250;
  w.append(h, c);
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

      const spans = w.querySelectorAll(".online-opponent-head span");
      if (spans.length === 2) {
        const livesLeft =
          p.paddle?.lives !== undefined ? Math.max(0, p.paddle.lives) : 3;
        // ★ 在名字前方加上 Lv. 標籤
        spans[0].textContent = p.name || "玩家";
        spans[1].textContent =
          p.alive === false ? "💀 淘汰" : `❤️ x${livesLeft}`;
        spans[1].style.color = "#7A728A";
      }

      const c = w.querySelector(".online-mini");
      if (c) {
        const x = c.getContext("2d");
        x.clearRect(0, 0, c.width, c.height);

        // 1. 畫背景漸層
        const g = x.createLinearGradient(0, 0, c.width, c.height);
        g.addColorStop(0, "#FDF4F6");
        g.addColorStop(1, "#E6F3FA");
        x.fillStyle = g;
        x.fillRect(0, 0, c.width, c.height);

        x.save();
        x.scale(c.width / 800, c.height / 600);

        // ==========================================
        // ★ 輕量化 99 人觀戰優化：解開真實數量
        // ==========================================
        let bCount = 0;

        // 解析我們壓縮的封包
        if (
          p.bricks
          && p.bricks.length === 1
          && p.bricks[0].x === 0
          && p.bricks[0].y === 0
        ) {
          bCount = p.bricks[0].ci;
        } else if (p.bricks) {
          // 相容舊版
          bCount = p.bricks.filter((b) => b.hp > 0).length;
        }

        // ==========================================
        // ★ 核心修復：利用本地字典記憶每關的「初始最大磚塊數」
        // ==========================================
        let maxBricks = 50;
        const realPlayer = onlinePlayers[p.id]; // 直接存取原始物件，確保資料跨幀保留

        if (realPlayer) {
          // 只要發現對方進入新關卡，就重置最大值
          if (realPlayer._trackedLevel !== p.level) {
            realPlayer._trackedLevel = p.level;
            realPlayer._maxBricks = Math.max(1, bCount); // 剛換關時的數量就是最大值
          } else {
            // 停留在同關卡時，永遠記住看過的「歷史最高數量」
            realPlayer._maxBricks = Math.max(
              realPlayer._maxBricks || 1,
              bCount,
            );
          }
          maxBricks = realPlayer._maxBricks;
        }

        if (p.alive !== false) {
          // 底槽
          x.fillStyle = "rgba(0,0,0,0.1)";
          x.fillRect(50, 50, 700, 30);

          // 動態比例計算
          const fillW = Math.min(1, bCount / maxBricks) * 700;
          x.fillStyle = "#C9B1E8";
          x.fillRect(50, 50, fillW, 30);

          // ★ 浮水印文字置中，加上關卡資訊並微調字體大小為 56px
          x.fillStyle = "rgba(122, 114, 138, 0.7)";
          x.font = "900 56px sans-serif";
          x.textAlign = "center";
          x.textBaseline = "middle";
          x.fillText(`Lv.${p.level || 1} ｜ 殘留方塊: ${bCount}`, 400, 300);
        }

        // 畫擋板
        if (p.paddle && p.paddle.x !== undefined) {
          x.fillStyle = "#9DD9E8";
          x.fillRect(
            p.paddle.x,
            p.paddle.y || 556,
            p.paddle.w || 120,
            p.paddle.h || 22,
          );
        }

        // 畫球
        if (p.ball && p.ball.x !== undefined && p.ball.y !== undefined) {
          x.fillStyle = "#5D576B";
          x.beginPath();
          x.arc(p.ball.x, p.ball.y, 11, 0, Math.PI * 2);
          x.fill();
        }
        x.restore();

        // 淘汰遮罩
        if (p.alive === false) {
          x.fillStyle = "rgba(255,255,255,.65)";
          x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#E0576B";
          x.font = "900 26px sans-serif";
          x.textAlign = "center";
          x.fillText("ELIMINATED", c.width / 2, c.height / 2);
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
      const livesLeft =
        p.paddle?.lives !== undefined ? Math.max(0, p.paddle.lives) : 3;
      // ★ 下方的文字標籤也同步顯示關卡
      tag.innerText =
        p.alive === false ?
          `💀 Lv.${p.level || 1} ${p.name || "玩家"}`
        : `Lv.${p.level || 1} ${p.name || "玩家"} - ❤️x${livesLeft}`;
    }
  });
}
