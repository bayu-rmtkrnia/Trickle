import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'

describe('renamed web paths', () => {
  it('sends the old short paths, with whatever follows, to the readable ones', async () => {
    const redirects = await nextConfig.redirects!()
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: '/w', destination: '/worker', permanent: false },
        { source: '/w/:path*', destination: '/worker/:path*', permanent: false },
        { source: '/f', destination: '/family', permanent: false },
        { source: '/f/:path*', destination: '/family/:path*', permanent: false },
        { source: '/perusahaan', destination: '/for-companies', permanent: false },
        { source: '/perusahaan/:path*', destination: '/for-companies/:path*', permanent: false },
      ]),
    )
  })
})
