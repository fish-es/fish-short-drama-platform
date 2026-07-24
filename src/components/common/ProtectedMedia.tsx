'use client'

import { useEffect, useState } from 'react'

interface ProtectedMediaProps {
  source: string
  protectedUrl: string
  alt?: string
  className?: string
  controls?: boolean
  onClick?: () => void
}

function useMediaUrl(source: string, protectedUrl: string): string {
  const [loaded, setLoaded] = useState({ key: '', url: '' })
  const remoteUrl = source.startsWith('http') ? source : ''
  const requestKey = `${source}|${protectedUrl}`

  useEffect(() => {
    if (!source || remoteUrl) return

    let active = true
    let objectUrl = ''
    fetch(protectedUrl, {
      headers: { 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
    })
      .then(response => {
        if (!response.ok) throw new Error('媒体加载失败')
        return response.blob()
      })
      .then(blob => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ key: requestKey, url: objectUrl })
      })
      .catch(() => {})

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [protectedUrl, remoteUrl, requestKey, source])

  return remoteUrl || (loaded.key === requestKey ? loaded.url : '')
}

export function ProtectedImage({
  source,
  protectedUrl,
  alt = '',
  className,
  onClick,
}: ProtectedMediaProps) {
  const mediaUrl = useMediaUrl(source, protectedUrl)
  if (!mediaUrl) return null
  // Blob URLs come from authenticated fetches and cannot use Next Image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl} alt={alt} className={className} onClick={onClick} />
}

export function ProtectedVideo({
  source,
  protectedUrl,
  className,
  controls = true,
}: ProtectedMediaProps) {
  const mediaUrl = useMediaUrl(source, protectedUrl)
  if (!mediaUrl) return null
  return <video src={mediaUrl} controls={controls} className={className} />
}

export async function downloadProtectedFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url, {
    headers: { 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
  })
  if (!response.ok) throw new Error('文件下载失败')

  const blobUrl = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(blobUrl)
}
