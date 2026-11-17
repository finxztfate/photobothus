const MAX_LOCAL_STORAGE_LEN = 4096;

function isPersistableValue(value) {
  if (value == null) return false;
  const str = String(value);
  if (str.startsWith('data:image') || str.startsWith('data:application')) return false;
  return str.length <= MAX_LOCAL_STORAGE_LEN;
}

function safeSetItem(key, value) {
  if (typeof window === 'undefined' || !isPersistableValue(value)) return false;
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export const customization = {
  getBackground: () => (typeof window !== 'undefined' ? localStorage.getItem('photobooth_bg') : null),
  getBorder: () => (typeof window !== 'undefined' ? localStorage.getItem('photobooth_border') : null),
  getRadius: () => (typeof window !== 'undefined' ? localStorage.getItem('photobooth_radius') : null),
  setBackground: (value) => { safeSetItem('photobooth_bg', value); },
  setBorder: (value) => { safeSetItem('photobooth_border', value); },
  setRadius: (value) => { safeSetItem('photobooth_radius', value); },
};
