import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  getProjectDirectory,
  isPathWithin,
  PROJECTS_DIR,
  requireExistingFileWithinRoot,
  resolveWithin,
  sanitizeFilename,
} from './storage.service'

describe('project storage paths', () => {
  it('builds project paths only from server-generated identifiers', () => {
    const path = getProjectDirectory('0123456789abcdef', '3ec7521d-7342-4b1b-834e-bb1236ca9e64')
    expect(isPathWithin(PROJECTS_DIR, path)).toBe(true)
    expect(path).toContain('0123456789abcdef')
    expect(path).toContain('3ec7521d-7342-4b1b-834e-bb1236ca9e64')
  })

  it.each(['.', '..', '../outside', 'folder/name', 'folder\\name', 'C:\\Windows'])(
    'rejects unsafe path segment %s',
    segment => {
      expect(() => resolveWithin(PROJECTS_DIR, segment)).toThrow()
    },
  )

  it('distinguishes descendants from sibling paths', () => {
    // Use platform-native separators so this assertion is stable on both Windows and Linux CI.
    const base = join('data', 'projects')
    const child = join(base, 'user', 'project')
    const sibling = join('data', 'projects-evil', 'file')
    expect(isPathWithin(base, child)).toBe(true)
    expect(isPathWithin(base, sibling)).toBe(false)

    // Also cover Windows-style input strings (may appear in DB paths / tests).
    expect(isPathWithin('C:\\data\\projects', 'C:\\data\\projects\\user\\project')).toBe(true)
    expect(isPathWithin('C:\\data\\projects', 'C:\\data\\projects-evil\\file')).toBe(false)
  })

  it('removes path separators and reserved filename characters', () => {
    expect(sanitizeFilename('../bad:name?.mp4')).toBe('bad_name_.mp4')
  })

  it('allows legacy files only below a distinct authorized project root', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'fish-storage-'))
    try {
      const legacyBase = join(temporaryRoot, 'ShortDrama')
      const projectRoot = join(legacyBase, 'existing-project')
      const projectFile = join(projectRoot, 'references', 'cover.png')
      const otherFile = join(legacyBase, 'other-project', 'secret.png')
      mkdirSync(join(projectRoot, 'references'), { recursive: true })
      mkdirSync(join(legacyBase, 'other-project'), { recursive: true })
      writeFileSync(projectFile, 'project')
      writeFileSync(otherFile, 'other')

      expect(requireExistingFileWithinRoot(projectRoot, projectFile, legacyBase))
        .toBe(realpathSync(projectFile))
      expect(() => requireExistingFileWithinRoot(projectRoot, otherFile, legacyBase))
        .toThrow()
      expect(() => requireExistingFileWithinRoot(legacyBase, projectFile, legacyBase))
        .toThrow()
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })
})
