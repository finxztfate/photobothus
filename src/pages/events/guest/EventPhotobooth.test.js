import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import EventPhotobooth from './EventPhotobooth';

jest.mock('../../../data/photoboothData', () => ({
  getAvailableCameras: () => Promise.resolve([]),
  getFilterFrame: () => null,
}));

jest.mock('../../../components/Camera', () => {
  const React = require('react');
  return React.forwardRef(function CameraMock() {
    return <div data-testid="camera" />;
  });
});

function GuestShell({ stripsEnabled = true }) {
  return <Outlet context={{ event: { stripsEnabled }, code: 'abc123' }} />;
}

function renderBooth({ stripsEnabled = true } = {}) {
  return render(
    <MemoryRouter initialEntries={['/e/abc123/photobooth']}>
      <Routes>
        <Route path="/e/:code" element={<GuestShell stripsEnabled={stripsEnabled} />}>
          <Route path="photobooth" element={<EventPhotobooth />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

test('event booth does not mention download', () => {
  renderBooth();
  expect(screen.getByText(/Photo 1 of/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
});

test('default strip layout takes 4 shots', () => {
  renderBooth();
  expect(screen.getByText('Photo 1 of 4')).toBeInTheDocument();
});
