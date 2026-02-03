const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const WAIT_MS = 2000; // Roblox API制限対策

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      if (!res.ok) break;

      const json = await res.json();
      if (!json?.data || json.data.length === 0) break;

      results.push(...json.data);

      cursor = json.nextPageCursor;
      if (!cursor) break;

      await sleep(WAIT_MS);
    } catch (e) {
      console.error("[ERROR fetchBySort]", e.message);
      break;
    }
  }

  return results;
}

async function fetchAllServers(placeId) {
  const all = [];

  try {
    const none = await fetchBySort(placeId, null);
    const asc  = await fetchBySort(placeId, "Asc");
    const desc = await fetchBySort(placeId, "Desc");

    all.push(...none, ...asc, ...desc);

    // jobIdで重複除去
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

  res.json({
    total: servers.length,
    data: servers
  });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
