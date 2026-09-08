// ==========================================
// 全域狀態 (Global State)
// ==========================================
export let chemSkills = [];
export let chemConstants = {};

// 原本的全域變數保留，但將作為「當前視角」的參照
export let chemInventory = {};
export let equippedSkills = [];
export let wishlist = [];
export let unlockedSkills = [];
export let multiPlayerPoints = 1000;

export let skillLevels = {}; // ★ 新增：技能等級紀錄

// ★ 新增：雙人獨立狀態陣列 (補上 levels)
export let chemStates = [
  {
    inventory: {},
    equipped: [],
    unlocked: [],
    wishlist: [],
    points: 1000,
    levels: {},
  }, // 1P
  {
    inventory: {},
    equipped: [],
    unlocked: [],
    wishlist: [],
    points: 1000,
    levels: {},
  }, // 2P
];
export let activePIdx = 0; // 商店目前服務的玩家 (0=1P, 1=2P)

export let currentGameMode = 1;
let isEquippingMode = false;
let activeEquipSlotIndex = null;
let shopCloseCallback = null;
export let currentShopPage = 0;
const CARDS_PER_PAGE = 10;

// ★ 核心狀態切換引擎：進商店時切換變數參照
export function switchChemState(pId) {
  chemStates[activePIdx].points = multiPlayerPoints;
  chemStates[activePIdx].inventory = chemInventory;
  chemStates[activePIdx].equipped = equippedSkills;
  chemStates[activePIdx].unlocked = unlockedSkills;
  chemStates[activePIdx].wishlist = wishlist;
  chemStates[activePIdx].levels = skillLevels; // ★ 存檔當前等級

  activePIdx = pId;

  multiPlayerPoints = chemStates[pId].points;
  chemInventory = chemStates[pId].inventory;
  equippedSkills = chemStates[pId].equipped;
  unlockedSkills = chemStates[pId].unlocked;
  wishlist = chemStates[pId].wishlist;
  skillLevels = chemStates[pId].levels || {}; // ★ 讀取專屬等級
}

export function setChemistryMode(m) {
  currentGameMode = m;
  if (typeof renderPeriodicTable === "function") renderPeriodicTable();
  if (typeof renderEquippedSlots === "function") renderEquippedSlots();
  if (typeof refreshDashboard === "function") refreshDashboard();
}

// ★ 升級 API：接收 pId 以判斷開啟誰的商店
export function openChemistryShop(
  title = "配方商店",
  pId = 0,
  callback = null,
) {
  switchChemState(pId);
  const titleEl = document.querySelector(".shop-header h2");
  if (titleEl) titleEl.innerText = `🛒 ${title}`;
  const btnEl = document.querySelector(".chem-return-btn");
  if (btnEl) btnEl.innerText = "↩️ 關閉商店";

  document.getElementById("chem-ui-overlay").style.display = "flex";
  shopCloseCallback = callback;
  if (typeof renderChemistryUI === "function") renderChemistryUI();
}

window.closeChemistryShop = function () {
  chemStates[activePIdx].points = multiPlayerPoints; // 關閉時存檔一次數值
  document.getElementById("chem-ui-overlay").style.display = "none";
  if (shopCloseCallback) {
    const cb = shopCloseCallback;
    shopCloseCallback = null;
    cb();
  }
};

window.nextShopPage = function () {
  currentShopPage++;
  renderShopCards();
};

window.prevShopPage = function () {
  if (currentShopPage > 0) {
    currentShopPage--;
    renderShopCards();
  }
};

// ==========================================
// 原子量對照表（元素週期表 1～118）
// 用於化合物分子量／式量計算
// 單位：g/mol（數值上等同相對原子量）
// ==========================================

const ATOMIC_WEIGHT = {
  // 1–10
  "H": 1.0,
  "He": 4.0,
  "Li": 6.9,
  "Be": 9.0,
  "B": 10.8,
  "C": 12.0,
  "N": 14.0,
  "O": 16.0,
  "F": 19.0,
  "Ne": 20.2,

  // 11–20
  "Na": 23.0,
  "Mg": 24.3,
  "Al": 27.0,
  "Si": 28.1,
  "P": 31.0,
  "S": 32.1,
  "Cl": 35.5,
  "Ar": 39.9,
  "K": 39.1,
  "Ca": 40.1,

  // 21–30
  "Sc": 45.0,
  "Ti": 47.9,
  "V": 50.9,
  "Cr": 52.0,
  "Mn": 54.9,
  "Fe": 55.8,
  "Co": 58.9,
  "Ni": 58.7,
  "Cu": 63.5,
  "Zn": 65.4,

  // 31–40
  "Ga": 69.7,
  "Ge": 72.6,
  "As": 74.9,
  "Se": 79.0,
  "Br": 79.9,
  "Kr": 83.8,
  "Rb": 85.5,
  "Sr": 87.6,
  "Y": 88.9,
  "Zr": 91.2,

  // 41–50
  "Nb": 92.9,
  "Mo": 95.9,
  "Tc": 98.0,
  "Ru": 101.1,
  "Rh": 102.9,
  "Pd": 106.4,
  "Ag": 107.9,
  "Cd": 112.4,
  "In": 114.8,
  "Sn": 118.7,

  // 51–60
  "Sb": 121.8,
  "Te": 127.6,
  "I": 126.9,
  "Xe": 131.3,
  "Cs": 132.9,
  "Ba": 137.3,
  "La": 138.9,
  "Ce": 140.1,
  "Pr": 140.9,
  "Nd": 144.2,

  // 61–70
  "Pm": 145.0,
  "Sm": 150.4,
  "Eu": 152.0,
  "Gd": 157.3,
  "Tb": 158.9,
  "Dy": 162.5,
  "Ho": 164.9,
  "Er": 167.3,
  "Tm": 168.9,
  "Yb": 173.0,

  // 71–80
  "Lu": 175.0,
  "Hf": 178.5,
  "Ta": 180.9,
  "W": 183.8,
  "Re": 186.2,
  "Os": 190.2,
  "Ir": 192.2,
  "Pt": 195.1,
  "Au": 197.0,
  "Hg": 200.6,

  // 81–90
  "Tl": 204.4,
  "Pb": 207.2,
  "Bi": 209.0,
  "Po": 209.0,
  "At": 210.0,
  "Rn": 222.0,
  "Fr": 223.0,
  "Ra": 226.0,
  "Ac": 227.0,
  "Th": 232.0,

  // 91–100
  "Pa": 231.0,
  "U": 238.0,
  "Np": 237.0,
  "Pu": 244.0,
  "Am": 243.0,
  "Cm": 247.0,
  "Bk": 247.0,
  "Cf": 251.0,
  "Es": 252.0,
  "Fm": 257.0,

  // 101–110
  "Md": 258.0,
  "No": 259.0,
  "Lr": 266.0,
  "Rf": 267.0,
  "Db": 268.0,
  "Sg": 269.0,
  "Bh": 270.0,
  "Hs": 277.0,
  "Mt": 278.0,
  "Ds": 281.0,

  // 111–118
  "Rg": 282.0,
  "Cn": 285.0,
  "Nh": 286.0,
  "Fl": 289.0,
  "Mc": 290.0,
  "Lv": 293.0,
  "Ts": 294.0,
  "Og": 294.0,
};

