import type { Request, Response, NextFunction } from 'express'
import { safeEncode, safeDecode, calculateSavings, isToonWorthIt } from './utils.js'

export interface ToonMiddlewareOptions {
  encode?: boolean
  decode?: boolean
  strict?: boolean
  statsHeader?: boolean
  threshold?: number
  routes?: string[]
}

function matchesRoute(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Convert glob pattern to regex: escape special chars, replace * with .*
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(path)
  })
}

function createHandler(options: ToonMiddlewareOptions = {}) {
  const {
    encode: doEncode = true,
    decode: doDecode = true,
    strict = false,
    statsHeader = false,
    threshold = 0.1,
    routes,
  } = options

  return function toonHandler(req: Request, res: Response, next: NextFunction): void {
    if (routes && routes.length > 0 && !matchesRoute(req.path, routes)) {
      return next()
    }

    // Request decoding: TOON → JSON
    if (doDecode && req.headers['content-type']?.includes('text/toon')) {
      const decodeToonBody = (raw: string) => {
        const decoded = safeDecode(raw)
        if (decoded === null) {
          if (strict) {
            interceptResponse()
            return next(new Error('Failed to decode TOON request body'))
          }
          // Leave req.body unchanged, fall through
        } else {
          req.body = decoded
        }
        interceptResponse()
        next()
      }

      // Case 1: body already read by a prior parser (e.g. express.text())
      if (typeof req.body === 'string') {
        return decodeToonBody(req.body)
      }

      // Case 2: body not yet consumed — read the stream
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => decodeToonBody(Buffer.concat(chunks).toString('utf-8')))
      req.on('error', (err) => next(err))
      return
    }

    interceptResponse()
    next()

    function interceptResponse() {
      if (!doEncode) return

      const originalJson = res.json.bind(res)

      res.json = function (data: unknown): Response {
        res.json = originalJson

        const acceptsTooon = req.headers['accept']?.includes('text/toon') ?? false
        if (!acceptsTooon) {
          return originalJson(data)
        }

        if (!isToonWorthIt(data, threshold)) {
          return originalJson(data)
        }

        const toonStr = safeEncode(data)
        if (!toonStr) {
          return originalJson(data)
        }

        if (statsHeader) {
          const jsonStr = JSON.stringify(data, null, 2)
          const { savingsPercent } = calculateSavings(jsonStr, toonStr)
          res.setHeader('X-TOON-Token-Savings', `${savingsPercent.toFixed(1)}%`)
        }

        res.setHeader('Content-Type', 'text/toon')
        res.send(toonStr)
        return res
      }
    }
  }
}

export function toonMiddleware(
  options?: ToonMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return createHandler(options)
}

export function toon(
  options?: ToonMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return createHandler(options)
}
