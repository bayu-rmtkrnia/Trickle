export const SPLASH_STORAGE_KEY = 'trickle:splash'

/**
 * Dijalankan di <head> sebelum halaman tampil: kalau splash sudah pernah
 * muncul di sesi ini, sembunyikan lewat CSS supaya tidak berkedip.
 * `?splash=1` memaksa splash tampil lagi (hanya saat development).
 */
export const splashScript = `(function(){try{var d=document.documentElement;var force=${
  process.env.NODE_ENV !== 'production'
}&&/[?&]splash=1/.test(location.search);if(!force&&sessionStorage.getItem('${SPLASH_STORAGE_KEY}')){d.dataset.splash='off'}else{sessionStorage.setItem('${SPLASH_STORAGE_KEY}','1')}}catch(e){document.documentElement.dataset.splash='off'}})()`

/** `true` selama splash cold start masih menutupi halaman. Hanya untuk dipanggil di browser. */
export function isSplashShowing() {
  const state = document.documentElement.dataset.splash
  return state !== 'off' && state !== 'done'
}

/**
 * Jalankan `callback` begitu splash selesai (langsung kalau splash tidak tampil).
 * Mengembalikan fungsi untuk membatalkan.
 */
export function onSplashDone(callback: () => void): () => void {
  if (!isSplashShowing()) {
    callback()
    return () => {}
  }
  const observer = new MutationObserver(() => {
    if (isSplashShowing()) return
    observer.disconnect()
    callback()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-splash'] })
  return () => observer.disconnect()
}