// ==========================================
// 初始化與資料載入 (替換原本的函式)
// ==========================================
export async function initChemistrySystem() {
  try {
    const response = await fetch("./mod/skills.json");
    if (!response.ok) throw new Error("無法讀取 skills.json");

    const data = await response.json();
    chemConstants = data.constants || {};

    chemSkills = data.skills.map((skill) => {
      let atomCount = 0;
      let exactWeight = 0;
      let calcDetails = [];

      // 動態計算分子量與組成字串
      for (const [sym, count] of Object.entries(skill.elements)) {
        atomCount += count;
        const weight = ATOMIC_WEIGHT[sym] || 0; // 若沒定義預設為 0
        exactWeight += weight * count;
        // 直式排版：元素 (原子量) × 數量
        calcDetails.push(`${sym} (${weight}) × ${count}`);
      }

      // 組合 Tooltip 顯示字串 (使用 <br> 換行，並為總計加上分隔線與強調色)
      const tooltipText = calcDetails + ` = ${exactWeight.toFixed(1)}`;

      // Cost 取四捨五入的整數
      const ratio = chemConstants.MOLECULAR_WEIGHT_TO_COST_RATIO || 1;
      const cost = Math.round(exactWeight) * ratio;

      return { ...skill, atomCount, cost, tooltipText };
    });

    const htmlResponse = await fetch("./mod/chem_ui.html");
    if (!htmlResponse.ok) throw new Error("無法讀取 chem_ui.html");
    const uiHtml = await htmlResponse.text();

    const uiContainer = document.createElement("div");
    uiContainer.innerHTML = uiHtml;
    document.body.appendChild(uiContainer.firstElementChild);

    // ★ 覆寫原本 HTML 寫死的關閉事件，接上我們剛寫的 API
    const closeBtn = document.querySelector(".chem-return-btn");
    if (closeBtn) closeBtn.onclick = window.closeChemistryShop;

    renderChemistryUI();
    console.log("✅ 化學技能系統與 UI 載入完成", chemSkills);
  } catch (error) {
    console.error("❌ 化學系統載入失敗:", error);
  }
}

// ==========================================
// 庫存管理 (Inventory) - 支援指定玩家 ID 與關卡統計
// ==========================================
export let levelStats = { gained: {}, used: {} }; // ★ 新增：關卡結算統計

export function resetLevelStats() {
  levelStats = { gained: {}, used: {} };
}

export function addAtom(element, amount = 1, pId = activePIdx) {
  const inv = chemStates[pId].inventory;
  if (!inv[element]) inv[element] = 0;
  inv[element] += amount;
  if (pId === activePIdx) chemInventory = inv;

  // ★ 統計獲得量 (僅限 1P)
  if (pId === 0)
    levelStats.gained[element] = (levelStats.gained[element] || 0) + amount;
}

export function tryConsumeRecipe(elementsRequired, pId = activePIdx) {
  const inv = chemStates[pId].inventory;
  for (const [element, requiredCount] of Object.entries(elementsRequired)) {
    if ((inv[element] || 0) < requiredCount) return false;
  }
  for (const [element, requiredCount] of Object.entries(elementsRequired)) {
    inv[element] -= requiredCount;

    // ★ 統計消耗量 (僅限 1P)
    if (pId === 0)
      levelStats.used[element] =
        (levelStats.used[element] || 0) + requiredCount;
  }
  if (pId === activePIdx) chemInventory = inv;
  return true;
}

export function getAtomCount(element, pId = activePIdx) {
  return chemStates[pId].inventory[element] || 0;
}

export function clearInventory(pId = activePIdx) {
  chemStates[pId].inventory = {};
  if (pId === activePIdx) chemInventory = chemStates[pId].inventory;
}

// ==========================================
// 裝備與牌組管理 (Equipment)
// ==========================================
export function getSkillData(skillId) {
  return chemSkills.find((s) => s.id === skillId);
}

// ★ 修改：裝備技能時，直接放入指定的 index
export function equipSkill(skillId, targetIndex) {
  if (equippedSkills.includes(skillId)) {
    console.warn("裝備失敗：該技能已裝備");
    return false;
  }
  equippedSkills[targetIndex] = skillId;
  return true;
}

// ★ 修改：卸除技能時，將該位置清空 (設為 null)，避免後方技能往前移位
export function unequipSkill(skillId) {
  const index = equippedSkills.indexOf(skillId);
  if (index !== -1) {
    equippedSkills[index] = null;
  }
}

// 願望清單管理與追蹤
window.toggleWishlist = function (skillId, event) {
  if (event) event.stopPropagation();
  const wList = chemStates[activePIdx].wishlist;
  if (wList.includes(skillId)) {
    chemStates[activePIdx].wishlist = wList.filter((id) => id !== skillId);
  } else {
    chemStates[activePIdx].wishlist.push(skillId);
  }
  if (typeof renderShopCards === "function") renderShopCards();
};

export function getNeededElements() {
  const needed = new Set();
  if (!chemStates || chemStates.length === 0) return [];

  // 檢查指定玩家的願望清單與背包差額
  const checkPlayer = (pId) => {
    const inv = chemStates[pId].inventory;
    const wList = chemStates[pId].wishlist;
    wList.forEach((skillId) => {
      const skill = getSkillData(skillId);
      if (skill) {
        for (const [sym, count] of Object.entries(skill.elements)) {
          if ((inv[sym] || 0) < count) needed.add(sym); // 若庫存不足則加入需求清單
        }
      }
    });
  };

  checkPlayer(0);
  if (currentGameMode === 2) checkPlayer(1);
  return Array.from(needed);
}

// ==========================================
// 週期表字典與 UI 動態渲染
// ==========================================
export const ELEMENT_DATA = {
  "H": ["氫", "nonmetal"],
  "He": ["氦", "noble"],
  "Li": ["鋰", "alkali"],
  "Be": ["鈹", "alkaline"],
  "B": ["硼", "metalloid"],
  "C": ["碳", "nonmetal"],
  "N": ["氮", "nonmetal"],
  "O": ["氧", "nonmetal"],
  "F": ["氟", "halogen"],
  "Ne": ["氖", "noble"],
  "Na": ["鈉", "alkali"],
  "Mg": ["鎂", "alkaline"],
  "Al": ["鋁", "main-metal"],
  "Si": ["矽", "metalloid"],
  "P": ["磷", "nonmetal"],
  "S": ["硫", "nonmetal"],
  "Cl": ["氯", "halogen"],
  "Ar": ["氬", "noble"],
  "K": ["鉀", "alkali"],
  "Ca": ["鈣", "alkaline"],
  "Sc": ["鈧", "transition"],
  "Ti": ["鈦", "transition"],
  "V": ["釩", "transition"],
  "Cr": ["鉻", "transition"],
  "Mn": ["錳", "transition"],
  "Fe": ["鐵", "transition"],
  "Co": ["鈷", "transition"],
  "Ni": ["鎳", "transition"],
  "Cu": ["銅", "transition"],
  "Zn": ["鋅", "transition"],
  "Ga": ["鎵", "main-metal"],
  "Ge": ["鍺", "metalloid"],
  "As": ["砷", "metalloid"],
  "Se": ["硒", "nonmetal"],
  "Br": ["溴", "halogen"],
  "Kr": ["氪", "noble"],
  "Rb": ["銣", "alkali"],
  "Sr": ["鍶", "alkaline"],
  "Y": ["釔", "transition"],
  "Zr": ["鋯", "transition"],
  "Nb": ["鈮", "transition"],
  "Mo": ["鉬", "transition"],
  "Tc": ["鎝", "transition"],
  "Ru": ["釕", "transition"],
  "Rh": ["銠", "transition"],
  "Pd": ["鈀", "transition"],
  "Ag": ["銀", "transition"],
  "Cd": ["鎘", "transition"],
  "In": ["銦", "main-metal"],
  "Sn": ["錫", "main-metal"],
  "Sb": ["銻", "metalloid"],
  "Te": ["碲", "metalloid"],
  "I": ["碘", "halogen"],
  "Xe": ["氙", "noble"],
  "Cs": ["銫", "alkali"],
  "Ba": ["鋇", "alkaline"],
  "Hf": ["鉿", "transition"],
  "Ta": ["鉭", "transition"],
  "W": ["鎢", "transition"],
  "Re": ["錸", "transition"],
  "Os": ["鋨", "transition"],
  "Ir": ["銥", "transition"],
  "Pt": ["鉑", "transition"],
  "Au": ["金", "transition"],
  "Hg": ["汞", "transition"],
  "Tl": ["鉈", "main-metal"],
  "Pb": ["鉛", "main-metal"],
  "Bi": ["鉍", "main-metal"],
  "Po": ["釙", "metalloid"],
  "At": ["砈", "halogen"],
  "Rn": ["氡", "noble"],
  "Fr": ["鍅", "alkali"],
  "Ra": ["鐳", "alkaline"],
  "Rf": ["鑪", "transition"],
  "Db": ["𨧀", "transition"],
  "Sg": ["𨭎", "transition"],
  "Bh": ["𨨏", "transition"],
  "Hs": ["𨭆", "transition"],
  "Mt": ["䥑", "unknown"],
  "Ds": ["鐽", "unknown"],
  "Rg": ["錀", "unknown"],
  "Cn": ["鎶", "unknown"],
  "Nh": ["鉨", "unknown"],
  "Fl": ["鈇", "unknown"],
  "Mc": ["鏌", "unknown"],
  "Lv": ["鉝", "unknown"],
  "Ts": ["鿬", "unknown"],
  "Og": ["鿫", "unknown"],
  // 鑭系與錒系
  "La": ["鑭", "lanthanide"],
  "Ce": ["鈰", "lanthanide"],
  "Pr": ["鐠", "lanthanide"],
  "Nd": ["釹", "lanthanide"],
  "Pm": ["鉕", "lanthanide"],
  "Sm": ["釤", "lanthanide"],
  "Eu": ["銪", "lanthanide"],
  "Gd": ["釓", "lanthanide"],
  "Tb": ["鋱", "lanthanide"],
  "Dy": ["鏑", "lanthanide"],
  "Ho": ["鈥", "lanthanide"],
  "Er": ["鉺", "lanthanide"],
  "Tm": ["銩", "lanthanide"],
  "Yb": ["鐿", "lanthanide"],
  "Lu": ["鎦", "lanthanide"],
  "Ac": ["錒", "actinide"],
  "Th": ["釷", "actinide"],
  "Pa": ["鏷", "actinide"],
  "U": ["鈾", "actinide"],
  "Np": ["錼", "actinide"],
  "Pu": ["鈽", "actinide"],
  "Am": ["鋂", "actinide"],
  "Cm": ["鋦", "actinide"],
  "Bk": ["鉳", "actinide"],
  "Cf": ["鉲", "actinide"],
  "Es": ["鑀", "actinide"],
  "Fm": ["鐨", "actinide"],
  "Md": ["鍆", "actinide"],
  "No": ["鍩", "actinide"],
  "Lr": ["鐒", "actinide"],
};

