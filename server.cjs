// server.cjs
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const jobs = {}; // jobId -> { done, count, servers, error }

// =======================
// バックグラウンド取得
// =======================
async function startFetchJob(jobId, placeId) {
    jobs[jobId] = {
        done: false,
        count: 0,
        servers: [],
        error: null
    };

    let cursor = null;

    try {
        do {
            const url = new URL(
                `https://games.roblox.com/v1/games/${placeId}/servers/Public`
            );
            url.searchParams.set("limit", "50");
            if (cursor) url.searchParams.set("cursor", cursor);

            const controller = new AbortController();
            setTimeout(() => controller.abort(), 10000);

            const res = await fetch(url.toString(), {
                signal: controller.signal
            });

            if (!res.ok) {
                throw new Error(`Roblox API ${res.status}`);
            }

            const json = await res.json();

            if (Array.isArray(json.data)) {
                jobs[jobId].servers.push(...json.data);
                jobs[jobId].count = jobs[jobId].servers.length;
            }

            cursor = json.nextPageCursor;

            // レート制限回避
            if (cursor) {
                await new Promise(r => setTimeout(r, 800));
            }
        } while (cursor);

        jobs[jobId].done = true;
    } catch (e) {
        jobs[jobId].error = e.message;
        jobs[jobId].done = true;
    }
}

// =======================
// API
// =======================

// 取得開始
app.post("/servers/start/:placeId", (req, res) => {
    const { placeId } = req.params;
    const jobId = `${placeId}-${Date.now()}`;

    startFetchJob(jobId, placeId);

    res.json({
        jobId,
        status: "started"
    });
});

// 進捗・結果取得
app.get("/servers/job/:jobId", (req, res) => {
    const job = jobs[req.params.jobId];

    if (!job) {
        return res.status(404).json({ error: "job not found" });
    }

    res.json({
        done: job.done,
        count: job.count,
        error: job.error,
        data: job.done ? job.servers : []
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
