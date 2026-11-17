const MIN_VISIBLE_MS = 450;

let pending = 0;
let visibleUntil = 0;
let holding = false;
let hideTimer = null;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

function armHide() {
  if (hideTimer) clearTimeout(hideTimer);
  const wait = Math.max(0, visibleUntil - Date.now());
  if (wait === 0) {
    holding = false;
    notify();
    return;
  }
  holding = true;
  hideTimer = setTimeout(() => {
    hideTimer = null;
    holding = false;
    if (pending === 0) notify();
  }, wait);
}

export function subscribeDataLoading(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDataLoading() {
  return pending > 0 || holding;
}

/** Keeps the loading modal up for the whole data action, including failures. */
export async function trackDataAction(work) {
  pending += 1;
  if (pending === 1) {
    visibleUntil = Date.now() + MIN_VISIBLE_MS;
    holding = true;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  notify();
  try {
    return await work();
  } finally {
    pending = Math.max(0, pending - 1);
    if (pending === 0) armHide();
  }
}
