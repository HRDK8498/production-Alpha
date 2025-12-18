diff --git a/server/src/server.js b/server/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..010967c1ff1e538f72667be4a10abaea42635049
--- /dev/null
+++ b/server/src/server.js
@@ -0,0 +1,188 @@
+const express = require('express');
+const cors = require('cors');
+const { createDatabase } = require('./db');
+
+const PORT = process.env.PORT || 4000;
+const app = express();
+const db = createDatabase();
+
+app.use(cors());
+app.use(express.json());
+app.use(express.urlencoded({ extended: true }));
+
+app.get('/health', (_req, res) => {
+  res.json({ status: 'ok' });
+});
+
+app.post('/api/skus', (req, res) => {
+  const { name, flavor, strength_mg, target_tablet_weight } = req.body;
+  if (!name) {
+    return res.status(400).json({ error: 'name is required' });
+  }
+  const stmt = db.prepare(
+    'INSERT INTO skus (name, flavor, strength_mg, target_tablet_weight) VALUES (?, ?, ?, ?)',
+  );
+  stmt.run([name, flavor, strength_mg || null, target_tablet_weight || null], function callback(err) {
+    if (err) return res.status(500).json({ error: err.message });
+    res.status(201).json({ id: this.lastID });
+  });
+});
+
+app.get('/api/skus', (_req, res) => {
+  db.all('SELECT * FROM skus ORDER BY id DESC', (err, rows) => {
+    if (err) return res.status(500).json({ error: err.message });
+    res.json(rows);
+  });
+});
+
+app.post('/api/batches', (req, res) => {
+  const { sku_id, planned_weight } = req.body;
+  if (!sku_id || !planned_weight) {
+    return res.status(400).json({ error: 'sku_id and planned_weight are required' });
+  }
+  const stmt = db.prepare('INSERT INTO batches (sku_id, planned_weight) VALUES (?, ?)');
+  stmt.run([sku_id, planned_weight], function callback(err) {
+    if (err) return res.status(500).json({ error: err.message });
+
+    const batchId = this.lastID;
+    db.get('SELECT id FROM recipes WHERE sku_id = ? ORDER BY id DESC LIMIT 1', [sku_id], (recipeErr, recipe) => {
+      if (recipeErr) return res.status(500).json({ error: recipeErr.message });
+
+      if (!recipe) {
+        return res.status(201).json({ id: batchId, warning: 'Batch created without recipe items' });
+      }
+
+      db.all(
+        'SELECT material, target_weight, unit FROM recipe_items WHERE recipe_id = ?',
+        [recipe.id],
+        (itemsErr, items) => {
+          if (itemsErr) return res.status(500).json({ error: itemsErr.message });
+
+          if (!items || items.length === 0) {
+            return res.status(201).json({ id: batchId, warning: 'Batch created; recipe has no items' });
+          }
+
+          const insertItem = db.prepare(
+            'INSERT INTO batch_items (batch_id, material, target_weight, unit, picked_weight, lot) VALUES (?, ?, ?, ?, NULL, NULL)',
+          );
+
+          items.forEach((item) => {
+            insertItem.run([batchId, item.material, item.target_weight, item.unit || 'kg']);
+          });
+          insertItem.finalize((finalizeErr) => {
+            if (finalizeErr) return res.status(500).json({ error: finalizeErr.message });
+            res.status(201).json({ id: batchId });
+          });
+        },
+      );
+    });
+  });
+});
+
+app.get('/api/batches', (req, res) => {
+  const status = req.query.status;
+  const query = status
+    ? ['SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC', [status]]
+    : ['SELECT * FROM batches ORDER BY created_at DESC', []];
+
+  db.all(query[0], query[1], (err, rows) => {
+    if (err) return res.status(500).json({ error: err.message });
+    res.json(rows);
+  });
+});
+
+app.get('/api/batches/:id', (req, res) => {
+  const id = req.params.id;
+  db.get('SELECT * FROM batches WHERE id = ?', [id], (err, batch) => {
+    if (err) return res.status(500).json({ error: err.message });
+    if (!batch) return res.status(404).json({ error: 'batch not found' });
+
+    db.all('SELECT * FROM batch_items WHERE batch_id = ?', [id], (itemsErr, items) => {
+      if (itemsErr) return res.status(500).json({ error: itemsErr.message });
+      db.get(
+        'SELECT r.id, r.instructions FROM recipes r INNER JOIN skus s ON s.id = r.sku_id WHERE s.id = ? ORDER BY r.id DESC LIMIT 1',
+        [batch.sku_id],
+        (recipeErr, recipe) => {
+          if (recipeErr) return res.status(500).json({ error: recipeErr.message });
+          res.json({ batch, items, recipe });
+        },
+      );
+    });
+  });
+});
+
+app.patch('/api/batches/:id/status', (req, res) => {
+  const { status } = req.body;
+  const id = req.params.id;
+  if (!status) return res.status(400).json({ error: 'status is required' });
+  const stmt = db.prepare('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
+  stmt.run([status, id], function callback(err) {
+    if (err) return res.status(500).json({ error: err.message });
+    res.json({ updated: this.changes });
+  });
+});
+
+app.patch('/api/batches/:id/items', (req, res) => {
+  const id = req.params.id;
+  const items = req.body.items;
+  if (!Array.isArray(items) || items.length === 0) {
+    return res.status(400).json({ error: 'items array is required' });
+  }
+
+  const updateItem = db.prepare(
+    'UPDATE batch_items SET picked_weight = COALESCE(?, picked_weight), lot = COALESCE(?, lot) WHERE id = ? AND batch_id = ?',
+  );
+  let changed = 0;
+  let hadError = false;
+
+  items.forEach((item) => {
+    updateItem.run([item.picked_weight ?? null, item.lot ?? null, item.id, id], function cb(err) {
+      if (err && !hadError) {
+        hadError = true;
+        return res.status(500).json({ error: err.message });
+      }
+      changed += this.changes;
+    });
+  });
+
+  updateItem.finalize((finalizeErr) => {
+    if (finalizeErr && !hadError) return res.status(500).json({ error: finalizeErr.message });
+    if (!hadError) res.json({ updated: changed });
+  });
+});
+
+app.post('/api/press', (req, res) => {
+  const { batch_id, received_weight, tablet_weight } = req.body;
+  if (!batch_id) return res.status(400).json({ error: 'batch_id is required' });
+  const expected_tablet_count = received_weight && tablet_weight ? Math.floor(received_weight / tablet_weight) : null;
+  const stmt = db.prepare(
+    'INSERT INTO press_runs (batch_id, received_weight, tablet_weight, expected_tablet_count) VALUES (?, ?, ?, ?)',
+  );
+  stmt.run([batch_id, received_weight || null, tablet_weight || null, expected_tablet_count], function callback(err) {
+    if (err) return res.status(500).json({ error: err.message });
+    res.status(201).json({ id: this.lastID, expected_tablet_count });
+  });
+});
+
+app.get('/api/press', (_req, res) => {
+  db.all('SELECT * FROM press_runs ORDER BY created_at DESC', (err, rows) => {
+    if (err) return res.status(500).json({ error: err.message });
+    res.json(rows);
+  });
+});
+
+app.patch('/api/press/:id/complete', (req, res) => {
+  const { final_weight, loss_weight } = req.body;
+  const id = req.params.id;
+  const stmt = db.prepare(
+    'UPDATE press_runs SET final_weight = ?, loss_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
+  );
+  stmt.run([final_weight || null, loss_weight || null, id], function callback(err) {
+    if (err) return res.status(500).json({ error: err.message });
+    res.json({ updated: this.changes });
+  });
+});
+
+app.listen(PORT, () => {
+  console.log(`Server listening on port ${PORT}`);
+});
