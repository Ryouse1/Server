const express = require('express');
const fetch = require('node-fetch'); // node-fetch@2
const cors = require('cors');

const app = express();
app.use(cors());

async function getServersPage(placeId, page = 1) {
    let cursor = null;
    let currentPage = 1;
    let servers = [];

    try {
        do {
            let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
            if (cursor) url += `&cursor=${cursor}`;

            console.log("Fetching URL:", url);
            const res = await fetch(url);
            const data = await res.json();
            console.log("Response:", JSON.stringify(data));

            if (data && data.data) {
                if (currentPage === page) {
                    servers = data.data;
                    break;
                }
            }

            cursor = data.nextPageCursor;
            currentPage++;
            if (!cursor) break;
        } while (true);

        console.log(`Servers returned for page ${page}: ${servers.length}`);
    } catch (e) {
        console.error("Error fetching servers:", e.message);
    }

    return servers;
}

async function getTotalPages(placeId) {
    let allServersCount = 0;
    let cursor = null;

    try {
        do {
            let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
            if (cursor) url += `&cursor=${cursor}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data && data.data) allServersCount += data.data.length;

            cursor = data.nextPageCursor;
            if (!cursor) break;
        } while (true);
    } catch (e) {
        console.error("Error counting servers:", e.message);
    }

    return Math.ceil(allServersCount / 100);
}

// APIルート
app.get('/servers/:placeId', async (req, res) => {
    const placeId = req.params.placeId;
    const page = parseInt(req.query.page) || 1;

    try {
        const servers = await getServersPage(placeId, page);
        const totalPages = await getTotalPages(placeId);

        res.json({
            totalServers: servers.length,
            totalPages: totalPages,
            data: servers
        });
    } catch (err) {
        console.error("Error in /servers route:", err.message);
        res.status(500).json({ error: err.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
