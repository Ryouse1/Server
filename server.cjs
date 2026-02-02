const express = require('express');
const fetch = require('node-fetch'); // node-fetch@2 を使う
const cors = require('cors');

const app = express();
app.use(cors());

// Roblox Public Server API から全サーバー取得
async function getAllServers(placeId) {
    let allServers = [];
    let cursor = null;

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

    return allServers;
}

// ルート
app.get('/servers/:placeId', async (req, res) => {
    const placeId = req.params.placeId;
    try {
        const servers = await getAllServers(placeId);
        res.json({ data: servers });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ポート
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
