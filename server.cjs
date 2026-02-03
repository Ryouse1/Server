const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const WAIT_MS = 2000; // API制限対策

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * sortOrderごとに全ページ取得
 */
async function fetchBySort(placeId, sortOrder) {
  let cursor = null;
  let results = [];

  while (true) {
    let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100`;
    if (sortOrder) url += `&sortOrder=${sortOrder}`;
    if (cursor) url += `&cursor=${cursor}`;

    console.log("[FETCH]", sortOrder || "NONE", cursor || "START");

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[ERROR] status", res.status);
        break;
      }

      const data = await res.json();
      if (!data?.data || data.data.length === 0) {
        console.log("[END] empty data");
        break;
      }

      results.push(...data.data);

      cursor = data.nextPageCursor;
      if (!cursor) break;

      await sleep(WAIT_MS); // API制限対策
    } catch (e) {
      console.error("[ERROR fetchBySort]", e.message);
      break;
    }
  }

  return results;
}

/**
 * placeIdの全Publicサーバーを取得
 * Asc優先で空き鯖を拾いやすくする
 */
async function fetchAllServers(placeId) {
  try {
    // Ascのみ先に取得して空き鯖優先
    const ascServers  = await fetchBySort(placeId, "Asc");
    const noneServers = await fetchBySort(placeId, null);
    const descServers = await fetchBySort(placeId, "Desc");

    let all = [...ascServers, ...noneServers, ...descServers];

    // 重複除去（jobIdで）
    const map = new Map();
    for (const s of all) if (s?.id) map.set(s.id, s);
    const unique = [...map.values()];

    console.log("[DONE]", placeId, "servers:", unique.length);
    return unique;
  } catch (e) {
    console.error("[ERROR fetchAllServers]", e.message);
    return [];
  }
}

// ルート
app.get("/servers/:placeId", async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) return res.status(400).json({ error: "placeId required" });

  console.log("[REQUEST]", placeId);

  const servers = await fetchAllServers(placeId);

  // 空きサーバー情報も含めて返す
  const formatted = servers.map(s => ({
    id: s.id,
    maxPlayers: s.maxPlayers,
    playing: s.playing,
    freeSlots: s.maxPlayers - s.playing,
    ping: s.ping || 0,
    fps: s.fps || 0,
    players: s.players || []
  }));

  res.json({
    total: formatted.length,
    data: formatted
  });
});

app.listen(PORT, () => console.log("Server running on port", PORT));
