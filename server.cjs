const express = require("express");
const app = express();

const PLACE_ID = process.env.PLACE_ID;
const PORT = process.env.PORT || 3000;

if (!PLACE_ID) {
  throw new Error("PLACE_ID is required");
}

/* ===============================
   内部キャッシュ
================================ */
const serverMap = new Map();

/* ===============================
   設定
================================ */
const BASE_URL = "https://games.roblox.com/v1/games";
const LIMIT = 100;
const INTERVAL = 5000; // 5秒

const queryPatterns = [
  { sortOrder: "Asc",  excludeFullGames: false },
  { sortOrder: "Desc", excludeFullGames: false },
  { sortOrder: "Asc",  excludeFullGames: true  },
  { sortOrder: "Desc", excludeFullGames: true  },
];

/* ===============================
   1パターン深掘り
================================ */
async function fetchDeep(pattern) {
  let cursor = null;

  while (true) {
    const params = new URLSearchParams({
      limit: LIMIT,
      sortOrder: pattern.sortOrder,
      excludeFullGames: pattern.excludeFullGames,
    });

    if (cursor) params.set("cursor", cursor);

    const url = `${BASE_URL}/${PLACE_ID}/servers/Public?${params}`;

    let json;
    try {
      const res = await fetch(url);
      json = await res.json();
    } catch {
      break;
    }

    if (!json?.data) break;

    for (const server of json.data) {
      serverMap.set(server.id, server);
    }

    if (!json.nextPageCursor) break;
    cursor = json.nextPageCursor;
  }
}

/* ===============================
   全攻撃ループ
================================ */
async function sweep() {
  for (const pattern of queryPatterns) {
    await fetchDeep(pattern);
  }
  console.log(`[sweep] servers=${serverMap.size}`);
}

/* ===============================
   定期更新
================================ */
setInterval(sweep, INTERVAL);
sweep();

/* ===============================
   API
================================ */
app.get("/servers", (req, res) => {
  res.json({
    count: serverMap.size,
    servers: [...serverMap.values()],
  });
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
