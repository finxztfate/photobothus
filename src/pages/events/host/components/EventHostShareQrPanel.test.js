import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventHostShareQrPanel from './EventHostShareQrPanel';

jest.mock('qrcode.react', () => {
  const React = require('react');
  return {
    QRCodeSVG: () => <svg data-testid="qr-preview" />,
    QRCodeCanvas: React.forwardRef(function MockQrCanvas(props, ref) {
      return <canvas ref={ref} />;
    }),
  };
});

test('downloads a PNG of the event QR', async () => {
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb) {
    cb(new Blob(['png'], { type: 'image/png' }));
  };

  const click = jest.fn();
  const originalCreate = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = originalCreate(tag);
    if (tag === 'a') el.click = click;
    return el;
  });
  global.URL.createObjectURL = jest.fn(() => 'blob:qr');
  global.URL.revokeObjectURL = jest.fn();

  render(
    <EventHostShareQrPanel
      eventUrl="http://localhost/e/ABC123/photobooth"
      event={{ code: 'ABC123' }}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Download QR' }));

  expect(click).toHaveBeenCalled();
  expect(click.mock.instances[0].download).toBe('photobothus-ABC123-qr.png');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qr');
});
