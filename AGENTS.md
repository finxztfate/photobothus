# Photobothus Project Conventions

## File Structure
```
src/
├── components/     # Reusable UI components (Camera.js)
├── hooks/          # Custom React hooks (useFaceDetection.js)
├── data/           # Static data and configurations (filterTemplates.js, photoboothData.js)
├── utils/          # Utility functions (customization.js)
├── pages/          # Page/route components (Home.js, Gallery.js, Photobooth.js, Layout.js)
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