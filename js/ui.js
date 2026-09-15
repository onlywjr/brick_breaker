import { keys } from "./game.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function bindVirtualButton(el, keyName) {
  if (!el) return;
  const press = (e) => {
    if (e && e.cancelable) e.preventDefault();
    keys[keyName] = true;
    keys[keyName.toLowerCase()] = true;
    el.classList.add("pressed");
  };
  const release = (e) => {
    if (e && e.cancelable) e.preventDefault();
    keys[keyName] = false;
    keys[keyName.toLowerCase()] = false;
    el.classList.remove("pressed");
  };

  el.addEventListener("pointerdown", press, { passive: false });
  el.addEventListener("pointerup", release, { passive: false });
  el.addEventListener("pointercancel", release, { passive: false });
  el.addEventListener("pointerleave", release, { passive: false });
  el.addEventListener("touchstart", press, { passive: false });
  el.addEventListener("touchend", release, { passive: false });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function setupVirtualControls() {
  bindVirtualButton(
    document.querySelector("#vbtn-solo-left .btn"),
    "ArrowLeft",
  );
  bindVirtualButton(
    document.querySelector("#vbtn-solo-right .btn"),
    "ArrowRight",
  );
  const p1Btns = document.querySelectorAll("#vbtn-p1-group .btn");
  if (p1Btns.length >= 2) {
    bindVirtualButton(p1Btns[0], "a");
    bindVirtualButton(p1Btns[1], "d");
  }
  const p2Btns = document.querySelectorAll("#vbtn-p2-group .btn");
  if (p2Btns.length >= 2) {
    bindVirtualButton(p2Btns[0], "ArrowLeft");
    bindVirtualButton(p2Btns[1], "ArrowRight");
  }
}

export function updateVirtualButtonsVisibility(showVirtual, running, mode) {
  const soloL = document.getElementById("vbtn-solo-left");
  const soloR = document.getElementById("vbtn-solo-right");
  const p1Grp = document.getElementById("vbtn-p1-group");
  const p2Grp = document.getElementById("vbtn-p2-group");
  if (!soloL || !soloR || !p1Grp || !p2Grp) return;

  if (!showVirtual || !running) {
    soloL.style.display = "none";
    soloR.style.display = "none";
    p1Grp.style.display = "none";
    p2Grp.style.display = "none";
    return;
  }
  if (mode === 2) {
    soloL.style.display = "none";
    soloR.style.display = "none";
    p1Grp.style.display = "flex";
    p2Grp.style.display = "flex";
  } else {
    soloL.style.display = "flex";
    soloR.style.display = "flex";
    p1Grp.style.display = "none";
    p2Grp.style.display = "none";
  }
}

// ==========================================
// ★ 精準設備偵測與自適應畫面縮放
// ==========================================
export function resizeGame() {
  const wrap = document.getElementById("wrap");
  if (!wrap) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isPortrait = h > w;
  const isOnline = document.body.classList.contains("online-battle-mode");

  const mainPrompt = document.getElementById("rotate-prompt");
  const chemOverlay = document.getElementById("chem-ui-overlay");
  const isShopOpen =
    chemOverlay
    && chemOverlay.style.display !== "none"
    && chemOverlay.style.display !== "";

  // 偵測是否為觸控設備
  const isTouchDevice = window.matchMedia(
    "(hover: none) and (pointer: coarse)",
  ).matches;
  // 精準偵測 iPad (包含新版 iPadOS 會偽裝成 MacIntel 的情況)
  const isIPad =
    /iPad/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (mainPrompt) {
    if (isShopOpen) {
      // 狀態 1：商店開啟中。強制隱藏主遊戲的提示，把方向控制權完全交給商店
      mainPrompt.style.setProperty("display", "none", "important");
    } else if (isTouchDevice) {
      // 狀態 2：觸控行動裝置
      if (isIPad && isOnline) {
        // 【專屬 iPad + 連線模式】：強制要求直向
        if (!isPortrait) {
          mainPrompt.innerHTML =
            "📱<br />請將 iPad 轉為直向<br />以顯示完整對戰畫面";
          mainPrompt.style.setProperty("display", "flex", "important");
        } else {
          mainPrompt.style.setProperty("display", "none", "important");
        }
      } else {
        // 【所有一般手機】或【iPad 單機模式】：一律強制要求橫向
        if (isPortrait) {
          mainPrompt.innerHTML =
            "🔄<br />請將設備轉為橫向<br />以顯示完整遊戲畫面";
          mainPrompt.style.setProperty("display", "flex", "important");
        } else {
          mainPrompt.style.setProperty("display", "none", "important");
        }
      }
    } else {
      // 電腦版無須提示
      mainPrompt.style.setProperty("display", "none", "important");
    }
  }

  // 畫面縮放邏輯
  const baseW = !isPortrait && isOnline ? 1200 : 840;
  const baseH = isPortrait && isOnline ? 1150 : 660;
  let scale = Math.min(w / baseW, h / baseH);
  if (scale > 1.5) scale = 1.5;
  wrap.style.transform = `scale(${scale})`;
  wrap.style.transformOrigin = "center center";
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function onlineShowStatus(text, ms = 1200) {
  const el = document.getElementById("online-attack-status");
  if (!el) return;
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(onlineShowStatus.timer);
  onlineShowStatus.timer = setTimeout(() => (el.style.display = "none"), ms);
}
