const SND = {
  hit: "./assets/sounds/brick_hit.mp3",
  brk: "./assets/sounds/brick_break.mp3",
  bounce: "./assets/sounds/ball_bounce.mp3",
  music: "./assets/sounds/bg_music.mp3",
};

export const loadedAudio = {};
let audioCtx = null;
let bgmSource = null;

export async function loadAudio() {
  const windowAudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new windowAudioContext();

  const jobs = Object.entries(SND).map(async ([k, src]) => {
    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      loadedAudio[k] = audioBuffer;
    } catch (e) {
      console.error(`音效載入失敗: ${src}`, e);
    }
  });

  return Promise.all(jobs);
}

export function playSfx(name) {
  if (!audioCtx || !loadedAudio[name]) return;

  // 背景音樂需要無限循環
  if (name === "music") {
    if (bgmSource) return; // 避免重複播放
    bgmSource = audioCtx.createBufferSource();
    bgmSource.buffer = loadedAudio[name];
    bgmSource.loop = true;

    // BGM 音量控制
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.25;
    bgmSource.connect(gainNode).connect(audioCtx.destination);
    bgmSource.start(0);
    return;
  }

  // 短音效播放 (零延遲)
  const source = audioCtx.createBufferSource();
  source.buffer = loadedAudio[name];

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.5; // 音效音量

  source.connect(gainNode).connect(audioCtx.destination);
  source.start(0);
}

export function unlockAudio() {
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  window.removeEventListener("click", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