// 獨立定義原子序，確保排版打散後數字依然正確
const ATOMIC_NUMBER = {
  "H": 1,
  "He": 2,
  "Li": 3,
  "Be": 4,
  "B": 5,
  "C": 6,
  "N": 7,
  "O": 8,
  "F": 9,
  "Ne": 10,
  "Na": 11,
  "Mg": 12,
  "Al": 13,
  "Si": 14,
  "P": 15,
  "S": 16,
  "Cl": 17,
  "Ar": 18,
  "K": 19,
  "Ca": 20,
  "Sc": 21,
  "Ti": 22,
  "V": 23,
  "Cr": 24,
  "Mn": 25,
  "Fe": 26,
  "Co": 27,
  "Ni": 28,
  "Cu": 29,
  "Zn": 30,
  "Ga": 31,
  "Ge": 32,
  "As": 33,
  "Se": 34,
  "Br": 35,
  "Kr": 36,
  "Rb": 37,
  "Sr": 38,
  "Y": 39,
  "Zr": 40,
  "Nb": 41,
  "Mo": 42,
  "Tc": 43,
  "Ru": 44,
  "Rh": 45,
  "Pd": 46,
  "Ag": 47,
  "Cd": 48,
  "In": 49,
  "Sn": 50,
  "Sb": 51,
  "Te": 52,
  "I": 53,
  "Xe": 54,
  "Cs": 55,
  "Ba": 56,
  "La": 57,
  "Ce": 58,
  "Pr": 59,
  "Nd": 60,
  "Pm": 61,
  "Sm": 62,
  "Eu": 63,
  "Gd": 64,
  "Tb": 65,
  "Dy": 66,
  "Ho": 67,
  "Er": 68,
  "Tm": 69,
  "Yb": 70,
  "Lu": 71,
  "Hf": 72,
  "Ta": 73,
  "W": 74,
  "Re": 75,
  "Os": 76,
  "Ir": 77,
  "Pt": 78,
  "Au": 79,
  "Hg": 80,
  "Tl": 81,
  "Pb": 82,
  "Bi": 83,
  "Po": 84,
  "At": 85,
  "Rn": 86,
  "Fr": 87,
  "Ra": 88,
  "Ac": 89,
  "Th": 90,
  "Pa": 91,
  "U": 92,
  "Np": 93,
  "Pu": 94,
  "Am": 95,
  "Cm": 96,
  "Bk": 97,
  "Cf": 98,
  "Es": 99,
  "Fm": 100,
  "Md": 101,
  "No": 102,
  "Lr": 103,
  "Rf": 104,
  "Db": 105,
  "Sg": 106,
  "Bh": 107,
  "Hs": 108,
  "Mt": 109,
  "Ds": 110,
  "Rg": 111,
  "Cn": 112,
  "Nh": 113,
  "Fl": 114,
  "Mc": 115,
  "Lv": 116,
  "Ts": 117,
  "Og": 118,
};

// 移除鑭系與錒系的 7 行主週期表
const PT_GRID = [
  "H",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "He",
  "Li",
  "Be",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Sc",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
  "Ga",
  "Ge",
  "As",
  "Se",
  "Br",
  "Kr",
  "Rb",
  "Sr",
  "Y",
  "Zr",
  "Nb",
  "Mo",
  "Tc",
  "Ru",
  "Rh",
  "Pd",
  "Ag",
  "Cd",
  "In",
  "Sn",
  "Sb",
  "Te",
  "I",
  "Xe",
  "Cs",
  "Ba",
  "",
  "Hf",
  "Ta",
  "W",
  "Re",
  "Os",
  "Ir",
  "Pt",
  "Au",
  "Hg",
  "Tl",
  "Pb",
  "Bi",
  "Po",
  "At",
  "Rn",
  "Fr",
  "Ra",
  "",
  "Rf",
  "Db",
  "Sg",
  "Bh",
  "Hs",
  "Mt",
  "Ds",
  "Rg",
  "Cn",
  "Nh",
  "Fl",
  "Mc",
  "Lv",
  "Ts",
  "Og",
];

// 3x5 的鑭系與錒系陣列
const LANTHANIDES = [
  "La",
  "Ce",
  "Pr",
  "Nd",
  "Pm",
  "Sm",
  "Eu",
  "Gd",
  "Tb",
  "Dy",
  "Ho",
  "Er",
  "Tm",
  "Yb",
  "Lu",
];
const ACTINIDES = [
  "Ac",
  "Th",
  "Pa",
  "U",
  "Np",
  "Pu",
  "Am",
  "Cm",
  "Bk",
  "Cf",
  "Es",
  "Fm",
  "Md",
  "No",
  "Lr",
];

let currentSelectedSymbol = null;

window.selectElementForConversion = function (symbol) {
  currentSelectedSymbol = symbol;
  const area3 = document.getElementById("conv-result-area");
  // 只有在單人模式才需要重置第三欄狀態
  if (area3 && currentGameMode === 1) {
    area3.style.alignItems = "center";
    area3.innerHTML = `<div style="color:#a39ead; font-size:20px; font-weight:900; opacity:0.3; pointer-events:none;">輸出結果</div>`;
  }
  const input = document.getElementById("conv-qty-input");
  if (input) input.value = 1;
  refreshDashboard();
};

