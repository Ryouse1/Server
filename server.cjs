const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const WAIT_MS = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * sortOrderごとに全ページ取得、失敗しても落ちない
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
        console.warn(`[WARN] fetch status ${res.status} for sortOrder=${sortOrder}`);
        break;
      }

      const data = await res.json();
      if (!data?.data || data.data.length === 0) {
        console.log("[END] empty data for", sortOrder);
        break;
      }

      results.push(...data.data);
      cursor = data.nextPageCursor;
      if (!cursor) break;

      await sleep(WAIT_MS);
    } catch (e) {
      console.warn("[WARN fetchBySort]", sortOrder, e.message);
      break; // 失敗しても落ちない
    }
  }

  return results;
}

/**
 * placeIdの全Publicサーバーを取得
 */
async function fetchAllServers(placeId) {
  let all = [];

  // Asc→NONE→Desc の順に取得
  const orders = ["Asc", null, "Desc"];

  for (const o of orders) {
    const servers = await fetchBySort(placeId, o);
    all.push(...servers);
  }

  // jobIdで重複除去
  const map = new Map();
  for (const s of all) if (s?.id) map.set(s.id, s);

  const unique = [...map.values()];
  console.log("[DONE]", placeId, "servers:", unique.length);

  return unique;
}

// ルート
app.get("/servers/:placeId", async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) return res.status(400).json({ error: "placeId required" });

  console.log("[REQUEST]", placeId);

  const servers = await fetchAllServers(placeId);

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
