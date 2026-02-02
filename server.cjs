const express = require('express');
const fetch = require('node-fetch'); // node-fetch@2
const cors = require('cors');

const app = express();
app.use(cors());

// Roblox Public Server API から全サーバー取得
async function getAllServers(placeId) {
    let allServers = [];
    let cursor = null;

    try {
        do {
            let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
            if (cursor) url += `&cursor=${cursor}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data && data.data) {
                allServers = allServers.concat(data.data);
            }

            cursor = data.nextPageCursor;
        } while (cursor);
    } catch (e) {
        console.error("Error fetching servers:", e.message);
    }

    return allServers;
}

// APIルート
app.get('/servers/:placeId', async (req, res) => {
    const placeId = req.params.placeId;

    try {
        const servers = await getAllServers(placeId);
        const totalServers = servers.length;
        const totalPages = Math.ceil(totalServers / 100);

        res.json({
            totalServers: totalServers,
            totalPages: totalPages,
            data: servers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ポート
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
