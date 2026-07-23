import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserId } from './user.service'

type SqlValue = string | number | null | Uint8Array

export interface DatabaseReader {
  exec(sql: string, params?: SqlValue[]): Array<{ values: SqlValue[][] }>
}

export type AccessMode = 'read' | 'write'

export interface RequestAuth {
  apiKey: string
  userId: string
}

export class RouteError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'RouteError'
  }
}

export function requireAuth(req: NextRequest): RequestAuth {
  const apiKey = req.headers.get('x-api-key')?.trim() || ''
  if (!apiKey) throw new RouteError(401, '请先设置 API Key')
  if (apiKey.length > 512) throw new RouteError(400, 'API Key 格式无效')
  return { apiKey, userId: getUserId(apiKey) }
}

export function routeErrorResponse(error: unknown): NextResponse {
  if (error instanceof RouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error('Unhandled route error', error)
  return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
}

function hasRow(db: DatabaseReader, sql: string, params: SqlValue[]): boolean {
  const rows = db.exec(sql, params)
  return rows.length > 0 && rows[0].values.length > 0
}

function projectPredicate(mode: AccessMode): string {
  return mode === 'write' ? 'p.user_id = ?' : '(p.user_id = ? OR p.is_public = 1)'
}

export function requireProjectAccess(
  db: DatabaseReader,
  projectId: string,
  userId: string,
  mode: AccessMode,
): void {
  const allowed = hasRow(
    db,
    `SELECT p.id FROM projects p WHERE p.id = ? AND ${projectPredicate(mode)}`,
    [projectId, userId],
  )
  if (!allowed) throw new RouteError(404, '项目不存在')
}

export function requireScriptAccess(
  db: DatabaseReader,
  scriptId: string,
  userId: string,
  mode: AccessMode,
): void {
  const allowed = hasRow(
    db,
    `SELECT s.id
     FROM scripts s
     JOIN projects p ON p.id = s.project_id
     WHERE s.id = ? AND ${projectPredicate(mode)}`,
    [scriptId, userId],
  )
  if (!allowed) throw new RouteError(404, '剧本不存在')
}

export function requireEpisodeAccess(
  db: DatabaseReader,
  episodeId: string,
  userId: string,
  mode: AccessMode,
): void {
  const allowed = hasRow(
    db,
    `SELECT e.id
     FROM episodes e
     JOIN scripts s ON s.id = e.script_id
     JOIN projects p ON p.id = s.project_id
     WHERE e.id = ? AND ${projectPredicate(mode)}`,
    [episodeId, userId],
  )
  if (!allowed) throw new RouteError(404, '剧集不存在')
}

export function requireSceneAccess(
  db: DatabaseReader,
  sceneId: string,
  userId: string,
  mode: AccessMode,
): void {
  const allowed = hasRow(
    db,
    `SELECT sc.id
     FROM scenes sc
     JOIN scripts s ON s.id = sc.script_id
     JOIN projects p ON p.id = s.project_id
     WHERE sc.id = ? AND ${projectPredicate(mode)}`,
    [sceneId, userId],
  )
  if (!allowed) throw new RouteError(404, '场景不存在')
}

export function requireAssetAccess(
  db: DatabaseReader,
  assetId: string,
  type: 'character' | 'location',
  userId: string,
  mode: AccessMode,
): void {
  const table = type === 'character' ? 'characters' : 'locations'
  const allowed = hasRow(
    db,
    `SELECT a.id
     FROM ${table} a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = ? AND ${projectPredicate(mode)}`,
    [assetId, userId],
  )
  if (!allowed) throw new RouteError(404, '资产不存在')
}

export function requireAssetInProject(
  db: DatabaseReader,
  assetId: string,
  type: 'character' | 'location',
  projectId: string,
  userId: string,
): void {
  const table = type === 'character' ? 'characters' : 'locations'
  const allowed = hasRow(
    db,
    `SELECT a.id
     FROM ${table} a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = ? AND p.id = ? AND p.user_id = ?`,
    [assetId, projectId, userId],
  )
  if (!allowed) throw new RouteError(404, '资产不存在')
}

export function requireEpisodeInProject(
  db: DatabaseReader,
  episodeId: string,
  projectId: string,
  userId: string,
): void {
  const allowed = hasRow(
    db,
    `SELECT e.id
     FROM episodes e
     JOIN scripts s ON s.id = e.script_id
     JOIN projects p ON p.id = s.project_id
     WHERE e.id = ? AND p.id = ? AND p.user_id = ?`,
    [episodeId, projectId, userId],
  )
  if (!allowed) throw new RouteError(404, '剧集不存在')
}
