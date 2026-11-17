/**
 * Host (customer) event pages — routes under /events/*
 *
 * | Route              | File                    |
 * |--------------------|-------------------------|
 * | /events            | EventHostListPage       |
 * | /events/new        | EventHostCreatePage     |
 * | /events/:id        | EventHostDetailPage     |
 * | /events/:id/edit   | EventHostEditPage       |
 *
 * Guest flow lives under /e/:code/* (see pages/EventGuestShell.js).
 */
export { default as EventHostListPage } from './EventHostListPage';
export { default as EventHostDetailPage } from './EventHostDetailPage';
export { default as EventHostCreatePage } from './EventHostCreatePage';
export { default as EventHostEditPage } from './EventHostEditPage';
