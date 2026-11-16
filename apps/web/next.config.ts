import type { NextConfig } from 'next'

/**
 * Old short paths, renamed to readable ones. Invite links and bookmarks shared
 * before the rename keep working; the rest of the path and the query string
 * carry over (`/w/invite/ABC` → `/worker/invite/ABC`). Temporary (307) so a
 * browser never caches it for good, in case the rename has to be rolled back.
 */
const renamed = [
  ['/w', '/worker'],
  ['/f', '/family'],
  ['/perusahaan', '/for-companies'],
] as const

const nextConfig: NextConfig = {
  async redirects() {
    return renamed.flatMap(([from, to]) => [
      { source: from, destination: to, permanent: false },
      { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: false },
    ])
  },
}

export default nextConfig
