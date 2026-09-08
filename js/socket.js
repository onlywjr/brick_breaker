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
  const shopBtn = document.getElementById("btn-lobby-shop"); // ★ 抓取商店按鈕
  if (!el) return;

  el.innerText = isReady ? "取消準備" : "準備完成";
  el.className =
    isReady ?
      "menu-item-macaron macaron-blue"
    : "menu-item-macaron macaron-pink";

  if (shopBtn) {
    // ★ 只要「準備完成」或是「未開啟 DLC」，就禁用商店按鈕
    const isDlc = document.getElementById("enable-dlc")?.checked ?? true;
    const shouldDisable = isReady || !isDlc;

    shopBtn.disabled = shouldDisable;
    shopBtn.style.opacity = shouldDisable ? "0.5" : "1";
    shopBtn.style.cursor = shouldDisable ? "not-allowed" : "pointer";
  }
}

export function createRoom() {
  if (!socket.connected) {
    setRoomStatus("尚未連線到遊戲伺服器，請稍候…", "error");
    return;
  }
  const name = document.getElementById("player-name-input").value.trim();
  const isDlc = document.getElementById("enable-dlc")?.checked ?? false; // ★ 抓取 DLC 狀態

  if (name) socket.emit("setPlayerName", name);
  setRoomStatus("正在建立房間…");
  // ★ 將 DLC 狀態打包發送給 Server
  socket.emit("createRoom", { name, dlc: isDlc });
}

export function joinRoom() {
  const input = document.getElementById("room-code-input");
  const code = (input?.value || "").trim().toUpperCase();
  const name = document.getElementById("player-name-input").value.trim();
  const isDlc = document.getElementById("enable-dlc")?.checked ?? false; // ★ 抓取 DLC 狀態

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
  // ★ 將 DLC 狀態與房間號碼一起發送給 Server
  socket.emit("joinRoom", { code, name, dlc: isDlc });
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

    // ★ 核心防呆：直接檢查伺服器傳來的 dlc 狀態
    if (state?.dlc !== undefined) {
      const dlcCb = document.getElementById("enable-dlc");

      // 1. 檢查是否與房主不同步 (若不符則踢出)
      if (dlcCb && dlcCb.checked !== state.dlc) {
        alert(
          `⛔ 加入失敗！\n此房間設定為：${state.dlc ? "🧪 化學 DLC 模式" : "🎮 一般對戰"}\n您的設定與房間不符，請在首頁勾選或取消 DLC 後再重新加入。`,
        );
        socket.emit("leaveRoom");
        currentRoomCode = null; // ★ 徹底清空本地端的房間代碼

        // 隱藏大廳，退回首頁
        const lobbyScreen = document.getElementById("lobby-screen");
        const roomStatus = document.getElementById("room-status");
        const menuBtns = document.getElementById("menu-btns");
        if (lobbyScreen) lobbyScreen.style.display = "none";
        if (roomStatus) roomStatus.style.display = "none";
        if (menuBtns) menuBtns.style.display = "flex";

        return; // ★ 阻斷後續程式，拒絕加入
      }

      // 2. 正常加入：更新大廳 UI
      const dlcStatus = document.getElementById("lobby-dlc-status");
      if (dlcStatus) {
        dlcStatus.innerText = state.dlc ? "🧪 化學擴展 (DLC)" : "🎮 一般對戰";
        dlcStatus.style.color = state.dlc ? "#DDA15E" : "#7A728A";
      }
      const lobbyShop = document.getElementById("btn-lobby-shop");
      if (lobbyShop) {
        lobbyShop.style.display = state.dlc ? "flex" : "none";
      }
    }

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
    startOnlineGame(state, document.getElementById("game"));
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
