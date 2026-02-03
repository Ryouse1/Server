// server.cjs
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const BASE_URL = "https://games.roblox.com/v1/games";

/**
 * Public Servers を nextPageCursor で限界まで取得
 */
async function fetchAllServers(placeId) {
  let allServers = [];
  let cursor = null;
  let page = 0;

  while (true) {
    const url =
      `${BASE_URL}/${placeId}/servers/Public` +
      `?sortOrder=Asc` +
      `&limit=100` +
      `&excludeFullGames=false` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

    const res = await fetch(url);
    if (!res.ok) break;

    const json = await res.json();

    if (!json || !Array.isArray(json.data)) break;

    // data が空でも cursor があれば続行
    if (json.data.length > 0) {
      allServers.push(...json.data);
    }

    cursor = json.nextPageCursor;
    page++;

    // cursor が無くなったら終了
    if (!cursor) break;

    // Roblox API 保護（速すぎると死ぬ）
    await new Promise(r => setTimeout(r, 200));
  }

  return allServers;
}

/**
 * API
 */
app.get("/servers/:placeId", async (req, res) => {
  try {
    const placeId = req.params.placeId;
    const servers = await fetchAllServers(placeId);

    res.json({
      count: servers.length,
      data: servers
    });
  } catch (err) {
    res.status(500).json({
      error: String(err)
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Roblox proxy running on port", port);
});
