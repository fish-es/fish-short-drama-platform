import initSqlJs, { Database } from 'sql.js'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const DATA_DIR = join(process.cwd(), 'data')
const DB_PATH = join(DATA_DIR, 'short-drama.db')

// Use global to persist DB across hot reloads in dev mode
const globalForDb = globalThis as any

export async function getDatabase(): Promise<Database> {
  if (globalForDb.__db) return globalForDb.__db

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

  let wasmBinary: Buffer | undefined
  const wasmPaths = [
    join(process.cwd(), 'public', 'sql-wasm.wasm'),
    join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ]
  for (const p of wasmPaths) {
    if (existsSync(p)) { wasmBinary = readFileSync(p); break }
  }

  const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : undefined)

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH)
    globalForDb.__db = new SQL.Database(buffer)
  } else {
    globalForDb.__db = new SQL.Database()
  }

  globalForDb.__db.run(SCHEMA)
  runMigrations(globalForDb.__db)
  saveDatabase()
  return globalForDb.__db
}

function runMigrations(db: Database): void {
  const tableInfo = db.exec("PRAGMA table_info(projects)")
  if (tableInfo.length > 0) {
    const columns = tableInfo[0].values.map((row: any) => row[1])
    if (!columns.includes('user_id')) {
      db.run("ALTER TABLE projects ADD COLUMN user_id TEXT DEFAULT ''")
    }
  }

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
  if (!tables.length || !tables[0].values.length) {
    db.run(`CREATE TABLE feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  }

  const changelogTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='changelog'")
  if (!changelogTable.length || !changelogTable[0].values.length) {
    db.run(`CREATE TABLE changelog (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  }

  // Add is_public column if missing
  const projInfo2 = db.exec("PRAGMA table_info(projects)")
  if (projInfo2.length > 0) {
    const cols = projInfo2[0].values.map((row: any) => row[1])
    if (!cols.includes('is_public')) {
      db.run("ALTER TABLE projects ADD COLUMN is_public INTEGER DEFAULT 0")
    }
    if (!cols.includes('project_type')) {
      db.run("ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'drama'")
    }
  }

  // Auth tables (added in login feature)
  const usersTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
  if (!usersTable.length || !usersTable[0].values.length) {
    db.run(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  }

  const sessionsTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
  if (!sessionsTable.length || !sessionsTable[0].values.length) {
    db.run(`CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )`)
  }

  const resetsTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='password_resets'")
  if (!resetsTable.length || !resetsTable[0].values.length) {
    db.run(`CREATE TABLE password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    )`)
  }
}

export function saveDatabase(): void {
  if (!globalForDb.__db) return
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const data = globalForDb.__db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active',
  output_path TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  cover_image TEXT,
  drama_title TEXT,
  user_id TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0,
  project_type TEXT NOT NULL DEFAULT 'drama'
);

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  synopsis TEXT,
  outline TEXT,
  total_episodes INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  voice_id TEXT NOT NULL DEFAULT '',
  reference_image TEXT,
  keywords TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_image TEXT,
  keywords TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL DEFAULT '',
  script_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  dialogue TEXT NOT NULL DEFAULT '',
  characters TEXT NOT NULL DEFAULT '[]',
  location TEXT NOT NULL DEFAULT '',
  duration REAL NOT NULL DEFAULT 5.0,
  scene_order INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'DRAFT',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS image_assets (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '1024x768',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_current INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS video_clips (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  image_asset_id TEXT,
  task_id TEXT,
  video_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  file_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voice_tracks (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  text TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
`
