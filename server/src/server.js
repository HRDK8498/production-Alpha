const http = require('http');
const url = require('url');
const { loadData, saveData, nextId, now } = require('./db');

const PORT = process.env.PORT || 4000;
let data = loadData();

function sendJSON(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        resolve({});
      }
    });
  });
}

function handleOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;

  if (req.method === 'OPTIONS') return handleOptions(res);

  if (pathname === '/health' && req.method === 'GET') {
    return sendJSON(res, 200, { status: 'ok' });
  }

  // SKU endpoints
  if (pathname === '/api/skus' && req.method === 'GET') {
    return sendJSON(res, 200, data.skus.slice().reverse());
  }

  if (pathname === '/api/skus' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.name) return sendJSON(res, 400, { error: 'name is required' });
    const id = nextId(data.skus);
    const record = {
      id,
      name: body.name,
      flavor: body.flavor || null,
      strength_mg: body.strength_mg || null,
      target_tablet_weight: body.target_tablet_weight || null,
      created_at: now(),
    };
    data.skus.push(record);
    saveData(data);
    return sendJSON(res, 201, { id });
  }

  // Batch creation
  if (pathname === '/api/batches' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.sku_id || !body.planned_weight) {
      return sendJSON(res, 400, { error: 'sku_id and planned_weight are required' });
    }
    const id = nextId(data.batches);
    const batch = {
      id,
      sku_id: Number(body.sku_id),
      planned_weight: Number(body.planned_weight),
      status: 'pending',
      picked_by: null,
      mixed_by: null,
      press_operator: null,
      created_at: now(),
      updated_at: now(),
    };
    data.batches.push(batch);

    // copy recipe items if available
    const recipe = data.recipes.find((r) => r.sku_id === batch.sku_id);
    const items = data.recipe_items.filter((ri) => recipe && ri.recipe_id === recipe.id);
    if (items.length) {
      items.forEach((item) => {
        data.batch_items.push({
          id: nextId(data.batch_items),
          batch_id: id,
          material: item.material,
          target_weight: item.target_weight,
          unit: item.unit || 'kg',
          picked_weight: null,
          lot: null,
        });
      });
    }

    saveData(data);
    return sendJSON(res, 201, { id });
  }

  if (pathname === '/api/batches' && req.method === 'GET') {
    const status = query.status;
    const rows = status
      ? data.batches.filter((b) => b.status === status).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      : data.batches.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return sendJSON(res, 200, rows);
  }

  if (pathname.startsWith('/api/batches/') && req.method === 'GET') {
    const id = Number(pathname.split('/')[3]);
    const batch = data.batches.find((b) => b.id === id);
    if (!batch) return sendJSON(res, 404, { error: 'batch not found' });
    const items = data.batch_items.filter((bi) => bi.batch_id === id);
    const recipe = data.recipes
      .filter((r) => r.sku_id === batch.sku_id)
      .sort((a, b) => b.id - a.id)[0];
    const recipeItems = recipe ? data.recipe_items.filter((ri) => ri.recipe_id === recipe.id) : [];
    return sendJSON(res, 200, { batch, items, recipe: recipe ? { ...recipe, items: recipeItems } : null });
  }

  if (pathname.startsWith('/api/batches/') && pathname.endsWith('/status') && req.method === 'PATCH') {
    const id = Number(pathname.split('/')[3]);
    const body = await parseBody(req);
    if (!body.status) return sendJSON(res, 400, { error: 'status is required' });
    const batch = data.batches.find((b) => b.id === id);
    if (!batch) return sendJSON(res, 404, { error: 'batch not found' });
    batch.status = body.status;
    batch.updated_at = now();
    saveData(data);
    return sendJSON(res, 200, { updated: 1 });
  }

  if (pathname.startsWith('/api/batches/') && pathname.endsWith('/items') && req.method === 'PATCH') {
    const id = Number(pathname.split('/')[3]);
    const body = await parseBody(req);
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return sendJSON(res, 400, { error: 'items array is required' });
    }
    let updated = 0;
    body.items.forEach((item) => {
      const record = data.batch_items.find((bi) => bi.id === item.id && bi.batch_id === id);
      if (record) {
        if (item.picked_weight !== undefined) record.picked_weight = item.picked_weight;
        if (item.lot !== undefined) record.lot = item.lot;
        updated += 1;
      }
    });
    saveData(data);
    return sendJSON(res, 200, { updated });
  }

  // Press operations
  if (pathname === '/api/press' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.batch_id) return sendJSON(res, 400, { error: 'batch_id is required' });
    const id = nextId(data.press_runs);
    const received_weight = body.received_weight ? Number(body.received_weight) : null;
    const tablet_weight = body.tablet_weight ? Number(body.tablet_weight) : null;
    const expected_tablet_count = received_weight && tablet_weight ? Math.floor(received_weight / tablet_weight) : null;
    data.press_runs.push({
      id,
      batch_id: Number(body.batch_id),
      received_weight,
      tablet_weight,
      expected_tablet_count,
      final_weight: null,
      loss_weight: null,
      created_at: now(),
      updated_at: now(),
    });
    saveData(data);
    return sendJSON(res, 201, { id, expected_tablet_count });
  }

  if (pathname === '/api/press' && req.method === 'GET') {
    const rows = data.press_runs.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return sendJSON(res, 200, rows);
  }

  if (pathname.startsWith('/api/press/') && pathname.endsWith('/complete') && req.method === 'PATCH') {
    const id = Number(pathname.split('/')[3]);
    const body = await parseBody(req);
    const record = data.press_runs.find((p) => p.id === id);
    if (!record) return sendJSON(res, 404, { error: 'press run not found' });
    if (body.final_weight !== undefined) record.final_weight = Number(body.final_weight);
    if (body.loss_weight !== undefined) record.loss_weight = Number(body.loss_weight);
    record.updated_at = now();
    saveData(data);
    return sendJSON(res, 200, { updated: 1 });
  }

  return sendJSON(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
