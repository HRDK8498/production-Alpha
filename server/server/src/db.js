diff --git a/server/src/db.js b/server/src/db.js
new file mode 100644
index 0000000000000000000000000000000000000000..1c31453342f5c65372a12c364e7534dcee07c685
--- /dev/null
+++ b/server/src/db.js
@@ -0,0 +1,121 @@
+const path = require('path');
+const sqlite3 = require('sqlite3').verbose();
+
+const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'production.db');
+
+function ensureDatabaseDirectory() {
+  const fs = require('fs');
+  const dir = path.dirname(DB_FILE);
+  if (!fs.existsSync(dir)) {
+    fs.mkdirSync(dir, { recursive: true });
+  }
+}
+
+function createDatabase() {
+  ensureDatabaseDirectory();
+  const db = new sqlite3.Database(DB_FILE);
+  db.serialize(() => {
+    db.run(`CREATE TABLE IF NOT EXISTS skus (
+      id INTEGER PRIMARY KEY AUTOINCREMENT,
+      name TEXT NOT NULL,
+      flavor TEXT,
+      strength_mg INTEGER,
+      target_tablet_weight REAL,
+      created_at TEXT DEFAULT CURRENT_TIMESTAMP
+    );`);
+
+    db.run(`CREATE TABLE IF NOT EXISTS recipes (
+      id INTEGER PRIMARY KEY AUTOINCREMENT,
+      sku_id INTEGER NOT NULL,
+      instructions TEXT,
+      FOREIGN KEY (sku_id) REFERENCES skus(id)
+    );`);
+
+    db.run(`CREATE TABLE IF NOT EXISTS recipe_items (
+      id INTEGER PRIMARY KEY AUTOINCREMENT,
+      recipe_id INTEGER NOT NULL,
+      material TEXT NOT NULL,
+      target_weight REAL NOT NULL,
+      unit TEXT DEFAULT 'kg',
+      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
+    );`);
+
+    db.run(`CREATE TABLE IF NOT EXISTS batches (
+      id INTEGER PRIMARY KEY AUTOINCREMENT,
+      sku_id INTEGER NOT NULL,
+      planned_weight REAL NOT NULL,
+      status TEXT DEFAULT 'pending',
+      picked_by TEXT,
+      mixed_by TEXT,
+      press_operator TEXT,
+      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
+      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
+      FOREIGN KEY (sku_id) REFERENCES skus(id)
+    );`);
+
+    db.run(`CREATE TABLE IF NOT EXISTS batch_items (
+      id INTEGER PRIMARY KEY AUTOINCREMENT,
+      batch_id INTEGER NOT NULL,
+      material TEXT NOT NULL,
+      target_weight REAL NOT NULL,
+      unit TEXT DEFAULT 'kg',
+      picked_weight REAL,
+      lot TEXT,
+      FOREIGN KEY (batch_id) REFERENCES batches(id)
+    );`);
+
+    db.run(`CREATE TABLE IF NOT EXISTS press_runs (
+      id INTEGER PRIMARY KEY AUTOINCREMENT,
+      batch_id INTEGER NOT NULL,
+      received_weight REAL,
+      tablet_weight REAL,
+      expected_tablet_count INTEGER,
+      final_weight REAL,
+      loss_weight REAL,
+      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
+      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
+      FOREIGN KEY (batch_id) REFERENCES batches(id)
+    );`);
+
+    seedIfEmpty(db);
+  });
+  return db;
+}
+
+function seedIfEmpty(db) {
+  db.get('SELECT COUNT(*) as count FROM skus', (err, row) => {
+    if (err) return;
+    if (row && row.count === 0) {
+      const insertSku = db.prepare(
+        'INSERT INTO skus (name, flavor, strength_mg, target_tablet_weight) VALUES (?, ?, ?, ?)',
+      );
+      insertSku.run(['Sample Energy Tablet', 'Berry', 250, 0.8]);
+      insertSku.finalize(() => {
+        db.get('SELECT id FROM skus LIMIT 1', (skuErr, skuRow) => {
+          if (skuErr || !skuRow) return;
+          const insertRecipe = db.prepare('INSERT INTO recipes (sku_id, instructions) VALUES (?, ?)');
+          insertRecipe.run([
+            skuRow.id,
+            '1) Verify all PPE. 2) Load ingredients per weights. 3) Mix at high speed for 5 minutes.',
+          ]);
+          insertRecipe.finalize(() => {
+            db.get('SELECT id FROM recipes WHERE sku_id = ? LIMIT 1', [skuRow.id], (recipeErr, recipeRow) => {
+              if (recipeErr || !recipeRow) return;
+              const recipeItems = db.prepare(
+                'INSERT INTO recipe_items (recipe_id, material, target_weight, unit) VALUES (?, ?, ?, ?)',
+              );
+              recipeItems.run([recipeRow.id, 'Active Powder', 10, 'kg']);
+              recipeItems.run([recipeRow.id, 'Binder', 2, 'kg']);
+              recipeItems.run([recipeRow.id, 'Flavor', 0.5, 'kg']);
+              recipeItems.finalize();
+            });
+          });
+        });
+      });
+    }
+  });
+}
+
+module.exports = {
+  createDatabase,
+};
