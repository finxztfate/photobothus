import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import EventEditor from './EventEditor';

jest.mock('../../../utils/api', () => ({
  apiRequest: jest.fn(async () => ({
    event: {
      uploadsRemaining: 2,
      guestUploadCount: 1,
      maxGuestUploads: 3,
      stripsEnabled: true,
    },
  })),
  getEventGuestKey: () => 'guest-test-key',
  patchEventStrip: jest.fn(),
  patchHostStrip: jest.fn(),
  uploadStrip: jest.fn(),
}));

test('event guest editor has Done, not Download or Upload', () => {
  const photos = [{ id: 1, src: 'data:image/png;base64,aaa', filter: 'none' }];
  render(
    <MemoryRouter
      initialEntries={[{
        pathname: '/e/abc123/editor',
        state: { photos, layout: 1, stripId: 9, savedToEvent: true },
      }]}
    >
      <Routes>
        <Route path="/e/:code/editor" element={<EventEditor />} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Back to booth' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Upload$/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
});
