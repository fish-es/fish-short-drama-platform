import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight CORS proxy for external video URLs.
 * Only pipes the byte stream — no transcoding, minimal CPU/memory.
 * This avoids CORS blocking when the browser fetches AI-generated
 * video clips from external CDNs during client-side merging.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      return NextResponse.json(
        { error: `Upstream responded ${resp.status}` },
        { status: 502 }
      )
    }

    const contentType = resp.headers.get('content-type') || 'video/mp4'
    const contentLength = resp.headers.get('content-length')

    // Stream the response body directly — no buffering
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    }
    if (contentLength) headers['Content-Length'] = contentLength

    return new NextResponse(resp.body, { headers })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
