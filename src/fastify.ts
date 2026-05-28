import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { ToonMiddlewareOptions } from './express.js'
import { safeEncode, safeDecode, calculateSavings, isToonWorthIt } from './utils.js'

const toonPlugin: FastifyPluginAsync<ToonMiddlewareOptions> = async (fastify, options) => {
  const {
    encode: doEncode = true,
    decode: doDecode = true,
    strict = false,
    statsHeader = false,
    threshold = 0.1,
  } = options

  if (doDecode) {
    // Register a content type parser so Fastify accepts text/toon bodies
    fastify.addContentTypeParser(
      'text/toon',
      { parseAs: 'string' },
      (_req: FastifyRequest, body: string, done: (err: Error | null, body?: unknown) => void) => {
        const decoded = safeDecode(body)
        if (decoded === null) {
          if (strict) {
            const err = Object.assign(new Error('Failed to decode TOON request body'), {
              statusCode: 400,
            })
            done(err)
          } else {
            done(null, body)
          }
        } else {
          done(null, decoded)
        }
      }
    )
  }

  if (doEncode) {
    fastify.addHook(
      'onSend',
      async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
        const contentType = reply.getHeader('content-type') as string | undefined
        if (!contentType?.includes('application/json')) return payload

        const acceptsTooon = request.headers['accept']?.includes('text/toon') ?? false
        if (!acceptsTooon) return payload

        let data: unknown
        try {
          data = typeof payload === 'string' ? JSON.parse(payload) : payload
        } catch {
          return payload
        }

        if (!isToonWorthIt(data, threshold)) return payload

        const toonStr = safeEncode(data)
        if (!toonStr) return payload

        if (statsHeader) {
          const jsonStr = JSON.stringify(data, null, 2)
          const { savingsPercent } = calculateSavings(jsonStr, toonStr)
          reply.header('X-TOON-Token-Savings', `${savingsPercent.toFixed(1)}%`)
        }

        reply.header('Content-Type', 'text/toon')
        return toonStr
      }
    )
  }
}

export default fp(toonPlugin, {
  name: 'toon-middleware',
  fastify: '>=4.0.0',
})
