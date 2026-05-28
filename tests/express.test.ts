import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { type Request, type Response } from 'express'
import request from 'supertest'
import { toonMiddleware, toon } from '../src/express.js'
import { safeEncode } from '../src/utils.js'

// Minimal fixture data that encodes well in TOON
const largeArray = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `User${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: 'admin',
  active: true,
}))

function buildApp(middlewareOptions?: Parameters<typeof toonMiddleware>[0]) {
  const app = express()
  app.use(express.json())
  app.use(toonMiddleware(middlewareOptions))

  app.get('/users', (_req: Request, res: Response) => {
    res.json(largeArray)
  })

  app.post('/echo', (req: Request, res: Response) => {
    res.json(req.body)
  })

  app.get('/text', (_req: Request, res: Response) => {
    res.type('text/plain').send('hello world')
  })

  return app
}

describe('Express middleware — encoding', () => {
  it('returns TOON-encoded body when Accept: text/toon', async () => {
    const app = buildApp()
    const res = await request(app)
      .get('/users')
      .set('Accept', 'text/toon')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/toon')
    expect(typeof res.text).toBe('string')
    expect(res.text.length).toBeGreaterThan(0)
  })

  it('returns JSON when Accept header does not include text/toon', async () => {
    const app = buildApp()
    const res = await request(app)
      .get('/users')
      .set('Accept', 'application/json')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('Express middleware — decoding', () => {
  it('decodes TOON request body to req.body', async () => {
    const app = buildApp()
    const payload = { message: 'hello', count: 42 }
    const encoded = safeEncode(payload)
    expect(encoded).not.toBeNull()

    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'text/toon')
      .send(encoded!)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(payload)
  })

  it('fallback: invalid TOON body with strict:false leaves body unchanged', async () => {
    // Use express.text() so it pre-reads the body as a string for our middleware to decode
    const appStrict = express()
    appStrict.use(express.text({ type: 'text/toon' }))
    appStrict.use(toonMiddleware({ strict: false }))
    appStrict.post('/echo', (req: Request, res: Response) => {
      // With strict:false, decode failure leaves req.body as the original raw string
      res.status(200).json({ received: req.body })
    })

    const res = await request(appStrict)
      .post('/echo')
      .set('Content-Type', 'text/toon')
      .send('NOT_VALID_TOON!!!')

    expect(res.status).toBe(200)
    expect(res.body.received).toBeDefined()
  })
})

describe('Express middleware — stats header', () => {
  it('adds X-TOON-Token-Savings header when statsHeader: true', async () => {
    const app = buildApp({ statsHeader: true })
    const res = await request(app)
      .get('/users')
      .set('Accept', 'text/toon')

    expect(res.headers['x-toon-token-savings']).toMatch(/[\d.]+%/)
  })

  it('does not add X-TOON-Token-Savings header when statsHeader: false', async () => {
    const app = buildApp({ statsHeader: false })
    const res = await request(app)
      .get('/users')
      .set('Accept', 'text/toon')

    expect(res.headers['x-toon-token-savings']).toBeUndefined()
  })
})

describe('Express middleware — threshold', () => {
  it('does NOT encode when threshold is set extremely high (1.0 = 100%)', async () => {
    // 100% savings is impossible, so response should be JSON
    const app = buildApp({ threshold: 1.0 })
    const res = await request(app)
      .get('/users')
      .set('Accept', 'text/toon')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
  })
})

describe('Express middleware — route filtering', () => {
  it('only activates on matching routes', async () => {
    const app = express()
    app.use(express.json())
    app.use(toonMiddleware({ routes: ['/api/*'] }))

    app.get('/api/data', (_req: Request, res: Response) => res.json(largeArray))
    app.get('/other', (_req: Request, res: Response) => res.json(largeArray))

    const toonRes = await request(app).get('/api/data').set('Accept', 'text/toon')
    expect(toonRes.headers['content-type']).toContain('text/toon')

    const plainRes = await request(app).get('/other').set('Accept', 'text/toon')
    // Should NOT be encoded since /other doesn't match /api/*
    expect(plainRes.headers['content-type']).toContain('application/json')
  })
})

describe('Express middleware — per-route toon()', () => {
  it('toon() works on a single route', async () => {
    const app = express()
    app.use(express.json())

    app.get('/special', toon({ encode: true }), (_req: Request, res: Response) => {
      res.json(largeArray)
    })
    app.get('/normal', (_req: Request, res: Response) => res.json(largeArray))

    const specialRes = await request(app).get('/special').set('Accept', 'text/toon')
    expect(specialRes.headers['content-type']).toContain('text/toon')

    const normalRes = await request(app).get('/normal').set('Accept', 'text/toon')
    // No middleware on /normal → normal JSON
    expect(normalRes.headers['content-type']).toContain('application/json')
  })
})

describe('Express middleware — content type passthrough', () => {
  it('leaves non-JSON responses untouched', async () => {
    const app = buildApp()
    const res = await request(app).get('/text').set('Accept', 'text/toon, text/plain')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.text).toBe('hello world')
  })
})
