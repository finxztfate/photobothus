/**
 * Guest event pages — routes under /e/:code/*
 *
 * | Route                 | File              |
 * |-----------------------|-------------------|
 * | /e/:code              | EventPublic       |
 * | /e/:code/layouts      | EventLayouts      |
 * | /e/:code/photobooth   | EventPhotobooth   |
 *
 * Host dashboard lives under /events/* (see pages/events/host).
 */
export { default as EventGuestShell } from './EventGuestShell';
export { default as EventPublic } from './EventPublic';
export { default as EventLayouts } from './EventLayouts';
export { default as EventPhotobooth } from './EventPhotobooth';
