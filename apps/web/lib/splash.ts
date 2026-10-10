export const SPLASH_STORAGE_KEY = 'trickle:splash'

/**
 * Dijalankan di <head> sebelum halaman tampil: kalau splash sudah pernah
 * muncul di sesi ini, sembunyikan lewat CSS supaya tidak berkedip.
 * `?splash=1` memaksa splash tampil lagi (hanya saat development).
 */
export const splashScript = `(function(){try{var d=document.documentElement;var force=${
  process.env.NODE_ENV !== 'production'
}&&/[?&]splash=1/.test(location.search);if(!force&&sessionStorage.getItem('${SPLASH_STORAGE_KEY}')){d.dataset.splash='off'}else{sessionStorage.setItem('${SPLASH_STORAGE_KEY}','1')}}catch(e){document.documentElement.dataset.splash='off'}})()`
