import { describe, expect, it } from 'vitest'
import {
  createPinnedLookup,
  isPrivateAddress,
  parseRemoteMediaUrl,
} from './remote-media.service'

describe('remote media URL validation', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
  ])('blocks private address %s', address => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '2606:4700:4700::1111',
    // Public IPv4-mapped IPv6 must stay public (dual-stack DNS often returns this form).
    '::ffff:8.8.8.8',
    '::ffff:0808:0808',
  ])('allows public address %s', address => {
    expect(isPrivateAddress(address)).toBe(false)
  })

  it.each([
    'file:///etc/passwd',
    'http://localhost/image.png',
    'http://127.0.0.1/image.png',
    'http://169.254.169.254/latest/meta-data',
    'https://user:pass@example.com/image.png',
    'https://example.com:3000/image.png',
  ])('rejects unsafe URL %s', value => {
    expect(() => parseRemoteMediaUrl(value)).toThrow()
  })

  it('honors Node lookup all:true callbacks without exposing unvetted addresses', () => {
    const pinnedLookup = createPinnedLookup({ address: '8.8.8.8', family: 4 })
    let callbackArgs: unknown[] = []

    pinnedLookup('cdn.example.com', { all: true }, (...args) => {
      callbackArgs = args
    })

    expect(callbackArgs).toEqual([
      null,
      [{ address: '8.8.8.8', family: 4 }],
    ])
  })

  it('uses the standard lookup callback shape when all is not requested', () => {
    const pinnedLookup = createPinnedLookup({ address: '8.8.8.8', family: 4 })
    let callbackArgs: unknown[] = []

    pinnedLookup('cdn.example.com', {}, (...args) => {
      callbackArgs = args
    })

    expect(callbackArgs).toEqual([null, '8.8.8.8', 4])
  })

  it('accepts a normal public HTTPS URL', () => {
    expect(parseRemoteMediaUrl('https://cdn.example.com/image.png').toString())
      .toBe('https://cdn.example.com/image.png')
  })
})
