export function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px), ((pointer: coarse) and (max-width: 1100px))').matches;
}

export function enterMobileFullscreen(node) {
  if (typeof window === 'undefined' || !isMobileViewport()) return Promise.resolve();
  const el = node || document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return Promise.resolve();
  return Promise.resolve(request.call(el)).catch(() => {});
}

export function exitMobileFullscreen() {
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  if (!active) return Promise.resolve();
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit) return Promise.resolve();
  return Promise.resolve(exit.call(document)).catch(() => {});
}
