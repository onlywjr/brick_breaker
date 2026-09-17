// ==========================================
// ★ 不雅字眼過濾器 (可自行擴充字典)
// ==========================================
const PROFANITY_LIST = [
  // 英文
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "cunt",
  "dick",
  "pussy",
  "slut",
  "whore",
  // 中文 (常見髒字與變體)
  "幹",
  "靠北",
  "靠夭",
  "機掰",
  "媽的",
  "智障",
  "腦殘",
  "沙雕",
  "賤",
  "婊",
  "垃圾",
  "吃屎",
  "去死",
  "肏",
  "操你",
  "媽逼",
];

export function containsProfanity(text) {
  if (!text) return false;
  // 移除所有空白與常見特殊符號，轉小寫後再檢查，防止玩家用 "f u c k" 或 "幹-你" 繞過
  const cleanText = text.replace(/[\s\-_*.,!@#$%^&()]/g, "").toLowerCase();
  return PROFANITY_LIST.some((word) => cleanText.includes(word));
}
