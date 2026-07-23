import { describe, expect, it } from 'vitest'
import {
  getProjectDirectory,
  isPathWithin,
  PROJECTS_DIR,
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
    expect(isPathWithin('C:\\data\\projects', 'C:\\data\\projects\\user\\project')).toBe(true)
    expect(isPathWithin('C:\\data\\projects', 'C:\\data\\projects-evil\\file')).toBe(false)
  })

  it('removes path separators and reserved filename characters', () => {
    expect(sanitizeFilename('../bad:name?.mp4')).toBe('bad_name_.mp4')
  })
})
