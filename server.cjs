// server.cjs
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

let cachedServers = {};
let lastFetchTime = {};
let refreshIntervals = {};

// Robloxサーバー全件取得（空ページもスキップ）
function getServerTypeConfig(serverType) {
    if (serverType === "1") {
        return { endpoint: "private-servers" };
    }
    if (serverType === "0") {
        return { endpoint: "servers/Public" };
    }
    return null;
}

async function fetchAllServers({ placeId, serverType, sortOrder, excludeFullGames, limit }) {
    const serverConfig = getServerTypeConfig(serverType);
    if (!serverConfig) {
        throw new Error("serverType must be 0 or 1");
    }

    const cacheKey = `${placeId}:${serverType}:${sortOrder}:${excludeFullGames}:${limit}`;
    if (!cachedServers[cacheKey]) cachedServers[cacheKey] = [];
    let allServers = [];
    let cursor = null;

    try {
        do {
            let url = `https://games.roblox.com/v1/games/${placeId}/${serverConfig.endpoint}?sortOrder=${sortOrder}&limit=${limit}`;
            if (cursor) url += `&cursor=${cursor}`;
            if (serverType === "0") {
                url += `&excludeFullGames=${excludeFullGames}`;
            }

            // Node.js v18+ では fetch が組み込み
            const res = await fetch(url);
            const data = await res.json();

            if (data && Array.isArray(data.data)) {
                allServers = allServers.concat(data.data);
            }

            cursor = data.nextPageCursor;
            if (cursor) await new Promise(r => setTimeout(r, 1000)); // API制限対策
        } while (cursor);

        cachedServers[cacheKey] = allServers;
        lastFetchTime[cacheKey] = Date.now();
    } catch (e) {
        console.error("Error fetching servers:", e.message);
    }

    return cachedServers[cacheKey];
}

function ensureRefreshInterval(options) {
    const { placeId, serverType, sortOrder, excludeFullGames, limit } = options;
    const cacheKey = `${placeId}:${serverType}:${sortOrder}:${excludeFullGames}:${limit}`;
    if (refreshIntervals[cacheKey]) return;

    refreshIntervals[cacheKey] = setInterval(() => {
        fetchAllServers(options);
    }, 5000);
}

// サーバー返却エンドポイント
app.get("/servers/:placeId", async (req, res) => {
    const placeId = req.params.placeId;
    const serverType = req.query.serverType ?? "0";
    const sortOrder = req.query.sortOrder ?? "Asc";
    const excludeFullGames = req.query.excludeFullGames ?? "false";
    const limit = req.query.limit ?? "100";
    if (!getServerTypeConfig(serverType)) {
        return res.status(400).json({ error: "serverType must be 0 or 1" });
    }
    const cacheKey = `${placeId}:${serverType}:${sortOrder}:${excludeFullGames}:${limit}`;
    try {
        if (!cachedServers[cacheKey] || (Date.now() - (lastFetchTime[cacheKey] || 0)) > 5000) {
            await fetchAllServers({ placeId, serverType, sortOrder, excludeFullGames, limit });
        }

        ensureRefreshInterval({ placeId, serverType, sortOrder, excludeFullGames, limit });

        const data = cachedServers[cacheKey] || [];
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
