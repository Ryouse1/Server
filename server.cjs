// server.cjs
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());

// =======================
// ストリーミング取得
// =======================
app.get("/servers/stream/:placeId", async (req, res) => {
    const { placeId } = req.params;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    let cursor = null;
    let total = 0;
    let page = 0;

    try {
        do {
            const url = new URL(
                `https://games.roblox.com/v1/games/${placeId}/servers/Public`
            );
            url.searchParams.set("limit", "50"); // 100は使わない
            if (cursor) url.searchParams.set("cursor", cursor);

            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 10000);

            const r = await fetch(url.toString(), { signal: controller.signal });
            clearTimeout(t);

            if (!r.ok) {
                res.write(`ERROR status=${r.status}\n`);
                break;
            }

            const json = await r.json();

            page++;
            const got = Array.isArray(json.data) ? json.data.length : 0;
            total += got;

            // 進捗
            res.write(`page=${page} got=${got} total=${total}\n`);

            // 1行1サーバー（JSONL）
            if (Array.isArray(json.data)) {
                for (const s of json.data) {
                    res.write(JSON.stringify(s) + "\n");
                }
            }

            cursor = json.nextPageCursor;

            if (cursor) await new Promise(r => setTimeout(r, 800));
        } while (cursor);

        res.write(`DONE total=${total}\n`);
        res.end();
    } catch (e) {
        res.write(`ERROR ${e.message}\n`);
        res.end();
    }
});

// =======================
// 起動
// =======================
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
