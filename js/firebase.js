// 引入 Firebase 核心與 Firestore 功能 (使用現代的 ES Module 寫法)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyB2z6amb3oiyNGqgWPD0zpirBjRFKgI2DA",
    authDomain: "br99-83079.firebaseapp.com",
    projectId: "br99-83079",
    storageBucket: "br99-83079.firebasestorage.app",
    messagingSenderId: "133496392010",
    appId: "1:133496392010:web:d3e4cd5212a647472d59b3"
  };

// 初始化 Firebase 與 Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 1. 上傳分數到資料庫 (依據模式分開儲存)
// ==========================================
export async function uploadScore(playerName, score, gameLevel, isDLC) {
  try {
    // 依據是否開啟 DLC，存入不同的資料表
    const collectionName = isDLC ? "leaderboard_chem" : "leaderboard_basic";
    
    await addDoc(collection(db, collectionName), {
      playerName: playerName || "神秘玩家", 
      score: score,
      level: gameLevel,
      timestamp: serverTimestamp() 
    });
    console.log("✅ 分數上傳成功！");
    return true;
  } catch (e) {
    console.error("❌ 分數上傳失敗: ", e);
    return false;
  }
}

// ==========================================
// 2. 取得排行榜前 100 名 (支援切換模式)
// ==========================================
export async function getTopScores(isDLC) {
  try {
    const collectionName = isDLC ? "leaderboard_chem" : "leaderboard_basic";
    // ★ 將 limit 改為 100
    const q = query(collection(db, collectionName), orderBy("score", "desc"), limit(100));
    const querySnapshot = await getDocs(q);
    
    let leaderboardData = [];
    querySnapshot.forEach((doc) => {
      leaderboardData.push(doc.data());
    });
    
    return leaderboardData;
  } catch (e) {
    console.error("❌ 讀取排行榜失敗: ", e);
    return [];
  }
}