// server.cjs
const express = require("express");
const cors = require("cors");

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

            // Node.js v18+ では fetch が組み込み
            const res = await fetch(url);
            const data = await res.json();

            if (data && Array.isArray(data.data)) {
                allServers = allServers.concat(data.data);
            }

            cursor = data.nextPageCursor;
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
        if (!cachedServers[placeId] || (Date.now() - (lastFetchTime[placeId] || 0)) > 5000) {
            await fetchAllServers(placeId);
        }

        const data = cachedServers[placeId] || [];
        res.json({
            totalServers: data.length,
            data: data
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
