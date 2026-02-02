// server.cjs (CommonJS)
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

let cachedServers = {};
let lastFetchTime = {};

async function fetchAllServers(placeId) {
    if (!cachedServers[placeId]) cachedServers[placeId] = [];
    let allServers = [];
    let cursor = null;

    try {
        do {
            let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
            if (cursor) url += `&cursor=${cursor}`;

            // Node.js 22 のグローバル fetch を使用
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.data) allServers = allServers.concat(data.data);
            cursor = data.nextPageCursor;

            if (cursor) await new Promise(r => setTimeout(r, 2000));
        } while (cursor);

        cachedServers[placeId] = allServers;
        lastFetchTime[placeId] = Date.now();
    } catch (e) {
        console.error("Error fetching servers:", e.message);
    }

    return cachedServers[placeId];
}

app.get("/servers/:placeId", async (req, res) => {
    const placeId = req.params.placeId;
    try {
        if (!cachedServers[placeId] || (Date.now() - (lastFetchTime[placeId]||0))>5000) {
            await fetchAllServers(placeId);
        }

        const data = cachedServers[placeId].map(s => ({
            id: s.id,
            playing: s.playing,
            maxPlayers: s.maxPlayers,
            ping: s.ping || 0,
            fps: s.fps || 0,
            players: s.players ? s.players.map(p => p.name || p) : []
        }));

        res.json({
            totalServers: data.length,
            data
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
