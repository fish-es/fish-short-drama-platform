import { realpathSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, isAbsolute, join, relative, resolve, sep } from 'path'

export const PROJECTS_DIR = join(process.cwd(), 'data', 'projects')
export const LEGACY_PROJECTS_DIR = join(homedir(), 'ShortDrama')

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

export function requireExistingFileWithinRoot(
  rootPath: string,
  filePath: string,
  authorizedAncestor?: string,
): string {
  const realRoot = realpathSync(rootPath)
  if (authorizedAncestor) {
    const realAncestor = realpathSync(authorizedAncestor)
    if (realRoot === realAncestor || !isPathWithin(realAncestor, realRoot)) {
      throw new Error('Project root is outside the authorized storage directory')
    }
  }

  const realFilePath = realpathSync(filePath)
  if (!isPathWithin(realRoot, realFilePath) || !statSync(realFilePath).isFile()) {
    throw new Error('File is outside the authorized project storage directory')
  }
  return realFilePath
}

export function requireExistingProjectFile(
  filePath: string,
  ownerUserId: string,
  projectId: string,
  legacyProjectPath?: string,
): string {
  const projectRoot = getProjectDirectory(ownerUserId, projectId)
  const candidates: Array<{ rootPath: string; filePath: string; legacy: boolean }> = [
    { rootPath: projectRoot, filePath, legacy: false },
  ]

  if (legacyProjectPath) {
    const legacyFilePath = isPathWithin(projectRoot, filePath)
      ? resolve(legacyProjectPath, relative(projectRoot, filePath))
      : filePath
    candidates.push({
      rootPath: legacyProjectPath,
      filePath: legacyFilePath,
      legacy: true,
    })
  }

  for (const candidate of candidates) {
    try {
      return requireExistingFileWithinRoot(
        candidate.rootPath,
        candidate.filePath,
        candidate.legacy ? LEGACY_PROJECTS_DIR : undefined,
      )
    } catch {
      // Try the next authorized storage location.
    }
  }

  throw new Error('File is outside the authorized project storage directory')
}

export function sanitizeFilename(value: string, fallback = 'download'): string {
  const cleaned = basename(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
  return cleaned || fallback
}
