import { NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'

function count(db: any, sql: string): number {
  const rows = db.exec(sql)
  if (!rows.length || !rows[0].values.length) return 0
  return Number(rows[0].values[0][0]) || 0
}

export async function GET() {
  const db = await getDatabase()

  // "今日" 按 UTC 计（created_at 存的是 UTC）
  const today = "date(created_at) = date('now')"

  const stats = {
    scripts: {
      today: count(db, `SELECT COUNT(*) FROM scripts WHERE ${today}`),
      total: count(db, 'SELECT COUNT(*) FROM scripts'),
    },
    images: {
      today: count(db, `SELECT COUNT(*) FROM image_assets WHERE ${today}`),
      total: count(db, 'SELECT COUNT(*) FROM image_assets'),
    },
    videos: {
      today: count(db, `SELECT COUNT(*) FROM video_clips WHERE status = 'completed' AND ${today}`),
      total: count(db, "SELECT COUNT(*) FROM video_clips WHERE status = 'completed'"),
    },
    projects: {
      today: count(db, `SELECT COUNT(*) FROM projects WHERE ${today}`),
      total: count(db, 'SELECT COUNT(*) FROM projects'),
    },
  }

  return NextResponse.json(stats)
}
