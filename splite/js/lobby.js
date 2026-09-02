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
        spans[0].textContent = p.name || "玩家";
        spans[1].textContent =
          p.alive === false ? "淘汰" : `#${index + 1}  ${p.score || 0}`;
        spans[1].style.color = "#7A728A";
      }

      const c = w.querySelector(".online-mini");
      if (c) {
        const x = c.getContext("2d");
        x.clearRect(0, 0, c.width, c.height);
        x.fillStyle = "#FDF4F6";
        x.fillRect(0, 0, c.width, c.height);
        x.save();
        x.scale(c.width / 800, c.height / 600);
        const g = x.createLinearGradient(0, 0, 800, 600);
        g.addColorStop(0, "#FDF4F6");
        g.addColorStop(1, "#E6F3FA");
        x.fillStyle = g;
        x.fillRect(0, 0, 800, 600);
        for (const b of p.bricks || []) {
          if (b.hp <= 0) continue;
          x.fillStyle = b.interference ? "#E79AAA" : "#C9B1E8";
          x.globalAlpha = b.interference ? 0.9 : 0.65;
          x.fillRect(b.x, b.y, b.w || 72, b.h || 24);
        }
        x.globalAlpha = 1;
        if (p.paddle) {
          x.fillStyle = "#9DD9E8";
          x.fillRect(p.paddle.x, p.paddle.y, p.paddle.w, p.paddle.h);
        }
        if (p.ball) {
          x.fillStyle = "#5D576B";
          x.beginPath();
          x.arc(p.ball.x, p.ball.y, p.ball.r || 8, 0, Math.PI * 2);
          x.fill();
        }
        x.restore();
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
      tag.innerText = `#${index + 1} ${p.name || "玩家"} - ${p.score || 0}`;
    }
  });
}
