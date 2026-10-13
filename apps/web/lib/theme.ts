export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'trickle:theme'

/**
 * Dijalankan di <head> sebelum halaman tampil: pasang tema pilihan pengguna
 * (kalau ada) supaya tidak berkedip. Tanpa pilihan, tema mengikuti sistem
 * lewat `prefers-color-scheme` di globals.css (DESIGN.md 2.3).
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t}}catch(e){}})()`
