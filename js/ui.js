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
// ★ 精準設備偵測與自適應畫面縮放 (完美版)
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

  // 1. 偵測是否具備觸控功能 (涵蓋實體手機、平板與開發者工具)
  const isTouch =
    "ontouchstart" in window
    || navigator.maxTouchPoints > 0
    || window.matchMedia("(pointer: coarse)").matches;

  // 2. 精準破解 iPadOS 的 Mac 偽裝：只要是蘋果設備且具備觸控功能，一律判定為 iPad
  const isIPad =
    /iPad/i.test(navigator.userAgent)
    || ((/Macintosh/i.test(navigator.userAgent)
      || navigator.platform === "MacIntel")
      && isTouch);

  // 3. 泛用行動裝置判定
  const isMobileDevice =
    isTouch
    || /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  if (mainPrompt) {
    if (isShopOpen) {
      // 狀態 1：商店開啟中。強制隱藏主遊戲的提示，保持畫布顯示
      mainPrompt.style.setProperty("display", "none", "important");
      wrap.style.display = "block";
    } else if (isMobileDevice) {
      if (isIPad) {
        // 【專屬 iPad (含 Pro/Mini)】：一律強制要求直向
        if (!isPortrait) {
          mainPrompt.innerHTML =
            "📱<br />請將 iPad 轉為直向<br />以顯示完整遊戲畫面";
          mainPrompt.style.setProperty("display", "flex", "important");
          wrap.style.display = "none";
        } else {
          mainPrompt.style.setProperty("display", "none", "important");
          wrap.style.display = "block";
        }
      } else {
        // 【所有一般手機 (iPhone/Android)】：一律強制要求橫向
        if (isPortrait) {
          mainPrompt.innerHTML =
            "🔄<br />請將設備轉為橫向<br />以顯示完整遊戲畫面";
          mainPrompt.style.setProperty("display", "flex", "important");
          wrap.style.display = "none";
        } else {
          mainPrompt.style.setProperty("display", "none", "important");
          wrap.style.display = "block";
        }
      }
    } else {
      // 電腦版無須提示
      mainPrompt.style.setProperty("display", "none", "important");
      wrap.style.display = "block";
    }
  }

  // ==========================================
  // ★ 動態縮放邏輯 (解除上限封印)
  // ==========================================
  let baseW = 840;
  let baseH = 660;

  if (isOnline) {
    if (isPortrait) {
      baseW = 840;
      baseH = 1150; // 連線模式 + 直向 (iPad 專用比例)
    } else {
      baseW = 1200; // 連線模式 + 橫向 (手機/電腦 專用比例)
      baseH = 660;
    }
  }

  let scale = Math.min(w / baseW, h / baseH);

  // ★ 關鍵修復：將原本的 1.5 放大極限解鎖到 3.0，讓 iPad Pro 這種超大平板也能完美滿版！
  if (scale > 3.0) scale = 3.0;

  wrap.style.transform = `scale(${scale})`;
  wrap.style.transformOrigin = "center center";
  
  // ==========================================
  // ★ 確保縮放計算完畢後才淡入顯示，徹底消除初始閃爍
  // ==========================================
  if (wrap.style.opacity !== "1") {
    requestAnimationFrame(() => {
      wrap.style.opacity = "1";
    });
  }
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
