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

function extractMappedIpv4(address: string): string | null {
  const normalized = address.toLowerCase().split('%')[0]
  if (!normalized.startsWith('::ffff:')) return null

  const embedded = normalized.slice('::ffff:'.length)
  if (isIP(embedded) === 4) return embedded

  // Compact form like ::ffff:7f00:1
  const parts = embedded.split(':')
  if (parts.length === 2 && parts.every(part => /^[0-9a-f]{1,4}$/i.test(part))) {
    const hi = parseInt(parts[0], 16)
    const lo = parseInt(parts[1], 16)
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
  }
  return null
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('ff')) return true
  if (normalized.startsWith('2001:db8:')) return true

  const mappedIpv4 = extractMappedIpv4(normalized)
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4)

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
  // Dual-stack hosts may return a mix of public + link-local records.
  // Only reject when there is no usable public address.
  const publicResults = results.filter(result => !isPrivateAddress(result.address))
  if (publicResults.length === 0) {
    throw new Error('媒体 URL 解析到了私有或无效地址')
  }
  return publicResults[0]
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

function sniffMediaContentType(buffer: Buffer): string | null {
  if (buffer.length >= 8) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png'
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg'
    }
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return 'image/webp'
    }
  }
  if (buffer.length >= 12) {
    const box = buffer.subarray(4, 8).toString('ascii')
    if (box === 'ftyp') return 'video/mp4'
  }
  return null
}

function isAllowedContentType(
  contentType: string,
  allowedContentTypes: string[],
  buffer: Buffer,
): boolean {
  if (allowedContentTypes.some(type => contentType.startsWith(type))) return true

  // Some CDNs return empty / octet-stream for signed media URLs.
  const sniffed = sniffMediaContentType(buffer)
  if (!sniffed) return false
  if (
    contentType === '' ||
    contentType.includes('octet-stream') ||
    contentType.startsWith('binary/')
  ) {
    return allowedContentTypes.some(type => sniffed.startsWith(type.replace(/\*$/, '')))
  }
  return false
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
    if (!isAllowedContentType(response.contentType, options.allowedContentTypes, response.body)) {
      throw new Error('远程资源不是允许的媒体类型')
    }
    return {
      buffer: response.body,
      contentType:
        response.contentType || sniffMediaContentType(response.body) || 'application/octet-stream',
      finalUrl: url.toString(),
    }
  }

  throw new Error('无法获取远程媒体')
}
