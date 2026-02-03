// server.cjs
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchSeries(placeId, sortOrder) {
  let cursor = null;
  let all = [];
  let page = 0;

  while (true) {
    let url =
      `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100`;

    if (sortOrder) url += `&sortOrder=${sortOrder}`;
    if (cursor) url += `&cursor=${cursor}`;

    console.log("[FETCH]", sortOrder || "NONE", url);

    let json;
    try {
      const res = await fetch(url); // Node22 global fetch
      json = await res.json();
    } catch (e) {
      console.error("[FETCH ERROR]", e.message);
      break;
    }

    if (!json || !Array.isArray(json.data) || json.data.length === 0) {
      console.log("[END]", sortOrder || "NONE");
      break;
    }

    all.push(...json.data);
    cursor = json.nextPageCursor;

    console.log(
      `[PAGE] ${sortOrder || "NONE"} +${json.data.length} total=${all.length}`
    );

    page++;
    if (!cursor) break;
    if (page >= 40) break; // 無限防止（約4000件）

    await sleep(400);
  }

  return all;
}

app.get("/servers/:placeId", async (req, res) => {
  const placeId = req.params.placeId;
  console.log("[REQUEST]", placeId);

  try {
    // ① sortOrderなし
    // ② Asc
    // ③ Desc
    const [none, asc, desc] = await Promise.all([
      fetchSeries(placeId, null),
      fetchSeries(placeId, "Asc"),
      fetchSeries(placeId, "Desc")
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
