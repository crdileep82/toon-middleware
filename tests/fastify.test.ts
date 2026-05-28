import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import toonPlugin from '../src/fastify.js'
import { safeEncode } from '../src/utils.js'

// Mocked version of safeDecode — lets individual tests simulate decode failure
vi.mock('../src/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils.js')>()
  return {
    ...actual,
    safeDecode: vi.fn(actual.safeDecode),
  }
})

const largeArray = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Item${i + 1}`,
  category: 'electronics',
  price: 99.99,
  inStock: true,
}))

describe('Fastify plugin', () => {
  it('registers without error', async () => {
    const fastify = Fastify()
    await expect(fastify.register(toonPlugin)).resolves.not.toThrow()
    await fastify.close()
  })

  it('encodes response to TOON when Accept: text/toon', async () => {
    const fastify = Fastify()
    await fastify.register(toonPlugin)

    fastify.get('/items', async () => largeArray)

    const res = await fastify.inject({
      method: 'GET',
      url: '/items',
      headers: { accept: 'text/toon' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/toon')
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('decodes TOON request body correctly', async () => {
    const fastify = Fastify()
    await fastify.register(toonPlugin)

    fastify.post('/echo', async (request) => request.body)

    const payload = { message: 'hello', items: [1, 2, 3] }
    const encoded = safeEncode(payload)
    expect(encoded).not.toBeNull()

    const res = await fastify.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'text/toon', accept: 'application/json' },
      payload: encoded!,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual(payload)
  })

  it('returns 400 on invalid TOON body with strict: true', async () => {
    // TOON decodes any string as itself, so we mock safeDecode to simulate failure
    const { safeDecode } = await import('../src/utils.js')
    vi.mocked(safeDecode).mockReturnValueOnce(null)

    const fastify = Fastify()
    await fastify.register(toonPlugin, { strict: true })

    fastify.post('/echo', async (request) => request.body)

    const res = await fastify.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'text/toon' },
      payload: 'some-toon-body',
    })

    expect(res.statusCode).toBe(400)
    vi.mocked(safeDecode).mockRestore()
  })

  it('leaves non-JSON responses untouched', async () => {
    const fastify = Fastify()
    await fastify.register(toonPlugin)

    fastify.get('/plain', async (_request, reply) => {
      reply.type('text/plain').send('hello world')
    })

    const res = await fastify.inject({
      method: 'GET',
      url: '/plain',
      headers: { accept: 'text/toon, text/plain' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.body).toBe('hello world')
  })
})
