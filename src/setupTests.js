// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock('@vladmandic/face-api', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: jest.fn() },
    faceLandmark68Net: { loadFromUri: jest.fn() },
  },
  TinyFaceDetectorOptions: jest.fn(),
  detectAllFaces: jest.fn(() => ({ withFaceLandmarks: jest.fn(() => Promise.resolve([])) })),
}));

jest.mock('react-webcam', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

// App probes /api/health on boot; keep unit tests offline-friendly.
const originalFetch = global.fetch;
global.fetch = jest.fn((input, init) => {
  const url = String(input || '');
  if (url.includes('/api/health')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ ok: true }),
    });
  }
  if (typeof originalFetch === 'function') {
    return originalFetch(input, init);
  }
  return Promise.reject(new TypeError('Failed to fetch'));
});