window.refreshDashboard = function () {
  if (!currentSelectedSymbol) return;
  const symbol = currentSelectedSymbol;
  const count = getAtomCount(symbol);
  const zhName = ELEMENT_DATA[symbol] ? ELEMENT_DATA[symbol][0] : symbol;
  const weight = ATOMIC_WEIGHT[symbol] ? ATOMIC_WEIGHT[symbol].toFixed(1) : "";
  const num = ATOMIC_NUMBER[symbol] || "";
  const category = ELEMENT_DATA[symbol] ? ELEMENT_DATA[symbol][1] : "unknown";

  const wrapper = document.getElementById("conv-element-wrapper");
  if (wrapper) {
    wrapper.innerHTML = `
      <div class="pt-element ${category} owned" style="position:relative; pointer-events:none;">
        <div class="pt-top-row"><span class="pt-atomic-num">${num}</span><span class="pt-atomic-weight">${weight}</span></div>
        <div class="pt-center-content"><span class="pt-name">${zhName}</span><span class="pt-symbol">${symbol}</span></div>
        <div class="pt-quantity">數量：${count}</div>
      </div>
    `;
  }

  const input = document.getElementById("conv-qty-input");
  // 兼容單/多人模式的按鈕
  const buyBtn =
    document.getElementById("conv-buy-btn")
    || document.getElementById("conv-execute-btn");
  const sellBtn = document.getElementById("conv-sell-btn");

  if (input && buyBtn) {
    input.disabled = false;

    if (currentGameMode === 2) {
      const costPerUnit = parseFloat(weight) || 0;
      const maxBuy =
        costPerUnit > 0 ? Math.floor(multiPlayerPoints / costPerUnit) : 0;
      const maxSell = count; // 最多只能賣背包擁有的數量

      buyBtn.disabled = maxBuy <= 0 || costPerUnit === 0;

      if (sellBtn) {
        sellBtn.disabled = maxSell <= 0; // 背包沒東西就禁用出售
      }

      // 輸入上限取兩者最大值，讓玩家自由輸入買或賣的數量
      input.max = Math.max(maxBuy, maxSell);
      if (parseInt(input.value) > input.max)
        input.value = Math.max(1, input.max);
    } else {
      // 單人模式
      input.max = count;
      if (parseInt(input.value) > count) input.value = Math.max(1, count);
      buyBtn.disabled = count <= 0;
    }
  }
};

window.executePurchase = function () {
  const symbol = currentSelectedSymbol;
  if (!symbol) return;

  const qty = parseInt(document.getElementById("conv-qty-input").value, 10);
  const costPerUnit = ATOMIC_WEIGHT[symbol] || 0;
  const totalCost = qty * costPerUnit;

  if (isNaN(qty) || qty <= 0 || totalCost > multiPlayerPoints) {
    alert("點數不足或數量錯誤！");
    return;
  }

  // ★ 扣除點數並明確加入當前玩家 (activePIdx) 的背包
  multiPlayerPoints -= totalCost;
  chemStates[activePIdx].points = multiPlayerPoints; // 確保寫回狀態
  addAtom(symbol, qty, activePIdx);

  // 更新介面
  updateInventoryUI();
  const ptsDisplay = document.getElementById("chem-mp-points");
  if (ptsDisplay) {
    ptsDisplay.innerText = Math.floor(multiPlayerPoints);
  }
  // ★ 新增這行：強制重新渲染配方卡片，讓達到條件的技能瞬間亮起！
  if (typeof renderShopCards === "function") renderShopCards();
};

window.executeConversion = function () {
  const symbol = currentSelectedSymbol;
  if (!symbol) return;
  const currentCount = getAtomCount(symbol);
  const qty = parseInt(document.getElementById("conv-qty-input").value, 10);
  const resultArea = document.getElementById("conv-result-area");

  if (isNaN(qty) || qty <= 0 || qty > currentCount) {
    resultArea.style.alignItems = "center";
    resultArea.innerHTML = `<div style="color:#d96c8e; font-weight:900; text-align:center;">數量錯誤或不足</div>`;
    return;
  }

  chemInventory[symbol] -= qty;
  const conversionResult = runConversion(symbol, qty);

  if (!conversionResult.success) {
    resultArea.style.alignItems = "center";
    let failHtml = `<div style="font-size:12px; line-height:1.6; color:#d96c8e; text-align:center; font-weight:900;">`;

    if (conversionResult.reason === "instability") {
      if (conversionResult.inputWeight >= 3000) {
        const unaffordableSkills = chemSkills.filter((skill) => {
          for (const [sym, num] of Object.entries(skill.elements)) {
            if (getAtomCount(sym) < num) return true;
          }
          return false;
        });
        if (unaffordableSkills.length > 0) {
          const luckySkill =
            unaffordableSkills[
              Math.floor(Math.random() * unaffordableSkills.length)
            ];
          failHtml += `巨大的能量摧毀了材料，但獲得了靈感！<br>解鎖：${luckySkill.name}`;
          for (const [sym, num] of Object.entries(luckySkill.elements)) {
            const missing = num - getAtomCount(sym);
            if (missing > 0) addAtom(sym, missing);
          }
        } else {
          failHtml += `引發罕見空間震盪，材料潰散。`;
        }
      } else {
        failHtml += `質量不足以維持穩定，材料潰散。<br>(崩潰率: ${(conversionResult.failProb * 100).toFixed(1)}%)`;
      }
    } else {
      failHtml += `材料經損耗後，連一顆最輕元素都湊不出。`;
    }

    failHtml += `</div>`;
    resultArea.innerHTML = failHtml;
    updateInventoryUI();
    renderShopCards();
    return;
  }

  // 成功時，取消置中對齊，改用 3x2 Grid 滿版佈局，移除「轉換成功」標題
  resultArea.style.alignItems = "stretch";
  let successHtml = `<div class="conv-result-grid">`;

  for (const [outSym, outQty] of Object.entries(conversionResult.output)) {
    addAtom(outSym, outQty);
    const outName = ELEMENT_DATA[outSym] ? ELEMENT_DATA[outSym][0] : outSym;
    successHtml += `<div class="conv-result-item"><span>✨ ${outName}</span><b>x${outQty}</b></div>`;
  }
  successHtml += `</div>`;

  resultArea.innerHTML = successHtml;
  updateInventoryUI();
  if (typeof renderShopCards === "function") renderShopCards();
};

// ==========================================
// 重構：動態渲染 3 個網格
// ==========================================
window.renderPeriodicTable = function () {
  renderGrid(PT_GRID, "chem-pt-grid");
  renderGrid(LANTHANIDES, "chem-lanthanides-grid");
  renderGrid(ACTINIDES, "chem-actinides-grid");

  const ptGrid = document.getElementById("chem-pt-grid");
  if (ptGrid) {
    const dashboard = document.createElement("div");
    dashboard.className = "chem-conversion-dashboard";

    // ★ 依據模式渲染不同介面
    if (currentGameMode === 2) {
      dashboard.innerHTML = `
        <div class="conv-col conv-col-1" id="conv-selected-area">
          <div class="conv-title"><span class="conv-icon">🛒</span>元素購買</div>
          <div id="conv-element-wrapper" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
            <div style="color:#a39ead; font-size:16px; font-weight:900; opacity:0.3; pointer-events:none;">目標元素</div>
          </div>
        </div>
        
        <!-- 第二欄：只保留數量輸入框，並且垂直置中 -->
        <div class="conv-col conv-col-2" style="justify-content: center;">
          <input type="number" id="conv-qty-input" min="1" placeholder="數量" disabled style="margin: 0; width: 85%;">
        </div>
        
        <!-- 第三欄：改為橫向排列 [購買] [點數] [出售] -->
        <div class="conv-col conv-col-3" id="conv-result-area" style="flex-direction: row; align-items: center; justify-content: space-evenly; padding: 10px 5px;">
          <button id="conv-buy-btn" class="conv-action-btn" disabled onclick="executePurchase()" style="width: 25%; margin: 0;">購買</button>
          
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div style="color:#a39ead; font-size:13px; font-weight:900;">剩餘點數</div>
            <div id="chem-mp-points" style="color:#666; font-size:32px; font-family:'Orbitron'; font-weight:900; margin-top:2px;">${Math.floor(multiPlayerPoints)}</div>
          </div>
          
          <button id="conv-sell-btn" class="conv-action-btn sell-btn" disabled onclick="executeSell()" style="width: 25%; margin: 0;">出售</button>
        </div>
      `;
    } else {
      // 保持原本的轉換爐介面...
      dashboard.innerHTML = `
        <div class="conv-col conv-col-1" id="conv-selected-area">
          <div class="conv-title"><span class="conv-icon">♻️</span>轉換爐</div>
          <div id="conv-element-wrapper" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
            <div style="color:#a39ead; font-size:16px; font-weight:900; opacity:0.3; pointer-events:none;">目標元素</div>
          </div>
        </div>
        <div class="conv-col conv-col-2">
          <input type="number" id="conv-qty-input" min="1" placeholder="數量" disabled>
          <button class="conv-action-btn" id="conv-execute-btn" disabled onclick="executeConversion()">⇅ 轉換</button>
        </div>
        <div class="conv-col conv-col-3" id="conv-result-area" style="align-items: center;">
          <div style="color:#a39ead; font-size:20px; font-weight:900; opacity:0.3; pointer-events:none;">輸出結果</div>
        </div>
      `;
    }
    ptGrid.appendChild(dashboard);
  }
};

