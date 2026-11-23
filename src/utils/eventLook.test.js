import { getDefaultDatePosition } from './stripCompositor';
import { applyLookToEventStrips, lookForLayout } from './eventLook';
import { patchHostStrip, apiRequest } from './api';
import { renderStripToCanvas } from './stripCompositor';

jest.mock('./api', () => ({
  apiRequest: jest.fn(),
  patchHostStrip: jest.fn(async () => ({})),
}));

jest.mock('./dataUrlFile', () => ({
  dataUrlToFile: jest.fn(async () => ({ name: 'strip.png', type: 'image/png' })),
}));

jest.mock('./stripCompositor', () => {
  const actual = jest.requireActual('./stripCompositor');
  return {
    ...actual,
    renderStripToCanvas: jest.fn(async ({ layoutId }) => `data:image/png;layout=${layoutId}`),
  };
});

const classicLook = {
  customBg: '#111111',
  customBorder: '#ffffff',
  showDate: true,
  dateSize: 12,
  dateColor: '#E8A33D',
  dateX: 0.5,
  dateY: 0.92,
  dateFont: '"Special Elite", cursive',
};

test('same layout keeps the dragged date position', () => {
  expect(lookForLayout(classicLook, 1, 1).dateY).toBe(0.92);
});

test('a different layout gets that layout’s date slot, not the edited strip’s coordinates', () => {
  const polaroid = lookForLayout(classicLook, 3, 1);
  const expected = getDefaultDatePosition(3, { placement: 'belowPhotos', dateSize: 12 });
  expect(polaroid.customBg).toBe('#111111');
  expect(polaroid.showDate).toBe(true);
  expect(polaroid.dateX).toBeCloseTo(expected.x);
  expect(polaroid.dateY).toBeCloseTo(expected.y);
  expect(polaroid.dateY).not.toBeCloseTo(classicLook.dateY, 3);
});

test('applying a look composites each guest strip in its own layout', async () => {
  apiRequest.mockResolvedValue({
    strips: [
      { id: 11, layoutId: 1, photoUrls: ['a', 'b', 'c', 'd'] },
      { id: 22, layoutId: 3, photoUrls: ['p'] },
      { id: 33, layoutId: 2, photoUrls: ['w', 'x', 'y', 'z'] },
    ],
    hasMore: false,
  });

  await applyLookToEventStrips({
    eventId: 9,
    skipStripId: 11,
    sourceLayoutId: 1,
    look: classicLook,
  });

  const layoutsUsed = renderStripToCanvas.mock.calls.map(([opts]) => opts.layoutId);
  expect(layoutsUsed).toEqual([3, 2]);
  expect(renderStripToCanvas.mock.calls[0][0].photos).toHaveLength(1);
  expect(renderStripToCanvas.mock.calls[1][0].photos).toHaveLength(4);

  const polaroidDate = getDefaultDatePosition(3, { placement: 'belowPhotos', dateSize: 12 });
  expect(renderStripToCanvas.mock.calls[0][0].dateY).toBeCloseTo(polaroidDate.y);
  expect(renderStripToCanvas.mock.calls[0][0].customBg).toBe('#111111');

  expect(patchHostStrip).toHaveBeenCalledTimes(2);
  expect(patchHostStrip.mock.calls[0][0]).toBe(9);
  expect(patchHostStrip.mock.calls[0][1]).toBe(22);
  expect(patchHostStrip.mock.calls[1][1]).toBe(33);
});
