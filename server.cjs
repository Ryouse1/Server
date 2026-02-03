diff --git a/server.cjs b/server.cjs
index 305a5faa49bad3b3adf7047d6a6cfc63666e18b2..b584de798344b42971cfec92b386c000c5eb1f32 100644
--- a/server.cjs
+++ b/server.cjs
@@ -1,63 +1,98 @@
 // server.cjs
 const express = require("express");
 const cors = require("cors");
 
 const app = express();
 app.use(cors());
 
 let cachedServers = {};
 let lastFetchTime = {};
 
 // Robloxサーバー全件取得（空ページもスキップ）
-async function fetchAllServers(placeId) {
-    if (!cachedServers[placeId]) cachedServers[placeId] = [];
+function getServerTypeConfig(serverType) {
+    if (serverType === "1") {
+        return { endpoint: "private-servers" };
+    }
+    if (serverType === "0") {
+        return { endpoint: "servers/Public" };
+    }
+    return null;
+}
+
+async function fetchAllServers({ placeId, serverType, sortOrder, excludeFullGames, limit }) {
+    const serverConfig = getServerTypeConfig(serverType);
+    if (!serverConfig) {
+        throw new Error("serverType must be 0 or 1");
+    }
+
+    const cacheKey = `${placeId}:${serverType}:${sortOrder}:${excludeFullGames}:${limit}`;
+    if (!cachedServers[cacheKey]) cachedServers[cacheKey] = [];
     let allServers = [];
     let cursor = null;
 
     try {
         do {
-            let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
-            if (cursor) url += `&cursor=${cursor}`;
+            const baseUrl = `https://games.roblox.com/v1/games/${placeId}/${serverConfig.endpoint}`;
+            const params = new URLSearchParams({ limit });
+            if (cursor) {
+                params.set("cursor", cursor);
+            } else {
+                params.set("sortOrder", sortOrder);
+            }
+            if (serverType === "0") {
+                params.set("excludeFullGames", excludeFullGames);
+            }
+            const url = `${baseUrl}?${params.toString()}`;
 
             // Node.js v18+ では fetch が組み込み
             const res = await fetch(url);
             const data = await res.json();
 
             if (data && Array.isArray(data.data)) {
                 allServers = allServers.concat(data.data);
             }
 
             cursor = data.nextPageCursor;
             if (cursor) await new Promise(r => setTimeout(r, 1000)); // API制限対策
         } while (cursor);
 
-        cachedServers[placeId] = allServers;
-        lastFetchTime[placeId] = Date.now();
+        cachedServers[cacheKey] = allServers;
+        lastFetchTime[cacheKey] = Date.now();
     } catch (e) {
         console.error("Error fetching servers:", e.message);
     }
 
-    return cachedServers[placeId];
+    return cachedServers[cacheKey];
 }
 
+// Refresh intervals removed; keep cache updates on demand.
+
 // サーバー返却エンドポイント
 app.get("/servers/:placeId", async (req, res) => {
     const placeId = req.params.placeId;
+    const serverType = req.query.serverType ?? "0";
+    const sortOrder = req.query.sortOrder ?? "Asc";
+    const excludeFullGames = req.query.excludeFullGames ?? "false";
+    const limit = req.query.limit ?? "100";
+    if (!getServerTypeConfig(serverType)) {
+        return res.status(400).json({ error: "serverType must be 0 or 1" });
+    }
+    const cacheKey = `${placeId}:${serverType}:${sortOrder}:${excludeFullGames}:${limit}`;
     try {
-        if (!cachedServers[placeId] || (Date.now() - (lastFetchTime[placeId] || 0)) > 5000) {
-            await fetchAllServers(placeId);
+        if (!cachedServers[cacheKey] || (Date.now() - (lastFetchTime[cacheKey] || 0)) > 5000) {
+            await fetchAllServers({ placeId, serverType, sortOrder, excludeFullGames, limit });
         }
 
-        const data = cachedServers[placeId] || [];
+        const data = cachedServers[cacheKey] || [];
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
