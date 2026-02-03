// server.cjs
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // ← 忘れずに

const app = express();
app.use(cors());

let cachedServers = {};
let lastFetchTime = {};

function getServerTypeConfig(serverType) {
    if (serverType === "1") return { endpoint: "private-servers" };
    if (serverType === "0") return { endpoint: "servers/Public" };
    return null;
}

async function fetchAllServers({ placeId, serverType, sortOrder, excludeFullGames, limit }) {
    const serverConfig = getServerTypeConfig(serverType);
    if (!serverConfig) throw new Error("serverType must be 0 or 1");

    const cacheKey = `${placeId}:${serverType}:${sortOrder}:${excludeFullGames}:${limit}`;
    if (!cachedServers[cacheKey]) cachedServers[cacheKey] = [];

    let allServers = [];
    let cursor = null;

    do {
        const baseUrl = `https://games.roblox.com/v1/games/${placeId}/${serverConfig.endpoint}`;
        const params = new URLSearchParams({ limit });

        if (cursor) params.set("cursor", cursor);
        else params.set("sortOrder", sortOrder);

        if (serverType === "0") params.set("excludeFullGames", excludeFullGames);

        const res = await fetch(`${baseUrl}?${params}`);
        const json = await res.json();

        if (Array.isArray(json.data)) allServers.push(...json.data);
        cursor = json.nextPageCursor;

        if (cursor) await new Promise(r => setTimeout(r, 1000));
    } while (cursor);

    cachedServers[cacheKey] = allServers;
    lastFetchTime[cacheKey] = Date.now();
    return allServers;
}

app.get("/servers/:placeId", async (req, res) => {
    const { placeId } = req.params;
    const {
        serverType = "0",
        sortOrder = "Asc",
        excludeFullGames = "false",
        limit = "100"
    } = req.query;

    if (!getServerTypeConfig(serverType)) {
        return res.status(400).json({ error: "serverType must be 0 or 1" });
    }

    const cacheKey = `${placeId}:${serverType}:${sortOrder}:${excludeFullGames}:${limit}`;

    if (!cachedServers[cacheKey] || Date.now() - (lastFetchTime[cacheKey] || 0) > 5000) {
        await fetchAllServers({ placeId, serverType, sortOrder, excludeFullGames, limit });
    }

    res.json({
        totalServers: cachedServers[cacheKey].length,
        data: cachedServers[cacheKey]
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
