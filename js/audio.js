const SND = {
  hit: "./assets/sounds/brick_hit.mp3",
  brk: "./assets/sounds/brick_break.mp3",
  bounce: "./assets/sounds/ball_bounce.mp3",
  music: "./assets/sounds/bg_music.mp3",
};

export const loadedAudio = {};

export function loadAudio() {
  const jobs = [];
  for (const [k, s] of Object.entries(SND)) {
    const a = new Audio(s);
    a.volume = 0.5;
    loadedAudio[k] = a;
    jobs.push(
      a
        .play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => {}),
    );
  }
  if (loadedAudio.music) {
    loadedAudio.music.loop = true;
    loadedAudio.music.volume = 0.25;
  }
  return Promise.all(jobs);
}

export function playSfx(name) {
  const a = loadedAudio[name];
  if (!a) return;
  // 不要修改原本的 currentTime，而是複製一個新的節點來獨立播放
  const clone = a.cloneNode();
  clone.volume = a.volume;
  clone.play().catch(() => {});
}

export function unlockAudio() {
  for (const k of ["hit", "brk", "bounce"]) {
    const a = loadedAudio[k];
    if (a) {
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => {});
    }
  }
  window.removeEventListener("click", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
