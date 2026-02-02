const express = require('express');
const fetch = require('node-fetch'); // node-fetch@2
const cors = require('cors');

const app = express();
app.use(cors());

let cachedServers = {};
let lastFetchTime = {};

// Roblox API から全てのPublicサーバーを分割取得
async function fetchAllServers(placeId) {
    if (!cachedServers[placeId]) cachedServers[placeId] = [];

    let allServers = [];
    let cursor = null;

    try {
        do {
            let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
            if (cursor) url += `&cursor=${cursor}`;

            console.log("Fetching URL:", url);
            const res = await fetch(url);
            const data = await res.json();
            console.log("Response length:", data.data ? data.data.length : 0);

            if (data && data.data) {
                allServers = allServers.concat(data.data);
            }

            cursor = data.nextPageCursor;

            // API制限対策：次ページまで少し待つ
            if (cursor) await new Promise(r => setTimeout(r, 2000));
        } while (cursor);

        cachedServers[placeId] = allServers;
        lastFetchTime[placeId] = Date.now();

        console.log(`Total servers fetched: ${allServers.length}`);
    } catch (e) {
        console.error("Error fetching servers:", e.message);
    }

    return cachedServers[placeId];
}

// APIルート
app.get('/servers/:placeId', async (req, res) => {
    const placeId = req.params.placeId;

    try {
        // キャッシュが古い場合のみ再取得（5秒以内はキャッシュを返す）
        if (!cachedServers[placeId] || (Date.now() - (lastFetchTime[placeId] || 0)) > 5000) {
            await fetchAllServers(placeId);
        }

        res.json({
            totalServers: cachedServers[placeId].length,
            data: cachedServers[placeId]
        });
    } catch (err) {
        console.error("Error in /servers route:", err.message);
        res.status(500).json({ error: err.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
