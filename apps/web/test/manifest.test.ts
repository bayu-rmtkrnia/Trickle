import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'

// PNG stores width and height as big-endian integers at bytes 16-23 of the IHDR chunk.
function pngSize(path: string) {
  const file = readFileSync(path)
  return `${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`
}

describe('web app manifest', () => {
  const app = manifest()

  it('opens Trickle full screen from the home screen', () => {
    expect(app).toMatchObject({ name: 'Trickle', start_url: '/', display: 'standalone' })
  })

  it('has install icons that exist in public/ at their declared size', () => {
    const icons = app.icons ?? []
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
    for (const icon of icons) {
      expect(pngSize(join(__dirname, '..', 'public', icon.src))).toBe(icon.sizes)
    }
  })
})
