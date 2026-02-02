import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

let cachedServers = {};
let lastFetchTime = {};

// Robloxサーバー全件取得（空ページもスキップ）
async function fetchAllServers(placeId) {
  if (!cachedServers[placeId]) cachedServers[placeId] = [];
  let allServers = [];
  let cursor = null;

  try {
    do {
      let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url);
      const data = await res.json();

      // データが空でも cursor があれば次ページへ
      if (data && Array.isArray(data.data)) {
        allServers = allServers.concat(data.data);
      }

      cursor = data.nextPageCursor; // 空ページでも cursor 次ページがあれば進む
      if (cursor) await new Promise(r => setTimeout(r, 1000)); // API制限対策
    } while (cursor);

    cachedServers[placeId] = allServers;
    lastFetchTime[placeId] = Date.now();
  } catch (e) {
    console.error("Error fetching servers:", e.message);
  }

  return cachedServers[placeId];
}

// サーバー返却エンドポイント
app.get("/servers/:placeId", async (req, res) => {
  const placeId = req.params.placeId;
  try {
    // キャッシュが古い場合は再取得
    if (!cachedServers[placeId] || (Date.now() - (lastFetchTime[placeId]||0)) > 5000) {
      await fetchAllServers(placeId);
    }

    res.json({
      totalServers: cachedServers[placeId].length,
      data: cachedServers[placeId]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
