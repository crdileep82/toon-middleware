# toon-middleware

![npm version](https://img.shields.io/npm/v/toon-middleware)
![license](https://img.shields.io/npm/l/toon-middleware)
![tests](https://img.shields.io/github/actions/workflow/status/your-org/toon-middleware/ci.yml?label=tests)

Zero-config Express & Fastify middleware for automatic JSON ↔ TOON conversion — reduce LLM API token costs by **30–60%** with one line of setup.

---

## Installation

```bash
npm install toon-middleware
```

---

## Quick Start — Express

```typescript
import express from 'express'
import { toonMiddleware } from 'toon-middleware'

const app = express()
app.use(express.json())
app.use(toonMiddleware({ statsHeader: true }))

app.get('/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }])
  // → If client sends Accept: text/toon, response is TOON-encoded automatically
})
```

---

## Quick Start — Fastify

```typescript
import Fastify from 'fastify'
import toonPlugin from 'toon-middleware/fastify'

const fastify = Fastify()
await fastify.register(toonPlugin, { statsHeader: true, threshold: 0.15 })

fastify.get('/products', async () => {
  return [{ id: 1, name: 'Laptop', price: 999 }]
  // → Auto-encoded to TOON when client requests it
})
```

---

## Options

| Option        | Type       | Default | Description                                                           |
|---------------|------------|---------|-----------------------------------------------------------------------|
| `encode`      | `boolean`  | `true`  | Encode JSON responses to TOON format when client accepts it           |
| `decode`      | `boolean`  | `true`  | Decode TOON request bodies to plain JS objects before route handlers  |
| `strict`      | `boolean`  | `false` | Throw/400 on decode failure instead of silently falling back to JSON  |
| `statsHeader` | `boolean`  | `false` | Add `X-TOON-Token-Savings: 42.3%` header to encoded responses        |
| `threshold`   | `number`   | `0.1`   | Minimum savings fraction (0–1) required before encoding (e.g. 0.1 = 10%) |
| `routes`      | `string[]` | `undefined` | Glob patterns — middleware only activates on matching paths (e.g. `['/api/*']`) |

---

## Per-Route Usage

Apply TOON to a single route instead of globally:

```typescript
import { toon } from 'toon-middleware'

app.get('/heavy-data', toon({ statsHeader: true }), (req, res) => {
  res.json(bigDataset)
})
```

---

## How It Works

TOON middleware intercepts traffic in two directions:

### Request Decoding (TOON → JSON)
1. Client sends `Content-Type: text/toon` with a TOON-encoded body
2. Middleware reads the raw body, calls `decode()` from `@toon-format/toon`
3. Decoded JS object is assigned to `req.body` before your route handler runs
4. Your handler sees plain JSON — no changes required

### Response Encoding (JSON → TOON)
1. Client sends `Accept: text/toon` in the request
2. Middleware wraps `res.json()` (Express) or hooks `onSend` (Fastify)
3. Before encoding, it checks if token savings exceed the `threshold`
4. If worthwhile: encodes to TOON string, sets `Content-Type: text/toon`, sends
5. If not worthwhile or encoding fails: falls through to normal JSON response

---

## When TOON Helps

TOON excels at compressing **uniform arrays** — data where the same keys repeat across many objects:

```json
[
  { "id": 1, "name": "Alice", "role": "admin", "active": true },
  { "id": 2, "name": "Bob",   "role": "user",  "active": false },
  ...hundreds more
]
```

Typical savings: **30–60% fewer tokens** compared to JSON when sent to GPT/Claude APIs.

## When TOON Doesn't Help

- **Deeply nested, heterogeneous objects** — unique keys don't compress well
- **Short single-object responses** — overhead of the TOON header may exceed savings
- **Binary or non-JSON payloads** — middleware passes these through untouched

The `threshold` option lets you tune the break-even point. At the default `0.1` (10%), responses with less than 10% token savings are sent as plain JSON.

---

## Token Savings Header

Enable `statsHeader: true` to see exact savings per response:

```
X-TOON-Token-Savings: 47.2%
```

Useful for monitoring and deciding whether to lower or raise `threshold`.
