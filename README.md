# production-Alpha

Local-first production reporting starter for mixing, pressing, and packaging workflows.

## Getting started (API server)

1. Install Node.js 18+ (no npm downloads needed; everything is dependency-free).
2. Start the API locally:
   ```bash
   cd server
   npm run start
   ```
3. Visit `http://localhost:4000/health` to confirm the server is running.

### What is included now

- File-backed JSON store (no external DB or npm packages required) for SKUs, recipes, batches, and press runs.
- Seed data for a sample SKU and recipe to help you test immediately.
- API endpoints (all JSON):
  - `GET /health` — service status check.
  - `POST /api/skus` — create a SKU (name required).
  - `GET /api/skus` — list SKUs.
  - `POST /api/batches` — create a production batch for a SKU and auto-copy recipe items into the pick list.
  - `GET /api/batches` — list batches (optional `?status=pending`).
  - `GET /api/batches/:id` — fetch a batch with its pick list and recipe instructions.
  - `PATCH /api/batches/:id/items` — update picked weights and lots for batch items.
  - `PATCH /api/batches/:id/status` — move a batch through statuses (e.g., `picking`, `in-mixing`, `to-pressing`, `completed`).
  - `POST /api/press` — log a press run (links to a batch, calculates expected tablet count when weights provided).
  - `GET /api/press` — list press runs.
  - `PATCH /api/press/:id/complete` — record final tablet weight and loss.

### Quick cURL/Postman walkthrough

```bash
# Health check
curl http://localhost:4000/health

# List seeded SKUs
curl http://localhost:4000/api/skus

# Create a new SKU
curl -X POST http://localhost:4000/api/skus \
  -H "Content-Type: application/json" \
  -d '{"name":"Vitamin C Tablet","flavor":"Orange","strength_mg":500,"target_tablet_weight":0.9}'

# Create a batch for SKU id 1 with a planned weight of 12.5 kg
curl -X POST http://localhost:4000/api/batches \
  -H "Content-Type: application/json" \
  -d '{"sku_id":1,"planned_weight":12.5}'

# Fetch that batch (shows pick list copied from the recipe and instructions)
curl http://localhost:4000/api/batches/1

# Record picked weights and lot numbers for batch items
curl -X PATCH http://localhost:4000/api/batches/1/items \
  -H "Content-Type: application/json" \
  -d '{"items":[{"id":1,"picked_weight":10.1,"lot":"A123"},{"id":2,"picked_weight":2.0,"lot":"B456"}]}'

# Mark the batch status (e.g., to-pressing)
curl -X PATCH http://localhost:4000/api/batches/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"to-pressing"}'

# Create a press run for that batch
curl -X POST http://localhost:4000/api/press \
  -H "Content-Type: application/json" \
  -d '{"batch_id":1,"received_weight":12.0,"tablet_weight":0.9}'

# Complete the press run with final weight and loss
curl -X PATCH http://localhost:4000/api/press/1/complete \
  -H "Content-Type: application/json" \
  -d '{"final_weight":11.8,"loss_weight":0.2}'
```

### Data file location

- Data is stored at `server/data/production.json`. Delete this file to reset to the seeded sample data.

### Troubleshooting

- **Nothing happens when starting**: Make sure you are in the `server` folder and run `npm run start` (which simply runs `node src/server.js`).
- **Need to change the port**: Set `PORT=5000` (or your preferred port) before running the start command.
