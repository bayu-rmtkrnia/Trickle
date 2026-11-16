import type { MetadataRoute } from 'next'

// Lets phones install Trickle to the home screen. Next.js serves this at /manifest.webmanifest
// and links it from every page. The icons are the logo symbol on the dark `bg` token.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trickle',
    short_name: 'Trickle',
    description: 'Gaji mengalir tiap detik. Tarik kapan saja.',
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E0B1A',
    theme_color: '#0E0B1A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
