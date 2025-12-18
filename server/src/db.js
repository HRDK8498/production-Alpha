const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'production.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = seedData();
    saveData(seeded);
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read data file, re-seeding', err);
    const seeded = seedData();
    saveData(seeded);
    return seeded;
  }
}

function saveData(data) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function now() {
  return new Date().toISOString();
}

function seedData() {
  const skus = [
    {
      id: 1,
      name: 'Sample Energy Tablet',
      flavor: 'Berry',
      strength_mg: 250,
      target_tablet_weight: 0.8,
      created_at: now(),
    },
  ];
  const recipes = [
    {
      id: 1,
      sku_id: 1,
      instructions: '1) Verify all PPE. 2) Load ingredients per weights. 3) Mix at high speed for 5 minutes.',
    },
  ];
  const recipe_items = [
    { id: 1, recipe_id: 1, material: 'Active Powder', target_weight: 10, unit: 'kg' },
    { id: 2, recipe_id: 1, material: 'Binder', target_weight: 2, unit: 'kg' },
    { id: 3, recipe_id: 1, material: 'Flavor', target_weight: 0.5, unit: 'kg' },
  ];
  return {
    skus,
    recipes,
    recipe_items,
    batches: [],
    batch_items: [],
    press_runs: [],
  };
}

function nextId(list) {
  if (!list || list.length === 0) return 1;
  return Math.max(...list.map((item) => item.id)) + 1;
}

module.exports = {
  loadData,
  saveData,
  nextId,
  now,
};
