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

export function resizeGame() {
  const wrap = document.getElementById("wrap");
  if (!wrap) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isPortrait = h > w;
  const isOnline = document.body.classList.contains("online-battle-mode");
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
