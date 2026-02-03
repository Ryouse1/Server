// server.cjs（CommonJS 完全版）
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Robloxに弾かれないための待ち時間
const WAIT_MS = 1200;

// placeId ごとのキャッシュ
const cache = new Map();

/**
 * sleep
 */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 1パターン（sortOrder別）を nextPageCursor がなくなるまで取得
 */
async function fetchBySort(placeId, sortOrder) {
  let cursor = null;
  let results = [];

  while (true) {
    let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100`;
    if (sortOrder) url += `&sortOrder=${sortOrder}`;
    if (cursor) url += `&cursor=${cursor}`;

    console.log("[FETCH]", sortOrder ?? "NONE", cursor ?? "START");

    const res = await fetch(url);
    if (!res.ok) break;

    const json = await res.json();
    if (!json?.data || json.data.length === 0) break;

    results.push(...json.data);

    cursor = json.nextPageCursor;
    if (!cursor) break;

    await sleep(WAIT_MS);
  }

  return results;
}

/**
 * placeId の Public サーバーを「限界まで」集める
 */
async function fetchAllServers(placeId) {
  console.log("[REQUEST]", placeId);

  const all = [];

  // sortOrder なし / Asc / Desc 全部やる
  const none = await fetchBySort(placeId, null);
  const asc  = await fetchBySort(placeId, "Asc");
  const desc = await fetchBySort(placeId, "Desc");

  all.push(...none, ...asc, ...desc);

  // jobId で重複除去
  const map = new Map();
  for (const s of all) {
    if (s?.id) map.set(s.id, s);
  }

  const unique = [...map.values()];

  console.log("[DONE]", placeId, "servers:", unique.length);

  cache.set(placeId, {
    time: Date.now(),
    data: unique
  });

  return unique;
}

/**
 * API
 * /servers/:placeId
 */
app.get("/servers/:placeId", async (req, res) => {
  const { placeId } = req.params;

  try {
    // 10秒キャッシュ
    const cached = cache.get(placeId);
    if (cached && Date.now() - cached.time < 10_000) {
      return res.json({
        cached: true,
        total: cached.data.length,
        data: cached.data
      });
    }

    const data = await fetchAllServers(placeId);

    res.json({
      cached: false,
      total: data.length,
      data
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
