import { renderLobbyPlayers } from "./lobby.js";
import { onlineShowStatus, escapeHtml } from "./ui.js";
import {
  startOnlineGame,
  showOnlineMatchOver,
  onlineReceiveAttack,
} from "./game.js";

export const socket = io("https://bm-server-90fs.onrender.com", {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  timeout: 8000,
});

export let lobbyState = null;
export let currentRoomCode = null;
export let isReady = false;

export function setRoomStatus(text, type = "info") {
  const el = document.getElementById("room-status");
  if (!el) return;
  el.style.display = text ? "block" : "none";
  el.innerText = text || "";
  el.style.color =
    type === "error" ? "#fb7185"
    : type === "success" ? "#34d399"
    : "#DDA15E";
}

export function updateReadyButton() {
  const el = document.getElementById("btn-ready");
  if (!el) return;
  el.innerText = isReady ? "取消準備" : "準備完成";
  el.className =
    isReady ?
      "menu-item-macaron macaron-blue"
    : "menu-item-macaron macaron-pink";
}

export function createRoom() {
  if (!socket.connected) {
    setRoomStatus("尚未連線到遊戲伺服器，請稍候…", "error");
    return;
  }
  const name = document.getElementById("player-name-input").value.trim();
  if (name) socket.emit("setPlayerName", name);
  setRoomStatus("正在建立房間…");
  socket.emit("createRoom");
}

export function joinRoom() {
  const input = document.getElementById("room-code-input");
  const code = (input?.value || "").trim().toUpperCase();
  const name = document.getElementById("player-name-input").value.trim();
  if (!code) {
    alert("請輸入房間代碼");
    input?.focus();
    return;
  }
  if (!socket.connected) {
    setRoomStatus("尚未連線到遊戲伺服器，請稍候…", "error");
    return;
  }
  if (name) socket.emit("setPlayerName", name);
  setRoomStatus(`正在加入房間 ${code}…`);
  socket.emit("joinRoom", code);
}

export function toggleReady() {
  if (!currentRoomCode) {
    setRoomStatus("尚未進入房間", "error");
    return;
  }
  socket.emit("toggleReady");
}

export function setupSocketListeners(handlers) {
  socket.on("connect", () => {
    setRoomStatus("伺服器已連線", "success");
    console.log("Lobby socket connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    if (currentRoomCode)
      setRoomStatus(`與伺服器斷線（${reason}），正在重新連線…`, "error");
  });

  socket.on("connect_error", (err) => {
    if (!currentRoomCode)
      setRoomStatus("無法連線到多人遊戲伺服器（Port 3000）", "error");
  });

  socket.on("roomCreated", (payload) => {
    const code = typeof payload === "string" ? payload : payload?.code;
    currentRoomCode = code; // 新增這行：儲存房間代碼
    handlers.showLobby(code);
  });

  socket.on("roomJoined", (payload) => {
    const code = typeof payload === "string" ? payload : payload?.code;
    currentRoomCode = code; // 新增這行：儲存房間代碼
    handlers.showLobby(code);
  });

  socket.on("lobbyState", (state) => {
    lobbyState = state || {};
    handlers.onLobbyState(state);
    const me = (state?.players || []).find((p) => p.id === socket.id);
    isReady = !!me?.ready;
    updateReadyButton();
    renderLobbyPlayers(
      state?.players || [],
      document.getElementById("player-list"),
      document.getElementById("room-status"),
      lobbyState,
    );
  });

  socket.on("roomUpdate", (playersObj) => {
    const players =
      Array.isArray(playersObj) ? playersObj : Object.values(playersObj || {});
    renderLobbyPlayers(
      players,
      document.getElementById("player-list"),
      document.getElementById("room-status"),
      lobbyState,
    );
    const me = players.find((p) => p.id === socket.id);
    if (me) {
      isReady = !!me.ready;
      updateReadyButton();
    }
  });

  socket.on("countdown", (time) => {
    const el = document.getElementById("lobby-countdown");
    if (!el) return;
    el.style.display = "block";
    el.innerText = `🔥 遊戲將在 ${time} 秒後開始...`;
    const rs = document.getElementById("room-status");
    if (rs) rs.style.display = "none";
  });

  socket.on("cancelCountdown", (message) => {
    const el = document.getElementById("lobby-countdown");
    if (el) el.style.display = "none";
    if (message) setRoomStatus(message, "info");
  });

  socket.on("gameStart", (state) => {
    document.getElementById("lobby-screen").style.display = "none";
    document.getElementById("lobby-countdown").style.display = "none";
    document.getElementById("menu-btns").style.display = "none";
    startOnlineGame(state);
  });

  socket.on("onlineState", (state) => handlers.onOnlineState(state));
  socket.on("playerAttacked", (data) => onlineReceiveAttack(data));
  socket.on("onlineAttackAccepted", (data) => {
    handlers.onAttackAccepted();
    if (data?.targetName)
      onlineShowStatus(`⚡ 攻擊 ${escapeHtml(data.targetName)}！`, 1000);
  });
  socket.on("onlineAttackRejected", (data) => handlers.onAttackRejected(data));
  socket.on("onlineMatchOver", (result) => showOnlineMatchOver(result));
  socket.on("playerEliminated", (data) => handlers.onPlayerEliminated(data));
  socket.on("lobbyError", (message) => {
    setRoomStatus(message || "多人遊戲發生錯誤", "error");
    alert(message || "多人遊戲發生錯誤");
  });
  socket.on("roomError", (message) => {
    setRoomStatus(message || "加入房間失敗", "error");
    alert(message || "加入房間失敗");
  });
  socket.on("error", (message) => {
    if (message) setRoomStatus(String(message), "error");
  });
}
