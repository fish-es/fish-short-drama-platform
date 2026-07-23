import { isIP } from 'net'
import { lookup } from 'dns/promises'
import http from 'http'
import https from 'https'

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 3

export interface RemoteMediaOptions {
  allowedContentTypes: string[]
  maxBytes: number
  timeoutMs?: number
}

interface ResolvedAddress {
  address: string
  family: number
}

interface RemoteResponse {
  statusCode: number
  location?: string
  contentType: string
  body: Buffer
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  )
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('ff')) return true
  if (normalized.startsWith('2001:db8:')) return true
  if (normalized.startsWith('::ffff:')) return true

  return false
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family === 6) return isPrivateIpv6(address)
  return true
}

export function parseRemoteMediaUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('媒体 URL 无效')
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('媒体 URL 仅支持 HTTP(S)')
  if (url.username || url.password) throw new Error('媒体 URL 不允许包含凭据')
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('媒体 URL 端口不受支持')

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('媒体 URL 不允许访问本地网络')
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) throw new Error('媒体 URL 不允许访问私有地址')
  return url
}

async function resolvePublicAddress(url: URL): Promise<ResolvedAddress> {
  const results = await lookup(url.hostname, { all: true, verbatim: true })
  if (results.length === 0 || results.some(result => isPrivateAddress(result.address))) {
    throw new Error('媒体 URL 解析到了私有或无效地址')
  }
  return results[0]
}

export async function validateRemoteMediaUrl(value: string): Promise<string> {
  const url = parseRemoteMediaUrl(value)
  await resolvePublicAddress(url)
  return url.toString()
}

function requestOnce(
  url: URL,
  resolved: ResolvedAddress,
  options: RemoteMediaOptions,
): Promise<RemoteResponse> {
  const client = url.protocol === 'https:' ? https : http
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise((resolvePromise, rejectPromise) => {
    const request = client.get(
      url,
      {
        headers: { Accept: options.allowedContentTypes.map(type => `${type}*`).join(', ') },
        lookup: (_hostname, _lookupOptions, callback) => {
          callback(null, resolved.address, resolved.family)
        },
      },
      response => {
        const statusCode = response.statusCode || 0
        const contentType = String(response.headers['content-type'] || '').toLowerCase()
        const location = response.headers.location
        const chunks: Buffer[] = []
        let totalBytes = 0

        response.on('data', chunk => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          totalBytes += buffer.length
          if (totalBytes > options.maxBytes) {
            request.destroy(new Error('远程媒体文件过大'))
            return
          }
          chunks.push(buffer)
        })
        response.on('end', () => {
          resolvePromise({
            statusCode,
            location,
            contentType,
            body: Buffer.concat(chunks),
          })
        })
      },
    )

    request.setTimeout(timeoutMs, () => request.destroy(new Error('获取远程媒体超时')))
    request.on('error', rejectPromise)
  })
}

export async function fetchRemoteMedia(
  value: string,
  options: RemoteMediaOptions,
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  let url = parseRemoteMediaUrl(value)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const resolved = await resolvePublicAddress(url)
    const response = await requestOnce(url, resolved, options)

    if (response.statusCode >= 300 && response.statusCode < 400 && response.location) {
      if (redirectCount === MAX_REDIRECTS) throw new Error('远程媒体重定向次数过多')
      url = parseRemoteMediaUrl(new URL(response.location, url).toString())
      continue
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`远程媒体请求失败: ${response.statusCode}`)
    }
    if (!options.allowedContentTypes.some(type => response.contentType.startsWith(type))) {
      throw new Error('远程资源不是允许的媒体类型')
    }
    return { buffer: response.body, contentType: response.contentType, finalUrl: url.toString() }
  }

  throw new Error('无法获取远程媒体')
}
