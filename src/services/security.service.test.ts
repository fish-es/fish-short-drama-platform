import { join } from 'path'
import initSqlJs from 'sql.js'
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type DatabaseReader,
  requireAssetAccess,
  requireAuth,
  requireEpisodeAccess,
  requireEpisodeInProject,
  requireProjectAccess,
  requireSceneAccess,
  requireScriptAccess,
} from './security.service'
import { getUserId } from './user.service'

let SQL: Awaited<ReturnType<typeof initSqlJs>>
let db: DatabaseReader & {
  run(sql: string, params?: Array<string | number | null>): void
}

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: file => join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  })
})

beforeEach(() => {
  db = new SQL.Database()
  db.run(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, user_id TEXT, is_public INTEGER);
    CREATE TABLE scripts (id TEXT PRIMARY KEY, project_id TEXT);
    CREATE TABLE episodes (id TEXT PRIMARY KEY, script_id TEXT);
    CREATE TABLE scenes (id TEXT PRIMARY KEY, script_id TEXT, episode_id TEXT);
    CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT);
    CREATE TABLE locations (id TEXT PRIMARY KEY, project_id TEXT);

    INSERT INTO projects VALUES ('private-project', 'owner', 0);
    INSERT INTO projects VALUES ('public-project', 'owner', 1);
    INSERT INTO projects VALUES ('other-project', 'other-owner', 0);
    INSERT INTO scripts VALUES ('private-script', 'private-project');
    INSERT INTO scripts VALUES ('public-script', 'public-project');
    INSERT INTO episodes VALUES ('private-episode', 'private-script');
    INSERT INTO episodes VALUES ('public-episode', 'public-script');
    INSERT INTO scenes VALUES ('private-scene', 'private-script', 'private-episode');
    INSERT INTO scenes VALUES ('public-scene', 'public-script', 'public-episode');
    INSERT INTO characters VALUES ('private-character', 'private-project');
    INSERT INTO locations VALUES ('public-location', 'public-project');
  `)
})

describe('request authentication', () => {
  it('rejects a missing API key', () => {
    const request = new NextRequest('http://localhost/api/project')
    expect(() => requireAuth(request)).toThrow('请先设置 API Key')
  })

  it('normalizes the API key and derives its user id', () => {
    const request = new NextRequest('http://localhost/api/project', {
      headers: { 'x-api-key': '  example-key  ' },
    })
    expect(requireAuth(request)).toEqual({
      apiKey: 'example-key',
      userId: getUserId('example-key'),
    })
  })
})

describe('resource ownership checks', () => {
  it('lets owners read and write their project hierarchy', () => {
    expect(() => requireProjectAccess(db, 'private-project', 'owner', 'write')).not.toThrow()
    expect(() => requireScriptAccess(db, 'private-script', 'owner', 'write')).not.toThrow()
    expect(() => requireEpisodeAccess(db, 'private-episode', 'owner', 'write')).not.toThrow()
    expect(() => requireSceneAccess(db, 'private-scene', 'owner', 'write')).not.toThrow()
    expect(() => requireAssetAccess(db, 'private-character', 'character', 'owner', 'write')).not.toThrow()
  })

  it('allows public reads but blocks writes from another user', () => {
    expect(() => requireProjectAccess(db, 'public-project', 'viewer', 'read')).not.toThrow()
    expect(() => requireScriptAccess(db, 'public-script', 'viewer', 'read')).not.toThrow()
    expect(() => requireEpisodeAccess(db, 'public-episode', 'viewer', 'read')).not.toThrow()
    expect(() => requireSceneAccess(db, 'public-scene', 'viewer', 'read')).not.toThrow()
    expect(() => requireAssetAccess(db, 'public-location', 'location', 'viewer', 'read')).not.toThrow()
    expect(() => requireProjectAccess(db, 'public-project', 'viewer', 'write')).toThrow('项目不存在')
  })

  it('hides private resources from other users', () => {
    expect(() => requireProjectAccess(db, 'private-project', 'viewer', 'read')).toThrow('项目不存在')
    expect(() => requireScriptAccess(db, 'private-script', 'viewer', 'read')).toThrow('剧本不存在')
    expect(() => requireEpisodeAccess(db, 'private-episode', 'viewer', 'read')).toThrow('剧集不存在')
    expect(() => requireSceneAccess(db, 'private-scene', 'viewer', 'read')).toThrow('场景不存在')
  })

  it('rejects an episode from a different project during assembly', () => {
    expect(() => requireEpisodeInProject(
      db,
      'private-episode',
      'public-project',
      'owner',
    )).toThrow('剧集不存在')
  })
})