function renderGrid(symbols, containerId) {
  const gridEl = document.getElementById(containerId);
  if (!gridEl) return;
  gridEl.innerHTML = "";

  symbols.forEach((symbol) => {
    if (!symbol) {
      gridEl.appendChild(document.createElement("div"));
      return;
    }

    const count = getAtomCount(symbol);
    const isOwned = count > 0;
    const [zhName, category] = ELEMENT_DATA[symbol] || [symbol, "unknown"];
    const atomicNum = ATOMIC_NUMBER[symbol] || "";
    const atomicWeight =
      ATOMIC_WEIGHT[symbol] ? ATOMIC_WEIGHT[symbol].toFixed(1) : "";

    const elDiv = document.createElement("div");
    elDiv.className = `pt-element ${category} ${isOwned ? "owned" : "empty"}`;
    elDiv.dataset.symbol = symbol;

    // ★ 移除原有的 convert-overlay，改為整個區塊 onClick 綁定
    elDiv.innerHTML = `
      <div class="pt-top-row">
        <span class="pt-atomic-num">${atomicNum}</span>
        <span class="pt-atomic-weight">${atomicWeight}</span>
      </div>
      <div class="pt-center-content">
        <span class="pt-name">${zhName}</span>
        <span class="pt-symbol">${symbol}</span>
      </div>
      <div class="pt-quantity">數量：${count}</div>
    `;

    // 綁定點擊事件，將元素帶入面板
    elDiv.onclick = () => selectElementForConversion(symbol);
    gridEl.appendChild(elDiv);
  });
}

// ==========================================
// 輔助函式：自動解析化學式，指派不同顏色，並將數字下標(黑)
// ==========================================
function formatColorizedFormula(formula) {
  const regex = /([A-Z][a-z]*)(\d*)/g;
  let html = "";
  let match;
  const subscripts = "₀₁₂₃₄₅₆₇₈₉";

  // 準備一組清晰明視度高的色板供元素依序使用
  const palette = [
    "#5FA8D3",
    "#D96C8E",
    "#43A047",
    "#E67E22",
    "#8E24AA",
    "#F6A6C1",
  ];
  const elementColorMap = {};
  let colorIndex = 0;

  while ((match = regex.exec(formula)) !== null) {
    const element = match[1];
    const count = match[2];
    if (!element) continue;

    // 若該元素還沒被分配顏色，則依序分配一個
    if (!elementColorMap[element]) {
      elementColorMap[element] = palette[colorIndex % palette.length];
      colorIndex++;
    }
    const color = elementColorMap[element];

    // 處理黑色下標數字
    let countStr = "";
    if (count) {
      const subStr = count
        .split("")
        .map((d) => subscripts[d])
        .join("");
      countStr = `<span style="color: #222;">${subStr}</span>`;
    }

    html += `<span style="color: ${color};">${element}</span>${countStr}`;
  }
  return html;
}

// 新增狀態變數
let currentCategory = "all";

// 在檔案某處將 toggleFurnace 綁定到 window，讓 HTML 可以呼叫
window.toggleFurnace = function () {
  const btn = document.getElementById("chem-furnace-btn");
  if (btn) btn.classList.toggle("collapsed");
};

