// server.cjs
const express = require("express");
const cors = require("cors");

// node-fetch 対応（これが超重要）
const fetch = require("node-fetch").default;

const app = express();
app.use(cors());

/**
 * 全サーバー取得（cursor 全追跡）
 */
async function fetchAllServers(placeId) {
    let cursor = null;
    let allServers = [];

    do {
        const params = new URLSearchParams({
            limit: "100"
        });

        if (cursor) params.set("cursor", cursor);

        const url =
            `https://games.roblox.com/v1/games/${placeId}/servers/Public?` +
            params.toString();

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Roblox API error: ${res.status}`);
        }

        const json = await res.json();

        if (Array.isArray(json.data)) {
            allServers.push(...json.data);
        }

        cursor = json.nextPageCursor;

        // Roblox rate limit 回避
        if (cursor) {
            await new Promise(r => setTimeout(r, 800));
        }
    } while (cursor);

    return allServers;
}

/**
 * API
 * /servers?placeId=xxxxx
 */
app.get("/servers", async (req, res) => {
    const { placeId } = req.query;

    if (!placeId) {
        return res.status(400).json({
            error: "placeId is required"
        });
    }

    try {
        const servers = await fetchAllServers(placeId);

        res.json({
            placeId,
            totalServers: servers.length,
            data: servers
        });
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
