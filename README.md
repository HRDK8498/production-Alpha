 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/README.md b/README.md
index 97993d0a04c9982ffc8858e5c07506465dcb0dd8..ffb78d23722896b54b9d25c7efcb787a0134c565 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,42 @@
 # production-Alpha
-mixing, pressing, blistering, carding, packaging
+
+Local-first production reporting starter for mixing, pressing, and packaging workflows.
+
+## Getting started (API server)
+
+1. Install Node.js 18+.
+2. Install dependencies from the `server` folder:
+   ```bash
+   cd server
+   npm install
+   ```
+3. Run the API locally:
+   ```bash
+   npm run start
+   ```
+4. Visit `http://localhost:4000/health` to confirm the server is running.
+
+### What is included now
+
+- SQLite-backed schema for SKUs, recipes, batches, and press runs.
+- Seed data for a sample SKU and recipe to help you test immediately.
+- API endpoints (all JSON):
+  - `GET /health` — service status check.
+  - `POST /api/skus` — create a SKU (name required).
+  - `GET /api/skus` — list SKUs.
+  - `POST /api/batches` — create a production batch for a SKU and auto-copy recipe items into the pick list.
+  - `GET /api/batches` — list batches (optional `?status=pending`).
+  - `GET /api/batches/:id` — fetch a batch with its pick list and recipe instructions.
+  - `PATCH /api/batches/:id/items` — update picked weights and lots for batch items.
+  - `PATCH /api/batches/:id/status` — move a batch through statuses (e.g., `picking`, `in-mixing`, `to-pressing`, `completed`).
+  - `POST /api/press` — log a press run (links to a batch, calculates expected tablet count when weights provided).
+  - `GET /api/press` — list press runs.
+  - `PATCH /api/press/:id/complete` — record final tablet weight and loss.
+
+### Next steps we can add
+
+- Frontend dashboard (React/Vite) for planners, mixers, and press operators.
+- Pick list entry and lot tracking per batch item.
+- Excel exports for recipes and press sheets.
+- Websocket notifications for handoff from mixing to pressing.
+- Role-based access and audit trail.
 
EOF
)
