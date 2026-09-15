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
// 1. 上傳分數到資料庫 (uploadScore)
// ==========================================
export async function uploadScore(playerName, score, gameLevel) {
  try {
    // 寫入資料到名為 "leaderboard" 的集合
    await addDoc(collection(db, "leaderboard"), {
      playerName: playerName || "神秘玩家", // 防呆：沒填名字就給預設值
      score: score,
      level: gameLevel,
      timestamp: serverTimestamp() // 記錄伺服器當下時間
    });
    console.log("✅ 分數上傳成功！");
    return true;
  } catch (e) {
    console.error("❌ 分數上傳失敗: ", e);
    return false;
  }
}

// ==========================================
// 2. 取得排行榜前 10 名 (getTopScores)
// ==========================================
export async function getTopScores() {
  try {
    // 查詢條件：針對 leaderboard 集合，依 score 欄位由大到小排序，最多抓 10 筆
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
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