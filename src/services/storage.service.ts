import { realpathSync, statSync } from 'fs'
import { basename, isAbsolute, join, relative, resolve, sep } from 'path'

export const PROJECTS_DIR = join(process.cwd(), 'data', 'projects')

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/

function requireSafeSegment(value: string, label: string): void {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`${label} contains unsupported characters`)
  }
}

export function isPathWithin(basePath: string, candidatePath: string): boolean {
  const rel = relative(resolve(basePath), resolve(candidatePath))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

export function resolveWithin(basePath: string, ...segments: string[]): string {
  for (const segment of segments) requireSafeSegment(segment, 'Path segment')
  const resolved = resolve(basePath, ...segments)
  if (!isPathWithin(basePath, resolved)) throw new Error('Resolved path escapes storage root')
  return resolved
}

export function getProjectDirectory(ownerUserId: string, projectId: string): string {
  requireSafeSegment(ownerUserId, 'User ID')
  requireSafeSegment(projectId, 'Project ID')
  return resolveWithin(PROJECTS_DIR, ownerUserId, projectId)
}

export function requireExistingProjectFile(
  filePath: string,
  ownerUserId: string,
  projectId: string,
): string {
  const projectRoot = realpathSync(getProjectDirectory(ownerUserId, projectId))
  const realFilePath = realpathSync(filePath)
  if (!isPathWithin(projectRoot, realFilePath)) {
    throw new Error('File is outside the project storage directory')
  }
  if (!statSync(realFilePath).isFile()) throw new Error('Requested path is not a file')
  return realFilePath
}

export function sanitizeFilename(value: string, fallback = 'download'): string {
  const cleaned = basename(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
  return cleaned || fallback
}
