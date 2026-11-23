# Photobothus Project Conventions

## File Structure
```
src/
├── components/     # Reusable UI components (Camera.js)
├── hooks/          # Custom React hooks (useFaceDetection.js)
├── data/           # Static data and configurations (filterTemplates.js, photoboothData.js)
├── utils/          # Shared helpers (customization.js, eventLook.js, eventBoothSession.js)
├── pages/
│   ├── Home.js, Gallery.js, Photobooth.js, Layout.js, …
│   └── events/
│       ├── host/   # /events/* dashboard + strip look editor
│       └── guest/  # /e/:code/* landing, layouts, booth
├── App.js          # Main app with router
└── index.js        # Entry point
```

## Commands
- `npm start` - Development server
- `npm test` - Run tests
- `npm run build` - Production build
- `npm run eject` - Eject from CRA

## Testing
- Tests use React Testing Library
- Mocks for face-api and react-webcam are in setupTests.js
- API tests: `npm test` inside `server/` (Node's built-in test runner, no database needed; the MySQL stand-in is `server/test-support/fakeDb.js`)