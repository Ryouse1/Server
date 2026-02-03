// server.cjs
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchAll(placeId, sortOrder) {
  let cursor = null;
  let servers = [];
  let page = 0;

  while (true) {
    let url =
      `https://games.roblox.com/v1/games/${placeId}/servers/Public` +
      `?limit=100&sortOrder=${sortOrder}`;

    if (cursor) url += `&cursor=${cursor}`;

    let json;
    try {
      const res = await fetch(url);
      json = await res.json();
    } catch {
      // 通信失敗 → スキップして次
      break;
    }

    if (!json || !Array.isArray(json.data)) break;
    if (json.data.length === 0) break;

    servers.push(...json.data);
    cursor = json.nextPageCursor;

    page++;
    if (!cursor) break;

    // API負荷対策
    await sleep(400);
    if (page > 50) break; // 無限防止
  }

  return servers;
}

app.get("/servers/:placeId", async (req, res) => {
  const placeId = req.params.placeId;

  try {
    // Asc + Desc 両取り
    const [asc, desc] = await Promise.all([
      fetchAll(placeId, "Asc"),
      fetchAll(placeId, "Desc")
    ]);

    // 重複排除（jobId基準）
    const map = new Map();
    [...asc, ...desc].forEach(s => {
      if (s && s.id) map.set(s.id, s);
    });

    const merged = Array.from(map.values());

    res.json({
      placeId,
      total: merged.length,
      asc: asc.length,
      desc: desc.length,
      data: merged
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
