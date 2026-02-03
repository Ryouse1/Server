// server.cjs
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchUntilEnd(placeId, sortOrder) {
  let cursor = null;
  let lastCursor = "__START__";
  let all = [];

  while (true) {
    let url =
      `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100`;

    if (sortOrder) url += `&sortOrder=${sortOrder}`;
    if (cursor) url += `&cursor=${cursor}`;

    console.log("[FETCH]", sortOrder || "NONE", cursor || "START");

    let json;
    try {
      const res = await fetch(url); // Node22 global fetch
      json = await res.json();
    } catch (e) {
      console.error("[FETCH ERROR]", e.message);
      break;
    }

    // 終了条件①：データなし
    if (!json?.data || json.data.length === 0) {
      console.log("[END] empty data");
      break;
    }

    all.push(...json.data);

    // 終了条件②：cursorが無い
    if (!json.nextPageCursor) {
      console.log("[END] no cursor");
      break;
    }

    // 終了条件③：cursorが進んでない（無限防止）
    if (json.nextPageCursor === lastCursor) {
      console.log("[END] cursor stuck");
      break;
    }

    lastCursor = cursor;
    cursor = json.nextPageCursor;

    // API負荷対策
    await sleep(400);
  }

  return all;
}

app.get("/servers/:placeId", async (req, res) => {
  const placeId = req.params.placeId;
  console.log("[REQUEST]", placeId);

  try {
    // ① sortOrderなし（満員多め）
    // ② Asc（空き多め）
    // ③ Desc（補完）
    const [none, asc, desc] = await Promise.all([
      fetchUntilEnd(placeId, null),
      fetchUntilEnd(placeId, "Asc"),
      fetchUntilEnd(placeId, "Desc")
    ]);

    // jobId(id)で重複排除
    const map = new Map();
    [...none, ...asc, ...desc].forEach(s => {
      if (s && s.id) map.set(s.id, s);
    });

    const merged = Array.from(map.values());

    res.json({
      placeId,
      total: merged.length,
      breakdown: {
        none: none.length,
        asc: asc.length,
        desc: desc.length
      },
      data: merged
    });
  } catch (e) {
    console.error("[SERVER ERROR]", e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