function initTabs() {
  const tabsContainer = document.querySelector(".chem-tabs");
  if (!tabsContainer) return;

  // 1. 從 JSON 抓出所有不重複的動態分類
  const uniqueCategories = [...new Set(chemSkills.map((s) => s.category))];

  // ★ 建立指定的分類排序順序
  const desiredOrder = ["攻擊", "防禦", "輔助", "控制", "特殊", "實驗"];

  // ★ 依照指定順序排序，若有未定義的新分類則排到最後面
  const categories = uniqueCategories.sort((a, b) => {
    let indexA = desiredOrder.indexOf(a);
    let indexB = desiredOrder.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  // 2. 先寫死絕對固定的功能性標籤
  let tabsHTML = `
    <button class="chem-tab active" data-category="all">全部</button>
    <button class="chem-tab" data-category="owned">🎒 已擁有</button>
    <button class="chem-tab" data-category="unlockable">🔓 可解鎖</button>
  `;

  // 3. 依照排序後的分類依序生成頁籤，並補上對應 Emoji
  categories.forEach((cat) => {
    let icon = "🧪"; // 預設圖示
    if (cat === "攻擊") icon = "⚔️";
    if (cat === "防禦") icon = "🛡️";
    if (cat === "輔助") icon = "💖";
    if (cat === "控制") icon = "⏳";
    if (cat === "特殊") icon = "✨";
    if (cat === "實驗") icon = "⚠️";

    tabsHTML += `<button class="chem-tab" data-category="${cat}">${icon} ${cat}</button>`;
  });

  // 一次性渲染到畫面上
  tabsContainer.innerHTML = tabsHTML;

  // 4. 重新綁定點擊事件，並確保切換時頁碼歸零
  document.querySelectorAll(".chem-tab").forEach((tab) => {
    tab.onclick = (e) => {
      document
        .querySelectorAll(".chem-tab")
        .forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");
      currentCategory = e.target.dataset.category;
      currentShopPage = 0; // 切換分類時，強制回到第一頁
      renderShopCards();
    };
  });
}

function renderShopCards() {
  const container = document.getElementById("chem-skill-cards-container");
  if (!container) return;
  container.innerHTML = "";

  // 1. 先將全域技能依照分子量 (molecularWeight) 由小到大排序
  const sortedAllSkills = [...chemSkills].sort(
    (a, b) => a.molecularWeight - b.molecularWeight,
  );

  // 2. ★ 更新過濾邏輯：支援「已擁有」與「可解鎖」
  let displaySkills = sortedAllSkills.filter((skill) => {
    const isUnlocked = unlockedSkills.includes(skill.id);

    // 提前計算是否買得起
    let canAfford = true;
    for (const [sym, num] of Object.entries(skill.elements)) {
      if (getAtomCount(sym) < num) canAfford = false;
    }

    if (currentCategory === "owned") return isUnlocked;
    if (currentCategory === "unlockable") return !isUnlocked && canAfford;
    if (currentCategory === "all") return true;
    return skill.category === currentCategory;
  });

  // 如果正在選擇裝備，過濾掉未解鎖的技能
  if (isEquippingMode) {
    displaySkills = displaySkills.filter((skill) =>
      unlockedSkills.includes(skill.id),
    );
  }

  // 3. 計算總頁數並防呆
  const totalPages = Math.max(
    1,
    Math.ceil(displaySkills.length / CARDS_PER_PAGE),
  );
  if (currentShopPage >= totalPages) currentShopPage = totalPages - 1;

  // 4. 更新左右翻頁按鈕狀態
  const prevBtn = document.getElementById("shop-prev-btn");
  const nextBtn = document.getElementById("shop-next-btn");
  if (prevBtn) prevBtn.disabled = currentShopPage === 0;
  if (nextBtn) nextBtn.disabled = currentShopPage >= totalPages - 1;

  // 5. 切割出當前頁面的 10 張卡片
  const paginatedSkills = displaySkills.slice(
    currentShopPage * CARDS_PER_PAGE,
    (currentShopPage + 1) * CARDS_PER_PAGE,
  );

  // 6. 渲染卡片
  paginatedSkills.forEach((skill, pageIndex) => {
    // ★ 修正：先確認是否已解鎖，再來判定等級 (防呆：若解鎖但沒等級，預設為 Lv.1)
    const isUnlocked = unlockedSkills.includes(skill.id);
    const currentLv = isUnlocked ? Math.max(1, skillLevels[skill.id] || 1) : 0;
    const isEquipped = equippedSkills.includes(skill.id);
    const upgradeMult = isUnlocked ? currentLv + 1 : 1; // 下一級的倍率
    const nextCost = skill.cost * upgradeMult;

    let canAfford = true;
    for (const [sym, num] of Object.entries(skill.elements)) {
      if (getAtomCount(sym) < num * upgradeMult) canAfford = false;
    }

    // 取得該技能在全域「強度排名」中的絕對編號
    const absoluteIndex = sortedAllSkills.indexOf(skill) + 1;

    let pureFormula = skill.formula;
    let zhName = "";
    if (skill.formula.includes("(")) {
      const parts = skill.formula.split("(");
      pureFormula = parts[0];
      zhName = parts[1].replace(")", "");
    }

    // ★ 判斷技能分類並給予對應圖示
    let catIcon = "🧪";
    if (skill.category === "攻擊") catIcon = "⚔️";
    if (skill.category === "防禦") catIcon = "🛡️";
    if (skill.category === "輔助") catIcon = "💖";
    if (skill.category === "控制") catIcon = "⏳";
    if (skill.category === "特殊") catIcon = "✨";
    if (skill.category === "實驗") catIcon = "⚠️";

    // 將單/雙人說明換行並上色
    let formattedDesc = (skill.description || "暫無說明")
      .replace(
        / ?【單人】/g,
        "<br><span style='color: #9dd9e8; font-weight: 900;'>【單人】</span>",
      )
      .replace(
        / ?【多人】/g,
        "<br><span style='color: #f6a6c1; font-weight: 900;'>【多人】</span>",
      );
    if (formattedDesc.startsWith("<br>"))
      formattedDesc = formattedDesc.substring(4);

    // 計算式
    let horizontalCalc = "";
    if (skill.tooltipText) {
      horizontalCalc = skill.tooltipText.replace(/,|\n/gi, "&nbsp;+&nbsp;");
    } else {
      horizontalCalc = `分子量 ${skill.molecularWeight} × 1 = ${skill.cost}`;
    }

    formattedDesc += `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #8a7e9c; color: #c9b1e8; font-size: 11px;">⚖️ 分子量：${horizontalCalc}</div>`;

    let cardStateClass =
      isEquipped ? "equipped"
      : isUnlocked ? "unlocked"
      : canAfford ? "affordable"
      : "unaffordable";
    const card = document.createElement("div");
    card.className = `chem-skill-card ${cardStateClass}`;
    const colorizedFormulaHTML = formatColorizedFormula(pureFormula);
    const tooltipDirectionClass = pageIndex < 5 ? "show-down" : "show-up";

    // ==========================================
    // ★ 新增：產生右下角的狀態按鈕或圖示 HTML
    // ==========================================
    let statusHtml = "";
    if (currentGameMode === 2) {
      // 多人模式：點數購買/升級
      const canAffordBtn = multiPlayerPoints >= nextCost;
      const btnColor =
        canAffordBtn ?
          isUnlocked ? "#83e6cf"
          : "#9dd9e8"
        : "#cbd5e1";
      statusHtml = `
        <button style="position: absolute; bottom: 8px; right: 8px; background: ${btnColor}; color: white; border: none; border-radius: 4px; padding: 3px 6px 3px 3px; font-size: 13px; font-weight: 900; cursor: ${canAffordBtn ? "pointer" : "not-allowed"}; z-index: 10;" 
                onclick="window.quickBuySkill('${skill.id}', event)">
          ${isUnlocked ? "⤴️" : "🛒"} ${nextCost}
        </button>`;
    } else {
      // 單人模式：原子解鎖/升級
      statusHtml =
        isUnlocked ?
          `<div style="position: absolute; bottom: 8px; right: 8px; font-size: 13px; opacity: 0.8;">${isEquipped ? "🟢" : "🧬"}${skill.cost}</div>`
        : `<div style="position: absolute; bottom: 8px; right: 8px; font-size: 13px; opacity: 0.5;">🔒${skill.cost}</div>`;
    }

    // ★ 補回遺失的願望清單星星狀態計算
    const isWished = chemStates[activePIdx].wishlist.includes(skill.id);
    const starColor = isWished ? "#F6D98B" : "#cbd5e1";
    const starOpacity = isWished ? "1" : "0.4";

    // ★ 將星星按鈕放在 card.innerHTML 的最開頭
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="chem-card-title" style="font-size: 16px; max-width: 65%;">${catIcon} ${skill.name} <span style="color:#d96c8e; font-size:12px; margin-left:4px;">Lv.${currentLv || 1}</span></span>
        <span style="position: absolute; top: 6px; right: 8px; font-size: 20px; color: ${starColor}; opacity: ${starOpacity}; cursor: pointer; z-index: 10; transition: 0.2s;" onclick="window.toggleWishlist('${skill.id}', event)">★</span>
      </div>
      <div style="margin: 5px 0; text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <span style="font-family: serif; font-size: 24px; font-weight: 900; letter-spacing: 1px;">${colorizedFormulaHTML}</span>
        <span style="font-size: 12px; color: #8a7e9c; font-weight: 900; margin-top: 2px;">(${zhName})</span>
      </div>
      <div class="chem-card-index">${absoluteIndex}</div>
      
      ${statusHtml}
      
      <div class="chem-card-tooltip ${tooltipDirectionClass}">${formattedDesc}</div>
    `;

    card.onclick = () => {
      if (isEquippingMode && activeEquipSlotIndex !== null) {
        if (isUnlocked && !isEquipped) {
          if (equipSkill(skill.id, activeEquipSlotIndex)) {
            isEquippingMode = false;
            activeEquipSlotIndex = null;
            renderEquippedSlots();
            renderShopCards();
          }
        }
      } else {
        if (isUnlocked) {
          // ★ 單人模式點擊已解鎖卡片時，檢查是否要升級
          if (currentGameMode === 1 && canAfford) {
            if (
              confirm(
                `【${skill.name}】目前為 Lv.${currentLv}。\n是否消耗 ${upgradeMult} 倍元素，將其升級至 Lv.${currentLv + 1}？`,
              )
            ) {
              for (const [sym, num] of Object.entries(skill.elements)) {
                chemInventory[sym] -= num * upgradeMult;
              }
              skillLevels[skill.id] = currentLv + 1;
              chemStates[activePIdx].levels = skillLevels;
              updateInventoryUI();
              renderShopCards();
              return; // 升級完直接返回，不執行下方的亮起邏輯
            }
          }

          // 原本的亮起週期表邏輯 (不想升級或點數不足時，單純亮起提示)
          document
            .querySelectorAll(".chem-skill-card")
            .forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          document
            .querySelectorAll(".pt-element")
            .forEach((el) => el.classList.remove("highlight"));
          Object.keys(skill.elements).forEach((sym) => {
            const ptEl = document.querySelector(
              `.pt-element[data-symbol="${sym}"]`,
            );
            if (ptEl) ptEl.classList.add("highlight");
          });
        } else if (canAfford) {
          if (confirm(`是否消耗元素解鎖技能【${skill.name}】？`)) {
            for (const [sym, num] of Object.entries(skill.elements)) {
              chemInventory[sym] -= num; // 初次解鎖是 1 倍
            }
            unlockedSkills.push(skill.id);
            skillLevels[skill.id] = 1; // ★ 紀錄為 Lv.1
            chemStates[activePIdx].levels = skillLevels;
            chemStates[activePIdx].unlocked = unlockedSkills;
            updateInventoryUI();
            renderShopCards();
          }
        }
      }
    };

    container.appendChild(card);
  });
}

// ==========================================
// 更新：渲染已裝備槽位
// ==========================================
function renderEquippedSlots() {
  const container = document.getElementById("chem-equipped-slots");
  if (!container) return;
  container.innerHTML = "";

  // ★ 加入滑鼠懸停提示
  container.title = "只能裝備已解鎖的技能，使用背包擁有的元素購買解鎖技能。";

  // ★ 判斷模式：單人3槽，多人5槽
  const maxSlots = currentGameMode === 1 ? 5 : 3;

  for (let i = 0; i < maxSlots; i++) {
    const slotId = equippedSkills[i];
    const slot = document.createElement("div");

    const isActiveSlot = isEquippingMode && activeEquipSlotIndex === i;
    let slotClass = `chem-slot ${slotId ? "filled" : ""}`;
    if (isActiveSlot) slotClass += " equipping-active";
    slot.className = slotClass;

    const priorityBadge = `<div class="slot-priority">${i + 1}</div>`;

    if (slotId) {
      const skill = getSkillData(slotId);
      const colorizedFormulaHTML = formatColorizedFormula(skill.formula);
      slot.innerHTML = `${priorityBadge}<span style="font-family: serif; font-weight: 900; font-size: 15px;">${colorizedFormulaHTML}</span>`;
    } else {
      const icon = isActiveSlot ? "×" : "+";
      const iconColor = isActiveSlot ? "#d96c8e" : "inherit";
      slot.innerHTML = `${priorityBadge}<span style="font-size: 28px; color: ${iconColor};">${icon}</span>`;
    }

    slot.onclick = () => {
      if (slotId) {
        unequipSkill(slotId);
        isEquippingMode = false;
        activeEquipSlotIndex = null;
      } else {
        if (isActiveSlot) {
          isEquippingMode = false;
          activeEquipSlotIndex = null;
        } else {
          isEquippingMode = true;
          activeEquipSlotIndex = i;
        }
      }
      renderEquippedSlots();
      renderShopCards();
    };
    container.appendChild(slot);
  }
}
// 確保 updateInventoryUI 被呼叫時能順便刷新第一欄與按鈕狀態
export function updateInventoryUI() {
  document.querySelectorAll(".pt-element").forEach((el) => {
    const symbol = el.dataset.symbol;
    if (!symbol) return;
    const count = getAtomCount(symbol);
    const qtySpan = el.querySelector(".pt-quantity");
    if (qtySpan) qtySpan.innerText = `數量：${count}`;
    if (count > 0) {
      el.classList.remove("empty");
      el.classList.add("owned");
    } else {
      el.classList.remove("owned");
      el.classList.add("empty");
    }
  });
  if (typeof refreshDashboard === "function") refreshDashboard();
}

// 記得在載入完 HTML 後呼叫 initTabs()
export function renderChemistryUI() {
  initTabs(); // 綁定頁籤
  renderPeriodicTable();
  renderShopCards();
  renderEquippedSlots();
}

// ==========================================
// 測試專用區塊：綁定到 window 讓 Console 可以呼叫
// ==========================================
window.testAddAtom = function (symbol, amount) {
  addAtom(symbol, amount);
  updateInventoryUI();
  console.log(`✅ 已獲得 ${amount} 個 ${symbol}！請查看畫面。`);
};

// ==========================================
// 元素轉換爐：核心演算法
// ==========================================
const CONVERSION_BASELINE_RATIO = 0.8;
const BRANCH_SAFE_PROBABILITY = 0.8;
const MAX_OUTPUT_TYPES = 5;
const MAX_QUANTITY_PER_TYPE = 100;
const MIN_TYPE_RATIO = 0.5;
const JACKPOT_DECAY_CONSTANT = 0.05;
const SAFE_DECAY_CONSTANT = 0.04;
const MIN_FILL_RATIO = 0.5;
const MAX_FILL_RETRIES = 3;

// ★ 新增：爐心穩定度常數
const MIN_STABLE_WEIGHT = 5; // 總原子量低於此值 100% 失敗
const INSTABILITY_DECAY_CONSTANT = 0.05; // 失敗率衰減速度
const GLOBAL_MIN_FAIL_RATE = 0.02; // ★ 全域保底失敗率 2%

function runConversion(inputSymbol, inputQuantity) {
  const inputWeight = ATOMIC_WEIGHT[inputSymbol] || 0;
  const totalInputWeight = inputQuantity * inputWeight;

  let failProb = 1.0;
  if (totalInputWeight > MIN_STABLE_WEIGHT) {
    failProb = Math.exp(
      -INSTABILITY_DECAY_CONSTANT * (totalInputWeight - MIN_STABLE_WEIGHT),
    );
  }

  // ★ 加上 2% 硬下限
  failProb = Math.max(GLOBAL_MIN_FAIL_RATE, failProb);

  if (Math.random() < failProb) {
    return {
      success: false,
      output: {},
      reason: "instability",
      failProb: failProb,
      inputWeight: totalInputWeight, // ★ 回傳投入總量，供 UI 判斷是否給安慰獎
    };
  }

  // (沒失敗才繼續執行原本的轉換邏輯)
  const validElements = new Set();
  chemSkills.forEach((skill) =>
    Object.keys(skill.elements).forEach((sym) => validElements.add(sym)),
  );
  validElements.delete(inputSymbol);
  const candidatePool = Array.from(validElements);

  const baseline = totalInputWeight * CONVERSION_BASELINE_RATIO;
  let result = {};

  function closenessWeights(pool, decayConstant) {
    let totalWeight = 0;
    const weights = pool.map((sym) => {
      const diff = Math.abs(inputWeight - (ATOMIC_WEIGHT[sym] || 0));
      const w = Math.exp(-decayConstant * diff);
      totalWeight += w;
      return { sym, w };
    });
    return { weights, totalWeight };
  }

  function weightedPick(weights, totalWeight) {
    let roll = Math.random() * totalWeight;
    let current = 0;
    for (const item of weights) {
      current += item.w;
      if (roll <= current) return item.sym;
    }
    return weights[weights.length - 1].sym;
  }

  let isJackpot = Math.random() > BRANCH_SAFE_PROBABILITY;

  if (isJackpot) {
    const jackpotCandidates = candidatePool.filter(
      (sym) => (ATOMIC_WEIGHT[sym] || 0) > baseline,
    );
    if (jackpotCandidates.length === 0) {
      isJackpot = false;
    } else {
      let totalWeight = 0;
      const weights = jackpotCandidates.map((sym) => {
        const w = Math.exp(
          -JACKPOT_DECAY_CONSTANT * ((ATOMIC_WEIGHT[sym] || 0) - baseline),
        );
        totalWeight += w;
        return { sym, w };
      });
      const picked = weightedPick(weights, totalWeight);
      result[picked] = 1;
    }
  }

  if (!isJackpot) {
    let success = false;
    const avgCandidateWeight =
      candidatePool.reduce((sum, sym) => sum + (ATOMIC_WEIGHT[sym] || 0), 0)
      / (candidatePool.length || 1);

    const dynamicMaxTypes = Math.max(
      1,
      Math.min(
        MAX_OUTPUT_TYPES,
        Math.floor(baseline / (avgCandidateWeight || 1)),
      ),
    );
    const dynamicMinTypes = Math.max(
      1,
      Math.min(dynamicMaxTypes, Math.ceil(dynamicMaxTypes * MIN_TYPE_RATIO)),
    );

    for (let retry = 0; retry < MAX_FILL_RETRIES && !success; retry++) {
      let tempResult = {};
      let currentFill = 0;
      let pool = [...candidatePool];
      const k =
        dynamicMinTypes
        + Math.floor(Math.random() * (dynamicMaxTypes - dynamicMinTypes + 1));
      let selectedTypes = [];

      for (let i = 0; i < k; i++) {
        if (pool.length === 0) break;
        const { weights, totalWeight } = closenessWeights(
          pool,
          SAFE_DECAY_CONSTANT,
        );
        const picked = weightedPick(weights, totalWeight);
        selectedTypes.push(picked);
        pool.splice(pool.indexOf(picked), 1);
      }

      let remaining = baseline;
      for (let i = 0; i < selectedTypes.length; i++) {
        const sym = selectedTypes[i];
        const symW = ATOMIC_WEIGHT[sym] || 0;
        const typesLeft = selectedTypes.length - i;
        const share = remaining / typesLeft;
        if (symW === 0) continue;

        const qty = Math.min(Math.floor(share / symW), MAX_QUANTITY_PER_TYPE);
        const actualValue = qty * symW;

        if (qty > 0) {
          tempResult[sym] = qty;
          currentFill += actualValue;
        }
        remaining -= actualValue;
      }

      if (currentFill >= baseline * MIN_FILL_RATIO) {
        result = tempResult;
        success = true;
      }
    }

    if (!success) {
      const fallbackCandidates = candidatePool.filter(
        (sym) =>
          (ATOMIC_WEIGHT[sym] || 0) > 0
          && (ATOMIC_WEIGHT[sym] || 0) <= baseline,
      );
      if (fallbackCandidates.length > 0) {
        const { weights, totalWeight } = closenessWeights(
          fallbackCandidates,
          SAFE_DECAY_CONSTANT,
        );
        const fallbackElement = weightedPick(weights, totalWeight);
        const w = ATOMIC_WEIGHT[fallbackElement] || 1;

        const qty = Math.min(Math.floor(baseline / w), MAX_QUANTITY_PER_TYPE);
        result[fallbackElement] = Math.max(qty, 1);
      }
    }
  }

  const hasOutput = Object.keys(result).length > 0;
  return {
    success: hasOutput,
    output: result,
    reason: hasOutput ? "success" : "too_small", // 區分因為量太小湊不出來的失敗
  };
}

window.executeSell = function () {
  const symbol = currentSelectedSymbol;
  if (!symbol) return;

  const count = getAtomCount(symbol);
  const qty = parseInt(document.getElementById("conv-qty-input").value, 10);
  const costPerUnit = ATOMIC_WEIGHT[symbol] || 0;
  const totalEarned = qty * costPerUnit;

  if (isNaN(qty) || qty <= 0 || qty > count) {
    alert("持有數量不足或輸入錯誤！");
    return;
  }

  // 扣除背包元素並返還點數
  chemInventory[symbol] -= qty;
  multiPlayerPoints += totalEarned;
  chemStates[activePIdx].points = multiPlayerPoints; // ★ 確保寫回狀態

  updateInventoryUI();
  const ptsDisplay = document.getElementById("chem-mp-points");
  if (ptsDisplay) {
    ptsDisplay.innerText = Math.floor(multiPlayerPoints);
  }
  // ★ 新增這行：賣掉元素後也要重新渲染卡片，避免誤判為可解鎖
  if (typeof renderShopCards === "function") renderShopCards();
};

// ==========================================
// ★ 快捷購買與裝備 UI 即時刷新修補引擎
// ==========================================
window.quickBuySkill = function (skillId, event) {
  event.stopPropagation();
  const skill = chemSkills.find((s) => s.id === skillId);
  if (!skill) return;

  const currentLv = skillLevels[skillId] || 0;
  const upgradeMult = currentLv === 0 ? 1 : currentLv + 1;
  const nextCost = skill.cost * upgradeMult;
  const btn = event.target;

  if (currentGameMode === 2) {
    if (multiPlayerPoints >= nextCost) {
      // 1. 成功扣款與升級
      multiPlayerPoints -= nextCost;
      chemStates[activePIdx].points = multiPlayerPoints;

      skillLevels[skillId] = upgradeMult; // 寫入新等級
      chemStates[activePIdx].levels = skillLevels;

      if (!unlockedSkills.includes(skillId)) {
        unlockedSkills.push(skillId);
        chemStates[activePIdx].unlocked = unlockedSkills;
      }

      // 2. 更新畫面右下角的點數顯示 UI
      const ptsDisplay = document.getElementById("chem-mp-points");
      if (ptsDisplay) ptsDisplay.innerText = Math.floor(multiPlayerPoints);

      // 3. 觸發音效與立即重新渲染 (卡片會自動更新為下一級的價格與狀態)
      if (window.playSfx) window.playSfx("star");
      if (typeof renderShopCards === "function") renderShopCards();
      if (typeof refreshDashboard === "function") refreshDashboard();
    } else {
      // 點數不足防呆動畫 (只有真正買不起時才會觸發)
      const originalText = btn.innerText; // 記住原本是寫 "解鎖" 還是 "升級"
      btn.innerText = "點數不足";
      btn.style.background = "#e57373";
      setTimeout(() => {
        btn.innerText = originalText; // 恢復原本的文字，而不是寫死的解鎖價格
        btn.style.background = currentLv > 0 ? "#7ed6c3d4" : "#6de2ff";
      }, 1000);
    }
  }
};

// ★ 攔截原版的裝備動作，補上強制存檔與刷新
const originalToggleEquip = window.toggleEquip;
if (originalToggleEquip) {
  window.toggleEquip = function (...args) {
    originalToggleEquip(...args);
    chemStates[activePIdx].equipped = equippedSkills; // 確保 2P 裝備存檔
    if (typeof renderShopTab === "function") renderShopCards();
    if (typeof renderEquippedSlots === "function") renderEquippedSlots();
  };
}

// ==========================================
// ★ 開發者快速測試外掛 (滿元素 + 全解鎖)
// ==========================================
window.cheatMaxAtoms = function (amount = 100) {
  // 1. 發放全元素
  Object.keys(ELEMENT_DATA).forEach((sym) => {
    if (chemStates[0]) chemStates[0].inventory[sym] = amount;
    if (chemStates[1]) chemStates[1].inventory[sym] = amount;
  });

  // 2. 獲取所有技能 ID 並寫入雙方狀態與等級
  const allSkillIds = chemSkills.map((skill) => skill.id);
  if (chemStates[0]) {
    chemStates[0].unlocked = [...allSkillIds];
    chemStates[0].levels = chemStates[0].levels || {}; // ★ 安全防呆
    allSkillIds.forEach((id) => (chemStates[0].levels[id] = 1));
  }
  if (chemStates[1]) {
    chemStates[1].unlocked = [...allSkillIds];
    chemStates[1].levels = chemStates[1].levels || {}; // ★ 安全防呆
    allSkillIds.forEach((id) => (chemStates[1].levels[id] = 1));
  }

  // 3. 同步當前 UI 視角的陣列
  unlockedSkills.length = 0;
  unlockedSkills.push(...allSkillIds);
  allSkillIds.forEach((id) => (skillLevels[id] = 1)); // ★ 確保同步等級到全域

  // 4. 強制刷新畫面
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof renderShopCards === "function") renderShopCards();

  console.log(
    `✅ 已為所有玩家發放 ${amount} 個全元素，並【解鎖所有技能】為 Lv.1！`,
  );
};

// ==========================================
// ★ 關卡倍率與磚塊生命值演算器
// ==========================================
export function calculateBrickHP(symbol, currentLevel = 1) {
  let baseHp = 1;

  if (symbol && ELEMENT_DATA[symbol]) {
    const category = ELEMENT_DATA[symbol][1];

    // 依據化學屬性給予基礎 HP
    if (["nonmetal", "halogen", "noble"].includes(category)) {
      baseHp = Math.floor(Math.random() * 2) + 1; // 氣體與非金屬 (1-2)
    } else if (
      ["alkali", "alkaline", "main-metal", "metalloid"].includes(category)
    ) {
      baseHp = Math.floor(Math.random() * 3) + 4; // 主族與鹼土金屬 (4-6)
    } else if (["transition"].includes(category)) {
      baseHp = Math.floor(Math.random() * 6) + 10; // 過渡金屬 (10-15)
    } else if (["lanthanide", "actinide", "unknown"].includes(category)) {
      baseHp = Math.floor(Math.random() * 11) + 20; // 放射性與超重元素 (20-30)
    }
  } else {
    // 預設無元素的一般磚塊
    baseHp = 2;
  }

  // 關卡倍率：每關增加 0.15 倍
  const levelMultiplier = 1 + (currentLevel - 1) * 0.15;

  // 回傳最終 HP (四捨五入，且最少為 1)
  return Math.max(1, Math.round(baseHp * levelMultiplier));
}
