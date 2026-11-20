export function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px), ((pointer: coarse) and (max-width: 1100px))').matches;
}

export function enterMobileFullscreen(node) {
  if (typeof window === 'undefined' || !isMobileViewport()) return Promise.resolve();
  if (document.fullscreenElement || document.webkitFullscreenElement) return Promise.resolve();
  const el = node || document.documentElement;
  try {
    if (el.requestFullscreen) {
      return Promise.resolve(el.requestFullscreen({ navigationUI: 'hide' })).catch(() => {});
    }
    if (el.webkitRequestFullscreen) {
      return Promise.resolve(el.webkitRequestFullscreen()).catch(() => {});
    }
  } catch {
    return Promise.resolve();
  }
  return Promise.resolve();
}

export function exitMobileFullscreen() {
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  if (!active) return Promise.resolve();
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit) return Promise.resolve();
  return Promise.resolve(exit.call(document)).catch(() => {});
}
