export const bgColorPresets = [
  { id: 'black', name: 'Black', value: '#000000' },
  { id: 'white', name: 'White', value: '#ffffff' },
  { id: 'gray', name: 'Gray', value: '#cfd1d8' },
  { id: 'purple', name: 'Purple', value: 'linear-gradient(135deg, #f0e8ff, #e8d5ff)' },
  { id: 'rainbow', name: 'Rainbow', value: 'linear-gradient(45deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #b48cff)' },
  { id: 'stripe', name: 'Stripe', value: '/stripe.jpg' },
  { id: 'pattern', name: 'Pattern', value: '/pattern.jpg' },
  { id: 'vect', name: 'Vector', value: '/vect.jpg' },
  { id: 'flowers', name: 'Floral', value: '/flowers.png' },
];

export function getBorderForBackground(value) {
  const isImage = typeof value === 'string' && value.startsWith('/');
  if (isImage || (typeof value === 'string' && value.startsWith('linear-gradient'))) {
    return '#ffffff';
  }
  return value;
}

export function getBackgroundPreviewStyle(value) {
  if (typeof value === 'string' && value.startsWith('/')) {
    return { background: `url(${value}) center/cover no-repeat` };
  }
  return { background: value };
}

/** Solid colors and gradients can be shown via CSS instead of re-rendering the strip canvas. */
export function isCssOnlyBackground(value) {
  if (typeof value !== 'string') return false;
  return !value.startsWith('/') && !value.startsWith('data:image');
}

export function buildCustomGradient(hex) {
  return `linear-gradient(135deg, ${hex}40, ${hex})`;
}
